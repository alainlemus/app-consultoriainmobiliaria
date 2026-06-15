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
import type { Contacto, Expediente, Ubicacion, OperacionSync } from '../types';

// ── Claves de AsyncStorage ───────────────────────────────────────────────────

const KEYS = {
  CONTACTOS:       'cache:contactos',
  EXPEDIENTES:     'cache:expedientes',
  UBICACIONES:     'cache:ubicaciones',
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
  tipo:         string;   // tipo de documento (nombre del checklist)
  seccion?:     string;   // sección del checklist (acreditado, vendedor, vivienda, otros)
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

/**
 * Busca un contacto específico en el cache por id.
 * Útil para mostrar el detalle offline sin recargar toda la lista.
 */
export async function getCacheContacto(id: number): Promise<Contacto | null> {
  try {
    const all = await getCacheContactos();
    return all.find(c => c.id === id) ?? null;
  } catch {
    return null;
  }
}

/**
 * Agrega o actualiza un contacto individual en el cache.
 * Estrategia de búsqueda:
 *  1. Por _local_id (para reemplazar el pendiente con el id real del servidor)
 *  2. Por id numérico real (para actualizar un contacto que ya existe)
 * Se usa al crear un contacto offline para que aparezca en la lista de inmediato,
 * y al sincronizar para reemplazar el placeholder con el dato real del servidor.
 */
export async function upsertCacheContacto(contacto: Contacto): Promise<void> {
  try {
    const all = await getCacheContactos();
    // Buscar primero por _local_id (caso: sync recibió el id real del servidor)
    let idx = contacto._local_id
      ? all.findIndex(c => c._local_id === contacto._local_id)
      : -1;
    // Si no encontró por _local_id, buscar por id numérico real (no 0)
    if (idx < 0 && contacto.id > 0) {
      idx = all.findIndex(c => c.id === contacto.id);
    }
    if (idx >= 0) {
      all[idx] = contacto;
    } else {
      // Los creados offline van al inicio para que se vean primero
      all.unshift(contacto);
    }
    await cacheContactos(all);
  } catch {
    // No bloquear si falla el cache
  }
}

/**
 * Elimina un contacto del cache local por id o _local_id.
 * Se usa cuando el sync regresa el id real del servidor para reemplazar el local.
 */
export async function removeCacheContacto(idOrLocalId: number | string): Promise<void> {
  try {
    const all = await getCacheContactos();
    const filtrados = all.filter(c =>
      c.id !== idOrLocalId && c._local_id !== String(idOrLocalId)
    );
    await cacheContactos(filtrados);
  } catch {}
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

/**
 * Busca un expediente específico en el cache por id.
 * Útil para mostrar el detalle offline sin recargar toda la lista.
 */
export async function getCacheExpediente(id: number): Promise<Expediente | null> {
  try {
    const all = await getCacheExpedientes();
    return all.find(e => e.id === id) ?? null;
  } catch {
    return null;
  }
}

/**
 * Agrega o actualiza un expediente individual en el cache.
 * Misma estrategia que upsertCacheContacto: _local_id primero, luego id.
 */
export async function upsertCacheExpediente(expediente: Expediente): Promise<void> {
  try {
    const all = await getCacheExpedientes();
    let idx = expediente._local_id
      ? all.findIndex(e => e._local_id === expediente._local_id)
      : -1;
    if (idx < 0 && expediente.id > 0) {
      idx = all.findIndex(e => e.id === expediente.id);
    }
    if (idx >= 0) {
      all[idx] = expediente;
    } else {
      all.unshift(expediente);
    }
    await cacheExpedientes(all);
  } catch {}
}

// ── Cache: Ubicaciones ────────────────────────────────────────────────────────

export async function cacheUbicaciones(data: Ubicacion[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.UBICACIONES, JSON.stringify(data));
}

export async function getCacheUbicaciones(): Promise<Ubicacion[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.UBICACIONES);
    return raw ? (JSON.parse(raw) as Ubicacion[]) : [];
  } catch {
    return [];
  }
}

/**
 * Agrega una ubicación creada offline al cache local.
 * Aparece en el mapa inmediatamente con _pendiente_sync: true.
 */
export async function upsertCacheUbicacion(ubicacion: Ubicacion): Promise<void> {
  try {
    const all = await getCacheUbicaciones();
    const idx = ubicacion._local_id
      ? all.findIndex(u => u._local_id === ubicacion._local_id)
      : ubicacion.id
        ? all.findIndex(u => u.id === ubicacion.id)
        : -1;
    if (idx >= 0) {
      all[idx] = ubicacion;
    } else {
      all.unshift(ubicacion);
    }
    await cacheUbicaciones(all);
  } catch {}
}

/**
 * Devuelve las ubicaciones de la cola pendiente como objetos Ubicacion
 * para mostrarlas en el mapa aunque no se hayan sincronizado aún.
 */
