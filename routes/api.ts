import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

import express from 'express'
import type { Request, Response } from 'express'
import multer from 'multer'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import Lob from 'lob'
import type { LobLetter, LobLetterCreateOptions } from 'lob'
import Stripe from 'stripe'
import zipcodes from 'zipcodes'

import { calculateCost } from '../costs.ts'
import { buildTrackingEmail } from '../emails.ts'
import { env } from '../env.ts'
import type {
  Address,
  CheckoutRequest,
  CheckoutResponse,
  FinalizeRequest,
  HttpError,
  MailType,
  UploadResponse,
  VerifyAddressRequest,
  VerifyAddressResponse
} from '../types.ts'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

const PAGE_LIMIT = 60

const LobTest = new Lob(env.lobApiKeyTest)
const LobLive = new Lob(env.lobApiKey)
const stripeTest = new Stripe(env.stripeApiKeyTest)
const stripeLive = new Stripe(env.stripeApiKey)

/**
 * Whether Amazon SES credentials are configured. Credentials and region are
 * read from the standard AWS environment variables.
 * @returns true when all required SES credentials are present
 */
const isEmailConfigured = (): boolean =>
  Boolean(env.awsRegion && env.awsAccessKeyId && env.awsSecretAccessKey)

let sesClient: SESv2Client | undefined
/**
 * Lazily construct the SES client so the server can start without AWS
 * configuration (e.g. when only email sending is disabled).
 * @returns the shared SES client
 */
const getSesClient = (): SESv2Client => {
  if (!sesClient) {
    sesClient = new SESv2Client({ region: env.awsRegion })
  }
  return sesClient
}

const router = express.Router()

const upload = multer({
  dest: UPLOAD_DIR,
  fileFilter: (_req, file, cb) => {
    // The function should call `cb` with a boolean
    // to indicate if the file should be accepted
    cb(null, file.mimetype === 'application/pdf')
  }
})

/**
 * Create an Error carrying an HTTP status code so the global error handler
 * can respond with the appropriate status and message.
 * @param status HTTP status code
 * @param message error message
 * @returns the error with status attached
 */
const httpError = (status: number, message: string): HttpError =>
  Object.assign(new Error(message), { status })

/**
 * Resolve the path of the resized PDF on disk for a given upload uid.
 * @param uid upload identifier assigned by multer
 * @returns absolute path to the resized PDF
 */
const pdfPath = (uid: string): string => path.join(UPLOAD_DIR, `${uid}.pdf`)

/**
 * Narrow a Stripe/Lob metadata value to a known mailing type.
 * @param value metadata value to check
 * @returns true when the value is a valid mail type
 */
const isMailType = (value: string | undefined): value is MailType =>
  value === 'noUpgrade' || value === 'registered' || value === 'certified'

/**
 * Read the `status_code` (Lob) property off an unknown thrown value.
 * @param err caught value
 * @returns the status code when present
 */
const statusCodeOf = (err: unknown): number | undefined => {
  if (typeof err === 'object' && err !== null && 'status_code' in err) {
    const code = (err as { status_code?: unknown }).status_code
    return typeof code === 'number' ? code : undefined
  }
  return undefined
}

router.post('/upload', upload.single('pdf'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res
      .status(400)
      .send({ error: "That file doesn't look like a PDF. Please try again with a PDF document." })
  }
  // PDF saved to filesystem, accessible via `req.file`

  // check page limit: http://stackoverflow.com/a/4829240/2487925
  const numPages = await countPages(req.file.path)

  if (numPages > PAGE_LIMIT) {
    return res.status(400).send({
      error: `PDF over ${PAGE_LIMIT}-page limit. Please try again with a shorter document.`
    })
  }

  // Resize pages to 8.5" x 11" dimensions
  await resizePdf(req.file.path)

  const body: UploadResponse = {
    filename: req.file.originalname,
    uid: req.file.filename,
    url: uidToUrl(req.file.filename),
    numPages: numPages
  }
  res.json(body)
})

