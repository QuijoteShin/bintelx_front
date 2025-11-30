// /bintelx_front/webpack.config.js
const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/**
 * Loads environment variables from .env file
 */
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    line = line.trim();
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) return;

    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      let value = valueParts.join('=').trim();
      // Remove quotes if present
      value = value.replace(/^["']|["']$/g, '');
      envVars[key.trim()] = value;
    }
  });

  return envVars;
}

const env = loadEnv();
console.log('[webpack] Loaded .env variables:', env);

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

module.exports = (envArgs, argv) => {
  const isProduction = argv.mode === 'production';
  const entryPoints = getEntryPoints(envArgs);

  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/bnx/main.js', // entryPoints,
    output: {
      filename: '[name].[contenthash].js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: env.APP_PUBLIC_PATH,
    },
    devtool: isProduction ? env.APP_PROD_SOURCE_MAP : env.APP_DEV_SOURCE_MAP,
    devServer: {
      static: './dist',
      hot: true,
      historyApiFallback: true,
      port: parseInt(env.APP_PORT),
      allowedHosts: [
        `.${env.APP_HOST}`
      ],
      open: {
        context: ['/'],
        target: env.APP_OPEN_URL,
      },
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: './public/index.html',
      }),
      new MiniCssExtractPlugin({
        filename: 'global.[contenthash].css',
      }),
      new webpack.DefinePlugin({
        __MODE_IN__: JSON.stringify(argv.mode),
        __ROUTES__: JSON.stringify(dynamicRoutes),
        __API_BASE_URL__: JSON.stringify(env.API_BASE_URL),
        __API_TIMEOUT__: JSON.stringify(parseInt(env.API_TIMEOUT)),
        __AUTH_LOGIN_ENDPOINT__: JSON.stringify(env.AUTH_LOGIN_ENDPOINT),
        __AUTH_VALIDATE_ENDPOINT__: JSON.stringify(env.AUTH_VALIDATE_ENDPOINT),
        __AUTH_REPORT_ENDPOINT__: JSON.stringify(env.AUTH_REPORT_ENDPOINT),
        __NAV_ENDPOINT__: JSON.stringify(env.NAV_ENDPOINT || ''),
        __ALLOW_CONVENTION_ROUTES__: JSON.stringify(env.ALLOW_CONVENTION_ROUTES !== 'false'),
      }),
      // Ignore non-module files (.md, .txt, etc.) in dynamic import contexts
      new webpack.IgnorePlugin({
        resourceRegExp: /\.(md|txt|LICENSE|README)$/,
        contextRegExp: /src[\/\\]apps/,
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
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
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
