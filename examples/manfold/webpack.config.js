// @noflow
// NOTE: To use this example standalone (e.g. outside of deck.gl repo)
// delete the local development overrides at the bottom of this file

// avoid destructuring for older Node version support
const resolve = require('path').resolve;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const ROOT = resolve(__dirname, '../..');
const NODE_MODULES = resolve(ROOT, 'node_modules');
const packageAliases = require(resolve(ROOT, 'alias.config'));

module.exports = {
  // 'cheap-module-eval-source-map' is faster than 'source-map' in webpack v4
  // but with less cleaner source map
  devtool: 'source-map',
  mode: 'development',

  entry: {
    app: resolve('./src/main.js'),
  },

  resolve: {
    alias: Object.assign(
      {},
      {
        react: resolve(NODE_MODULES, 'react'),
        ...packageAliases(),
      }
    ),
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        use: ['babel-loader', 'source-map-loader'],
        enforce: 'pre',
        exclude: [/node_modules/],
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
              modules: true,
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              plugins: () => [require('autoprefixer')],
              sourceMap: true,
            },
          },
        ],
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader', // creates style nodes from JS strings
          'css-loader', // translates CSS into CommonJS
          'sass-loader', // compiles Sass to CSS, using Node Sass by default
        ],
      },
    ],
  },

  plugins: [
    new MiniCssExtractPlugin(),
    new HtmlWebpackPlugin({title: 'manifold example'}),
  ],
};