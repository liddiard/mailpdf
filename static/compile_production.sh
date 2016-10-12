npm install
browserify -t [ babelify --presets [ es2015 react ] ] -t scssify -t [ envify --NODE_ENV production ] -t uglifyify -o dist/bundle.js src/app.jsx 
