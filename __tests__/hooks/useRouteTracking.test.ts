/**
 * Tests: src/hooks/useRouteTracking.ts
 *
 * Cubre:
 *  - activar: guarda punto inicial, persiste '1', pone estaActivo=true
 *  - activar con permiso denegado: muestra error, no activa
 *  - activar cuando no es asesor: no hace nada
 *  - desactivar: limpia intervalos, persiste '0', pone estaActivo=false, error=null
 *  - obtenerYGuardarPunto: fallback a getLastKnownPositionAsync si getCurrentPosition falla
 *  - obtenerYGuardarPunto: timeout de GPS se ignora silenciosamente
 *  - forzarSync: no hace nada si isConnected===false
 *  - forzarSync: sincroniza si isConnected!==false
 *  - pendientes se actualiza tras guardar puntos
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { useRouteTracking } from '../../src/hooks/useRouteTracking';
import * as routeTrackingService from '../../src/services/routeTracking';

// Mockear el servicio completo para aislar el hook
jest.mock('../../src/services/routeTracking', () => ({
  guardarPuntoOffline:         jest.fn(() => Promise.resolve()),
  syncRoutePoints:             jest.fn(() => Promise.resolve({ ok: 1, errores: 0 })),
  contarPendientesRoute:       jest.fn(() => Promise.resolve(0)),
  iniciarRouteSyncAutomatico:  jest.fn(),
  detenerRouteSyncAutomatico:  jest.fn(),
}));

const mockLocation = Location as jest.Mocked<typeof Location>;
const mockNetInfoFetch = NetInfo.fetch as jest.Mock;
const mockGuardarPuntoOffline       = routeTrackingService.guardarPuntoOffline       as jest.Mock;
const mockSyncRoutePoints           = routeTrackingService.syncRoutePoints           as jest.Mock;
const mockContarPendientesRoute     = routeTrackingService.contarPendientesRoute     as jest.Mock;
const mockIniciarRouteSyncAutomatico = routeTrackingService.iniciarRouteSyncAutomatico as jest.Mock;
const mockDetenerRouteSyncAutomatico = routeTrackingService.detenerRouteSyncAutomatico as jest.Mock;

const LOC_MOCK = {
  coords: {
    latitude:  19.4326,
    longitude: -99.1332,
    accuracy:  10,
    speed:     2.78,  // m/s ≈ 10 km/h
    altitude:  null,
    altitudeAccuracy: null,
    heading:   null,
  },
  timestamp: Date.now(),
};

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();

  // Limpiar AsyncStorage entre tests para evitar estado contaminado entre casos
  await AsyncStorage.clear();

  // Defaults
  (mockLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (mockLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue(LOC_MOCK);
  (mockLocation.getLastKnownPositionAsync as jest.Mock) = jest.fn().mockResolvedValue(LOC_MOCK);
  mockNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  mockContarPendientesRoute.mockResolvedValue(0);
  mockSyncRoutePoints.mockResolvedValue({ ok: 1, errores: 0 });
  mockGuardarPuntoOffline.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVAR
// ══════════════════════════════════════════════════════════════════════════════

describe('activar', () => {
  it('pone estaActivo=true y persiste "1" en AsyncStorage', async () => {
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    expect(result.current.estaActivo).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('route:tracking_enabled', '1');
  });

  it('obtiene una ubicación inicial al activar', async () => {
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalled();
    expect(mockGuardarPuntoOffline).toHaveBeenCalled();
  });

  it('convierte velocidad de m/s a km/h correctamente', async () => {
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    const puntoGuardado = mockGuardarPuntoOffline.mock.calls[0][0];
    // 2.78 m/s × 3.6 ≈ 10.008 km/h
    expect(puntoGuardado.velocidad).toBeCloseTo(2.78 * 3.6, 1);
  });

  it('inicia el listener de sincronización automática', async () => {
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    expect(mockIniciarRouteSyncAutomatico).toHaveBeenCalled();
  });

  it('no hace nada si isAsesor=false', async () => {
    const { result } = renderHook(() => useRouteTracking(false));

    await act(async () => {
      await result.current.activar();
    });

    expect(result.current.estaActivo).toBe(false);
    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('muestra error si el permiso de ubicación está denegado', async () => {
    (mockLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    expect(result.current.estaActivo).toBe(false);
    expect(result.current.error).toContain('Permiso de ubicación');
  });

  it('pone iniciando=false al terminar activar exitosamente', async () => {
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    // Al finalizar exitosamente: iniciando=false, estaActivo=true
    expect(result.current.iniciando).toBe(false);
    expect(result.current.estaActivo).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// OBTENER Y GUARDAR PUNTO — fallback GPS
// ══════════════════════════════════════════════════════════════════════════════

describe('obtenerYGuardarPunto — manejo de errores GPS', () => {
  it('usa getLastKnownPositionAsync como fallback si getCurrentPosition falla', async () => {
    (mockLocation.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(new Error('GPS unavailable'));
    (mockLocation.getLastKnownPositionAsync as jest.Mock).mockResolvedValueOnce(LOC_MOCK);

    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    expect(mockLocation.getLastKnownPositionAsync).toHaveBeenCalled();
    // Aun así guarda el punto
    expect(mockGuardarPuntoOffline).toHaveBeenCalled();
    // Sin error visible
    expect(result.current.error).toBeNull();
  });

  it('no muestra error si getLastKnownPositionAsync también retorna null (silencioso)', async () => {
    (mockLocation.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(new Error('GPS unavailable'));
    (mockLocation.getLastKnownPositionAsync as jest.Mock).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    // No debe haber error rojo ni punto guardado
    expect(result.current.error).toBeNull();
    // El activar en sí puede guardar un punto antes del error, verificar que
    // el fallback no guardó nada extra cuando last=null
    // (el primer getCurrentPositionAsync llama es al activar, ya mockeado arriba)
  });

  it('ignora errores de timeout de GPS silenciosamente — BUG CORREGIDO', async () => {
    // Simular error de timeout del sistema de ubicación
    (mockLocation.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(new Error('Location request timed out'));
    (mockLocation.getLastKnownPositionAsync as jest.Mock).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    // Timeout debe ignorarse silenciosamente
    expect(result.current.error).toBeNull();
  });

  it('ignora errores con "timed out" en el mensaje', async () => {
    (mockLocation.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(new Error('Operation timed out after 30s'));
    (mockLocation.getLastKnownPositionAsync as jest.Mock).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    expect(result.current.error).toBeNull();
  });

  it('SÍ muestra error para errores no relacionados con timeout', async () => {
    // Para que el error llegue al catch externo del hook, debe venir de
    // requestForegroundPermissionsAsync o guardarPuntoOffline (no de getCurrentPosition,
    // que tiene su propio inner try/catch con fallback silencioso).
    // Simular un error inesperado al intentar guardar el punto:
    (mockLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (mockLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValue(LOC_MOCK);
    mockGuardarPuntoOffline.mockRejectedValueOnce(new Error('Storage error: disk full'));

    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    expect(result.current.error).toContain('Storage error');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DESACTIVAR
// ══════════════════════════════════════════════════════════════════════════════

describe('desactivar', () => {
  it('pone estaActivo=false y persiste "0"', async () => {
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    await act(async () => {
      await result.current.desactivar();
    });

    expect(result.current.estaActivo).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('route:tracking_enabled', '0');
  });

  it('limpia el error al desactivar', async () => {
    (mockLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar(); // falla → error
    });

    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.desactivar();
    });

    expect(result.current.error).toBeNull();
  });

  it('llama a detenerRouteSyncAutomatico', async () => {
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
      await result.current.desactivar();
    });

    expect(mockDetenerRouteSyncAutomatico).toHaveBeenCalled();
  });

  it('intenta sync final al desactivar si hay conexión', async () => {
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
      await result.current.desactivar();
    });

    expect(mockSyncRoutePoints).toHaveBeenCalled();
  });

  it('no intenta sync al desactivar si isConnected===false', async () => {
    mockNetInfoFetch
      .mockResolvedValueOnce({ isConnected: true })   // para activar
      .mockResolvedValueOnce({ isConnected: false });  // para desactivar

    const { result } = renderHook(() => useRouteTracking(true));

    // Resetear llamadas de sync del activar
    await act(async () => { await result.current.activar(); });
    mockSyncRoutePoints.mockClear();

    await act(async () => { await result.current.desactivar(); });

    expect(mockSyncRoutePoints).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FORZAR SYNC
// ══════════════════════════════════════════════════════════════════════════════

describe('forzarSync', () => {
  it('sincroniza si isConnected !== false', async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: true });
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.forzarSync();
    });

    expect(mockSyncRoutePoints).toHaveBeenCalled();
  });

  it('NO sincroniza si isConnected === false', async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.forzarSync();
    });

    expect(mockSyncRoutePoints).not.toHaveBeenCalled();
  });

  it('SÍ sincroniza si isConnected === null (Android desconocido)', async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: null });
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.forzarSync();
    });

    expect(mockSyncRoutePoints).toHaveBeenCalled();
  });

  it('actualiza el contador de pendientes tras sync', async () => {
    mockContarPendientesRoute.mockResolvedValue(3);
    const { result } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.forzarSync();
    });

    expect(result.current.pendientes).toBe(3);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ESTADO PERSISTIDO
// ══════════════════════════════════════════════════════════════════════════════

describe('estado persistido', () => {
  it('restaura estaActivo=true si AsyncStorage tiene "1"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'route:tracking_enabled') return Promise.resolve('1');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useRouteTracking(true));

    await waitFor(() => {
      expect(result.current.estaActivo).toBe(true);
    });
  });

  it('no restaura estado si isAsesor=false', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'route:tracking_enabled') return Promise.resolve('1');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useRouteTracking(false));

    // Esperar un tick para que el useEffect corra
    await act(async () => { await Promise.resolve(); });

    expect(result.current.estaActivo).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CLEANUP AL DESMONTAR
// ══════════════════════════════════════════════════════════════════════════════

describe('cleanup al desmontar', () => {
  it('llama a detenerRouteSyncAutomatico al desmontar', async () => {
    const { result, unmount } = renderHook(() => useRouteTracking(true));

    await act(async () => {
      await result.current.activar();
    });

    mockDetenerRouteSyncAutomatico.mockClear();
    unmount();

    expect(mockDetenerRouteSyncAutomatico).toHaveBeenCalled();
  });
});