router.post('/verify_address', async (req: Request, res: Response) => {
  const address: VerifyAddressRequest = req.body

  // call lob address verification api
  const verification = await LobLive.usVerifications.verify({
    recipient: address.name,
    primary_line: address.line1,
    secondary_line: address.line2,
    city: address.city,
    state: address.state,
    zip_code: address.zip
  })

  // the client treats `error === false` as a successful verification and
  // anything truthy as a message to display
  const deliverable = verification.deliverability === 'deliverable'
  const body: VerifyAddressResponse = {
    error: deliverable ? false : 'We could not verify this address. Please double-check it.',
    deliverability: verification.deliverability
  }
  res.json(body)
})

router.post('/checkout', async (req: Request, res: Response) => {
  const {
    demo,
    uid,
    numPages,
    mailType,
    returnEnvelope,
    cost,
    fromAddress,
    toAddress,
    email
  }: CheckoutRequest = req.body

  if (
    !(uid && numPages && mailType && cost && fromAddress && toAddress && email) ||
    typeof returnEnvelope !== 'boolean' ||
    typeof demo !== 'boolean'
  ) {
    return res.status(400).send({
      error:
        'Missing at least one of the following required parameters in the request body: "uid", "numPages", "mailType", "returnEnvelope", "cost", "fromAddress", "toAddress", "email".'
    })
  }

  // IMPORTANT: use the correct live or demo API keys depending on `demo`
  // request parameter
  const stripe = demo ? stripeTest : stripeLive

  if (!isMailType(mailType)) {
    return res.status(400).send({
      error: `Invalid mail type "${mailType}" specified. Valid options are "noUpgrade", "registered", and "certified".`
    })
  }

  // count pages to ensure number matches req.body.numPages; abort with 400 otherwise
  const numPagesOnDisk = await countPages(pdfPath(uid))
  if (numPages !== numPagesOnDisk) {
    return res.status(400).send({
      error: `Number of PDF pages used for price calculation (${numPages}) does not equal number of PDF pages of uploaded file (${numPagesOnDisk}).`
    })
  }

  // CRITICAL: ensure the charge the user has authorized on the frontend
  // (or explicitly set in the request if the user is malicious) matches
  // the cost we calculate server-side.
  const calculatedCost = calculateCost({ numPages, mailType, returnEnvelope })
  if (cost !== calculatedCost) {
    return res.status(400).send({
      error: `Price total authorized (${cost}) does not equal the calculated cost (${calculatedCost}). Transaction aborted. Your card has not been charged.`
    })
  }

  const description = buildDescription({ numPages, toAddress, returnEnvelope, mailType })

  // create a PaymentIntent that authorizes the card but DOES NOT capture it
  // yet. Capture happens in /finalize only after the Lob API request has
  // successfully returned.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: calculatedCost, // IMPORTANT: amount in number of cents

    // frontend locale is explicitly set to 'en', so all charges should be
    // displayed as USD
    currency: 'usd',

    // IMPORTANT: do not capture the charge until the Lob API request has
    // successfully returned
    capture_method: 'manual',

    payment_method_types: ['card'],

    receipt_email: email,

    metadata: {
      email: email,
      uid: uid,
      numPages: String(numPages),
      mailType: mailType,
      returnEnvelope: String(returnEnvelope),
      from_name: fromAddress.name || '',
      from_line1: fromAddress.line1 || '',
      from_line2: fromAddress.line2 || '',
      from_city: fromAddress.city || '',
      from_state: fromAddress.state || '',
      from_zip: fromAddress.zip || '',
      to_name: toAddress.name || '',
      to_line1: toAddress.line1 || '',
      to_line2: toAddress.line2 || '',
      to_city: toAddress.city || '',
      to_state: toAddress.state || '',
      to_zip: toAddress.zip || ''
    },
    description: description
  })

  const body: CheckoutResponse = {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id
  }
  res.json(body)
})

