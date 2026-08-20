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

// El backend valida `precision` con la regla `integer` de Laravel, que rechaza
// floats (p. ej. 65.32 falla FILTER_VALIDATE_INT). `loc.coords.accuracy` casi
// nunca es un entero exacto, así que sin este redondeo CADA punto fallaba la
// validación (422) y la cola nunca bajaba de tamaño aunque "pareciera" sincronizar.
function normalizarPunto(p: RoutePoint): RoutePoint {
  return { ...p, precision: Math.round(p.precision) };
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
  // isInternetReachable puede ser null en Android (estado desconocido).
  // Solo bloqueamos si sabemos con certeza que NO hay internet (false).
  // null = desconocido → intentar de todas formas.
  if (state.isConnected === false) {
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

    // Intentar enviar todos los items pendientes en un solo batch para reducir requests
    const todosPuntos = pendientes.flatMap(item => item.puntos);
    try {
      await guardarPuntosRuta(todosPuntos.map(normalizarPunto));
      // Marcar todos como enviados
      for (const item of pendientes) {
        item.sync = true;
        item.synced_at = new Date().toISOString();
      }
      ok = pendientes.length;
    } catch {
      // Si el batch falla, intentar uno por uno para salvar los que se pueda
      for (const item of pendientes) {
        try {
          await guardarPuntosRuta(item.puntos.map(normalizarPunto));
          item.sync = true;
          item.synced_at = new Date().toISOString();
          ok++;
        } catch {
          errores++;
        }
      }
    }

    // Persistir: conservar pendientes + últimos 50 syncados como historial
    const actualizados = queue.filter(item => !item.sync).concat(
      queue.filter(item => item.sync).slice(-50)
    );
    await AsyncStorage.setItem(KEY_ROUTE_QUEUE, JSON.stringify(actualizados));
  } finally {
    syncEnProceso = false;
  }

  return { ok, errores };
}

// ── Conteo pendientes ─────────────────────────────────────────────────────────

export async function contarPendientesRoute(): Promise<number> {
  const queue = await getQueue();
  // Contar puntos individuales (no items de cola) para que el número sea preciso
  return queue
    .filter(item => !item.sync)
    .reduce((acc, item) => acc + item.puntos.length, 0);
}

// ── Listener de conectividad ─────────────────────────────────────────────────

let unsubscribeNetInfo: (() => void) | null = null;

export function iniciarRouteSyncAutomatico(): void {
  if (unsubscribeNetInfo) return;
  unsubscribeNetInfo = NetInfo.addEventListener(state => {
    // isInternetReachable puede ser null en Android; solo bloquear si es false explícito
    if (state.isConnected !== false) {
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
