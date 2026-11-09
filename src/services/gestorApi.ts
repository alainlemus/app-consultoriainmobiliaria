/**
 * API del gestor (/v1/gestor/…): sus encargos, revisión de documentos y subidas.
 *
 * Offline-first: la lista y cada encargo se guardan en el teléfono para verlos
 * sin señal; las subidas sin señal quedan en cola y se envían solas después
 * (sincronizarSubidasGestor, llamada desde el layout del gestor).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiFetch, API_BASE, getToken, resolveStorageUrl } from './api';
import { limpiarArchivoLocal } from '../utils/comprimirFoto';

export type EstadoEncargo = 'por_revisar' | 'con_observaciones' | 'en_tramite' | 'por_validar' | 'terminado' | 'cancelado';
export type Revision = 'pendiente' | 'correcto' | 'incorrecto';

export interface EncargoResumen {
  id: number;
  estado: EstadoEncargo;
  estado_label: string;
  vuelta: number;
  instrucciones: string;
  fecha_entrega: string | null;
  enviado_at: string | null;
  documentos_count: number;
  subidos_count: number;
  expediente: { id: number; folio: string | null; acreditado: string | null; tipo_tramite: string | null; municipio: string };
}

export interface DocumentoCompartido {
  id: number; nombre: string; extension: string; revision: Revision; nota: string | null;
  vuelta: number; nuevo: boolean; revisado_at: string | null;
}

export interface DocumentoSubido {
  id: number; nombre: string; notas: string | null; extension: string;
  validacion: 'en_revision' | 'validado' | 'rechazado'; motivo_rechazo: string | null; subido_at: string | null;
}

export interface EncargoDetalle extends EncargoResumen {
  enviado_por: string | null;
  datos: { clave: string; titulo: string; campos: { label: string; valor: string }[] }[];
  documentos: DocumentoCompartido[];
  subidos: DocumentoSubido[];
  historial: { tipo: string; detalle: string | null; por: string | null; fecha: string | null }[];
}

const KEY_LISTA   = 'gestor:encargos:';
const KEY_DETALLE = 'gestor:encargo:';
const KEY_COLA    = 'gestor:subidas_pendientes';

async function guardar(key: string, v: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});
}
async function leer<T>(key: string): Promise<T | null> {
  try { const raw = await AsyncStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}

export const esErrorDeRed = (e: unknown) => {
  const m = (e instanceof Error ? e.message : '').toLowerCase();
  return m.includes('network') || m.includes('failed') || m.includes('timeout') || m.includes('aborted');
};

// ── Lectura (con caché) ──────────────────────────────────────────────────────

export type FiltroEncargos = 'activos' | 'terminados';

/** Devuelve la lista del servidor; sin señal, la última guardada (desdeCache = true). */
export async function getEncargos(filtro: FiltroEncargos = 'activos'): Promise<{ data: EncargoResumen[]; desdeCache: boolean }> {
  try {
    const res = await apiFetch<{ data: EncargoResumen[] }>(`/gestor/encargos?estado=${filtro}`);
    await guardar(KEY_LISTA + filtro, res.data);
    return { data: res.data, desdeCache: false };
  } catch (e) {
    const cache = await leer<EncargoResumen[]>(KEY_LISTA + filtro);
    if (cache && esErrorDeRed(e)) return { data: cache, desdeCache: true };
    throw e;
  }
}

export async function getEncargo(id: number): Promise<{ data: EncargoDetalle; desdeCache: boolean }> {
  try {
    const res = await apiFetch<{ data: EncargoDetalle }>(`/gestor/encargos/${id}`);
    await guardar(KEY_DETALLE + id, res.data);
    return { data: res.data, desdeCache: false };
  } catch (e) {
    const cache = await leer<EncargoDetalle>(KEY_DETALLE + id);
    if (cache && esErrorDeRed(e)) return { data: cache, desdeCache: true };
    throw e;
  }
}

export async function urlDocumento(encargoId: number, documentoId: number): Promise<string> {
  const res = await apiFetch<{ url: string }>(`/gestor/encargos/${encargoId}/documentos/${documentoId}/url`);
  // La URL firmada trae el dominio del backend (APP_URL); en desarrollo el teléfono
  // no lo resuelve, así que se cambia por el origen de API_BASE (la firma sigue válida).
  return resolveStorageUrl(res.url) ?? res.url;
}

// ── Revisión ─────────────────────────────────────────────────────────────────

export async function enviarRevision(
  encargoId: number,
  revisiones: { documento_id: number; revision: 'correcto' | 'incorrecto'; nota?: string }[],
): Promise<EncargoDetalle> {
  const res = await apiFetch<{ data: EncargoDetalle }>(`/gestor/encargos/${encargoId}/revision`, {
    method: 'POST',
    body:   JSON.stringify({ revisiones }),
  });
  await guardar(KEY_DETALLE + encargoId, res.data);
  return res.data;
}

