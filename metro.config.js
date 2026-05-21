const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// En Expo Go (APP_OWNERSHIP=expo o sin variable), sustituir
// expo-local-authentication por un mock que no usa código nativo.
const isExpoGo = process.env.APP_OWNERSHIP === 'expo' || !process.env.EAS_BUILD;

if (isExpoGo) {
  config.resolver = config.resolver ?? {};
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules ?? {}),
    'expo-local-authentication': path.resolve(
      __dirname,
      'src/mocks/expo-local-authentication.ts'
    ),
  };
}

module.exports = config;
