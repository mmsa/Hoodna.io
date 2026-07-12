const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../packages/shared');
const tokensRoot = path.resolve(projectRoot, '../packages/tokens');

const config = getDefaultConfig(projectRoot);

// Monorepo support for workspace packages.
config.watchFolders = [sharedRoot, tokensRoot];
config.resolver.extraNodeModules = {
  '@hoodna/shared': sharedRoot,
  '@hoodna/tokens': tokensRoot,
  zod: path.resolve(projectRoot, 'node_modules/zod'),
};
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
