/**
 * Servicio de almacenamiento offline y sincronización
 *
 * Arquitectura:
 *  - AsyncStorage como cache local (contactos, expedientes)
 *  - Cola de operaciones JSON para crear/actualizar registros
 *  - Cola separada de documentos para uploads binarios
 *  - Sync automático al recuperar conexión via NetInfo
 *
 * Dos colas porque:
 *  - Ops JSON   → se envían en batch a POST /api/v1/sync
 *  - Documentos → se suben individualmente a POST /expedientes/:id/documentos
 *    (son archivos binarios, no caben en JSON)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { v4 as uuidv4 } from 'uuid';

import { syncBatch, uploadDocumento } from './api';
import type { Contacto, Expediente, OperacionSync } from '../types';

// ── Claves de AsyncStorage ───────────────────────────────────────────────────

const KEYS = {
  CONTACTOS:       'cache:contactos',
  EXPEDIENTES:     'cache:expedientes',
  SYNC_QUEUE:      'sync:queue',          // operaciones JSON
  DOCS_QUEUE:      'sync:docs_queue',     // uploads de documentos
  LAST_SYNC:       'sync:last_at',
} as const;

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface OperacionPendiente extends OperacionSync {
  id_local:  string;
  timestamp: string;
  intentos:  number;
  estado:    'pendiente' | 'procesando' | 'ok' | 'error';
}

/** Un documento escaneado que no pudo subirse por falta de conexión */
export interface DocumentoPendiente {
  id_local:     string;
  expedienteId: number;
  uri:          string;   // file:// URI del PDF/imagen guardada en el dispositivo
  tipo:         string;   // tipo de documento (identificacion_oficial, etc.)
  mimeType:     string;   // 'application/pdf' | 'image/jpeg'
  notas?:       string;
  timestamp:    string;
  intentos:     number;
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

// ── Cola de operaciones JSON ─────────────────────────────────────────────────

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

// ── Cola de documentos ───────────────────────────────────────────────────────

/**
 * Encola un documento para subir cuando haya conexión.
 * Úsalo cuando el usuario escanea/selecciona un archivo estando offline.
 */
export async function encolarDocumento(params: {
  expedienteId: number;
  uri:          string;
  tipo:         string;
  mimeType:     string;
  notas?:       string;
}): Promise<string> {
  const doc: DocumentoPendiente = {
    id_local:     uuidv4(),
    expedienteId: params.expedienteId,
    uri:          params.uri,
    tipo:         params.tipo,
    mimeType:     params.mimeType,
    notas:        params.notas,
    timestamp:    new Date().toISOString(),
    intentos:     0,
  };
  const queue = await getDocsQueue();
  queue.push(doc);
  await AsyncStorage.setItem(KEYS.DOCS_QUEUE, JSON.stringify(queue));
  return doc.id_local;
}

export async function getDocsQueue(): Promise<DocumentoPendiente[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DOCS_QUEUE);
    return raw ? (JSON.parse(raw) as DocumentoPendiente[]) : [];
  } catch {
    return [];
  }
}

// ── Conteo total de pendientes ────────────────────────────────────────────────

/** Suma de operaciones JSON + documentos pendientes */
export async function contarPendientes(): Promise<number> {
  const [ops, docs] = await Promise.all([getQueue(), getDocsQueue()]);
  return ops.length + docs.length;
}

// ── Sincronización ───────────────────────────────────────────────────────────

let syncEnProceso = false;

/**
 * Procesa ambas colas:
 *  1. Operaciones JSON → batch a /api/v1/sync
 *  2. Documentos → upload individual a /expedientes/:id/documentos
 *
 * Retorna totales de ok y errores en ambas colas.
 */
export async function sincronizar(): Promise<{ ok: number; errores: number }> {
  if (syncEnProceso) return { ok: 0, errores: 0 };
  syncEnProceso = true;

  let ok = 0;
  let errores = 0;

  try {
    // ── 1. Cola JSON ───────────────────────────────────────────────────────
    const queue = await getQueue();
    if (queue.length > 0) {
      const operaciones: OperacionSync[] = queue.map(op => ({
        id_local:  op.id_local,
        tipo:      op.tipo,
        datos:     op.datos,
        timestamp: op.timestamp,
        intentos:  op.intentos,
        estado:    'procesando' as const,
      }));

      try {
        const resultado = await syncBatch(operaciones);
        const fallidas: OperacionPendiente[] = [];

        for (const res of resultado.resultados) {
          const original = queue.find(q => q.id_local === res.id_local);
          if (res.estado === 'ok') {
            ok++;
          } else {
            errores++;
            // Reintentar máximo 3 veces, luego descartar
            if (original && original.intentos < 3) {
              fallidas.push({ ...original, intentos: original.intentos + 1 });
            }
          }
        }
        await AsyncStorage.setItem(KEYS.SYNC_QUEUE, JSON.stringify(fallidas));
      } catch {
        // Sin red — dejar la cola intacta para el próximo intento
      }
    }

    // ── 2. Cola de documentos ─────────────────────────────────────────────
    const docsQueue = await getDocsQueue();
    if (docsQueue.length > 0) {
      const fallidas: DocumentoPendiente[] = [];

      for (const doc of docsQueue) {
        try {
          await uploadDocumento(
            doc.expedienteId,
            doc.uri,
            doc.tipo,
            doc.notas,
            doc.mimeType,
          );
          ok++;
        } catch {
          errores++;
          if (doc.intentos < 3) {
            fallidas.push({ ...doc, intentos: doc.intentos + 1 });
          }
          // Si ya intentó 3 veces (p.ej. archivo borrado), se descarta
        }
      }
      await AsyncStorage.setItem(KEYS.DOCS_QUEUE, JSON.stringify(fallidas));
    }

    if (ok > 0 || errores > 0) {
      await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
    }
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
 * (Usado como fallback; en la app se usa SyncContext que hace lo mismo con más visibilidad)
 */
export function iniciarSyncAutomatico(): void {
  if (unsubscribeNetInfo) return;
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
