const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin'); 
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const base_href = isProduction ? "BASE_HREF": "/";
  const kaldi_url = isProduction ? "KALDI_URL": "ws://localhost:8082/client/ws";
  return {
    mode: argv.mode,
    entry: './src/js/streamer.js', // Entry point of your application
    output: {
        filename: 'bundle.js', // Output bundle filename
        path: path.resolve(__dirname, 'dist'), // Output directory
    },
    plugins: [
        new HtmlWebpackPlugin({
          template: 'src/index.html', 
          filename: 'index.html', 
          templateParameters: (compilation, assets, assetTags, options) => {
            return {
              BASE_HREF: base_href,
              KALDI_URL: kaldi_url,
            };
          },
        }),
        new CopyWebpackPlugin({
            patterns: [
              { from: "*.css", to: "css", context: "src/css"},
            ],
          }),
        new webpack.DefinePlugin({
            'process.env': {
              BUILD_VERSION: JSON.stringify(process.env.BUILD_VERSION)
            }
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
  };
};
