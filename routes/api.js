import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

import express from 'express'
import multer from 'multer'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import Lob from 'lob'
import Stripe from 'stripe'
import zipcodes from 'zipcodes'

import { calculateCost } from '../costs.js'
import { buildTrackingEmail } from '../emails.js'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

const PAGE_LIMIT = 60

const LobTest = new Lob(process.env.LOB_API_KEY_TEST)
const LobLive = new Lob(process.env.LOB_API_KEY)
const stripeTest = new Stripe(process.env.STRIPE_API_KEY_TEST)
const stripeLive = new Stripe(process.env.STRIPE_API_KEY)

/**
 * Whether Amazon SES credentials are configured. Credentials and region are
 * read from the standard AWS environment variables.
 * @returns {boolean}
 */
const isEmailConfigured = () => Boolean(
  process.env.AWS_REGION &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY
)

let sesClient
/**
 * Lazily construct the SES client so the server can start without AWS
 * configuration (e.g. when only email sending is disabled).
 * @returns {SESv2Client}
 */
const getSesClient = () => {
  if (!sesClient) {
    sesClient = new SESv2Client({ region: process.env.AWS_REGION })
  }
  return sesClient
}

const router = express.Router()

const upload = multer({
  dest: UPLOAD_DIR,
  fileFilter: (req, file, cb) => {
    // The function should call `cb` with a boolean
    // to indicate if the file should be accepted
    cb(null, file.mimetype === 'application/pdf')
  }
})

/**
 * Create an Error carrying an HTTP status code so the global error handler
 * can respond with the appropriate status and message.
 * @param {number} status HTTP status code
 * @param {string} message error message
 * @returns {Error}
 */
const httpError = (status, message) => Object.assign(new Error(message), { status })

/**
 * Resolve the path of the resized PDF on disk for a given upload uid.
 * @param {string} uid upload identifier assigned by multer
 * @returns {string} absolute path to the resized PDF
 */
const pdfPath = uid => path.join(UPLOAD_DIR, `${uid}.pdf`)

router.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: 'That file doesn\'t look like a PDF. Please try again with a PDF document.' })
  }
  // PDF saved to filesystem, accessible via `req.file`

  // check page limit: http://stackoverflow.com/a/4829240/2487925
  const numPages = await countPages(req.file.path)

  if (numPages > PAGE_LIMIT) {
    return res.status(400).send({ error: `PDF over ${PAGE_LIMIT}-page limit. Please try again with a shorter document.` })
  }

  // Resize pages to 8.5" x 11" dimensions
  await resizePdf(req.file.path)

  res.json({
    filename: req.file.originalname,
    uid: req.file.filename,
    url: uidToUrl(req.file.filename),
    numPages: numPages
  })
})

router.post('/verify_address', async (req, res) => {
  // call lob address verification api
  const verification = await LobLive.usVerifications.verify({
    recipient: req.body.name,
    primary_line: req.body.line1,
    secondary_line: req.body.line2,
    city: req.body.city,
    state: req.body.state,
    zip_code: req.body.zip
  })

  // the client treats `error === false` as a successful verification and
  // anything truthy as a message to display
  const deliverable = verification.deliverability === 'deliverable'
  res.json({
    error: deliverable ? false : 'We could not verify this address. Please double-check it.',
    deliverability: verification.deliverability
  })
})

