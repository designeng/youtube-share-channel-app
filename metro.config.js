const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// In the Play build `foo.play.ts(x)` replaces `foo.ts(x)`, so the replaced code never reaches the bundle.
if (process.env.EXPO_PUBLIC_APP_VARIANT === 'play') {
  config.resolver.sourceExts = ['play.tsx', 'play.ts', ...config.resolver.sourceExts];
  // The variant is inlined into transformed files: the two builds must not share Metro's cache.
  config.cacheVersion = `${config.cacheVersion}-play`;
}

module.exports = config;