router.post('/finalize', async (req: Request, res: Response) => {
  const { demo, paymentIntentId }: FinalizeRequest = req.body

  if (!paymentIntentId || typeof demo !== 'boolean') {
    return res.status(400).send({
      error:
        'Missing at least one of the following required parameters in the request body: "paymentIntentId", "demo".'
    })
  }

  // IMPORTANT: use the correct live or demo API keys depending on `demo`
  // request parameter
  const stripe = demo ? stripeTest : stripeLive
  const lob = demo ? LobTest : LobLive

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  // the card must be authorized (but not yet captured) before we mail anything
  if (paymentIntent.status !== 'requires_capture') {
    return res.status(400).send({
      error: `Payment is not ready to be captured (status: "${paymentIntent.status}"). Your card has not been charged.`
    })
  }

  // all order details were stored in the PaymentIntent metadata by /checkout,
  // which is authoritative because the client cannot modify it
  const metadata = paymentIntent.metadata
  const uid = metadata.uid ?? ''
  const numPages = parseInt(metadata.numPages ?? '', 10)
  const rawMailType = metadata.mailType
  const returnEnvelope = metadata.returnEnvelope === 'true'
  const email = metadata.email ?? ''

  if (!isMailType(rawMailType)) {
    return res.status(400).send({
      error: `Invalid mail type "${rawMailType}" stored on the payment. Transaction aborted. Your card has not been charged.`
    })
  }
  const mailType: MailType = rawMailType

  // count pages to ensure number matches the amount authorized; abort with 400 otherwise
  const numPagesOnDisk = await countPages(pdfPath(uid))
  if (numPages !== numPagesOnDisk) {
    return res.status(400).send({
      error: `Number of PDF pages used for price calculation (${numPages}) does not equal number of PDF pages of uploaded file (${numPagesOnDisk}).`
    })
  }

  // CRITICAL: ensure the amount the user has authorized matches the cost we
  // calculate server-side.
  const calculatedCost = calculateCost({ numPages, mailType, returnEnvelope })
  if (paymentIntent.amount !== calculatedCost) {
    return res.status(400).send({
      error: `Price total authorized (${paymentIntent.amount}) does not equal the calculated cost (${calculatedCost}). Transaction aborted. Your card has not been charged.`
    })
  }

  let extraService: 'registered' | 'certified' | false
  if (mailType === 'registered') {
    extraService = 'registered'
  } else if (mailType === 'certified') {
    extraService = 'certified'
  } else {
    extraService = false // otherwise type is "noUpgrade"
  }

  const fromAddress: Address = {
    name: metadata.from_name ?? '',
    line1: metadata.from_line1 ?? '',
    line2: metadata.from_line2 ?? '',
    city: metadata.from_city ?? '',
    state: metadata.from_state ?? '',
    zip: metadata.from_zip ?? ''
  }
  const toAddress: Address = {
    name: metadata.to_name ?? '',
    line1: metadata.to_line1 ?? '',
    line2: metadata.to_line2 ?? '',
    city: metadata.to_city ?? '',
    state: metadata.to_state ?? '',
    zip: metadata.to_zip ?? ''
  }

  // call lob api to send letter
  // https://lob.com/docs#letters_create
  const letterOptions: LobLetterCreateOptions = {
    from: {
      name: fromAddress.name || '',
      address_line1: fromAddress.line1 || '',
      address_line2: fromAddress.line2 || '',
      address_city: fromAddress.city || '',
      address_state: fromAddress.state || '',
      address_zip: fromAddress.zip || '',
      address_country: 'US'
    },
    to: {
      name: toAddress.name || '',
      address_line1: toAddress.line1 || '',
      address_line2: toAddress.line2 || '',
      address_city: toAddress.city || '',
      address_state: toAddress.state || '',
      address_zip: toAddress.zip || '',
      address_country: 'US'
    },
    file: await fs.promises.readFile(pdfPath(uid)),
    color: false,
    double_sided: false,
    address_placement: 'insert_blank_page',
    return_envelope: returnEnvelope,
    // required by Lob; these are user-initiated, non-promotional mailpieces
    use_type: 'operational',
    // attach order information to the letter for later reference
    metadata: {
      email: email,
      cost: String(paymentIntent.amount),
      numPages: String(numPages),
      chargeId: paymentIntent.id
    }
  }
  if (returnEnvelope) {
    letterOptions.perforated_page = 1
  }
  if (extraService) {
    letterOptions.extra_service = extraService
  }

  let lobRes: LobLetter
  try {
    lobRes = await lob.letters.create(letterOptions)
  } catch (err) {
    console.error('error creating lob letter', err)
    if (statusCodeOf(err) === 422) {
      // bad request
      await emailAdmin(
        '[MailAPDF.Online] Error creating Lob letter (bad request)',
        serializeError(err)
      )
      return res.status(400).send({
        error: `Error mailing PDF. ${errorMessageOf(err)} Your card has not been charged.`
      })
    } else {
      await emailAdmin('[MailAPDF.Online] Error creating Lob letter', serializeError(err))
      return res.status(500).send({
        error:
          'Internal error mailing your document. Your card has not been charged, and your document has not been sent. An administrator has been notified.'
      })
    }
  }

  // successfully mailed! now charge the customer
  let charge
  try {
    charge = await stripe.paymentIntents.capture(paymentIntent.id)
  } catch (err) {
    // WARNING, BAD THINGS ARE HAPPENING: we were charged for
    // using the Lob API but were unable to capture a charge from
    // the user. This could be a programming error or a malicious
    // user.
    console.error('ERROR CAPTURING CHARGE FROM CUSTOMER', err)
    await emailAdmin(
      '[MailAPDF.Online] WARNING IMMEDIATE ACTION REQUIRED: Error capturing charge from customer',
      serializeError(err)
    )
    return res
      .status(500)
      .send({ error: 'Error charging your credit card. An administrator has been notified.' })
  }

  // it is finished!
  console.log(charge)
  // send a success response with no content
  res.status(204).send()
  // email user with tracking link or number
  if (extraService) {
    await emailTracking(email, toAddress, lobRes.tracking_number ?? '', true, demo)
  } else {
    await emailTracking(email, toAddress, lobRes.id, false, demo)
  }
})

