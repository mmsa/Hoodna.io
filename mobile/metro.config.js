const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../packages/shared');

const config = getDefaultConfig(projectRoot);

// Monorepo support for @hoodna/shared (and its zod imports).
config.watchFolders = [sharedRoot];
config.resolver.extraNodeModules = {
  '@hoodna/shared': sharedRoot,
  zod: path.resolve(projectRoot, 'node_modules/zod'),
};
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