router.post('/checkout', async (req, res) => {
  const demo = req.body.demo
  const uid = req.body.uid
  const numPages = req.body.numPages
  const mailType = req.body.mailType
  const returnEnvelope = req.body.returnEnvelope
  const cost = req.body.cost
  const fromAddress = req.body.fromAddress
  const toAddress = req.body.toAddress
  const email = req.body.email

  if (!(uid && numPages && mailType && cost && fromAddress && toAddress && email) ||
      typeof returnEnvelope !== 'boolean' || typeof demo !== 'boolean') {
    return res.status(400).send({ error: 'Missing at least one of the following required parameters in the request body: "uid", "numPages", "mailType", "returnEnvelope", "cost", "fromAddress", "toAddress", "email".' })
  }

  // IMPORTANT: use the correct live or demo API keys depending on `demo`
  // request parameter
  const stripe = demo ? stripeTest : stripeLive

  if (!(mailType === 'noUpgrade' || mailType === 'registered' || mailType === 'certified')) {
    return res.status(400).send({ error: `Invalid mail type "${mailType}" specified. Valid options are "noUpgrade", "registered", and "certified".` })
  }

  // count pages to ensure number matches req.body.numPages; abort with 400 otherwise
  const numPagesOnDisk = await countPages(pdfPath(uid))
  if (numPages !== numPagesOnDisk) {
    return res.status(400).send({ error: `Number of PDF pages used for price calculation (${numPages}) does not equal number of PDF pages of uploaded file (${numPagesOnDisk}).` })
  }

  // CRITICAL: ensure the charge the user has authorized on the frontend
  // (or explicitly set in the request if the user is malicious) matches
  // the cost we calculate server-side.
  const calculatedCost = calculateCost({ numPages, mailType, returnEnvelope })
  if (cost !== calculatedCost) {
    return res.status(400).send({ error: `Price total authorized (${cost}) does not equal the calculated cost (${calculatedCost}). Transaction aborted. Your card has not been charged.` })
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

  res.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id
  })
})

