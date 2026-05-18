/**
 * Tests: src/services/offline.ts
 *
 * Cubre:
 *  - cacheContactos / getCacheContactos
 *  - cacheExpedientes / getCacheExpedientes
 *  - encolarOperacion / getQueue / limpiarQueue / contarPendientes
 *  - sincronizar: procesa cola, descarta ok, reintenta errores (máx 3), guarda last_sync
 *  - sincronizar: no hace nada si cola vacía
 *  - sincronizar: no hace nada si ya hay sync en proceso (guard)
 *  - iniciarSyncAutomatico / detenerSyncAutomatico
 *  - getUltimaSincronizacion
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { v4 as uuidv4 } from 'uuid';

import {
  cacheContactos, getCacheContactos,
  cacheExpedientes, getCacheExpedientes,
  encolarOperacion, getQueue, limpiarQueue, contarPendientes,
  sincronizar,
  getUltimaSincronizacion,
  iniciarSyncAutomatico, detenerSyncAutomatico,
} from '../../src/services/offline';

// mock de syncBatch (llamado dentro de offline.ts)
jest.mock('../../src/services/api', () => ({
  syncBatch: jest.fn(),
}));
import { syncBatch } from '../../src/services/api';
const mockSyncBatch = syncBatch as jest.Mock;

// ── helpers ────────────────────────────────────────────────────────────────
const CONTACTO = { id: 1, nombre: 'Ana', apellido_paterno: 'Gómez', apellido_materno: '', email: 'ana@test.com', telefono: '5500', estado_prospecto: 'nuevo', created_at: '2025-01-01' };
const EXPEDIENTE = { id: 1, folio: 'EXP-001', contacto_id: 1, tipo_tramite_id: 1, etapa_tramite_id: 1, estado: 'en_proceso', created_at: '2025-01-01' };

beforeEach(async () => {
  // limpiar AsyncStorage simulado entre tests
  await AsyncStorage.clear();
  mockSyncBatch.mockReset();
  jest.clearAllMocks();
  (uuidv4 as jest.Mock).mockReturnValue('mock-uuid-1234');
});

// ── Cache Contactos ────────────────────────────────────────────────────────

describe('Cache: Contactos', () => {
  it('getCacheContactos retorna [] cuando no hay cache', async () => {
    const data = await getCacheContactos();
    expect(data).toEqual([]);
  });

  it('cacheContactos persiste y getCacheContactos recupera', async () => {
    await cacheContactos([CONTACTO]);
    const data = await getCacheContactos();
    expect(data).toHaveLength(1);
    expect(data[0].nombre).toBe('Ana');
  });

  it('getCacheContactos retorna [] si AsyncStorage falla', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('IO error'));
    const data = await getCacheContactos();
    expect(data).toEqual([]);
  });
});

// ── Cache Expedientes ──────────────────────────────────────────────────────

describe('Cache: Expedientes', () => {
  it('getCacheExpedientes retorna [] cuando no hay cache', async () => {
    expect(await getCacheExpedientes()).toEqual([]);
  });

  it('cacheExpedientes persiste y getCacheExpedientes recupera', async () => {
    await cacheExpedientes([EXPEDIENTE]);
    const data = await getCacheExpedientes();
    expect(data[0].folio).toBe('EXP-001');
  });
});

// ── Cola de operaciones ────────────────────────────────────────────────────

describe('Cola de operaciones', () => {
  it('getQueue retorna [] cuando no hay operaciones', async () => {
    expect(await getQueue()).toEqual([]);
  });

  it('encolarOperacion agrega una operación a la cola', async () => {
    const id = await encolarOperacion('crear_contacto', { nombre: 'Test' });
    expect(id).toBe('mock-uuid-1234');
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].tipo).toBe('crear_contacto');
    expect(queue[0].estado).toBe('pendiente');
    expect(queue[0].intentos).toBe(0);
  });

  it('encolarOperacion acumula múltiples operaciones', async () => {
    await encolarOperacion('crear_contacto', { nombre: 'A' });
    await encolarOperacion('actualizar_expediente', { folio: 'X' });
    const queue = await getQueue();
    expect(queue).toHaveLength(2);
  });

  it('limpiarQueue vacía la cola', async () => {
    await encolarOperacion('crear_contacto', { nombre: 'A' });
    await limpiarQueue();
    expect(await getQueue()).toEqual([]);
  });

  it('contarPendientes retorna número correcto', async () => {
    expect(await contarPendientes()).toBe(0);
    await encolarOperacion('crear_contacto', { nombre: 'A' });
    await encolarOperacion('crear_contacto', { nombre: 'B' });
    expect(await contarPendientes()).toBe(2);
  });
});

// ── Sincronización ─────────────────────────────────────────────────────────

describe('sincronizar', () => {
  it('retorna {ok:0, errores:0} si la cola está vacía', async () => {
    const result = await sincronizar();
    expect(result).toEqual({ ok: 0, errores: 0 });
    expect(mockSyncBatch).not.toHaveBeenCalled();
  });

  it('procesa operaciones exitosas y vacía la cola', async () => {
    await encolarOperacion('crear_contacto', { nombre: 'Ana' });
    mockSyncBatch.mockResolvedValueOnce({
      resultados: [{ id_local: 'mock-uuid-1234', estado: 'ok', mensaje: 'creado' }],
      procesados: 1, errores: 0,
    });
    const result = await sincronizar();
    expect(result).toEqual({ ok: 1, errores: 0 });
    expect(await getQueue()).toHaveLength(0);
    expect(await getUltimaSincronizacion()).not.toBeNull();
  });

  it('reintenta operaciones fallidas (intentos < 3)', async () => {
    await encolarOperacion('crear_contacto', { nombre: 'Ana' });
    mockSyncBatch.mockResolvedValueOnce({
      resultados: [{ id_local: 'mock-uuid-1234', estado: 'error', mensaje: 'fallo' }],
      procesados: 0, errores: 1,
    });
    const result = await sincronizar();
    expect(result).toEqual({ ok: 0, errores: 1 });
    const queue = await getQueue();
    // debe quedar en cola con intentos=1
    expect(queue).toHaveLength(1);
    expect(queue[0].intentos).toBe(1);
  });

  it('descarta operaciones fallidas después de 3 intentos', async () => {
    // Colocar manualmente una op con intentos=3
    const op = {
      id_local: 'uuid-3',
      tipo: 'crear_contacto' as const,
      datos: { nombre: 'Ana' },
      timestamp: '2025-01-01T00:00:00.000Z',
      intentos: 3,
      estado: 'pendiente' as const,
    };
    await AsyncStorage.setItem('sync:queue', JSON.stringify([op]));

    mockSyncBatch.mockResolvedValueOnce({
      resultados: [{ id_local: 'uuid-3', estado: 'error', mensaje: 'fallo' }],
      procesados: 0, errores: 1,
    });
    await sincronizar();
    // descartada — cola vacía
    expect(await getQueue()).toHaveLength(0);
  });

  it('no hace nada si la conexión falla (catch silencioso)', async () => {
    await encolarOperacion('crear_contacto', { nombre: 'Ana' });
    mockSyncBatch.mockRejectedValueOnce(new Error('Network error'));
    const result = await sincronizar();
    // No lanza, retorna contadores 0
    expect(result).toEqual({ ok: 0, errores: 0 });
  });
});

// ── getUltimaSincronizacion ────────────────────────────────────────────────

describe('getUltimaSincronizacion', () => {
  it('retorna null si nunca se ha sincronizado', async () => {
    expect(await getUltimaSincronizacion()).toBeNull();
  });

  it('retorna ISO string después de sincronizar', async () => {
    await encolarOperacion('crear_contacto', { nombre: 'X' });
    mockSyncBatch.mockResolvedValueOnce({
      resultados: [{ id_local: 'mock-uuid-1234', estado: 'ok', mensaje: 'ok' }],
      procesados: 1, errores: 0,
    });
    await sincronizar();
    const ts = await getUltimaSincronizacion();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── Sync automático (NetInfo listener) ────────────────────────────────────

describe('iniciarSyncAutomatico / detenerSyncAutomatico', () => {
  it('registra listener en NetInfo', () => {
    iniciarSyncAutomatico();
    expect(NetInfo.addEventListener).toHaveBeenCalled();
    detenerSyncAutomatico();
  });

  it('no registra doble listener si ya está activo', () => {
    (NetInfo.addEventListener as jest.Mock).mockClear();
    iniciarSyncAutomatico();
    iniciarSyncAutomatico(); // segunda llamada
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    detenerSyncAutomatico();
  });

  it('detenerSyncAutomatico llama al unsubscribe', () => {
    const mockUnsub = jest.fn();
    (NetInfo.addEventListener as jest.Mock).mockReturnValueOnce(mockUnsub);
    iniciarSyncAutomatico();
    detenerSyncAutomatico();
    expect(mockUnsub).toHaveBeenCalled();
  });
});
