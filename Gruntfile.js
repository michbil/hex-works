/**
 * Created by mich.bil on 13.01.15.
 */
module.exports = function(grunt) {

    var sourcefiles = [
        "editor/js/locale.js",
        "editor/js/utils.js",
        "editor/js/binbuf.js",
        "editor/js/app.js",
        "editor/js/controllers.js",
        "editor/js/services.js",
        "editor/js/directives.js",
        "editor/js/hexview.js",
        "editor/js/formcontrols.js"];


    grunt.initConfig({

    });
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        htmlangular: {
            options: {
                // Task-specific options go here.
            },
            your_target: {
                src: ['index.html']
            }
        },
        jslint: {
            src: sourcefiles,
            directives: {
                // node environment
                node: false,
                // browser environment
                browser: true,
                // allow dangling underscores
                nomen: true,
                // allow todo statements
                todo: true,
                // allow unused parameters
                unparam: true,
                // add predefined libraries
                predef: [
                    '$',
                    '_',
                    'jQuery',
                    ''
                ]
            }
        },
        karma: {
            unit: {
                configFile: 'my.conf.js',
                singleRun: true,
            }
        },
        concat: {
            dist: {
                src: sourcefiles,
                dest: 'dist/editor/js/all.tot.js'

            }
        },
        targethtml: {
            dist: {
                files: {
                    'dist/editor/index.html': 'editor/index.html'
                }
            }
        },
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
                mangle:false
            },
            dist: {
                src:['dist/editor/js/all.tot.js'],
                dest:'dist/editor/js/all.js'

            }
        },
        copy: {
            main: {
                files: [
                    {expand: true, src: [
                        'editor/css/**',
                        'editor/lib/**',
                        'editor/fonts/**',
                        'editor/img/**',
                        'editor/lib/**',
                        'editor/templates/**',
                        'editor/material/**',
                        'editor/favicon.ico'
                    ], dest: 'dist/'},
                    {expand:true, src: [
                        'server/*.js',
                        'server/package.json',
                        'server/calculator/**',
                        'server/layouts/**',
                        'server/public/**',
                        'server/schema/**',
                        'server/sockets/**',
                        'server/util/**',
                        'server/views/**',
                        "server/calcjsproduction/**"

                    ], dest: "dist/"}
                ]
            }

        }
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-targethtml');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-jslint');
    grunt.loadNpmTasks('grunt-html-angular-validate');

    // Default task(s).
    grunt.registerTask('default', ['targethtml','concat','uglify','copy']);

};