// ── «Ya terminé» y reabrir (requieren señal) ─────────────────────────────────

async function accionEncargo(encargoId: number, accion: 'entregar' | 'reabrir'): Promise<EncargoDetalle> {
  const res = await apiFetch<{ data: EncargoDetalle }>(`/gestor/encargos/${encargoId}/${accion}`, { method: 'POST' });
  await guardar(KEY_DETALLE + encargoId, res.data);
  return res.data;
}

/** El gestor avisa que ya subió todo. */
export const entregarEncargo = (encargoId: number) => accionEncargo(encargoId, 'entregar');

/** Olvidó algo: el encargo vuelve a En trámite mientras la administración no lo cierre. */
export const reabrirEncargo = (encargoId: number) => accionEncargo(encargoId, 'reabrir');

// ── CUV (Clave Única de Vivienda) ────────────────────────────────────────────

/** El gestor con encargo en trámite registra la CUV (16 dígitos) con foto o PDF opcional. */
export async function registrarCuvGestor(encargoId: number, cuv: string, archivo?: { uri: string; mimeType: string; nombre: string }): Promise<void> {
  const token = await getToken();
  const form  = new FormData();
  form.append('cuv', cuv);
  if (archivo) form.append('archivo', { uri: archivo.uri, name: archivo.nombre, type: archivo.mimeType } as any);
  const res = await fetch(`${API_BASE}/gestor/encargos/${encargoId}/cuv`, {
    method: 'POST', headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errores = body?.errors ? Object.values(body.errors as Record<string, string[]>).flat().join(' ') : '';
    throw new Error(errores || body?.message || `Error ${res.status}`);
  }
}

// ── Subidas (con cola sin señal) ─────────────────────────────────────────────

export interface SubidaGestor {
  encargoId: number;
  uri:       string;   // archivo persistido en documentDirectory
  nombreArchivo: string;
  mimeType:  string;
  tipo:      string;
  notas?:    string;
  reemplazaId?: number;
  intentos?: number;
}

async function enviarSubida(s: SubidaGestor): Promise<void> {
  const token = await getToken();
  const form = new FormData();
  form.append('archivo', { uri: s.uri, name: s.nombreArchivo, type: s.mimeType } as any);
  form.append('tipo', s.tipo);
  if (s.notas) form.append('notas', s.notas);
  if (s.reemplazaId) form.append('reemplaza_documento_id', String(s.reemplazaId));

  const res = await fetch(`${API_BASE}/gestor/encargos/${s.encargoId}/documentos`, {
    method:  'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body:    form,
  });
  if (res.status === 401 && token) {
    await SecureStore.deleteItemAsync('auth_token').catch(() => {});
    router.replace('/(auth)/login');
    throw new Error('Sesión expirada. Inicia sesión de nuevo.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errores = body?.errors ? Object.values(body.errors as Record<string, string[]>).flat().join(' ') : '';
    throw new Error(errores || body?.message || `Error ${res.status}`);
  }
}

/** Sube el documento; sin señal lo deja en cola. Lanza si el servidor lo rechaza. */
export async function subirDocumento(s: SubidaGestor): Promise<'subido' | 'encolado'> {
  try {
    await enviarSubida(s);
    await limpiarArchivoLocal(s.uri);
    return 'subido';
  } catch (e) {
    if (!esErrorDeRed(e)) throw e;
    const cola = (await leer<SubidaGestor[]>(KEY_COLA)) ?? [];
    cola.push({ ...s, intentos: 0 });
    await guardar(KEY_COLA, cola);
    return 'encolado';
  }
}

export async function subidasPendientes(encargoId?: number): Promise<SubidaGestor[]> {
  const cola = (await leer<SubidaGestor[]>(KEY_COLA)) ?? [];
  return encargoId ? cola.filter(c => c.encargoId === encargoId) : cola;
}

let sincronizando = false;

export async function sincronizarSubidasGestor(): Promise<number> {
  if (sincronizando) return 0;
  sincronizando = true;
  let ok = 0;
  try {
    const cola = (await leer<SubidaGestor[]>(KEY_COLA)) ?? [];
    if (cola.length === 0) return 0;
    const quedan: SubidaGestor[] = [];
    for (const s of cola) {
      try {
        await enviarSubida(s);
        await limpiarArchivoLocal(s.uri);
        ok++;
      } catch (e) {
        if (esErrorDeRed(e)) quedan.push(s);
        else if ((s.intentos ?? 0) < 2) quedan.push({ ...s, intentos: (s.intentos ?? 0) + 1 });
        else await limpiarArchivoLocal(s.uri);
      }
    }
    await guardar(KEY_COLA, quedan);
  } finally {
    sincronizando = false;
  }
  return ok;
}
