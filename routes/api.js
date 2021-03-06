const fs = require('fs');
const exec = require('child_process').exec;

const express = require('express');
const router = express.Router();
const request = require('request');
const LobTest = require('lob')(process.env.LOB_API_KEY_TEST);
const LobLive = require('lob')(process.env.LOB_API_KEY);
const stripeTest = require('stripe')(process.env.STRIPE_API_KEY_TEST);
const stripeLive = require('stripe')(process.env.STRIPE_API_KEY);
const multer = require('multer');
const moment = require('moment');
const zipcodes = require('zipcodes');

const calculateCost = require('../static/costs.js').calculateCost;

const UPLOAD_DEST = 'static/uploads/';
const PAGE_LIMIT = 60;

const upload = multer({
  dest: UPLOAD_DEST,
  fileFilter: (req, file, cb) => {
    // The function should call `cb` with a boolean
    // to indicate if the file should be accepted
    cb(null, file.mimetype === 'application/pdf');
  }
});


router.post('/upload', upload.single('pdf'), (req, res, next) => {
  if (!req.file) {
    return res.status(400).send({ error: 'That file doesn\'t look like a PDF. Please try again with a PDF document.' })
  }
  // PDF saved to filesystem, accessible via `req.file`

  // check page limit: http://stackoverflow.com/a/4829240/2487925
  countPages(req.file.path, res, numPages => {

    if (numPages > PAGE_LIMIT) {
      return res.status(400).send({ error: `PDF over ${PAGE_LIMIT}-page limit. Please try again with a shorter document.` });
    }

    // Resize pages to 8.5" x 11" dimensions
    // This absolute monstrosity is an effort of hours of googling, and is 
    // comprised of code and docs from the following sources:
    // 1. http://stackoverflow.com/a/7507511/2487925
    // 2. http://stackoverflow.com/a/26989410
    // 3. http://www.ghostscript.com/doc/9.04/Use.htm#Known_paper_sizes
    // 4. http://ghostscript.com/pipermail/gs-devel/2008-May/007776.html
    // It resizes PDF pages to 8.5"x11" (cf. #1, #3) (equivalent to 612x792 
    // points), rotates landscape images to portrait (cf. #4), and fixes
    // CropBox/MediaBox that causes incorrect dimensions for some PDFs,
    // particularly scanned ones (cf. #2).
    // Uploaded PDF is a random filename assigned by multer; resized PDF has
    // the same filename prefix but with '.pdf' appended.
    exec(`gs -q -dNOPAUSE -dBATCH -dFIXEDMEDIA -dPDFFitPage -dAutoRotatePages -sDEVICE=pdfwrite -sPAPERSIZE=letter -sOutputFile=${req.file.path}.pdf -c "<</EndPage {0 eq {[/CropBox [0 0 612 792] /PAGE pdfmark true}{false}ifelse}>> setpagedevice" -f ${req.file.path}`, (err, stdout, stderr) => {
      if (err) {
        console.error(err, stderr);
        return res.status(400).send({ error: 'Unable to process PDF. Please check that you have uploaded a valid PDF document.' });
      }
      res.json({
        filename: req.file.originalname,
        uid: req.file.filename,
        url: uidToUrl(req.file.filename),
        numPages: numPages
      });
    });

  });
});

router.post('/verify_address', (req, expressRes, next) => {
  // call lob address verification api
  LobLive.verification.verify({
    address_line1: req.body.line1,
    address_line2: req.body.line2,
    address_city: req.body.city,
    address_state: req.body.state,
    address_zip: req.body.zip
  }, (err, res) => {
    if (err && err.status_code === 404) {
      return expressRes.status(404).send({ message: 'Unable to locate address. Please recheck.' });
    }
    else if (err) {
      // console.error(err);
    }
    expressRes.json(res);
  });
});

