const path = require('path');
const PWAPlugin = require('gh-pwa');
const CleanWebpackPlugin = require('clean-webpack-plugin');

// https://github.com/webpack/webpack/issues/6496
const mode = () => {
  if (process.env.NODE_ENV != null) {
    return process.env.NODE_ENV;
  } else {
    return 'development';
  }
}

const app = new PWAPlugin({
  name: 'Wallpaper',
  scope: 'wallpaper',
  description: "iPhone wallpaper maker",
  theme: '#fffff0',
  tag: 2,
  mode: mode()
})

module.exports = [
  {
    name: 'client',
    entry: './bundle.js',
    target: 'web', // by default
    output: {
      path: path.resolve(__dirname, 'docs'),
      filename: 'bundle.[contenthash].js',
    },
    // watch: true,
    mode: mode(),
    devServer: {
      contentBase: path.join(__dirname, 'docs'),
      port: 3012
    },
    plugins: [
      new CleanWebpackPlugin(['docs']),
      app
    ]
  }
];
