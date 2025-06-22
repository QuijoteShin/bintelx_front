// /bintelx_front/webpack.config.js
const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

/**
* Scans the /src/apps directory to automatically generate a route map
* from all the routes.json files found within each app's folder.
*/
function generateRoutes() {
  const appsPath = path.join(__dirname, 'src', 'apps');
  const appDirs = fs.readdirSync(appsPath).filter(file =>
      fs.statSync(path.join(appsPath, file)).isDirectory()
  );

  let allRoutes = [];
  for (const dir of appDirs) {
    const routeFilePath = path.join(appsPath, dir, 'routes.json');
    if (fs.existsSync(routeFilePath)) {
      const routesContent = fs.readFileSync(routeFilePath, 'utf-8');
      try {
        const routes = JSON.parse(routesContent);
        allRoutes = allRoutes.concat(routes);
      } catch (e) {
        console.error(`Error parsing routes.json for app: ${dir}`, e);
      }
    }
  }
  console.log('Discovered Routes:', allRoutes);
  return allRoutes;
}

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

const dynamicRoutes = generateRoutes();

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const entryPoints = getEntryPoints(env);

  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/bnx/main.js', // entryPoints,
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
      host: 'localhost',
      allowedHosts: [
        '.dev.local'
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: './public/index.html',
      }),
      new webpack.DefinePlugin({
        __MODE_IN__: JSON.stringify(argv.mode),
        __ROUTES__: JSON.stringify(dynamicRoutes),
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