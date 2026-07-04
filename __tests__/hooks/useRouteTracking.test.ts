/**
 * Tests: src/hooks/useRouteTracking.ts (arquitectura background)
 *
 * Cubre:
 *  - activar: inicia background tracking, guarda punto inicial, persiste '1'
 *  - activar con permiso denegado: muestra error, no activa
 *  - activar cuando no es asesor: no hace nada
 *  - desactivar: detiene background tracking, persiste '0', limpia error
 *  - forzarSync: llama syncRoutePoints y actualiza contador
 *  - estado persistido: restaura estaActivo=true si AsyncStorage tiene '1'
 *  - estado persistido: restaura si la tarea de background está activa
 *  - cleanup al desmontar: NO detiene background (debe seguir en background)
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouteTracking } from '../../src/hooks/useRouteTracking';
import * as routeTrackingService from '../../src/services/routeTracking';
import * as backgroundTrackingService from '../../src/services/backgroundTracking';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../src/services/routeTracking', () => ({
  guardarPuntoOffline:   jest.fn(() => Promise.resolve()),
  syncRoutePoints:       jest.fn(() => Promise.resolve({ ok: 1, errores: 0 })),
  contarPendientesRoute: jest.fn(() => Promise.resolve(0)),
}));

jest.mock('../../src/services/backgroundTracking', () => ({
  BACKGROUND_LOCATION_TASK:   'background-location-task',
  startBackgroundTracking:    jest.fn(() => Promise.resolve()),
  stopBackgroundTracking:     jest.fn(() => Promise.resolve()),
  isBackgroundTrackingActive: jest.fn(() => Promise.resolve(false)),
}));

const mockLocation             = Location as jest.Mocked<typeof Location>;
const mockSyncRoutePoints      = routeTrackingService.syncRoutePoints      as jest.Mock;
const mockContarPendientes     = routeTrackingService.contarPendientesRoute as jest.Mock;
const mockGuardarPuntoOffline  = routeTrackingService.guardarPuntoOffline   as jest.Mock;
const mockStartBG              = backgroundTrackingService.startBackgroundTracking    as jest.Mock;
const mockStopBG               = backgroundTrackingService.stopBackgroundTracking     as jest.Mock;
const mockIsBGActive           = backgroundTrackingService.isBackgroundTrackingActive as jest.Mock;

const LOC_MOCK = {
  coords: {
    latitude: 19.4326, longitude: -99.1332,
    accuracy: 10, speed: 2.78,
    altitude: null, altitudeAccuracy: null, heading: null,
  },
  timestamp: Date.now(),
};

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  await AsyncStorage.clear();

  (mockLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (mockLocation.getForegroundPermissionsAsync    as jest.Mock).mockResolvedValue({ status: 'granted' });
  (mockLocation.getCurrentPositionAsync          as jest.Mock).mockResolvedValue(LOC_MOCK);
  mockStartBG.mockResolvedValue(undefined);
  mockStopBG.mockResolvedValue(undefined);
  mockIsBGActive.mockResolvedValue(false);
  mockSyncRoutePoints.mockResolvedValue({ ok: 1, errores: 0 });
  mockContarPendientes.mockResolvedValue(0);
  mockGuardarPuntoOffline.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVAR
// ══════════════════════════════════════════════════════════════════════════════

describe('activar', () => {
  it('pone estaActivo=true y persiste "1"', async () => {
    const { result } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.activar(); });

    expect(result.current.estaActivo).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('route:tracking_enabled', '1');
  });

  it('llama a startBackgroundTracking', async () => {
    const { result } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.activar(); });

    expect(mockStartBG).toHaveBeenCalledTimes(1);
  });

  it('guarda un punto inicial', async () => {
    const { result } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.activar(); });

    expect(mockGuardarPuntoOffline).toHaveBeenCalled();
  });

  it('convierte velocidad de m/s a km/h correctamente', async () => {
    const { result } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.activar(); });

    const punto = mockGuardarPuntoOffline.mock.calls[0][0];
    expect(punto.velocidad).toBeCloseTo(2.78 * 3.6, 1);
  });

  it('no hace nada si isAsesor=false', async () => {
    const { result } = renderHook(() => useRouteTracking(false));
    await act(async () => { await result.current.activar(); });

    expect(result.current.estaActivo).toBe(false);
    expect(mockStartBG).not.toHaveBeenCalled();
  });

  it('muestra error si el permiso de ubicación está denegado', async () => {
    (mockLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => { await result.current.activar(); });

    expect(result.current.estaActivo).toBe(false);
    expect(result.current.error).toContain('Permiso de ubicación');
    expect(mockStartBG).not.toHaveBeenCalled();
  });

  it('pone iniciando=false al terminar activar exitosamente', async () => {
    const { result } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.activar(); });

    expect(result.current.iniciando).toBe(false);
    expect(result.current.estaActivo).toBe(true);
  });

  it('activa aunque el punto inicial falle (background sigue corriendo)', async () => {
    (mockLocation.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('GPS fail'));
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => { await result.current.activar(); });

    // El tracking se activa igual — la tarea de background capturará puntos
    expect(result.current.estaActivo).toBe(true);
    expect(mockStartBG).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DESACTIVAR
// ══════════════════════════════════════════════════════════════════════════════

describe('desactivar', () => {
  it('pone estaActivo=false y persiste "0"', async () => {
    const { result } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.activar(); });
    await act(async () => { await result.current.desactivar(); });

    expect(result.current.estaActivo).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('route:tracking_enabled', '0');
  });

  it('llama a stopBackgroundTracking', async () => {
    const { result } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.activar(); });
    await act(async () => { await result.current.desactivar(); });

    expect(mockStopBG).toHaveBeenCalled();
  });

  it('limpia el error al desactivar', async () => {
    (mockLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const { result } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.activar(); });

    expect(result.current.error).not.toBeNull();

    await act(async () => { await result.current.desactivar(); });

    expect(result.current.error).toBeNull();
  });

  it('hace sync final al desactivar', async () => {
    const { result } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.activar(); });
    mockSyncRoutePoints.mockClear();

    await act(async () => { await result.current.desactivar(); });

    expect(mockSyncRoutePoints).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FORZAR SYNC
// ══════════════════════════════════════════════════════════════════════════════

describe('forzarSync', () => {
  it('llama syncRoutePoints', async () => {
    const { result } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.forzarSync(); });

    expect(mockSyncRoutePoints).toHaveBeenCalled();
  });

  it('actualiza el contador de pendientes', async () => {
    mockContarPendientes.mockResolvedValue(5);
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => { await result.current.forzarSync(); });

    expect(result.current.pendientes).toBe(5);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ESTADO PERSISTIDO
// ══════════════════════════════════════════════════════════════════════════════

describe('estado persistido', () => {
  it('restaura estaActivo=true si AsyncStorage tiene "1"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      key === 'route:tracking_enabled' ? Promise.resolve('1') : Promise.resolve(null)
    );

    const { result } = renderHook(() => useRouteTracking(true));

    await waitFor(() => {
      expect(result.current.estaActivo).toBe(true);
    });
  });

  it('restaura estaActivo=true si la tarea de background está activa', async () => {
    mockIsBGActive.mockResolvedValue(true);

    const { result } = renderHook(() => useRouteTracking(true));

    await waitFor(() => {
      expect(result.current.estaActivo).toBe(true);
    });
  });

  it('no restaura estado si isAsesor=false', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      key === 'route:tracking_enabled' ? Promise.resolve('1') : Promise.resolve(null)
    );

    const { result } = renderHook(() => useRouteTracking(false));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.estaActivo).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CLEANUP AL DESMONTAR
// ══════════════════════════════════════════════════════════════════════════════

describe('cleanup al desmontar', () => {
  it('NO llama stopBackgroundTracking al desmontar (el tracking debe seguir en background)', async () => {
    const { result, unmount } = renderHook(() => useRouteTracking(true));
    await act(async () => { await result.current.activar(); });

    mockStopBG.mockClear();
    unmount();

    expect(mockStopBG).not.toHaveBeenCalled();
  });
});