router.post('/finalize', async (req, res) => {
  const demo = req.body.demo
  const paymentIntentId = req.body.paymentIntentId

  if (!paymentIntentId || typeof demo !== 'boolean') {
    return res.status(400).send({ error: 'Missing at least one of the following required parameters in the request body: "paymentIntentId", "demo".' })
  }

  // IMPORTANT: use the correct live or demo API keys depending on `demo`
  // request parameter
  const stripe = demo ? stripeTest : stripeLive
  const lob = demo ? LobTest : LobLive

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  // the card must be authorized (but not yet captured) before we mail anything
  if (paymentIntent.status !== 'requires_capture') {
    return res.status(400).send({ error: `Payment is not ready to be captured (status: "${paymentIntent.status}"). Your card has not been charged.` })
  }

  // all order details were stored in the PaymentIntent metadata by /checkout,
  // which is authoritative because the client cannot modify it
  const metadata = paymentIntent.metadata
  const uid = metadata.uid
  const numPages = parseInt(metadata.numPages, 10)
  const mailType = metadata.mailType
  const returnEnvelope = metadata.returnEnvelope === 'true'
  const email = metadata.email

  // count pages to ensure number matches the amount authorized; abort with 400 otherwise
  const numPagesOnDisk = await countPages(pdfPath(uid))
  if (numPages !== numPagesOnDisk) {
    return res.status(400).send({ error: `Number of PDF pages used for price calculation (${numPages}) does not equal number of PDF pages of uploaded file (${numPagesOnDisk}).` })
  }

  // CRITICAL: ensure the amount the user has authorized matches the cost we
  // calculate server-side.
  const calculatedCost = calculateCost({ numPages, mailType, returnEnvelope })
  if (paymentIntent.amount !== calculatedCost) {
    return res.status(400).send({ error: `Price total authorized (${paymentIntent.amount}) does not equal the calculated cost (${calculatedCost}). Transaction aborted. Your card has not been charged.` })
  }

  let extraService
  if (mailType === 'registered') {
    extraService = 'registered'
  }
  else if (mailType === 'certified') {
    extraService = 'certified'
  }
  else {
    extraService = false // otherwise type is "noUpgrade"
  }

  const fromAddress = {
    name: metadata.from_name,
    line1: metadata.from_line1,
    line2: metadata.from_line2,
    city: metadata.from_city,
    state: metadata.from_state,
    zip: metadata.from_zip
  }
  const toAddress = {
    name: metadata.to_name,
    line1: metadata.to_line1,
    line2: metadata.to_line2,
    city: metadata.to_city,
    state: metadata.to_state,
    zip: metadata.to_zip
  }

  // call lob api to send letter
  // https://lob.com/docs#letters_create
  const letterOptions = {
    from: {
      name: fromAddress.name || '',
      address_line1: fromAddress.line1  || '',
      address_line2: fromAddress.line2 || '',
      address_city: fromAddress.city  || '',
      address_state: fromAddress.state  || '',
      address_zip: fromAddress.zip  || '',
      address_country: 'US',
    },
    to: {
      name: toAddress.name || '',
      address_line1: toAddress.line1 || '',
      address_line2: toAddress.line2 || '',
      address_city: toAddress.city || '',
      address_state: toAddress.state || '',
      address_zip: toAddress.zip || '',
      address_country: 'US',
    },
    file: await fs.promises.readFile(pdfPath(uid)),
    color: false,
    double_sided: false,
    address_placement: 'insert_blank_page',
    return_envelope: returnEnvelope,
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

  let lobRes
  try {
    lobRes = await lob.letters.create(letterOptions)
  }
  catch (err) {
    console.error('error creating lob letter', err)
    if (err.status_code === 422) { // bad request
      await emailAdmin('[MailAPDF.Online] Error creating Lob letter (bad request)', JSON.stringify(err, null, 2))
      return res.status(400).send({ error: `Error mailing PDF. ${err.message} Your card has not been charged.` })
    }
    else {
      await emailAdmin('[MailAPDF.Online] Error creating Lob letter', JSON.stringify(err, null, 2))
      return res.status(500).send({ error: 'Internal error mailing your document. Your card has not been charged, and your document has not been sent. An administrator has been notified.' })
    }
  }

  // successfully mailed! now charge the customer
  let charge
  try {
    charge = await stripe.paymentIntents.capture(paymentIntent.id)
  }
  catch (err) {
    // WARNING, BAD THINGS ARE HAPPENING: we were charged for
    // using the Lob API but were unable to capture a charge from
    // the user. This could be a programming error or a malicious
    // user.
    console.error('ERROR CAPTURING CHARGE FROM CUSTOMER', err)
    await emailAdmin('[MailAPDF.Online] WARNING IMMEDIATE ACTION REQUIRED: Error capturing charge from customer', JSON.stringify(err, null, 2))
    return res.status(500).send({ error: 'Error charging your credit card. An administrator has been notified.' })
  }

  // it is finished!
  console.log(charge)
  // send a success response with no content
  res.status(204).send()
  // email user with tracking link or number
  if (extraService) {
    await emailTracking(email, toAddress.line1, lobRes.tracking_number, true)
  }
  else {
    await emailTracking(email, toAddress.line1, lobRes.id, false)
  }
})

router.get('/track/:trackingNumber', async (req, res) => {
  let letter
  try {
    letter = await LobLive.letters.retrieve(req.params.trackingNumber)
  }
  catch (err) {
    if (err.status_code === 404) {
      return res.render('tracking.mustache', { notFound: true, id: req.params.trackingNumber })
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
  .sort((a, b) => new Date(b.time) - new Date(a.time)) // most recent first
  .map(event => {
    event.time = formatDate(event.time, { includeTime: true })
    const location = zipcodes.lookup(event.location)
    event.location = location ? [location.city, location.state].join(', ') : event.location
    return event
  })
  res.render('tracking.mustache', letter)
})

/**
 * Count the number of pages in a PDF using Ghostscript.
 * @param {string} pdf path to the PDF file
 * @returns {Promise<number>} number of pages
 */
async function countPages(pdf) {
  let stdout
  try {
    ({ stdout } = await execFileAsync('gs', [
      '-q',
      '-dNODISPLAY',
      '-c',
      `(${pdf}) (r) file runpdfbegin pdfpagecount = quit`
    ]))
  }
  catch (err) {
    console.error(err, err.stderr)
    throw httpError(400, 'Unable to process PDF. Please check that you have uploaded a valid PDF document.')
  }
  // split by newlines, filter out empty lines
  const stdoutLines = stdout.split('\n').filter(line => { return line.length })
  // ghostscript will sometimes print warnings on previous lines that we
  // can't seem to suppress
  const numPages = parseInt(stdoutLines[stdoutLines.length-1])
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
 * @param {string} pdf path to the PDF file
 * @returns {Promise<void>}
 */
async function resizePdf(pdf) {
  try {
    await execFileAsync('gs', [
      '-q',
      '-dNOPAUSE',
      '-dBATCH',
      '-dFIXEDMEDIA',
      '-dPDFFitPage',
      '-dAutoRotatePages',
      '-sDEVICE=pdfwrite',
      '-sPAPERSIZE=letter',
      `-sOutputFile=${pdf}.pdf`,
      '-c',
      '<</EndPage {0 eq {[/CropBox [0 0 612 792] /PAGE pdfmark true}{false}ifelse}>> setpagedevice',
      '-f',
      pdf
    ])
  }
  catch (err) {
    console.error(err, err.stderr)
    throw httpError(400, 'Unable to process PDF. Please check that you have uploaded a valid PDF document.')
  }
}

/**
 * Build a human-readable Stripe charge description for an order.
 * @param {{numPages: number, toAddress: object, returnEnvelope: boolean, mailType: string}} order
 * @returns {string}
 */
function buildDescription({ numPages, toAddress, returnEnvelope, mailType }) {
  let description = `Mailing a ${numPages}-page PDF to ${toAddress.line1}`
  if (returnEnvelope) {
    description += ' with a return envelope'
  }
  if (mailType === 'registered') {
    description += ' via registered mail'
  }
  else if (mailType === 'certified') {
    description += ' via certified mail'
  }
  return description
}

/**
 * Resolve the public URL for a processed upload.
 * @param {string} uid upload identifier assigned by multer
 * @returns {string} URL path
 */
function uidToUrl(uid) {
  return `/uploads/${uid}.pdf`
}

/**
 * Format a date (or date string) like "Monday, January 1st", optionally
 * prefixed with the time like "3:45 PM Monday, January 1st".
 * @param {Date|string} date value to format
 * @param {{includeTime?: boolean}} [options]
 * @returns {string}
 */
function formatDate(date, { includeTime = false } = {}) {
  const parsed = new Date(date)
  const datePart = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long' }).format(parsed)
  const day = parsed.getDate()
  const formatted = `${datePart} ${day}${ordinalSuffix(day)}`
  if (!includeTime) {
    return formatted
  }
  const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(parsed)
  return `${timePart} ${formatted}`
}

/**
 * Get the English ordinal suffix for a number (1 -> "st", 2 -> "nd", etc.).
 * @param {number} n
 * @returns {string}
 */
function ordinalSuffix(n) {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const value = n % 100
  return suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]
}

/**
 * Email an administrator. Errors are logged rather than thrown so callers can
 * continue responding to the user.
 * @param {string} subject email subject
 * @param {string} body email body
 * @returns {Promise<void>}
 */
async function emailAdmin(subject, body) {
  if (!isEmailConfigured()) {
    console.error('AWS SES is not configured; skipping admin email:', subject)
    return
  }

  try {
    await getSesClient().send(new SendEmailCommand({
      FromEmailAddress: 'admin_alerts@mailpdf.online',
      Destination: {
        ToAddresses: [process.env.ADMIN_EMAIL]
      },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: body, Charset: 'UTF-8' }
          }
        }
      }
    }))
  }
  catch (err) {
    console.error(err)
  }
}

/**
 * Email a customer their tracking information.
 * @param {string} email recipient email address
 * @param {string} toLine1 first line of the destination address
 * @param {string} trackingNumber Lob letter id or USPS tracking number
 * @param {boolean} uspsTracking whether the tracking number is a USPS number
 * @returns {Promise<void>}
 */
async function emailTracking(email, toLine1, trackingNumber, uspsTracking) {
  const trackUrl = uspsTracking
    ? `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`
    : `https://mailpdf.online/track/${trackingNumber}`
  const { subject, text, html } = buildTrackingEmail({ toLine1, trackingNumber, trackUrl, uspsTracking })

  if (!isEmailConfigured()) {
    console.error('AWS SES is not configured; skipping tracking email to', email)
    return
  }

  try {
    await getSesClient().send(new SendEmailCommand({
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
    }))
  }
  catch (err) {
    console.error(err)
  }
}

export default router
