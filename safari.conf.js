// Karma configuration
// Generated on Wed Jan 14 2015 12:21:30 GMT+0200 (FLE Standard Time)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    files: [
      'lib/filesaver.min.js',
      "lib/jdataview.js",
      "lib/jquery-2.1.3.min.js",
      "lib/jquery-ui.min.js",
      "lib/jquery.mousewheel.js",
      "lib/bootstrap.min.js",
      "lib/bootstrap-contextmenu.js",
      "lib/jbinary.js",
      "lib/angular.min.js",
      "lib/angular-route.min.js",
      "lib/angular-mocks.js",
      "lib/ui-bootstrap-tpls-0.12.0.js",
      "lib/angular-seo.js",
      'lib/scalyr.js',
      "lib/ZeroClipboard.js",
      "lib/localforage.js",
      "https://cdn.socket.io/socket.io-1.3.2.js",

      "js/locale.js",
      "js/utils.js", "js/binbuf.js", "js/app.js", "js/controllers.js", "js/services.js", "js/directives.js", "js/hexview.js", "js/formcontrols.js",

      'test/*.js'
    ],


    // list of files to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Safari'],
    //browsers: ['Chrome'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false
  });
};
