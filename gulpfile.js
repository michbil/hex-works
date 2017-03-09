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

gulp.task('generate-service-worker', function(callback) {
    var path = require('path');
    var swPrecache = require('sw-precache');
    var rootDir = 'dist';

    swPrecache.write(path.join(rootDir, 'service-worker.js'), {
        staticFileGlobs: [rootDir + '/**/*.{js,html,css,png,jpg,gif,svg,eot,ttf,woff,swf,woff2}'],
        stripPrefix: rootDir
    }, callback);
});


gulp.task('default', ['copy','generate-service-worker']);