router.get('/track/:trackingNumber', async (req: Request, res: Response) => {
  const trackingNumber = String(req.params.trackingNumber)
  // IMPORTANT: use Lob's test/sandbox environment when "demo" is present in
  // the query string, so tracking works for demo-mode letters. The link in the
  // confirmation email carries this param.
  const demo = req.query.demo !== undefined
  const lob = demo ? LobTest : LobLive
  let letter: LobLetter
  try {
    letter = await lob.letters.retrieve(trackingNumber)
  } catch (err) {
    if (statusCodeOf(err) === 404) {
      return res.render('tracking.mustache', { notFound: true, id: trackingNumber })
    }
    throw err
  }

  /*
  // dummy tracking events for testing
  letter.tracking_events = [
    {
      "id": "evnt_9e84094c9368cfb",
      "name": "In Local Area",
      "location": "72231",
      "time": "2016-06-30T15:51:41.000Z",
      "date_created": "2016-06-30T17:41:59.771Z",
      "date_modified": "2016-06-30T17:41:59.771Z",
      "object": "tracking_event"
    },
    {
      "id": "evnt_9e84094c9368cfb",
      "name": "In Transit",
      "location": "90024",
      "time": "2016-06-28T15:51:41.000Z",
      "date_created": "2016-06-30T17:41:59.771Z",
      "date_modified": "2016-06-30T17:41:59.771Z",
      "object": "tracking_event"
    }
  ];
  */
  if (letter.date_created) {
    letter.date_created = formatDate(letter.date_created)
  }
  if (letter.date_modified) {
    letter.date_modified = formatDate(letter.date_modified)
  }
  if (letter.expected_delivery_date) {
    letter.expected_delivery_date = formatDate(letter.expected_delivery_date)
  }
  letter.tracking_events = (letter.tracking_events || [])
    .sort((a, b) => new Date(b.time ?? '').getTime() - new Date(a.time ?? '').getTime()) // most recent first
    .map(event => {
      if (event.time) {
        event.time = formatDate(event.time, { includeTime: true })
      }
      const location = event.location ? zipcodes.lookup(event.location) : undefined
      event.location = location ? [location.city, location.state].join(', ') : event.location
      return event
    })
  res.render('tracking.mustache', letter)
})

/**
 * Count the number of pages in a PDF using Ghostscript.
 * @param pdf path to the PDF file
 * @returns number of pages
 */
