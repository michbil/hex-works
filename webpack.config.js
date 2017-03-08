var path = require('path');
var webpack = require('webpack');

var e = {
    entry: './src/index.js',
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
                exclude: /node_modules/,
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
    devtool: 'inline-source-map'


};

module.exports = e;