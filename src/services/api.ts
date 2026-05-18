import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ApiResponse, AuthState, SyncResponse, OperacionSync, PaginatedResponse, Contacto, Expediente, Ubicacion, Documento } from '../types';

// Lee la URL del API desde app.config.ts > extra.apiUrl
// Fallback: localhost para desarrollo en Expo Go
const API_BASE: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined)
  ?? 'http://localhost/api/v1';

const TOKEN_KEY = 'auth_token';

/**
 * Las URLs de Storage generadas por Laravel usan APP_URL (ej. http://consultoriaInmobiliaria.test).
 * En desarrollo desde la app móvil necesitamos reemplazar el origen por el de API_BASE
 * para que el dispositivo pueda resolver la URL.
 *
 * Ejemplo:
 *   http://consultoriaInmobiliaria.test/storage/expedientes/1/docs/ine.jpg
 *   → http://192.168.100.7:8080/storage/expedientes/1/docs/ine.jpg
 */
function resolveStorageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const apiOrigin = new URL(API_BASE).origin;          // http://192.168.100.7:8080
    const storageUrl = new URL(url);
    storageUrl.protocol = new URL(apiOrigin).protocol;
    storageUrl.hostname = new URL(apiOrigin).hostname;
    storageUrl.port     = new URL(apiOrigin).port;
    return storageUrl.toString();
  } catch {
    return url;
  }
}

// ── Token storage ──────────────────────────────────────────────────────────

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── Fetch base con auth ────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  const headers: HeadersInit = {
    'Accept':       'application/json',
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401 && !path.includes('/auth/')) {
      // Token expirado — limpiar y redirigir al login
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      router.replace('/(auth)/login');
      throw new Error('Sesión expirada. Inicia sesión de nuevo.');
    }
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? `Error ${response.status}`);
  }

  return response.json();
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthState> {
  const res = await apiFetch<{ token: string; user: AuthState['user'] }>('/auth/login', {
    method: 'POST',
    body:   JSON.stringify({ email, password }),
  });
  await saveToken(res.token!);
  return { user: res.user, token: res.token, isAuthenticated: true };
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Si la API falla offline, igual limpiamos el token local
  }
  await removeToken();
}

export async function getMe(): Promise<AuthState['user']> {
  const res = await apiFetch<ApiResponse<AuthState['user']>>('/auth/me');
  return res.data;
}

// ── Prospectos ─────────────────────────────────────────────────────────────

export async function getContactos(params?: { estado?: string; q?: string; page?: number }): Promise<PaginatedResponse<Contacto>> {
  const p: Record<string, string> = {};
  if (params?.q)      p['q']      = params.q;
  if (params?.estado) p['estado'] = params.estado;
  if (params?.page)   p['page']   = String(params.page);
  const qs = new URLSearchParams(p).toString();
  return apiFetch<PaginatedResponse<Contacto>>(`/contactos${qs ? `?${qs}` : ''}`);
}

export async function getContacto(id: number): Promise<Contacto> {
  const res = await apiFetch<ApiResponse<Contacto>>(`/contactos/${id}`);
  return res.data;
}

export async function createContacto(data: Partial<Contacto>): Promise<Contacto> {
  const res = await apiFetch<ApiResponse<Contacto>>('/contactos', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
  return res.data;
}

export async function updateContacto(id: number, data: Partial<Contacto>): Promise<Contacto> {
  const res = await apiFetch<ApiResponse<Contacto>>(`/contactos/${id}`, {
    method: 'PUT',
    body:   JSON.stringify(data),
  });
  return res.data;
}

// ── Expedientes ────────────────────────────────────────────────────────────

export async function getExpedientes(params?: { estado?: string }): Promise<PaginatedResponse<Expediente>> {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== ''))
  ).toString();
  return apiFetch<PaginatedResponse<Expediente>>(`/expedientes${qs ? `?${qs}` : ''}`);
}

export async function getExpediente(id: number): Promise<Expediente> {
  const res = await apiFetch<ApiResponse<Expediente>>(`/expedientes/${id}`);
  const exp = res.data;
  // Normalizar URLs de documentos para que el móvil pueda resolverlas
  if (exp.documentos) {
    exp.documentos = exp.documentos.map(doc => ({
      ...doc,
      url: resolveStorageUrl(doc.url),
    }));
  }
  return exp;
}