router.post('/checkout', (req, expressRes, next) => {
  const demo = req.body.demo;
  const token = req.body.token;
  const uid = req.body.uid;
  const numPages = req.body.numPages;
  const mailType = req.body.mailType;
  const returnEnvelope = req.body.returnEnvelope;
  const cost = req.body.cost;
  const fromAddress = req.body.fromAddress;
  const toAddress = req.body.toAddress;

  if (!(token && uid && numPages && mailType && cost && fromAddress && toAddress) ||
      typeof returnEnvelope !== 'boolean' || typeof demo !== 'boolean') {
    return res.status(400).send({ error: 'Missing at least one of the following required parameters in the request body: "token", "uid", "numPages", "mailType", "returnEnvelope", "cost", "fromAddress", "toAddress".' });
  }

  // IMPORTANT: use the correct live or demo API keys depending on `demo`
  // request parameter
  const stripe = demo ? stripeTest : stripeLive;
  const Lob = demo ? LobTest : LobLive;

  if (!(mailType === 'noUpgrade' || mailType === 'registered' || mailType === 'certified')) {
    return res.status(400).send({ error: `Invalid mail type "${mailType}" specified. Valid options are "noUpgrade", "registered", and "certified".` })
  }

  let extraService;
  if (mailType === 'registered') {
    extraService = 'registered';
  }
  else if (mailType === 'certified') {
    extraService = 'certified';
  }
  else {
    extraService = false; // otherwise type is "noUpgrade"
  }
  
  // count pages to ensure number matches req.body.numPages; abort with 400 otherwise
  countPages(UPLOAD_DEST+uid+'.pdf', expressRes, numPagesOnDisk => {
    if (numPages !== numPagesOnDisk) {
      return expressRes.status(400).send({ error: `Number of PDF pages used for price calculation (${numPages}) does not equal number of PDF pages of uploaded file (${numPagesOnDisk}).` });
    }

    // CRITICAL: ensure the charge the user has authorized on the frontend
    // (or explicitly set in the request if the user is malicious) matches 
    // the cost we calculate server-side. 
    const options = {
      numPages: numPages,
      mailType: mailType,
      returnEnvelope: returnEnvelope
    };
    const calculatedCost = calculateCost(options);
    if (cost !== calculatedCost) {
      return expressRes.status(400).send({ error: `Price total authorized (${cost}) does not equal the calculated cost (${calculatedCost}). Transaction aborted. Your card has not been charged.` });
    }

    // call stripe api to authorize the charge but DO NOT capture yet
    let description = `Mailing a ${numPagesOnDisk}-page PDF to ${toAddress.line1}`;
    if (returnEnvelope) {
      description += ' with a return envelope';
    }
    if (mailType === 'registered') {
      description += ' via registered mail';
    }
    else if (mailType === 'certified') {
      description += ' via certified mail';
    }
    stripe.charges.create({
      // IMPORTANT: do not capture the charge until the Lob API request has
      // successfully returned
      capture: false,

      amount: calculatedCost, // IMPORTANT: amount in number of cents

      // frontend locale on Stripe Checkout explicity set to 'en', so all
      // charges should be displayed as USD
      currency: 'usd',

      // from frontend stripe checkout
      source: token.id,
      receipt_email: token.email,

      metadata: {
        email: token.email,
        numPages: numPages,
        mailType: mailType,
        returnEnvelope: returnEnvelope,
        from_name: fromAddress.name,
        from_line1: fromAddress.line1,
        from_line2: fromAddress.line2,
        from_city: fromAddress.city,
        from_state: fromAddress.state,
        from_zip: fromAddress.zip,
        to_name: toAddress.name,
        to_line1: toAddress.line1,
        to_line2: toAddress.line2,
        to_city: toAddress.city,
        to_state: toAddress.state,
        to_zip: toAddress.zip
      },
      description: description
    }, (err, charge) => {
      if (err) {
        console.error('error creating stripe charge', err);
        // cf. https://stripe.com/docs/api/node#errors
        if (err.rawType === 'card_error') {
          return expressRes.status(400).send({ error: `Authorization for your credit card failed. ${err.message} Please try again with corrected card information. Your card has not been charged, and your document has not been sent.` });
        }
        else {
          emailAdmin('[MailAPDF.Online] Error creating Stripe charge', JSON.stringify(err, null, 2));
          return expressRes.status(500).send({ error: `Internal error charging your card. Your card has not been charged, and your document has not been sent. An administrator has been notified.` });
        }
      }
      else {
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
          file: fs.readFileSync(UPLOAD_DEST+uid+'.pdf'),
          color: false,
          double_sided: false,
          address_placement: 'insert_blank_page',
          return_envelope: returnEnvelope,
          data: {
            email: token.email,
            cost: charge.amount,
            numPages: numPages,
            chargeId: charge.id
          }
        };
        if (returnEnvelope) {
          letterOptions.perforated_page = 1; 
        }
        if (extraService) {
          letterOptions.extra_service = extraService;
        }
        Lob.letters.create(letterOptions, (err, lobRes) => {
          if (err) {
            console.error('error creating lob letter', err);
            if (err.status_code === 422) { // bad request
              emailAdmin('[MailAPDF.Online] Error creating Lob letter (bad request)', JSON.stringify(err, null, 2));
              return expressRes.status(400).send({ error: `Error mailing PDF. ${err.message} Your card has not been charged.` });
            }
            else {
              emailAdmin('[MailAPDF.Online] Error creating Lob letter', JSON.stringify(err, null, 2));
              return expressRes.status(500).send({ error: `Internal error mailing your document. Your card has not been charged, and your document has not been sent. An administrator has been notified.` });
            }
          }
          else {
            // successfully mailed! now charge the customer
            stripe.charges.capture(charge.id, (err, charge) => {
              if (err) {
                // WARNING, BAD THINGS ARE HAPPENING: we were charged for 
                // using the Lob API but were unable to capture a charge from
                // the user. This could be a programming error or a malicious
                // user.
                console.error('ERROR CAPTURING CHARGE FROM CUSTOMER', err);
                emailAdmin('[MailAPDF.Online] WARNING IMMEDIATE ACTION REQUIRED: Error capturing charge from customer', JSON.stringify(err, null, 2) + '\n\n' + JSON.stringify(charge, null, 2));
                return expressRes.status(500).send({ error: 'Error charging your credit card. An administrator has been notified.' });
              }
              else {
                // it is finished!
                console.log(charge);
                // send a success response with no content
                expressRes.status(204).send();
                // email user with tracking link or number
                if (extraService) {
                  emailTracking(token.email, toAddress.line1, lobRes.tracking_number, true);
                }
                else {
                  emailTracking(token.email, toAddress.line1, lobRes.id, false);
                }
              }
            });
          }
        });
      }
    });
  });
});

