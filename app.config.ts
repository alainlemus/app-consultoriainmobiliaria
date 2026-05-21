import type { ExpoConfig, ConfigContext } from 'expo/config';

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

// En desarrollo siempre usamos 127.0.0.1 (funciona tanto en simulador como en la Mac).
// Para dispositivo físico real usar EXPO_PUBLIC_API_URL=http://192.168.100.7:8080/api/v1
const DEV_API_URL  = 'http://127.0.0.1:8080/api/v1';
const PROD_API_URL = 'https://consultoriainmobiliaria.com.mx/api/v1';

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL
    ?? (process.env.APP_ENV === 'production' ? PROD_API_URL : DEV_API_URL);

  return {
    ...config,
    name:    'Consultoría Inmobiliaria',
    slug:    'app-consultoriainmobiliaria',
    version: '1.0.0',
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
    },
    android: {
      package: 'mx.consultoriainmobiliaria.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#222121',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
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
    ],
    // ── Variables accesibles en la app via expo-constants ──────────────────
    extra: {
      apiUrl,
      appEnv: process.env.APP_ENV ?? 'development',
      eas: {
        projectId: process.env.EAS_PROJECT_ID ?? '0e90bae8-ab6a-412f-a91d-01433afe689d',
      },
    },
  };
};
