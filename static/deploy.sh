#!/bin/bash

bucket='s3://mailpdfonline/'

echo "Building release browserify bundle..."
browserify -t [ babelify --presets [ es2015 react ] ] -t scssify -t [ envify --NODE_ENV production ] -t uglifyify src/app.jsx | aws s3 cp - "${bucket}dist/bundle.js"
echo "Uploaded bundle to S3."
