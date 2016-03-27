var gulp = require('gulp');
var browserify = require('gulp-browserify');
var source = require('vinyl-source-stream');
var fs = require('fs');
var wrapper = require('gulp-wrapper');
var uglify = require ('gulp-uglify');
var rename = require("gulp-rename");
var sourcemaps = require('gulp-sourcemaps');

console.log(uglify);

gulp.task('copy', function() {
    return gulp.src(["./views/**/*.*"])
        .pipe(gulp.dest('./dist/'));
});

gulp.task('hex', function() {

    return gulp.src('src/index.js')
        .pipe(browserify({
            debug:true
        }))
        .pipe(sourcemaps.init({loadMaps: true})) // loads map from browserify file
        .pipe(uglify({mangle: false}))
        .pipe(sourcemaps.write('./')) // writes .map file
        .pipe(gulp.dest('./dist/'))
        .on('error', function(err) {
            console.log('Build error:', err.toString());
        })
});


gulp.task('default', ['copy','hex']);
