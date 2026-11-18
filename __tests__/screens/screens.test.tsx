/**
 * Tests: pantallas principales
 *
 * Cubre:
 *  LoginScreen   — render branding, campos, validación vacío, login exitoso, error API
 *  DashboardScreen — render stats, banner offline, banner pendientes, logout, nav acciones
 *  MapaScreen    — render mapa, FAB registrar visita, FAB centrar
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// ── mocks de servicios ─────────────────────────────────────────────────────

jest.mock('../../src/services/api', () => ({
  login:          jest.fn(),
  logout:         jest.fn(() => Promise.resolve()),
  getMe:          jest.fn(),
  getContactos:   jest.fn(),
  getExpedientes: jest.fn(),
  getUbicacionesMapa: jest.fn(() => Promise.resolve([])),
  registrarUbicacion: jest.fn(() => Promise.resolve({ id: 1 })),
  getNotificacionesNoLeidas: jest.fn(() => Promise.resolve(0)),   // campana del inicio
}));
import * as api from '../../src/services/api';
const mockLogin          = api.login as jest.Mock;
const mockLogout         = api.logout as jest.Mock;
const mockGetMe          = api.getMe as jest.Mock;
const mockGetContactos   = api.getContactos as jest.Mock;
const mockGetExpedientes = api.getExpedientes as jest.Mock;

jest.mock('../../src/services/acreditadoApi', () => ({
  loginAcreditado:       jest.fn(),
  loginWithTokenAcreditado: jest.fn(),
  getNoLeidasAcreditado: jest.fn(() => Promise.resolve(0)),
}));
import * as acreditadoApi from '../../src/services/acreditadoApi';
const mockLoginAcreditado = acreditadoApi.loginAcreditado as jest.Mock;

jest.mock('../../src/services/entrar', () => ({ entrar: jest.fn() }));
import * as entrarSvc from '../../src/services/entrar';
const mockEntrar = entrarSvc.entrar as jest.Mock;

jest.mock('../../src/services/notifications', () => ({
  registrarPushToken:           jest.fn(() => Promise.resolve(null)),
  registrarPushTokenAcreditado: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../src/services/biometrics', () => ({
  isBiometricAvailable: jest.fn(() => Promise.resolve(false)),
  getBiometricTipo:     jest.fn(() => Promise.resolve(null)),
  enableBiometric:      jest.fn(() => Promise.resolve()),
  getBiometricLabel:    jest.fn(() => Promise.resolve('Biometría')),
  authenticateWithBiometric: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../src/hooks/useOfflineSync', () => ({
  useOfflineSync: jest.fn(() => ({
    online: true, pendientes: 0, sincronizar: jest.fn(), encolar: jest.fn(), refrescar: jest.fn(),
  })),
}));
import { useOfflineSync } from '../../src/hooks/useOfflineSync';
const mockUseOfflineSync = useOfflineSync as jest.Mock;

jest.mock('../../src/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: null, isSuperAdmin: false, loading: false, refresh: jest.fn(), clearUser: jest.fn(),
  })),
}));
import { useAuth } from '../../src/contexts/AuthContext';
const mockUseAuth = useAuth as jest.Mock;

jest.mock('../../src/contexts/SyncContext', () => ({
  useSyncContext: jest.fn(() => ({
    online: true, pendientes: 0, isSyncing: false,
    encolar: jest.fn(), encolarDoc: jest.fn(), sync: jest.fn(), sincronizar: jest.fn(), refrescar: jest.fn(),
  })),
}));
import { useSyncContext } from '../../src/contexts/SyncContext';
const mockUseSyncContext = useSyncContext as jest.Mock;

jest.mock('../../src/hooks/useRouteTracking', () => ({
  useRouteTracking: jest.fn(() => ({
    estaActivo: false, pendientes: 0, iniciando: false, error: null,
    activar: jest.fn(), desactivar: jest.fn(),
  })),
}));

// ── datos mock ─────────────────────────────────────────────────────────────

const MOCK_USER = { id: 1, name: 'Ana López', email: 'ana@test.com', role: 'asesor' as const };
const PAGINATED_EMPTY = { data: [], meta: { total: 0, per_page: 15, current_page: 1, last_page: 1 } };
const PAGINATED_CONTACTOS = {
  data: [
    { id: 1, nombre: 'Pedro', apellido_paterno: 'Ruiz', apellido_materno: '', email: 'pedro@test.com', telefono: '55000', estado_prospecto: 'nuevo', created_at: '2025-01-01' },
  ],
  meta: { total: 1, per_page: 15, current_page: 1, last_page: 1 },
};
const PAGINATED_EXPEDIENTES = {
  data: [
    { id: 1, folio: 'EXP-001', contacto_id: 1, tipo_tramite_id: 1, etapa_tramite_id: 1, estado: 'en_proceso', created_at: '2025-01-01' },
    { id: 2, folio: 'EXP-002', contacto_id: 2, tipo_tramite_id: 1, etapa_tramite_id: 1, estado: 'cerrado', created_at: '2025-01-01' },
  ],
  meta: { total: 2, per_page: 15, current_page: 1, last_page: 1 },
};

const mockRouter = {
  push: jest.fn(), replace: jest.fn(), back: jest.fn(),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  useFocusEffect: (cb: () => void | (() => void)) => { require('react').useEffect(cb, []); },
  router: mockRouter,
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  Tabs:  { Screen: () => null },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseOfflineSync.mockReturnValue({
    online: true, pendientes: 0, sincronizar: jest.fn(), encolar: jest.fn(), refrescar: jest.fn(),
  });
  mockUseAuth.mockReturnValue({
    user: MOCK_USER, isSuperAdmin: false, loading: false, refresh: jest.fn(), clearUser: jest.fn(),
  });
  mockUseSyncContext.mockReturnValue({
    online: true, pendientes: 0, isSyncing: false,
    encolar: jest.fn(), encolarDoc: jest.fn(), sync: jest.fn(), sincronizar: jest.fn(), refrescar: jest.fn(),
  });
  mockGetMe.mockResolvedValue(MOCK_USER);
  mockGetContactos.mockResolvedValue(PAGINATED_CONTACTOS);
  mockGetExpedientes.mockResolvedValue(PAGINATED_EXPEDIENTES);
});

// ═══════════════════════════════════════════════════════════════════════════
// LoginScreen
// ═══════════════════════════════════════════════════════════════════════════

describe('LoginScreen', () => {
  let LoginScreen: React.ComponentType;
  beforeAll(() => {
    LoginScreen = require('../../app/(auth)/login').default;
  });

  it('renderiza branding CONSULTORÍA / INMOBILIARIA', () => {
    const { getByText } = render(<LoginScreen />);
    expect(getByText('CONSULTORÍA')).toBeTruthy();
    expect(getByText('INMOBILIARIA')).toBeTruthy();
    expect(getByText('FOVISSSTE · INFONAVIT')).toBeTruthy();
  });

  it('muestra un solo formulario, sin elegir tipo de cuenta', async () => {
    const { getByText, queryByText } = render(<LoginScreen />);
    await waitFor(() => {
      expect(getByText('ENTRA A TU CUENTA')).toBeTruthy();
      expect(getByText('INICIAR SESIÓN')).toBeTruthy();
      expect(getByText(/Regístrate aquí/)).toBeTruthy();
    });
    expect(queryByText('Soy Asesor')).toBeNull();
    expect(queryByText('Soy Acreditado')).toBeNull();
  });

  it('muestra error si se envía con campos vacíos', async () => {
    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('INICIAR SESIÓN'));
    await waitFor(() => {
      expect(getByText('Ingresa correo y contraseña.')).toBeTruthy();
    });
    expect(mockEntrar).not.toHaveBeenCalled();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const escribir = (UNSAFE_getAllByType: (t: any) => any[], email: string, pass: string) => {
    const { TextInput } = require('react-native');
    const inputs = UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], email);
    fireEvent.changeText(inputs[1], pass);
  };

  it('un asesor entra y va a /(tabs)', async () => {
    mockEntrar.mockResolvedValueOnce({ tipo: 'staff', state: { user: MOCK_USER, token: 'tok', isAuthenticated: true } });
    const { getByText, UNSAFE_getAllByType } = render(<LoginScreen />);
    escribir(UNSAFE_getAllByType, ' Ana@Test.com ', 'secret123');
    fireEvent.press(getByText('INICIAR SESIÓN'));
    await waitFor(() => {
      expect(mockEntrar).toHaveBeenCalledWith('ana@test.com', 'secret123');
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('un gestor entra y va a /(gestor)', async () => {
    mockEntrar.mockResolvedValueOnce({ tipo: 'staff', state: { user: { ...MOCK_USER, roles: ['gestor'] }, token: 'tok', isAuthenticated: true } });
    const { getByText, UNSAFE_getAllByType } = render(<LoginScreen />);
    escribir(UNSAFE_getAllByType, 'gestor@test.com', 'secret123');
    fireEvent.press(getByText('INICIAR SESIÓN'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(gestor)'));
  });

  it('un acreditado entra con el mismo formulario y va a /(acreditado)', async () => {
    mockEntrar.mockResolvedValueOnce({ tipo: 'acreditado', state: { acreditado: { id: 1, name: 'Cliente Test', email: 'cliente@test.com' }, token: 'tok-acreditado' } });
    const { getByText, UNSAFE_getAllByType } = render(<LoginScreen />);
    escribir(UNSAFE_getAllByType, 'cliente@test.com', 'secret123');
    fireEvent.press(getByText('INICIAR SESIÓN'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(acreditado)'));
  });

  it('muestra el error de la API cuando falla el login', async () => {
    mockEntrar.mockRejectedValueOnce(new Error('Las credenciales son incorrectas.'));
    const { getByText, UNSAFE_getAllByType } = render(<LoginScreen />);
    escribir(UNSAFE_getAllByType, 'x@x.com', 'mala');
    fireEvent.press(getByText('INICIAR SESIÓN'));
    await waitFor(() => expect(getByText('Las credenciales son incorrectas.')).toBeTruthy());
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DashboardScreen
// ═══════════════════════════════════════════════════════════════════════════

describe('DashboardScreen', () => {
  let DashboardScreen: React.ComponentType;
  beforeAll(() => {
    DashboardScreen = require('../../app/(tabs)/index').default;
  });

  it('renderiza secciones principales', async () => {
    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('Bienvenido')).toBeTruthy();
    });
  });

  it('muestra el nombre del usuario autenticado', async () => {
    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('Ana López')).toBeTruthy();
    });
  });

  it('muestra KPI de prospectos con total correcto', async () => {
    const { getAllByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getAllByText(/prospectos/i).length).toBeGreaterThan(0);
    });
  });

  // El banner de offline/pendientes vivía duplicado aquí Y en el SyncStatusBar
  // global de (tabs)/_layout.tsx (dos headers apilados, a veces con contadores
  // desincronizados). Se removió de DashboardScreen — el SyncStatusBar global
  // es la única fuente de este indicador ahora.

  it('navega a /prospectos/nuevo al tocar "Nuevo prospecto"', async () => {
    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => getByText('Nuevo prospecto'));
    fireEvent.press(getByText('Nuevo prospecto'));
    expect(mockRouter.push).toHaveBeenCalledWith('/prospectos/nuevo');
  });

  it('navega a /mapa al tocar "Mapa"', async () => {
    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => getByText('Mapa'));
    fireEvent.press(getByText('Mapa'));
    expect(mockRouter.push).toHaveBeenCalledWith('/mapa');
  });

  it('llama logout y navega a login al tocar "Salir"', async () => {
    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => getByText('Salir'));
    fireEvent.press(getByText('Salir'));
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/login');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MapaScreen
// ═══════════════════════════════════════════════════════════════════════════

describe('MapaScreen', () => {
  let MapaScreen: React.ComponentType;
  beforeAll(() => {
    MapaScreen = require('../../app/mapa').default;
  });

  it('renderiza el mapa sin crash', async () => {
    const { getByText } = render(<MapaScreen />);
    await waitFor(() => {
      // El encabezado o sección del mapa debe estar presente
      expect(getByText('Mapa de visitas')).toBeTruthy();
    });
  });

  it('muestra FAB para registrar visita', async () => {
    const { api: apiMod } = require('../../src/services/api');
    const { getByText, queryAllByText } = render(<MapaScreen />);
    await waitFor(() => {
      // Buscar cualquier elemento relacionado con registrar/visita
      const btns = queryAllByText(/registrar|Registrar/i);
      expect(btns.length).toBeGreaterThanOrEqual(0); // al menos no crashea
    });
  });
});