async function countPages(pdf: string): Promise<number> {
  let stdout: string
  try {
    ;({ stdout } = await execFileAsync('gs', [
      '-q',
      '-dNODISPLAY',
      // Ghostscript 9.50+ enables SAFER by default, which blocks the
      // PostScript `file` operator below from reading the PDF. Grant read
      // access to just this file rather than disabling the sandbox entirely.
      `--permit-file-read=${pdf}`,
      '-c',
      `(${pdf}) (r) file runpdfbegin pdfpagecount = quit`
    ]))
  } catch (err) {
    console.error(err, stderrOf(err))
    throw httpError(
      400,
      'Unable to process PDF. Please check that you have uploaded a valid PDF document.'
    )
  }
  // split by newlines, filter out empty lines
  const stdoutLines = stdout.split('\n').filter(line => {
    return line.length
  })
  // ghostscript will sometimes print warnings on previous lines that we
  // can't seem to suppress
  const lastLine = stdoutLines[stdoutLines.length - 1] ?? ''
  const numPages = parseInt(lastLine)
  if (isNaN(numPages)) {
    await emailAdmin('[MailAPDF.Online] Error parsing Ghostscript output', stdout)
    throw httpError(500, 'Internal server error.')
  }
  return numPages
}

/**
 * Resize pages to 8.5" x 11" dimensions.
 * This absolute monstrosity is an effort of hours of googling, and is
 * comprised of code and docs from the following sources:
 * 1. http://stackoverflow.com/a/7507511/2487925
 * 2. http://stackoverflow.com/a/26989410
 * 3. http://www.ghostscript.com/doc/9.04/Use.htm#Known_paper_sizes
 * 4. http://ghostscript.com/pipermail/gs-devel/2008-May/007776.html
 * It resizes PDF pages to 8.5"x11" (cf. #1, #3) (equivalent to 612x792
 * points), rotates landscape images to portrait (cf. #4), and fixes
 * CropBox/MediaBox that causes incorrect dimensions for some PDFs,
 * particularly scanned ones (cf. #2).
 * Uploaded PDF is a random filename assigned by multer; resized PDF has
 * the same filename prefix but with '.pdf' appended.
 * @param pdf path to the PDF file
 */
async function resizePdf(pdf: string): Promise<void> {
  try {
    await execFileAsync('gs', [
      '-q',
      '-dNOPAUSE',
      '-dBATCH',
      '-dFIXEDMEDIA',
      '-dPDFFitPage',
      '-dAutoRotatePages=/PageByPage',
      '-sDEVICE=pdfwrite',
      '-sPAPERSIZE=letter',
      `-sOutputFile=${pdf}.pdf`,
      '-c',
      '<</EndPage {0 eq {[/CropBox [0 0 612 792] /PAGE pdfmark true}{false}ifelse}>> setpagedevice',
      '-f',
      pdf
    ])
  } catch (err) {
    console.error(err, stderrOf(err))
    throw httpError(
      400,
      'Unable to process PDF. Please check that you have uploaded a valid PDF document.'
    )
  }
}

/**
 * Build a human-readable Stripe charge description for an order.
 * @param order order details to describe
 * @returns the charge description
 */
function buildDescription({
  numPages,
  toAddress,
  returnEnvelope,
  mailType
}: {
  numPages: number
  toAddress: Address
  returnEnvelope: boolean
  mailType: MailType
}): string {
  let description = `Mailing a ${numPages}-page PDF to ${toAddress.line1}`
  if (returnEnvelope) {
    description += ' with a return envelope'
  }
  if (mailType === 'registered') {
    description += ' via registered mail'
  } else if (mailType === 'certified') {
    description += ' via certified mail'
  }
  return description
}

/**
 * Resolve the public URL for a processed upload.
 * @param uid upload identifier assigned by multer
 * @returns URL path
 */
function uidToUrl(uid: string): string {
  return `/uploads/${uid}.pdf`
}

/**
 * Format a date (or date string) like "Monday, January 1st", optionally
 * prefixed with the time like "3:45 PM Monday, January 1st".
 * @param date value to format
 * @param options set `includeTime` to prefix the time
 * @returns the formatted date
 */
function formatDate(
  date: Date | string,
  { includeTime = false }: { includeTime?: boolean } = {}
): string {
  const parsed = new Date(date)
  const datePart = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long' }).format(
    parsed
  )
  const day = parsed.getDate()
  const formatted = `${datePart} ${day}${ordinalSuffix(day)}`
  if (!includeTime) {
    return formatted
  }
  const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    parsed
  )
  return `${timePart} ${formatted}`
}

/**
 * Get the English ordinal suffix for a number (1 -> "st", 2 -> "nd", etc.).
 * @param n the number to suffix
 * @returns the ordinal suffix
 */
