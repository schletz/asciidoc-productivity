//@ts-check

'use strict';

const path = require('path');

/** @typedef {import('webpack').Configuration} WebpackConfig **/

/**
 * Bundles src/extension.ts with all dependencies into dist/extension.js, the `main` entry of
 * package.json. `npm run package` builds the same bundle in production mode.
 * @type WebpackConfig
 */
const extensionConfig = {
  target: 'node',
  mode: 'none',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    // Provided by the extension host at runtime.
    vscode: 'commonjs vscode',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      // See src/ssh2-mock.js.
      'ssh2': path.resolve(__dirname, 'src/ssh2-mock.js')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    // The problem matcher of the watch task in .vscode/tasks.json reads this log.
    level: "log",
  },
};
module.exports = [extensionConfig];
