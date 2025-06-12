// /bintelx_front/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

/**
 * Determina los puntos de entrada para la compilación de Webpack.
 * @param {object} env - El objeto 'env' pasado desde el script de npm.
 * @returns {object} El objeto de entrada para Webpack.
 */
const getEntryPoints = (env) => {
  // build separated apps
  if (env && env.apps) {
    const apps = env.apps.split(','); // 'app1,app2' -> ['app1', 'app2']
    const entry = {};
    apps.forEach(app => {
      entry[app] = `./src/apps/${app}/index.js`;
    });
    return entry;
  }

  return {
    main: './src/bnx/main.js'
  };
};

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const entryPoints = getEntryPoints(env);

  return {
    mode: isProduction ? 'production' : 'development',
    entry: entryPoints,
    output: {
      filename: '[name].[contenthash].js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/',
    },
    devtool: isProduction ? false : 'inline-source-map',

    devServer: {
      static: './dist',
      hot: true,
      historyApiFallback: true,
      port: 8080,
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: './public/index.html',
      }),
    ],
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
        {
          test: /\.tpls$/,
          use: 'raw-loader',
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
    },
  };
};