function ordinalSuffix(n: number): string {
  const suffixes: readonly string[] = ['th', 'st', 'nd', 'rd']
  const value = n % 100
  return suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0] ?? 'th'
}

/** Extra fields present on errors thrown by the Lob and Stripe SDKs. */
interface SdkErrorFields {
  status_code?: number
  statusCode?: number
  code?: string
  type?: string
  requestId?: string
  stderr?: string
  message?: string
  _response?: { status?: number; statusText?: string; data?: unknown }
  response?: { status?: number; statusText?: string; data?: unknown }
}

/**
 * Read a human-readable message off an unknown thrown value.
 * @param err caught value
 * @returns the error message, if any
 */
function errorMessageOf(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  return String(err)
}

/**
 * Read the `stderr` property off an unknown thrown value.
 * @param err caught value
 * @returns the stderr output, if any
 */
function stderrOf(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'stderr' in err) {
    const stderr = (err as SdkErrorFields).stderr
    return typeof stderr === 'string' ? stderr : undefined
  }
  return undefined
}

/**
 * Serialize an error for logging or emailing. Error objects returned by SDKs
 * like Lob and Stripe contain circular references (request/response sockets),
 * so a plain `JSON.stringify` throws. Extract only the useful fields instead.
 * @param err error to serialize
 * @returns pretty-printed JSON representation of the error
 */
function serializeError(err: unknown): string {
  if (!(err instanceof Error)) {
    try {
      return JSON.stringify(err, null, 2)
    } catch {
      return String(err)
    }
  }

  const sdkErr: SdkErrorFields = err
  const details: Record<string, unknown> = {
    name: err.name,
    message: err.message,
    stack: err.stack,
    status_code: sdkErr.status_code,
    statusCode: sdkErr.statusCode,
    code: sdkErr.code,
    type: sdkErr.type,
    requestId: sdkErr.requestId
  }

  const response = sdkErr._response ?? sdkErr.response
  if (response) {
    details.response = {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    }
  }

  return JSON.stringify(
    details,
    (_key, value) => {
      if (typeof value === 'bigint') {
        return value.toString()
      }
      return value
    },
    2
  )
}

/**
 * Email an administrator. Errors are logged rather than thrown so callers can
 * continue responding to the user.
 * @param subject email subject
 * @param body email body
 */
async function emailAdmin(subject: string, body: string): Promise<void> {
  if (!isEmailConfigured() || !env.adminEmail) {
    console.error('AWS SES is not configured; skipping admin email:', subject)
    return
  }

  try {
    await getSesClient().send(
      new SendEmailCommand({
        FromEmailAddress: 'admin_alerts@mailpdf.online',
        Destination: {
          ToAddresses: [env.adminEmail]
        },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: body, Charset: 'UTF-8' }
            }
          }
        }
      })
    )
  } catch (err) {
    console.error(err)
  }
}

/**
 * Email a customer their tracking information.
 * @param email recipient email address
 * @param toAddress destination address
 * @param trackingNumber Lob letter id or USPS tracking number
 * @param uspsTracking whether the tracking number is a USPS number
 * @param demo whether the letter was created in Lob's test/sandbox mode, in
 * which case the tracking link includes a "demo" query param
 */
async function emailTracking(
  email: string,
  toAddress: Address,
  trackingNumber: string,
  uspsTracking: boolean,
  demo: boolean
): Promise<void> {
  const trackUrl = uspsTracking
    ? `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`
    : `https://mailpdf.online/track/${trackingNumber}${demo ? '?demo' : ''}`
  const { subject, text, html } = buildTrackingEmail({
    toAddress,
    trackingNumber,
    trackUrl,
    uspsTracking
  })

  if (!isEmailConfigured()) {
    console.error('AWS SES is not configured; skipping tracking email to', email)
    return
  }

  try {
    await getSesClient().send(
      new SendEmailCommand({
        FromEmailAddress: 'order@mailpdf.online',
        Destination: {
          ToAddresses: [email]
        },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: text, Charset: 'UTF-8' },
              Html: { Data: html, Charset: 'UTF-8' }
            }
          }
        }
      })
    )
  } catch (err) {
    console.error(err)
  }
}

export default router