export async function createExpediente(data: Partial<Expediente>): Promise<Expediente> {
  const res = await apiFetch<ApiResponse<Expediente>>('/expedientes', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
  return res.data;
}

// ── Documentos ─────────────────────────────────────────────────────────────

export async function uploadDocumento(expedienteId: number, uri: string, tipo: string, notas?: string): Promise<Documento> {
  const token = await getToken();
  const formData = new FormData();
  formData.append('archivo', { uri, type: 'image/jpeg', name: `doc_${Date.now()}.jpg` } as unknown as Blob);
  formData.append('tipo_documento', tipo);
  if (notas) formData.append('notas', notas);

  const response = await fetch(`${API_BASE}/expedientes/${expedienteId}/documentos`, {
    method:  'POST',
    headers: {
      'Accept':        'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) throw new Error(`Error al subir documento: ${response.status}`);
  const res = await response.json();
  const doc: Documento = res.data;
  return { ...doc, url: resolveStorageUrl(doc.url) };
}

export async function deleteDocumento(expedienteId: number, documentoId: number): Promise<void> {
  await apiFetch(`/expedientes/${expedienteId}/documentos/${documentoId}`, { method: 'DELETE' });
}

/**
 * Obtiene una URL firmada temporal (5 min) para ver/descargar el documento.
 * La URL apunta al endpoint de descarga de Laravel, no al archivo directamente.
 */
export async function getDocumentoUrl(expedienteId: number, documentoId: number): Promise<string> {
  const res = await apiFetch<{ url: string; expira_en: number }>(
    `/expedientes/${expedienteId}/documentos/${documentoId}/ver`
  );
  // La URL ya viene con el host correcto de APP_URL; reemplazamos el origen
  // por el de API_BASE igual que con las URLs de storage.
  return resolveStorageUrl(res.url) ?? res.url;
}

export async function reemplazarDocumento(expedienteId: number, documentoId: number, uri: string): Promise<Documento> {
  const token = await getToken();
  const formData = new FormData();
  formData.append('archivo', { uri, type: 'image/jpeg', name: `doc_${Date.now()}.jpg` } as unknown as Blob);

  const response = await fetch(`${API_BASE}/expedientes/${expedienteId}/documentos/${documentoId}/reemplazar`, {
    method:  'POST',
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
    body:    formData,
  });

  if (!response.ok) throw new Error(`Error al reemplazar documento: ${response.status}`);
  const res = await response.json();
  const doc: Documento = res.data;
  return { ...doc, url: resolveStorageUrl(doc.url) };
}

// ── Ubicaciones ────────────────────────────────────────────────────────────

export async function registrarUbicacion(data: Omit<Ubicacion, 'id'>): Promise<Ubicacion> {
  const res = await apiFetch<ApiResponse<Ubicacion>>('/ubicaciones', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
  return res.data;
}

export async function getUbicacionesMapa(): Promise<Ubicacion[]> {
  const res = await apiFetch<ApiResponse<Ubicacion[]>>('/ubicaciones/mapa');
  // Resolver URLs de fotos para acceso desde móvil en dev
  return res.data.map(u => ({
    ...u,
    fotos: u.fotos?.map(f => ({ ...f, url: resolveStorageUrl(f.url) ?? f.url })),
  }));
}

export async function subirFotosVisita(
  ubicacionId: number,
  fotos: { uri: string; name: string; type: string }[],
): Promise<{ id: number; url: string }[]> {
  const token = await getToken();
  const form  = new FormData();

  fotos.forEach((f) => {
    form.append('fotos[]', { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
  });

  const response = await fetch(`${API_BASE}/ubicaciones/${ubicacionId}/fotos`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    form,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message ?? `Error ${response.status} al subir fotos`);
  }

  const res = await response.json();
  return res.data;
}

// ── Sync offline ───────────────────────────────────────────────────────────

export async function syncBatch(operaciones: OperacionSync[]): Promise<SyncResponse> {
  return apiFetch<SyncResponse>('/sync', {
    method: 'POST',
    body:   JSON.stringify({ operaciones }),
  });
}

// ── Dispositivos FCM ───────────────────────────────────────────────────────

export async function registrarDispositivo(fcmToken: string, plataforma: 'ios' | 'android'): Promise<void> {
  await apiFetch('/dispositivos', {
    method: 'POST',
    body:   JSON.stringify({ fcm_token: fcmToken, plataforma }),
  });
}
