/**
 * Servicio API para el acreditado.
 * Usa el mismo API_BASE que api.ts pero con rutas /v1/acreditado/
 * y almacena el token en una clave separada para no interferir con el asesor.
 */

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import {
  Acreditado,
  AcreditadoAuthState,
  ExpedienteAcreditado,
  DocumentoAcreditado,
  SeguimientoAcreditado,
  ServicioTramite,
} from '../types';

const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
const API_BASE: string =
  Platform.OS === 'ios'
    ? (extra?.apiUrlIos     ?? 'http://127.0.0.1:8080/api/v1')
    : (extra?.apiUrlAndroid ?? 'http://10.0.2.2:8082/api/v1');

const ACREDITADO_BASE = API_BASE.replace('/v1', '/v1/acreditado');
const TOKEN_KEY       = 'acreditado_token';

/** Key de SecureStore donde AcreditadoAuthContext cachea el perfil — se limpia junto con el token al expirar la sesión */
export const ACREDITADO_CACHE_KEY = 'cached_acreditado';

// ── Token helpers ─────────────────────────────────────────────────────────────

export async function saveAcreditadoToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getAcreditadoToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeAcreditadoToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function acreditadoFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAcreditadoToken();

  const headers: Record<string, string> = {
    Accept:         'application/json',
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${ACREDITADO_BASE}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  // Token expirado/revocado (cuenta desactivada, etc.) — igual que apiFetch
  // del asesor: limpiar sesión y mandar al login en vez de dejar la app
  // mostrando datos viejos indefinidamente con cada pantalla fallando en silencio.
  if (res.status === 401 && token && !path.includes('/auth/')) {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(ACREDITADO_CACHE_KEY).catch(() => {});
    router.replace('/(auth)/login');
    throw new Error('Sesión expirada. Inicia sesión de nuevo.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? `Error ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function registrarAcreditado(data: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  curp?: string;
  telefono?: string;
}): Promise<AcreditadoAuthState & { expediente_vinculado?: ExpedienteAcreditado | null }> {
  const res = await acreditadoFetch<any>('/auth/registro', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
  await saveAcreditadoToken(res.token);
  return { acreditado: res.acreditado, token: res.token, expediente_vinculado: res.expediente_vinculado };
}

export async function loginAcreditado(email: string, password: string): Promise<AcreditadoAuthState> {
  const res = await acreditadoFetch<any>('/auth/login', {
    method: 'POST',
    body:   JSON.stringify({ email, password }),
  });
  await saveAcreditadoToken(res.token);
  return { acreditado: res.acreditado, token: res.token };
}

export async function logoutAcreditado(): Promise<void> {
  try {
    await acreditadoFetch('/auth/logout', { method: 'POST' });
  } catch {}
  await removeAcreditadoToken();
}

export async function getMeAcreditado(): Promise<Acreditado> {
  const res = await acreditadoFetch<{ data: Acreditado }>('/auth/me');
  return res.data;
}

export async function updatePerfilAcreditado(data: {
  name?: string;
  telefono?: string;
  curp?: string;
  nss?: string;
  rfc?: string;
}): Promise<Acreditado> {
  const res = await acreditadoFetch<{ acreditado: Acreditado }>('/auth/perfil', {
    method: 'PUT',
    body:   JSON.stringify(data),
  });
  return res.acreditado;
}

export async function cambiarPasswordAcreditado(
  passwordActual: string,
  password: string,
  passwordConfirmation: string,
): Promise<void> {
  await acreditadoFetch('/auth/password', {
    method: 'PUT',
    body:   JSON.stringify({
      password_actual:       passwordActual,
      password,
      password_confirmation: passwordConfirmation,
    }),
  });
}

export async function forgotPasswordAcreditado(email: string): Promise<void> {
  await acreditadoFetch('/auth/forgot-password', {
    method: 'POST',
    body:   JSON.stringify({ email }),
  });
}

export async function solicitarCancelacionAcreditado(): Promise<void> {
  await acreditadoFetch('/auth/solicitar-cancelacion', { method: 'POST' });
  await removeAcreditadoToken();
}

export async function subirFotoAcreditado(uri: string): Promise<string | null> {
  const token = await getAcreditadoToken();
  const formData = new FormData();
  formData.append('foto', { uri, name: 'foto.jpg', type: 'image/jpeg' } as any);

  const res = await fetch(`${ACREDITADO_BASE}/auth/perfil/foto`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body:    formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? 'Error al subir foto');
  return data?.foto_perfil_url ?? null;
}

// ── Expediente ────────────────────────────────────────────────────────────────

export async function getExpedienteAcreditado(): Promise<ExpedienteAcreditado | null> {
  const res = await acreditadoFetch<{ data: ExpedienteAcreditado | null }>('/expediente');
  return res.data;
}

export async function getSeguimientoAcreditado(): Promise<SeguimientoAcreditado[]> {
  const res = await acreditadoFetch<{ data: SeguimientoAcreditado[] }>('/expediente/seguimiento');
  return res.data ?? [];
}

export async function getDocumentosPendientesAcreditado(): Promise<DocumentoAcreditado[]> {
  const res = await acreditadoFetch<{ data: DocumentoAcreditado[] }>('/expediente/documentos-pendientes');
  return res.data ?? [];
}

// ── Documentos ────────────────────────────────────────────────────────────────

export async function getDocumentosAcreditado(): Promise<DocumentoAcreditado[]> {
  const res = await acreditadoFetch<{ data: DocumentoAcreditado[] }>('/expediente/documentos');
  return res.data ?? [];
}

export async function subirDocumentoAcreditado(
  uri: string,
  tipoDocumento: string,
  mimeType?: string,
  notas?: string,
): Promise<DocumentoAcreditado> {
  const token = await getAcreditadoToken();
  const ext   = uri.split('.').pop() ?? 'jpg';
  const mime  = mimeType ?? 'application/octet-stream';

  const formData = new FormData();
  formData.append('archivo', { uri, name: `doc.${ext}`, type: mime } as any);
  formData.append('tipo_documento', tipoDocumento);
  if (notas) formData.append('notas', notas);

  const res = await fetch(`${ACREDITADO_BASE}/expediente/documentos`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body:    formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? 'Error al subir documento');
  return data.documento;
}

export async function getUrlDocumentoAcreditado(documentoId: number): Promise<string> {
  const res = await acreditadoFetch<{ url: string }>(`/expediente/documentos/${documentoId}/ver`);
  return res.url;
}

// ── Solicitudes ───────────────────────────────────────────────────────────────

export async function getServiciosDisponibles(): Promise<ServicioTramite[]> {
  const res = await acreditadoFetch<{ data: ServicioTramite[] }>('/servicios');
  return res.data ?? [];
}

export async function solicitarAsesoria(data: {
  tipo_tramite_id?: number;
  mensaje?: string;
  municipio?: string;
  estado?: string;
}): Promise<void> {
  await acreditadoFetch('/solicitudes', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}
