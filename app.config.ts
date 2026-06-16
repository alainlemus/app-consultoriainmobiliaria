import type { ExpoConfig, ConfigContext } from 'expo/config';
import type { ConfigPlugin } from 'expo/config-plugins';
import { withDangerousMod } from 'expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuración dinámica de la app por ambiente.
 *
 * Uso local (desarrollo):
 *   EXPO_PUBLIC_API_URL=http://192.168.1.x/api/v1 npx expo start
 *
 * En EAS Build se define en eas.json > build > [profile] > env:
 *   "env": { "EXPO_PUBLIC_API_URL": "https://api.tudominio.com/api/v1" }
 *
 * Accesible en la app vía:
 *   import Constants from 'expo-constants';
 *   Constants.expoConfig?.extra?.apiUrl
 */

// 10.0.2.2 es el gateway del emulador Android (apunta a la Mac del host).
// Puerto 8082 escucha en 0.0.0.0 (todas las interfaces), funciona desde emulador Android.
// Puerto 8080 escucha en 127.0.0.1, funciona desde simulador iOS.
// Para dispositivo físico real usar EXPO_PUBLIC_API_URL=http://192.168.100.7:8082/api/v1
const DEV_API_URL_ANDROID = 'http://10.0.2.2:8082/api/v1';
const DEV_API_URL_IOS     = 'https://consultoriainmobiliaria.com.mx/api/v1';
const STAGING_API_URL     = 'https://dev.consultoriainmobiliaria.com.mx/api/v1';
const PROD_API_URL        = 'https://consultoriainmobiliaria.com.mx/api/v1';

/**
 * Config plugin que parchea directamente el build.gradle de react-native-image-to-pdf
 * reemplazando compileSdkVersion 28 → 34 y buildToolsVersion obsoleto.
 * La librería es del 2019 y no usa rootProject.ext, por lo que no se puede
 * sobreescribir desde el root project sin causar errores de lifecycle en Gradle 8.
 */
const withFixImageToPdf: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'android',
    async (mod) => {
      const filePath = path.join(
        mod.modRequest.projectRoot,
        'node_modules',
        'react-native-image-to-pdf',
        'android',
        'build.gradle',
      );
      if (fs.existsSync(filePath)) {
        let contents = fs.readFileSync(filePath, 'utf8');
        // Solo parchear si aún tiene los valores viejos
        if (contents.includes('compileSdkVersion 28')) {
          contents = contents
            .replace('compileSdkVersion 28', 'compileSdkVersion 34')
            .replace('buildToolsVersion "28.0.3"', 'buildToolsVersion "34.0.0"')
            .replace('targetSdkVersion 28', 'targetSdkVersion 34')
            .replace('minSdkVersion 19', 'minSdkVersion 24');
          fs.writeFileSync(filePath, contents, 'utf8');
        }
      }
      return mod;
    },
  ]);

export default ({ config }: ConfigContext): ExpoConfig => {
  const isProduction = process.env.APP_ENV === 'production';
  const isStaging    = process.env.APP_ENV === 'staging';

  const resolvedProdUrl = isProduction ? PROD_API_URL : isStaging ? STAGING_API_URL : undefined;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? resolvedProdUrl;

  return withFixImageToPdf({
    ...config,
    name:    'Consultoría Inmobiliaria',
    slug:    'app-consultoriainmobiliaria',
    version: '1.4.2',
    orientation: 'portrait',
    icon:    './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'consultoriainmobiliaria',
    splash: {
      image:       './assets/splash-icon.png',
      resizeMode:  'contain',
      backgroundColor: '#222121',
    },
    ios: {
      bundleIdentifier: 'mx.consultoriainmobiliaria.app',
      supportsTablet: true,
      infoPlist: {
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            'dev.consultoriainmobiliaria.com.mx': {
              NSExceptionAllowsInsecureHTTPLoads: false,
            },
          },
        },
      },
    },
     android: {
      package: 'mx.consultoriainmobiliaria.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#222121',
      },
      edgeToEdgeEnabled: false as unknown as true,  // react-native-maps 1.20.1 no soporta edge-to-edge, causa crash en Samsung Android 14/15
      predictiveBackGestureEnabled: true,  // requerido en Android 14+ (Samsung S25/S26)
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',  // debe estar definida en eas.json o .env.local
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-notifications',
        {
          icon:                   './assets/icon.png',
          color:                  '#cd9d36',
          sounds:                 [],
          androidMode:            'default',
          androidCollapsedTitle:  'Consultoría Inmobiliaria',
        },
      ],
      [
        'expo-camera',
        { cameraPermission: 'La app necesita acceso a la cámara para escanear documentos.' },
      ],
      [
        'expo-image-picker',
        { photosPermission: 'La app necesita acceso a la galería para adjuntar documentos.' },
      ],
      [
        'expo-location',
        { locationAlwaysAndWhenInUsePermission: 'La app usa tu ubicación para registrar visitas a clientes.' },
      ],
      [
        'react-native-document-scanner-plugin',
        { cameraPermission: 'La app necesita acceso a la cámara para escanear documentos.' },
      ],
    ],
    // ── Variables accesibles en la app via expo-constants ──────────────────
    extra: {
      apiUrl,
      apiUrlAndroid: process.env.EXPO_PUBLIC_API_URL ?? (isProduction ? PROD_API_URL : isStaging ? STAGING_API_URL : DEV_API_URL_ANDROID),
      apiUrlIos:     process.env.EXPO_PUBLIC_API_URL ?? (isProduction ? PROD_API_URL : isStaging ? STAGING_API_URL : DEV_API_URL_IOS),
      appEnv: process.env.APP_ENV ?? 'development',
      eas: {
        projectId: process.env.EAS_PROJECT_ID ?? '0e90bae8-ab6a-412f-a91d-01433afe689d',
      },
    },
  });
};
