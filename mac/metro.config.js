const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const betaSrc = path.resolve(__dirname, '../beta/src');
const macNodeModules = path.resolve(__dirname, 'node_modules');

/**
 * Metro configuration
 *
 * - @shared/* imports resolve to beta/src/*
 * - react-native is symlinked to react-native-macos in node_modules
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  watchFolders: [betaSrc],
  resolver: {
    nodeModulesPaths: [macNodeModules],
    resolveRequest: (context, moduleName, platform) => {
      // Map @shared/* imports to beta/src/*
      if (moduleName.startsWith('@shared/')) {
        const relativePath = moduleName.slice('@shared/'.length);
        const absolutePath = path.resolve(betaSrc, relativePath);
        const {resolveRequest: _, ...restContext} = context;
        return context.resolveRequest(restContext, absolutePath, platform);
      }
      // Default resolution
      const {resolveRequest: _, ...restContext} = context;
      return context.resolveRequest(restContext, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
