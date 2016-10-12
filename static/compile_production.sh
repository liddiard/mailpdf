#!/bin/bash

# http://stackoverflow.com/a/16349776/2487925
cd "${0%/*}"

npm install
browserify -t [ babelify --presets [ es2015 react ] ] -t scssify -t [ envify --NODE_ENV production ] -t uglifyify -o dist/bundle.js src/app.jsx 