router.get('/track/:trackingNumber', (req, expressRes, next) => {
  LobLive.letters.retrieve(req.params.trackingNumber, (err, res) => {
    if (err && err.status_code === 404) {
      return expressRes.render('tracking.mustache', { notFound: true, id: req.params.trackingNumber });
    }
    console.error(err);
    console.log(res);
    const dateFormat = 'dddd, MMMM Do';
    const timeFormat = 'h:mm a dddd, MMMM Do';
    res.date_created = moment(res.date_created).format(dateFormat);
    res.date_modified = moment(res.date_modified).format(dateFormat);
    res.expected_delivery_date = moment(res.expected_delivery_date).format(dateFormat);
    /*
    // dummy tracking events for testing
    res.tracking_events = [
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
    res.tracking_events = res.tracking_events
    .sort((a, b) => {
      return a.time < b.time;
    })
    .map(event => {
      event.time = moment(event.time).format(timeFormat);
      const location = zipcodes.lookup(event.location);
      event.location = [location.city, location.state].join(', ');
      return event;
    });
    expressRes.render('tracking.mustache', res);
  }); 
});

function countPages(pdf, res, callback) {
  exec(`gs -q -dNODISPLAY -c "(${pdf}) (r) file runpdfbegin pdfpagecount = quit"`, (err, stdout, stderr) => {
    if (err) {
      console.error(err, stderr);
      return res.status(400).send({ error: 'Unable to process PDF. Please check that you have uploaded a valid PDF document.' });
    }
    // split by newlines, filter out empty lines
    const stdoutLines = stdout.split('\n').filter(line => { return line.length });
    // ghostscript will sometimes print warnings on previous lines that we
    // can't seem to suppress
    const numPages = parseInt(stdoutLines[stdoutLines.length-1]);
    if (isNaN(numPages)) {
      emailAdmin('[MailAPDF.Online] Error parsing Ghostscript output', stdout);
      return res.status(500).send({ error: 'Internal server error.' });
    }
    callback(numPages);
  });
}

function uidToUrl(uid) {
  return `/uploads/${uid}.pdf`;
}

function emailAdmin(subject, body) {
  const payload = {
    from: {
      email: 'admin_alerts@mailpdf.online'
    },
    personalizations: [
      {
        to: [
          {
            email: process.env.ADMIN_EMAIL
          }
        ],
        subject: subject
      }
    ],
    content: [
      {
        type: 'text/plain',
        value: body
      }
    ],
  };

  request
  .post({
    url: 'https://api.sendgrid.com/v3/mail/send',
    auth: {
      bearer: process.env.SENDGRID_API_KEY
    },
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  },
  (err, res, body) => {
    console.error(err);
    console.log(body);
  });
}

function emailTracking(email, toLine1, trackingNumber, uspsTracking) {
  let templateId, trackUrl;
  if (uspsTracking) {
    templateId = '37513b23-4187-46ef-9b9a-cf55c03c1a98';
    trackUrl = `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`;
  }
  else {
    templateId = '462621e1-354c-4c73-9739-2b958ddcf8d1';
    trackUrl = `https://mailpdf.online/track/${trackingNumber}`;
  }
  const payload = {
    template_id: templateId,
    from: {
      email: 'order@mailpdf.online'
    },
    personalizations: [
      {
        to: [
          {
            email: email
          }
        ],
        substitutions: {
          '-to_line1-': toLine1,
          '-tracking_number-': trackingNumber,
          '-track_url-': trackUrl
        } 
      }
    ]
  };

  request
  .post({
    url: 'https://api.sendgrid.com/v3/mail/send',
    auth: {
      bearer: process.env.SENDGRID_API_KEY
    },
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  },
  (err, res, body) => {
    console.error(err);
    console.log(body);
  });
}

module.exports = router;
