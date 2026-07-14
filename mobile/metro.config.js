const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(workspaceRoot, 'packages/shared');
const tokensRoot = path.resolve(workspaceRoot, 'packages/tokens');
const i18nRoot = path.resolve(workspaceRoot, 'packages/i18n');

const config = getDefaultConfig(projectRoot);

// Monorepo support for workspace packages (Metro must see all packages).
config.watchFolders = [sharedRoot, tokensRoot, i18nRoot];
config.resolver.extraNodeModules = {
  '@hoodna/shared': sharedRoot,
  '@hoodna/tokens': tokensRoot,
  '@hoodna/i18n': i18nRoot,
  zod: path.resolve(projectRoot, 'node_modules/zod'),
};
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
