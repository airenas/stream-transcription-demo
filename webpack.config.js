const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin'); 
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: './src/js/streamer.js', // Entry point of your application
    output: {
        filename: 'bundle.js', // Output bundle filename
        path: path.resolve(__dirname, 'dist'), // Output directory
    },
    plugins: [
        new HtmlWebpackPlugin({
          template: './src/index.html',
        }),
        new CopyWebpackPlugin({
            patterns: [
              { from: "*.css", to: "css", context: "src/css"},
            ],
          }),
      ],
    devServer: {
        static: './dist',
        watchFiles: ['src/**/*', "index.html"],
        historyApiFallback: true,
        client: {
          overlay: false,
        },
    },
    // optimization: {
    //     runtimeChunk: 'single',
    // },
};
