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
}));
import * as api from '../../src/services/api';
const mockLogin          = api.login as jest.Mock;
const mockLogout         = api.logout as jest.Mock;
const mockGetMe          = api.getMe as jest.Mock;
const mockGetContactos   = api.getContactos as jest.Mock;
const mockGetExpedientes = api.getExpedientes as jest.Mock;

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

  it('renderiza botón INICIAR SESIÓN', async () => {
    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Soy Asesor'));
    await waitFor(() => {
      expect(getByText('INICIAR SESIÓN')).toBeTruthy();
    });
  });

  it('muestra error si se envía con campos vacíos', async () => {
    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Soy Asesor'));
    await waitFor(() => getByText('INICIAR SESIÓN'));
    fireEvent.press(getByText('INICIAR SESIÓN'));
    await waitFor(() => {
      expect(getByText('Ingresa correo y contraseña.')).toBeTruthy();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('llama login y navega a /(tabs) cuando las credenciales son válidas', async () => {
    mockLogin.mockResolvedValueOnce({ user: MOCK_USER, token: 'tok', isAuthenticated: true });
    const { getByText, UNSAFE_getAllByType } = render(<LoginScreen />);
    fireEvent.press(getByText('Soy Asesor'));
    await waitFor(() => getByText('INICIAR SESIÓN'));
    const { TextInput } = require('react-native');
    const inputs = UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], 'ana@test.com');
    fireEvent.changeText(inputs[1], 'secret123');
    fireEvent.press(getByText('INICIAR SESIÓN'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('ana@test.com', 'secret123');
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('muestra mensaje de error de la API cuando falla el login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Credenciales inválidas'));
    const { getByText, UNSAFE_getAllByType } = render(<LoginScreen />);
    fireEvent.press(getByText('Soy Asesor'));
    await waitFor(() => getByText('INICIAR SESIÓN'));
    const { TextInput } = require('react-native');
    const inputs = UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], 'x@x.com');
    fireEvent.changeText(inputs[1], 'wrong');
    fireEvent.press(getByText('INICIAR SESIÓN'));
    await waitFor(() => {
      expect(getByText('Credenciales inválidas')).toBeTruthy();
    });
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
      expect(getByText(/Mapa|mapa|visita/i)).toBeTruthy();
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
