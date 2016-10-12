#!/bin/bash

# http://stackoverflow.com/a/16349776/2487925
cd "${0%/*}"

echo "Installing browserify..."
npm install -g browserify
echo "Installing dev dependencies..."
npm install --only=dev
echo "Installing production dependencies..."
npm install --only=production
echo "Building browserify bundle..."
browserify -t [ babelify --presets [ es2015 react ] ] -t scssify -t [ envify --NODE_ENV production ] -t uglifyify -o dist/bundle.js src/app.jsx 
