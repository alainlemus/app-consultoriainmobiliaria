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

const DEV_API_URL  = 'http://192.168.100.7:8080/api/v1';  // proxy → Herd local
const PROD_API_URL = 'https://api.consultoriainmobiliaria.com/api/v1'; // ← tu VPS/Dokploy

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL
    ?? (process.env.APP_ENV === 'production' ? PROD_API_URL : DEV_API_URL);

  return {
    ...config,
    name:    'app-consultoriainmobiliaria',
    slug:    'app-consultoriainmobiliaria',
    version: '1.0.0',
    orientation: 'portrait',
    icon:    './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    scheme: 'consultoriainmobiliaria',
    splash: {
      image:       './assets/splash-icon.png',
      resizeMode:  'contain',
      backgroundColor: '#353030',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
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
        projectId: process.env.EAS_PROJECT_ID ?? '',
      },
    },
  };
};
