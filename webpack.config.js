var path = require('path');
var webpack = require('webpack');


var e = {
    entry: [
    //    "./views/lib/sw.js",
        "./views/material/js/ripples.min.js",
        "./views/material/js/material.min.js",
        "./views/lib/webfont.js",
        './src/index.js'],
    output: {
        path: './dist/',
        filename: 'index.js',
        devtoolModuleFilenameTemplate: '[absolute-resource-path]'
    },

    module: {
        loaders: [
            {
                test: /.js?$/,
                loader: 'babel-loader',
                exclude: [/node_modules/,/views/],
                query: {
                    presets: ['react', 'es2015','stage-0']
                }
            }
        ]
        ,
    },


    devServer: {
        port: 8000,
        contentBase: "./dist/",
        colors: true,
        inline:true,
        historyApiFallback: true
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress:{
                warnings: false,
            },
            mangle: false
    })],
    devtool: 'source-map'


};

module.exports = e;