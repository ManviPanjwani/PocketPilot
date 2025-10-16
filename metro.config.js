const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (config.resolver && Array.isArray(config.resolver.sourceExts)) {
  config.resolver.sourceExts = Array.from(
    new Set([...config.resolver.sourceExts, 'cjs'])
  );
}

config.resolver.alias = {
  ...config.resolver.alias,
  '@': path.resolve(__dirname),
};

module.exports = config;
