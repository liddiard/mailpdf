const express = require('express');
const router = express.Router();
const exec = require('child_process').exec;

const Lob = require('lob')('test_0dc8d51e0acffcb1880e0f19c79b2f5b0cc');
const stripe = require('stripe')('sk_test_BQokikJOvBiI2HlWgH4olfQ2');
const multer = require('multer');

const upload = multer({
  dest: 'static/uploads/',
  fileFilter: (req, file, cb) => {
    // The function should call `cb` with a boolean
    // to indicate if the file should be accepted
    cb(null, file.mimetype === 'application/pdf');
  }
});

const PAGE_LIMIT = 60;


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

    // resize pages to 8.5" x 11" dimensions
    // http://stackoverflow.com/a/7507511/2487925
    // http://www.ghostscript.com/doc/9.04/Use.htm#Known_paper_sizes
    // uploaded PDF is a random filename assigned by multer; resized PDF has
    // the same filename prefix but with '.pdf' appended
    exec(`gs -q -dNODISPLAY -sDEVICE=pdfwrite -sPAPERSIZE=letter -dFIXEDMEDIA -dPDFFitPage -dCompatibilityLevel=1.4 -o ${req.file.path}.pdf ${req.file.path}`, (err, stdout, stderr) => {
      if (stderr) {
        console.error(stderr);
        return res.status(400).send({ error: 'Unable to process PDF. Please check that you have uploaded a valid PDF document.' });
      }
      res.json({
        filename: req.file.originalname,
        uid: req.file.filename,
        url: `/uploads/${req.file.filename}.pdf`,
        numPages: numPages
      });
    });

  });
});

router.post('/verify_address', (req, expressRes, next) => {
  // call lob address verification api
  Lob.verification.verify({
    address_line1: req.body.line1,
    address_line2: req.body.line2,
    address_city: req.body.city,
    address_state: req.body.state,
    address_zip: req.body.zip
  }, (err, res) => {
    expressRes.json(res);
  });
});

router.post('/checkout', (req, res, next) => {
  const stripeToken = req.body.stripeToken;
  const pdfUrl = req.body.url;
  const numPages = req.body.numPages;
  const mailType = req.body.mailType;
  const returnEnvelope = req.body.returnEnvelope;

  if (!stripeToken || !pdfUrl || !numPages || !mailType ||
      typeof returnEnvelope === 'undefined') {
    return res.status(400).send({ error: 'Missing parameters for "stripeToken", "filename", "numPages", "mailType", and/or "returnEnvelope" in request body.' });
  }

  // count pages to ensure number matches req.body.numPages; abort with 400 otherwise

  // call stripe api to charge card with capture = false
  // call lob api to send letter
  // issue refund, alert admin if call not successful
});

router.get('/track/:trackingNumber', (req, res, next) => {
  // call lob api, render a tracking number view
});

function countPages(pdf, res, callback) {
  exec(`gs -q -dNODISPLAY -c "(${pdf}) (r) file runpdfbegin pdfpagecount = quit"`, (err, stdout, stderr) => {
    if (stderr) {
      console.error(stderr);
      return res.status(400).send({ error: 'Unable to process PDF. Please check that you have uploaded a valid PDF document.' });
    }
    // split by newlines, filter out empty lines
    const stdoutLines = stdout.split('\n').filter(line => { return line.length });
    // ghostscript will sometimes print warnings on previous lines that we
    // can't seem to suppress
    const numPages = parseInt(stdoutLines[stdoutLines.length-1]);
    if (isNaN(numPages)) {
      console.error('Error parsing ghostscript output,', stdoutLines);
      return res.status(500).send({ error: 'Internal server error.' });
    }
    callback(numPages);
  });
}

module.exports = router;
