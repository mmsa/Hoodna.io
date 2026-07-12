const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(workspaceRoot, 'packages/shared');
const tokensRoot = path.resolve(workspaceRoot, 'packages/tokens');

const config = getDefaultConfig(projectRoot);

// Monorepo support for workspace packages (Metro must see both packages).
config.watchFolders = [sharedRoot, tokensRoot];
config.resolver.extraNodeModules = {
  '@hoodna/shared': sharedRoot,
  '@hoodna/tokens': tokensRoot,
  zod: path.resolve(projectRoot, 'node_modules/zod'),
};
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
