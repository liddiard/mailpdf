import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import express from 'express'
import logger from 'morgan'
import { rateLimit } from 'express-rate-limit'
import mustache from 'mustache-express'

import api, { UPLOAD_DIR } from './routes/api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

// Register '.mustache' extension with The Mustache Express
app.engine('mustache', mustache())

app.set('view engine', 'mustache')
app.set('views', path.join(__dirname, 'views'))

app.disable('x-powered-by') // we don't need the x-powered-by express header
// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'))
// allow larger file uploads: http://stackoverflow.com/a/19965089/2487925
// should match value in nginx.conf on server. for dokku, see example in docs:
// http://dokku.viewdocs.io/dokku/configuration/nginx/#customizing-via-configuration-files-included-by-the-default-tem
const sizeLimit = '25mb'
app.use(express.json({ limit: sizeLimit }))
app.use(express.urlencoded({ limit: sizeLimit, extended: true }))

// make sure the uploads directory exists before multer tries to write to it
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// serve the built client (Vite output) and the uploaded PDFs
app.use(express.static(path.join(__dirname, 'dist')))
app.use('/uploads', express.static(UPLOAD_DIR))

app.use('/', api)

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found')
  err.status = 404
  next(err)
})

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res, next) => {
    console.error(err)
    next(err)
  })
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }
  res.status(err.status || 500)
  res.json({ error: err.message || 'Internal server error' })
})

// rate limiting ===============================================================
if (process.env.NODE_ENV === 'production') {
  const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minute window
    max: 40, // start blocking after 40 requests
    message: 'Too many requests from this IP, please try again later.'
  })
  app.use('/', apiLimiter)

  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 10, // start blocking after 10 requests
    message: 'Too many requests from this IP, please try again after an hour.'
  })
  app.use('/upload', uploadLimiter)
}

export default app
