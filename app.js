const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const RateLimit = require('express-rate-limit');
const mustache = require('mustache-express');

const api = require('./routes/api');

const app = express();

// Register '.mustache' extension with The Mustache Express
app.engine('mustache', mustache());

app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');


app.disable('x-powered-by'); // we don't need the x-powered-by express header
// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
// allow larger file uploads: http://stackoverflow.com/a/19965089/2487925
// should match value in nginx.conf on server. for dokku, see example in docs:
// http://dokku.viewdocs.io/dokku/configuration/nginx/#customizing-via-configuration-files-included-by-the-default-tem
const sizeLimit = '25mb';
app.use(bodyParser.json({ limit: sizeLimit }));
app.use(bodyParser.urlencoded({ limit: sizeLimit, extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'static')));

app.use('/', api);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    console.error(err);
    next();
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  next();
});

// rate limiting ===============================================================
if (process.env.NODE_ENV === 'production') {
  const apiLimiter = new RateLimit({
    windowMs: 10*60*1000, // 10 minute window
    delayAfter: 20, // begin slowing down responses after the first 20 requests
    delayMs: 0.1*1000, // slow down subsequent responses by 0.1 seconds per request
    max: 40, // start blocking after 40 requests
    message: 'Too many requests from this IP, please try again after an hour.'
  });
  app.use('/', apiLimiter);

  const uploadLimiter = new RateLimit({
    windowMs: 60*60*1000, // 1 hour window
    delayAfter: 5, // begin slowing down responses after the first 10 requests
    delayMs: 1*1000, // slow down subsequent responses by 1 second per request
    max: 10, // start blocking after 10 requests
    message: 'Too many requests from this IP, please try again after an hour.'
  });
  app.use('/upload', uploadLimiter);
}


module.exports = app;
