#!/bin/bash

bucket='s3://static.mailpdf.online/'

echo "Building release browserify bundle..."
browserify -t [ babelify --presets [ es2015 react ] ] -t scssify -t [ envify --NODE_ENV production ] -t uglifyify src/app.jsx | gzip | aws s3 cp - "${bucket}dist/bundle.js"
echo "Uploaded bundle to S3."