export async function getUbicacionesPendientesSync(): Promise<Ubicacion[]> {
  try {
    const queue = await getQueue();
    return queue
      .filter(op => op.tipo === 'registrar_ubicacion' && op.estado === 'pendiente')
      .map(op => {
        const datos = op.datos as Record<string, unknown>;
        return {
          id:               undefined,
          _local_id:        op.id_local,
          _pendiente_sync:  true,
          latitud:          datos.latitud   != null ? Number(datos.latitud)  : null,
          longitud:         datos.longitud  != null ? Number(datos.longitud) : null,
          tipo:             (datos.tipo as any) ?? 'visita_cliente',
          semaforo:         datos.tipo === 'escuela' ? 'amarillo' : undefined,
          nombre_lugar:     datos.nombre_lugar ? String(datos.nombre_lugar) : undefined,
          direccion:        datos.direccion   ? String(datos.direccion)     : undefined,
          municipio:        datos.municipio   ? String(datos.municipio)     : undefined,
          estado:           datos.estado      ? String(datos.estado)        : undefined,
          notas:            datos.notas       ? String(datos.notas)         : undefined,
          visitado_en:      String(datos.visitado_en ?? op.timestamp),
          contacto_id:      datos.contacto_id ? Number(datos.contacto_id)  : undefined,
        } as Ubicacion;
      });
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
  seccion?:     string;
  mimeType:     string;
  notas?:       string;
}): Promise<string> {
  const doc: DocumentoPendiente = {
    id_local:     uuidv4(),
    expedienteId: params.expedienteId,
    uri:          params.uri,
    tipo:         params.tipo,
    seccion:      params.seccion,
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

// ── Contactos pendientes de sync visibles en la lista ────────────────────────

/**
 * Devuelve los contactos de la cola pendiente que aún no tienen id de servidor.
 * Se usan para mezclarlos con la lista cacheada y mostrarlos con badge de "pendiente".
 */
export async function getContactosPendientesSync(): Promise<Contacto[]> {
  try {
    const queue = await getQueue();
    return queue
      .filter(op => op.tipo === 'crear_contacto' && op.estado === 'pendiente')
      .map(op => {
        const datos = op.datos as Record<string, unknown>;
        return {
          id:               0,   // sin id real aún
          _local_id:        op.id_local,
          _pendiente_sync:  true,
          nombre:           String(datos.nombre ?? ''),
          telefono:         datos.telefono ? String(datos.telefono) : undefined,
          email:            datos.email    ? String(datos.email)    : undefined,
          servicio:         datos.servicio as any,
          estado_prospecto: (datos.estado_prospecto as any) ?? 'nuevo',
          notas:            datos.notas ? String(datos.notas) : undefined,
          created_at:       op.timestamp,
        } as Contacto;
      });
  } catch {
    return [];
  }
}

/**
 * Devuelve los expedientes de la cola pendiente que aún no tienen id de servidor.
 */
export async function getExpedientesPendientesSync(): Promise<Expediente[]> {
  try {
    const queue = await getQueue();
    return queue
      .filter(op => op.tipo === 'crear_expediente' && op.estado === 'pendiente')
      .map(op => {
        const datos = op.datos as Record<string, unknown>;
        return {
          id:               0,
          _local_id:        op.id_local,
          _pendiente_sync:  true,
          contacto_id:      Number(datos.contacto_id ?? 0),
          tipo_tramite_id:  Number(datos.tipo_tramite_id ?? 0),
          asesor_id:        0,
          estado:           (datos.estado as any) ?? 'en_proceso',
          created_at:       op.timestamp,
          updated_at:       op.timestamp,
        } as Expediente;
      });
  } catch {
    return [];
  }
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
            // Si el servidor nos devuelve el id real, actualizar el cache local
            if (res.id_servidor && original) {
              if (original.tipo === 'crear_contacto') {
                // Reemplazar el contacto local (sin id) por el que tiene id del servidor
                const contactoLocal = original.datos as Record<string, unknown>;
                const contactoConId: Contacto = {
                  id:               res.id_servidor,
                  _local_id:        original.id_local,
                  _pendiente_sync:  false,
                  nombre:           String(contactoLocal.nombre ?? ''),
                  telefono:         contactoLocal.telefono ? String(contactoLocal.telefono) : undefined,
                  email:            contactoLocal.email    ? String(contactoLocal.email)    : undefined,
                  servicio:         contactoLocal.servicio as any,
                  estado_prospecto: (contactoLocal.estado_prospecto as any) ?? 'nuevo',
                };
                await upsertCacheContacto(contactoConId);
              }

              if (original.tipo === 'registrar_ubicacion') {
                // Reemplazar la ubicación local por la que tiene id del servidor
                const datos = original.datos as Record<string, unknown>;
                const ubicacionConId: Ubicacion = {
                  id:              res.id_servidor,
                  _local_id:       original.id_local,
                  _pendiente_sync: false,
                  latitud:         datos.latitud  != null ? Number(datos.latitud)  : null,
                  longitud:        datos.longitud != null ? Number(datos.longitud) : null,
                  tipo:            (datos.tipo as any) ?? 'visita_cliente',
                  nombre_lugar:    datos.nombre_lugar ? String(datos.nombre_lugar) : undefined,
                  municipio:       datos.municipio   ? String(datos.municipio)     : undefined,
                  estado:          datos.estado      ? String(datos.estado)        : undefined,
                  notas:           datos.notas       ? String(datos.notas)         : undefined,
                  visitado_en:     String(datos.visitado_en ?? original.timestamp),
                };
                await upsertCacheUbicacion(ubicacionConId);
              }
            }
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
            doc.seccion,
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
