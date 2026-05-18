/**
 * Servicio de almacenamiento offline y sincronización
 *
 * Arquitectura:
 *  - AsyncStorage como cache local (contactos, expedientes)
 *  - Cola de operaciones pendientes para creación/actualización offline
 *  - Sync automático al recuperar conexión via NetInfo
 *  - Integración con el endpoint POST /api/v1/sync del backend
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import 'react-native-get-random-values'; // requerido para uuid en RN
import { v4 as uuidv4 } from 'uuid';

import { syncBatch } from './api';
import type { Contacto, Expediente, OperacionSync } from '../types';

// ── Claves de AsyncStorage ───────────────────────────────────────────────────

const KEYS = {
  CONTACTOS:          'cache:contactos',
  EXPEDIENTES:        'cache:expedientes',
  SYNC_QUEUE:         'sync:queue',
  LAST_SYNC:          'sync:last_at',
} as const;

// ── Tipos internos ───────────────────────────────────────────────────────────

export interface OperacionPendiente extends OperacionSync {
  id_local:   string;
  timestamp:  string;
  intentos:   number;
  estado:     'pendiente' | 'procesando' | 'ok' | 'error';
}

// ── Cache: Contactos ─────────────────────────────────────────────────────────

export async function cacheContactos(data: Contacto[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CONTACTOS, JSON.stringify(data));
}

export async function getCacheContactos(): Promise<Contacto[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CONTACTOS);
    return raw ? (JSON.parse(raw) as Contacto[]) : [];
  } catch {
    return [];
  }
}

// ── Cache: Expedientes ───────────────────────────────────────────────────────

export async function cacheExpedientes(data: Expediente[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.EXPEDIENTES, JSON.stringify(data));
}

export async function getCacheExpedientes(): Promise<Expediente[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.EXPEDIENTES);
    return raw ? (JSON.parse(raw) as Expediente[]) : [];
  } catch {
    return [];
  }
}

// ── Cola de operaciones pendientes ───────────────────────────────────────────

export async function encolarOperacion(
  tipo: OperacionSync['tipo'],
  datos: Record<string, unknown>,
): Promise<string> {
  const op: OperacionPendiente = {
    id_local:  uuidv4(),
    tipo,
    datos,
    timestamp: new Date().toISOString(),
    intentos:  0,
    estado:    'pendiente',
  };

  const queue = await getQueue();
  queue.push(op);
  await AsyncStorage.setItem(KEYS.SYNC_QUEUE, JSON.stringify(queue));
  return op.id_local;
}

export async function getQueue(): Promise<OperacionPendiente[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SYNC_QUEUE);
    return raw ? (JSON.parse(raw) as OperacionPendiente[]) : [];
  } catch {
    return [];
  }
}

export async function limpiarQueue(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.SYNC_QUEUE);
}

export async function contarPendientes(): Promise<number> {
  const q = await getQueue();
  return q.length;
}

// ── Sincronización ───────────────────────────────────────────────────────────

let syncEnProceso = false;

/**
 * Intenta sincronizar la cola de operaciones pendientes con el backend.
 * Retorna el número de operaciones procesadas.
 */
export async function sincronizar(): Promise<{ ok: number; errores: number }> {
  if (syncEnProceso) return { ok: 0, errores: 0 };

  const queue = await getQueue();
  if (queue.length === 0) return { ok: 0, errores: 0 };

  syncEnProceso = true;
  let ok = 0;
  let errores = 0;

  try {
    const operaciones: OperacionSync[] = queue.map(op => ({
      id_local:  op.id_local,
      tipo:      op.tipo,
      datos:     op.datos,
      timestamp: op.timestamp,
      intentos:  op.intentos,
      estado:    'procesando' as const,
    }));

    const resultado = await syncBatch(operaciones);
    const fallidas: OperacionPendiente[] = [];

    for (const res of resultado.resultados) {
      const original = queue.find(q => q.id_local === res.id_local);
      if (res.estado === 'ok') {
        ok++;
      } else {
        errores++;
        if (original && original.intentos < 3) {
          fallidas.push({ ...original, intentos: original.intentos + 1 });
        }
        // Si ya intentó 3 veces, se descarta (evitar loop infinito)
      }
    }

    // Guardar solo las que fallaron y aún tienen intentos restantes
    await AsyncStorage.setItem(KEYS.SYNC_QUEUE, JSON.stringify(fallidas));
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());

  } catch {
    // Sin conexión — no hacer nada, reintentar después
  } finally {
    syncEnProceso = false;
  }

  return { ok, errores };
}

export async function getUltimaSincronizacion(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.LAST_SYNC);
}

// ── Listener de conectividad ─────────────────────────────────────────────────

let unsubscribeNetInfo: (() => void) | null = null;

/**
 * Inicia el listener de conectividad. Llamar una sola vez al arrancar la app.
 * Cuando se recupera la conexión, sincroniza automáticamente.
 */
export function iniciarSyncAutomatico(): void {
  if (unsubscribeNetInfo) return; // ya activo

  unsubscribeNetInfo = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      sincronizar();
    }
  });
}

export function detenerSyncAutomatico(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
}

// ── Hook conveniente ─────────────────────────────────────────────────────────
// Se exporta desde src/hooks/useOfflineSync.ts para mantener separación
