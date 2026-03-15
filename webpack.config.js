const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const GA_SNIPPET = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-J99PMLML6S"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-J99PMLML6S');</script>`;

module.exports = {
    entry: [
        './views/material/js/ripples.min.js',
        './views/material/js/material.min.js',
        './src/index.js'
    ],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.js',
        devtoolModuleFilenameTemplate: '[absolute-resource-path]'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: [/node_modules/, /views/],
                options: {
                    presets: ['@babel/preset-env']
                }
            }
        ]
    },
    optimization: {
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    mangle: false
                }
            })
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'views', to: '.' },
                {
                    from: 'beta/dist',
                    to: 'beta',
                    noErrorOnMissing: true,
                    transform: {
                        transformer(content, absoluteFrom) {
                            if (absoluteFrom.endsWith('.html')) {
                                return content.toString()
                                    .replace(/src="\/_expo\//g, 'src="_expo/')
                                    .replace(/href="\/_expo\//g, 'href="_expo/')
                                    .replace(/href="\/favicon/g, 'href="favicon')
                                    .replace('</head>', GA_SNIPPET + '\n</head>');
                            }
                            return content;
                        }
                    }
                }
            ]
        })
    ],
    devServer: {
        port: 8000,
        static: [
            { directory: path.resolve(__dirname, 'dist') }
        ],
        historyApiFallback: {
            rewrites: [
                { from: /^\/beta/, to: '/beta/index.html' }
            ]
        }
    },
    devtool: 'source-map'
};
