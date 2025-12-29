const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add watchFolders to include the shared package
config.watchFolders = [
  path.resolve(__dirname, '..'),
];

module.exports = withNativeWind(config, { input: './global.css' });

