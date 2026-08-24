// jest.setup.js — mocks globales para toda la suite de tests

// ── expo-constants ────────────────────────────────────────────────────────────
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'http://localhost/api/v1',
        appEnv: 'test',
      },
    },
  },
}));

// ── AsyncStorage ─────────────────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// ── NetInfo ───────────────────────────────────────────────────────────────────
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

// ── expo-secure-store ─────────────────────────────────────────────────────────
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve('mock-token-123')),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// ── expo-router ───────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push:    jest.fn(),
    replace: jest.fn(),
    back:    jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  router: {
    push:    jest.fn(),
    replace: jest.fn(),
    back:    jest.fn(),
  },
  Link:  ({ children }) => children,
  Stack: { Screen: () => null },
  Tabs:  { Screen: () => null },
}));

// ── expo-camera ───────────────────────────────────────────────────────────────
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(() => [
    { granted: true },
    jest.fn(() => Promise.resolve({ granted: true })),
  ]),
}));

// ── expo-local-authentication (Face ID / huella) ──────────────────────────────
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(false)),
  isEnrolledAsync:  jest.fn(() => Promise.resolve(false)),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([])),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: false })),
  AuthenticationType: { FACIAL_RECOGNITION: 1, FINGERPRINT: 2 },
}));

// ── expo-image-picker ─────────────────────────────────────────────────────────
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({ canceled: false, assets: [{ uri: 'file://mock-image.jpg' }] })
  ),
}));

// ── expo-location ─────────────────────────────────────────────────────────────
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getBackgroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  requestBackgroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: {
        latitude:  19.4326,
        longitude: -99.1332,
        accuracy:  10,
        speed:     0,
        altitude:  null,
        altitudeAccuracy: null,
        heading:   null,
      },
      timestamp: Date.now(),
    })
  ),
  getLastKnownPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: {
        latitude:  19.4326,
        longitude: -99.1332,
        accuracy:  20,
        speed:     0,
        altitude:  null,
        altitudeAccuracy: null,
        heading:   null,
      },
      timestamp: Date.now(),
    })
  ),
  startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  stopLocationUpdatesAsync:  jest.fn(() => Promise.resolve()),
  Accuracy: { High: 5, Balanced: 3, Low: 1, Lowest: 0, BestForNavigation: 6 },
}));

// ── expo-notifications ────────────────────────────────────────────────────────
jest.mock('expo-notifications', () => ({
  setNotificationHandler:               jest.fn(),
  getPermissionsAsync:                  jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync:              jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync:                jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[mock]' })),
  setNotificationChannelAsync:          jest.fn(() => Promise.resolve()),
  addNotificationReceivedListener:      jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  scheduleNotificationAsync:            jest.fn(() => Promise.resolve()),
  setBadgeCountAsync:                   jest.fn(() => Promise.resolve()),
  AndroidImportance: { MAX: 5 },
}));

// ── expo-device ───────────────────────────────────────────────────────────────
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// ── react-native-maps ─────────────────────────────────────────────────────────
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = ({ children, ...props }) => React.createElement(View, props, children);
  MockMapView.displayName = 'MapView';
  const Marker   = ({ children, ...props }) => React.createElement(View, props, children);
  const Callout  = ({ children, ...props }) => React.createElement(View, props, children);
  return {
    __esModule: true,
    default: MockMapView,
    Marker,
    Callout,
    PROVIDER_GOOGLE: 'google',
  };
});

// ── react-native-safe-area-context ────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }) => children,
}));

// ── uuid ──────────────────────────────────────────────────────────────────────
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

// ── react-native-get-random-values ────────────────────────────────────────────
jest.mock('react-native-get-random-values', () => {});

// ── expo-task-manager ─────────────────────────────────────────────────────────
jest.mock('expo-task-manager', () => ({
  defineTask:           jest.fn(),
  isTaskRegisteredAsync: jest.fn(() => Promise.resolve(false)),
  unregisterAllTasksAsync: jest.fn(() => Promise.resolve()),
}));

// ── src/services/backgroundTracking ──────────────────────────────────────────
jest.mock('./src/services/backgroundTracking', () => ({
  BACKGROUND_LOCATION_TASK:   'background-location-task',
  startBackgroundTracking:    jest.fn(() => Promise.resolve()),
  stopBackgroundTracking:     jest.fn(() => Promise.resolve()),
  isBackgroundTrackingActive: jest.fn(() => Promise.resolve(false)),
}));

// ── fetch global ─────────────────────────────────────────────────────────────
global.fetch = jest.fn();
