/**
 * Servicio de tracking GPS para registra la ruta del asesor.
 *
 * El backend ya tiene:
 *   POST /api/v1/routes/points  → recibe batch de puntos { points: [{lat, lng, precision, velocidad, timestamp}] }
 *
 * Aquí solo manejamos la cola offline y la sincronización.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { guardarPuntosRuta } from './api';

const KEY_ROUTE_QUEUE = 'route:points_queue';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface RoutePoint {
  lat:        number;
  lng:        number;
  precision:  number;   // metros
  velocidad:  number;  // km/h
  timestamp:  string;  // ISO 8601
}

interface QueueItem {
  puntos:    RoutePoint[];
  sync:      boolean;  // true = enviado, false = pendiente
  synced_at?: string;
}

// ── Cola offline ────────────────────────────────────────────────────────────────

export async function guardarPuntoOffline(punto: RoutePoint): Promise<void> {
  const queue = await getQueue();
  queue.push({ puntos: [punto], sync: false });
  await AsyncStorage.setItem(KEY_ROUTE_QUEUE, JSON.stringify(queue));
}

export async function guardarPuntosBatchOffline(puntos: RoutePoint[]): Promise<void> {
  if (puntos.length === 0) return;
  const queue = await getQueue();
  queue.push({ puntos, sync: false });
  await AsyncStorage.setItem(KEY_ROUTE_QUEUE, JSON.stringify(queue));
}

export async function getQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_ROUTE_QUEUE);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

export async function getPendientes(): Promise<RoutePoint[]> {
  const queue = await getQueue();
  const pendientes: RoutePoint[] = [];
  for (const item of queue) {
    if (!item.sync) {
      pendientes.push(...item.puntos);
    }
  }
  return pendientes;
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(KEY_ROUTE_QUEUE);
}

// ── Sincronización ─────────────────────────────────────────────────────────────

let syncEnProceso = false;

export async function syncRoutePoints(): Promise<{ ok: number; errores: number }> {
  if (syncEnProceso) return { ok: 0, errores: 0 };

  const state = await NetInfo.fetch();
  if (!state.isConnected || !state.isInternetReachable) {
    return { ok: 0, errores: 0 };
  }

  syncEnProceso = true;
  let ok = 0;
  let errores = 0;

  try {
    const queue = await getQueue();
    const pendientes = queue.filter(item => !item.sync);

    if (pendientes.length === 0) {
      return { ok: 0, errores: 0 };
    }

    for (const item of pendientes) {
      try {
        await guardarPuntosRuta(item.puntos);
        item.sync = true;
        item.synced_at = new Date().toISOString();
        ok++;
      } catch {
        errores++;
      }
    }

    // Mantener solo los últimos 50 items syncados para referencia
    const todos = queue.filter(item => !item.sync).concat(
      queue.filter(item => item.sync).slice(-50)
    );
    await AsyncStorage.setItem(KEY_ROUTE_QUEUE, JSON.stringify(todos));
  } finally {
    syncEnProceso = false;
  }

  return { ok, errores };
}

// ── Conteo pendientes ─────────────────────────────────────────────────────────

export async function contarPendientesRoute(): Promise<number> {
  const queue = await getQueue();
  return queue.filter(item => !item.sync).length;
}

// ── Listener de conectividad ─────────────────────────────────────────────────

let unsubscribeNetInfo: (() => void) | null = null;

export function iniciarRouteSyncAutomatico(): void {
  if (unsubscribeNetInfo) return;
  unsubscribeNetInfo = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      syncRoutePoints();
    }
  });
}

export function detenerRouteSyncAutomatico(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
}
