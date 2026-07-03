/**
 * Tests: src/services/routeTracking.ts
 *
 * Cubre los bugs corregidos y el comportamiento esperado de:
 *  - Cola offline (guardar, leer, limpiar)
 *  - syncRoutePoints:
 *      · NetInfo.isConnected === false  → no sync
 *      · NetInfo.isConnected === null   → SÍ intenta (Android desconocido)
 *      · NetInfo.isConnected === true   → sync normal
 *      · batch exitoso marca todos como sync=true y persiste en AsyncStorage
 *      · batch falla → fallback item-por-item
 *      · guarda correctamente en AsyncStorage tras sync
 *  - contarPendientesRoute: cuenta puntos individuales, no items de cola
 *  - iniciarRouteSyncAutomatico / detenerRouteSyncAutomatico
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as api from '../../src/services/api';

// Mockear guardarPuntosRuta directamente desde api
jest.mock('../../src/services/api', () => ({
  ...jest.requireActual('../../src/services/api'),
  guardarPuntosRuta: jest.fn(),
}));

// Importar DESPUÉS del mock para que el módulo use el mock
import {
  guardarPuntoOffline,
  guardarPuntosBatchOffline,
  getQueue,
  getPendientes,
  clearQueue,
  syncRoutePoints,
  contarPendientesRoute,
  iniciarRouteSyncAutomatico,
  detenerRouteSyncAutomatico,
} from '../../src/services/routeTracking';

const mockGuardarPuntosRuta = api.guardarPuntosRuta as jest.Mock;
const mockNetInfoFetch = NetInfo.fetch as jest.Mock;
const mockNetInfoAddEventListener = NetInfo.addEventListener as jest.Mock;

// ── Punto de prueba ────────────────────────────────────────────────────────────

const PUNTO_A = { lat: 19.4326, lng: -99.1332, precision: 10, velocidad: 0, timestamp: '2025-01-01T10:00:00.000Z' };
const PUNTO_B = { lat: 19.4400, lng: -99.1400, precision: 8,  velocidad: 15, timestamp: '2025-01-01T10:02:00.000Z' };
const PUNTO_C = { lat: 19.4500, lng: -99.1500, precision: 12, velocidad: 20, timestamp: '2025-01-01T10:04:00.000Z' };

// ── Helper: limpiar estado entre tests ─────────────────────────────────────────

beforeEach(async () => {
  await clearQueue();
  jest.clearAllMocks();
  // Resetear también el listener de NetInfo (variable de módulo en routeTracking)
  detenerRouteSyncAutomatico();
  // NetInfo por defecto: conectado
  mockNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  mockGuardarPuntosRuta.mockResolvedValue({ saved: 1, ids: [1] });
  // Restaurar el mock de addEventListener al default del setup
  mockNetInfoAddEventListener.mockReturnValue(jest.fn());
});

// ══════════════════════════════════════════════════════════════════════════════
// COLA OFFLINE
// ══════════════════════════════════════════════════════════════════════════════

describe('Cola offline', () => {
  it('guardarPuntoOffline agrega un item a la cola con sync=false', async () => {
    await guardarPuntoOffline(PUNTO_A);
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].sync).toBe(false);
    expect(queue[0].puntos[0]).toEqual(PUNTO_A);
  });

  it('guardarPuntosBatchOffline agrega un item con múltiples puntos', async () => {
    await guardarPuntosBatchOffline([PUNTO_A, PUNTO_B]);
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].puntos).toHaveLength(2);
    expect(queue[0].sync).toBe(false);
  });

  it('guardarPuntosBatchOffline con array vacío no agrega nada', async () => {
    await guardarPuntosBatchOffline([]);
    const queue = await getQueue();
    expect(queue).toHaveLength(0);
  });

  it('múltiples guardarPuntoOffline acumulan items separados', async () => {
    await guardarPuntoOffline(PUNTO_A);
    await guardarPuntoOffline(PUNTO_B);
    const queue = await getQueue();
    expect(queue).toHaveLength(2);
  });

  it('clearQueue vacía la cola', async () => {
    await guardarPuntoOffline(PUNTO_A);
    await clearQueue();
    const queue = await getQueue();
    expect(queue).toHaveLength(0);
  });

  it('getQueue retorna [] si AsyncStorage está vacío', async () => {
    const queue = await getQueue();
    expect(queue).toEqual([]);
  });

  it('getPendientes devuelve solo puntos con sync=false', async () => {
    await guardarPuntoOffline(PUNTO_A);
    await guardarPuntoOffline(PUNTO_B);
    const pendientes = await getPendientes();
    expect(pendientes).toHaveLength(2);
    expect(pendientes).toContainEqual(PUNTO_A);
    expect(pendientes).toContainEqual(PUNTO_B);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// contarPendientesRoute
// ══════════════════════════════════════════════════════════════════════════════

describe('contarPendientesRoute', () => {
  it('retorna 0 cuando la cola está vacía', async () => {
    expect(await contarPendientesRoute()).toBe(0);
  });

  it('cuenta puntos individuales, no items de cola', async () => {
    // 1 item con 2 puntos + 1 item con 1 punto = 3 puntos totales
    await guardarPuntosBatchOffline([PUNTO_A, PUNTO_B]);
    await guardarPuntoOffline(PUNTO_C);
    expect(await contarPendientesRoute()).toBe(3);
  });

  it('no cuenta los items ya sincronizados', async () => {
    await guardarPuntoOffline(PUNTO_A);
    await guardarPuntoOffline(PUNTO_B);

    // Marcar el primero como sincronizado manualmente
    const raw = await AsyncStorage.getItem('route:points_queue');
    const queue = JSON.parse(raw!);
    queue[0].sync = true;
    await AsyncStorage.setItem('route:points_queue', JSON.stringify(queue));

    // Solo debe contar PUNTO_B
    expect(await contarPendientesRoute()).toBe(1);
  });

  it('con 8 items de 1 punto cada uno retorna 8', async () => {
    for (let i = 0; i < 8; i++) {
      await guardarPuntoOffline({ ...PUNTO_A, timestamp: `2025-01-01T10:0${i}:00.000Z` });
    }
    expect(await contarPendientesRoute()).toBe(8);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// syncRoutePoints — comprobación de conectividad
// ══════════════════════════════════════════════════════════════════════════════

describe('syncRoutePoints — verificación de red', () => {
  it('no sincroniza si isConnected === false', async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
    await guardarPuntoOffline(PUNTO_A);

    const result = await syncRoutePoints();

    expect(result).toEqual({ ok: 0, errores: 0 });
    expect(mockGuardarPuntosRuta).not.toHaveBeenCalled();
    // El punto sigue pendiente
    expect(await contarPendientesRoute()).toBe(1);
  });

  it('SÍ sincroniza si isConnected === null (Android desconocido) — BUG CORREGIDO', async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: null, isInternetReachable: null });
    await guardarPuntoOffline(PUNTO_A);

    const result = await syncRoutePoints();

    expect(mockGuardarPuntosRuta).toHaveBeenCalled();
    expect(result.ok).toBeGreaterThan(0);
  });

  it('SÍ sincroniza si isConnected === true pero isInternetReachable === null', async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: true, isInternetReachable: null });
    await guardarPuntoOffline(PUNTO_A);

    const result = await syncRoutePoints();

    expect(mockGuardarPuntosRuta).toHaveBeenCalled();
    expect(result.ok).toBeGreaterThan(0);
  });

  it('no sincroniza si la cola está vacía', async () => {
    const result = await syncRoutePoints();
    expect(result).toEqual({ ok: 0, errores: 0 });
    expect(mockGuardarPuntosRuta).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// syncRoutePoints — lógica de batch y persistencia
// ══════════════════════════════════════════════════════════════════════════════

describe('syncRoutePoints — batch y persistencia', () => {
  it('envía todos los puntos pendientes en un único request batch', async () => {
    await guardarPuntoOffline(PUNTO_A);
    await guardarPuntoOffline(PUNTO_B);
    await guardarPuntoOffline(PUNTO_C);

    mockGuardarPuntosRuta.mockResolvedValueOnce({ saved: 3, ids: [1, 2, 3] });

    const result = await syncRoutePoints();

    // Solo 1 llamada al API (batch, no 3)
    expect(mockGuardarPuntosRuta).toHaveBeenCalledTimes(1);
    const llamada = mockGuardarPuntosRuta.mock.calls[0][0];
    expect(llamada).toHaveLength(3);
    expect(result.ok).toBe(3);
    expect(result.errores).toBe(0);
  });

  it('tras sync exitoso la cola no tiene pendientes', async () => {
    await guardarPuntoOffline(PUNTO_A);
    await guardarPuntoOffline(PUNTO_B);

    await syncRoutePoints();

    expect(await contarPendientesRoute()).toBe(0);
  });

  it('los items syncados persisten en AsyncStorage con sync=true', async () => {
    await guardarPuntoOffline(PUNTO_A);

    await syncRoutePoints();

    const raw = await AsyncStorage.getItem('route:points_queue');
    const queue = JSON.parse(raw!);
    // Todos los items deben tener sync=true
    expect(queue.every((item: any) => item.sync === true)).toBe(true);
  });

  it('si el batch falla, cae a fallback item-por-item y salva los que puede', async () => {
    await guardarPuntoOffline(PUNTO_A);
    await guardarPuntoOffline(PUNTO_B);

    // Primer call (batch) falla, segundo y tercer call (item-por-item) éxito
    mockGuardarPuntosRuta
      .mockRejectedValueOnce(new Error('Batch error'))
      .mockResolvedValueOnce({ saved: 1, ids: [1] })
      .mockResolvedValueOnce({ saved: 1, ids: [2] });

    const result = await syncRoutePoints();

    expect(result.ok).toBe(2);
    expect(result.errores).toBe(0);
    expect(await contarPendientesRoute()).toBe(0);
  });

  it('si el batch y algunos items-por-item fallan, registra errores correctamente', async () => {
    await guardarPuntoOffline(PUNTO_A);
    await guardarPuntoOffline(PUNTO_B);

    // Batch falla, primer item-por-item falla, segundo éxito
    mockGuardarPuntosRuta
      .mockRejectedValueOnce(new Error('Batch error'))
      .mockRejectedValueOnce(new Error('Item error'))
      .mockResolvedValueOnce({ saved: 1, ids: [2] });

    const result = await syncRoutePoints();

    expect(result.ok).toBe(1);
    expect(result.errores).toBe(1);
    // El punto que falló sigue pendiente
    expect(await contarPendientesRoute()).toBe(1);
  });

  it('los items nuevos agregados después de sync siguen siendo pendientes', async () => {
    await guardarPuntoOffline(PUNTO_A);
    await syncRoutePoints();

    // Agregar un punto después del sync
    await guardarPuntoOffline(PUNTO_B);

    expect(await contarPendientesRoute()).toBe(1);
  });

  it('mantiene máximo 50 items syncados como historial', async () => {
    // Agregar 60 puntos y sincronizarlos todos
    for (let i = 0; i < 60; i++) {
      await guardarPuntoOffline({ ...PUNTO_A, timestamp: `2025-01-01T${String(i).padStart(2,'0')}:00:00.000Z` });
    }

    mockGuardarPuntosRuta.mockResolvedValue({ saved: 60, ids: [] });
    await syncRoutePoints();

    const raw = await AsyncStorage.getItem('route:points_queue');
    const queue = JSON.parse(raw!);
    // Máximo 50 items historial + 0 pendientes
    expect(queue.length).toBeLessThanOrEqual(50);
    expect(queue.every((item: any) => item.sync === true)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Listener de conectividad
// ══════════════════════════════════════════════════════════════════════════════

describe('iniciarRouteSyncAutomatico / detenerRouteSyncAutomatico', () => {
  it('registra un listener de NetInfo al iniciar', () => {
    iniciarRouteSyncAutomatico();
    expect(mockNetInfoAddEventListener).toHaveBeenCalledTimes(1);
  });

  it('no registra doble listener si se llama dos veces', () => {
    iniciarRouteSyncAutomatico();
    iniciarRouteSyncAutomatico(); // segunda llamada debe ignorarse
    expect(mockNetInfoAddEventListener).toHaveBeenCalledTimes(1);
    // Cleanup para que el siguiente test empiece limpio
    detenerRouteSyncAutomatico();
  });

  it('detenerRouteSyncAutomatico llama al unsubscribe', () => {
    const mockUnsub = jest.fn();
    mockNetInfoAddEventListener.mockReturnValueOnce(mockUnsub);

    iniciarRouteSyncAutomatico();
    detenerRouteSyncAutomatico();

    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });

  it('el listener SÍ dispara syncRoutePoints cuando isConnected !== false', async () => {
    await guardarPuntoOffline(PUNTO_A);
    let capturedCallback: ((state: any) => void) | null = null;

    mockNetInfoAddEventListener.mockImplementationOnce((cb: (state: any) => void) => {
      capturedCallback = cb;
      return jest.fn();
    });

    iniciarRouteSyncAutomatico();
    expect(capturedCallback).not.toBeNull();

    // El listener llama syncRoutePoints() sin await — la función es disparada pero
    // no esperada. Verificamos que el callback fue registrado y se llama sin lanzar,
    // y que si hay red el sync eventualmente procesa la cola.
    // Preparar NetInfo para que syncRoutePoints proceda
    mockNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });

    // Llamar el callback y esperar el ciclo completo de promesas
    let syncPromise: Promise<any> | undefined;
    mockGuardarPuntosRuta.mockImplementationOnce(() => {
      return Promise.resolve({ saved: 1, ids: [1] });
    });

    capturedCallback!({ isConnected: true, isInternetReachable: true });

    // Drenamos la microtask queue completamente
    await new Promise(resolve => setImmediate(resolve));

    expect(mockGuardarPuntosRuta).toHaveBeenCalled();

    detenerRouteSyncAutomatico();
  });

  it('el listener NO dispara syncRoutePoints cuando isConnected === false', async () => {
    await guardarPuntoOffline(PUNTO_A);
    let capturedCallback: ((state: any) => void) | null = null;

    mockNetInfoAddEventListener.mockImplementationOnce((cb: (state: any) => void) => {
      capturedCallback = cb;
      return jest.fn();
    });

    iniciarRouteSyncAutomatico();

    // Con isConnected=false, el listener verifica `state.isConnected !== false`
    // que es false, así que NO llama syncRoutePoints
    if (capturedCallback) {
      capturedCallback({ isConnected: false, isInternetReachable: false });
      await new Promise(resolve => setImmediate(resolve));
    }
    expect(mockGuardarPuntosRuta).not.toHaveBeenCalled();

    detenerRouteSyncAutomatico();
  });

  it('el listener SÍ dispara syncRoutePoints con isConnected=null (Android)', async () => {
    await guardarPuntoOffline(PUNTO_A);
    let capturedCallback: ((state: any) => void) | null = null;

    mockNetInfoAddEventListener.mockImplementationOnce((cb: (state: any) => void) => {
      capturedCallback = cb;
      return jest.fn();
    });

    iniciarRouteSyncAutomatico();

    // Con isConnected=null (Android desconocido), el listener verifica `null !== false`
    // que es true, así que SÍ llama syncRoutePoints
    mockNetInfoFetch.mockResolvedValue({ isConnected: null, isInternetReachable: null });
    mockGuardarPuntosRuta.mockResolvedValue({ saved: 1, ids: [1] });

    if (capturedCallback) {
      capturedCallback({ isConnected: null, isInternetReachable: null });
      await new Promise(resolve => setImmediate(resolve));
    }
    expect(mockGuardarPuntosRuta).toHaveBeenCalled();

    detenerRouteSyncAutomatico();
  });
});
