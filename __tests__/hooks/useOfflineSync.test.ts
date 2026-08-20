/**
 * Tests: src/hooks/useOfflineSync.ts
 *
 * Cubre:
 *  - estado inicial: online=true, pendientes=0
 *  - actualiza pendientes al montar
 *  - reacciona al cambio de conectividad (NetInfo listener)
 *  - encolar agrega y refresca contador
 *  - sincronizar dispara doSync y refresca contador
 *  - refrescar actualiza pendientes
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOfflineSync } from '../../src/hooks/useOfflineSync';
import { SyncProvider } from '../../src/contexts/SyncContext';

// mock de offline service
jest.mock('../../src/services/offline', () => ({
  contarPendientes:  jest.fn(() => Promise.resolve(0)),
  encolarOperacion:  jest.fn(() => Promise.resolve('mock-uuid')),
  encolarDocumento:  jest.fn(() => Promise.resolve('mock-doc-uuid')),
  sincronizar:       jest.fn(() => Promise.resolve({ ok: 1, errores: 0 })),
}));
import { contarPendientes, encolarOperacion, sincronizar as doSync } from '../../src/services/offline';
const mockContar   = contarPendientes as jest.Mock;
const mockEncolar  = encolarOperacion as jest.Mock;
const mockDoSync   = doSync as jest.Mock;

// mock de routeTracking service (puntos GPS pendientes, incluidos en el mismo sync)
jest.mock('../../src/services/routeTracking', () => ({
  contarPendientesRoute: jest.fn(() => Promise.resolve(0)),
  syncRoutePoints:       jest.fn(() => Promise.resolve({ ok: 0, errores: 0 })),
}));
import { contarPendientesRoute, syncRoutePoints } from '../../src/services/routeTracking';
const mockContarRoute = contarPendientesRoute as jest.Mock;
const mockSyncRoute   = syncRoutePoints as jest.Mock;

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(SyncProvider, null, children);

let netInfoCallback: ((state: { isConnected: boolean; isInternetReachable: boolean }) => void) | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  netInfoCallback = null;
  mockContar.mockResolvedValue(0);
  mockContarRoute.mockResolvedValue(0);
  mockSyncRoute.mockResolvedValue({ ok: 0, errores: 0 });

  (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
    netInfoCallback = cb;
    return jest.fn(); // unsub
  });
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
});

// ── Estado inicial ─────────────────────────────────────────────────────────

describe('useOfflineSync — estado inicial', () => {
  it('online=true y pendientes=0 por defecto', async () => {
    const { result } = renderHook(() => useOfflineSync(), { wrapper });
    // estado antes del efecto asíncrono
    expect(result.current.online).toBe(true);
    expect(result.current.pendientes).toBe(0);
  });

  it('llama contarPendientes al montar', async () => {
    mockContar.mockResolvedValueOnce(3);
    const { result } = renderHook(() => useOfflineSync(), { wrapper });
    await act(async () => {});
    expect(mockContar).toHaveBeenCalled();
    expect(result.current.pendientes).toBe(3);
  });
});

// ── Conectividad ──────────────────────────────────────────────────────────

describe('useOfflineSync — conectividad', () => {
  it('online=false cuando NetInfo reporta sin conexión', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false, isInternetReachable: false });
    const { result } = renderHook(() => useOfflineSync(), { wrapper });
    await act(async () => {
      netInfoCallback?.({ isConnected: false, isInternetReachable: false });
    });
    expect(result.current.online).toBe(false);
  });

  it('dispara sincronizar cuando se recupera conexión', async () => {
    mockDoSync.mockResolvedValue({ ok: 2, errores: 0 });
    renderHook(() => useOfflineSync(), { wrapper });
    await act(async () => {
      netInfoCallback?.({ isConnected: true, isInternetReachable: true });
    });
    expect(mockDoSync).toHaveBeenCalled();
  });
});

// ── encolar ────────────────────────────────────────────────────────────────

describe('useOfflineSync — encolar', () => {
  it('encolar llama encolarOperacion y actualiza pendientes', async () => {
    mockContar.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const { result } = renderHook(() => useOfflineSync(), { wrapper });
    await act(async () => {});

    let id: string;
    await act(async () => {
      id = await result.current.encolar('crear_contacto', { nombre: 'X' });
    });

    expect(mockEncolar).toHaveBeenCalledWith('crear_contacto', { nombre: 'X' });
    expect(id!).toBe('mock-uuid');
    expect(result.current.pendientes).toBe(1);
  });
});

// ── sincronizar ────────────────────────────────────────────────────────────

describe('useOfflineSync — sincronizar', () => {
  it('sincronizar llama doSync y refresca pendientes', async () => {
    mockDoSync.mockResolvedValue({ ok: 2, errores: 0 });
    mockContar.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    const { result } = renderHook(() => useOfflineSync(), { wrapper });
    await act(async () => {});

    let res: { ok: number; errores: number };
    await act(async () => {
      res = await result.current.sincronizar();
    });

    expect(mockDoSync).toHaveBeenCalled();
    expect(res!).toEqual({ ok: 2, errores: 0 });
    expect(result.current.pendientes).toBe(0);
  });

  it('si sincronizar (ops) revienta, igual refresca los pendientes de rutas GPS ya sincronizados', async () => {
    // Bug real: con Promise.all, un throw en una cola tumbaba el Promise.all
    // completo y saltaba el refrescar() final, dejando el contador (y el
    // header) atorado con el número viejo aunque la otra cola sí se sincronizó.
    mockDoSync.mockRejectedValue(new Error('fallo de red en cola de operaciones'));
    mockSyncRoute.mockResolvedValue({ ok: 5, errores: 0 });
    mockContar.mockResolvedValue(0);
    mockContarRoute.mockResolvedValueOnce(5).mockResolvedValueOnce(0);

    const { result } = renderHook(() => useOfflineSync(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.sincronizar();
    });

    expect(mockSyncRoute).toHaveBeenCalled();
    expect(result.current.pendientes).toBe(0);
  });
});

// ── refrescar ──────────────────────────────────────────────────────────────

describe('useOfflineSync — refrescar', () => {
  it('refrescar actualiza el contador de pendientes', async () => {
    mockContar.mockResolvedValueOnce(0).mockResolvedValueOnce(5);
    const { result } = renderHook(() => useOfflineSync(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.refrescar();
    });

    expect(result.current.pendientes).toBe(5);
  });
});
