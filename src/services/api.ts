import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { ApiResponse, AuthState, SyncResponse, OperacionSync, PaginatedResponse, Contacto, Expediente, Ubicacion, Documento, Comision, ResumenComisiones, Escuela, SemaforoEscuela, Anuncio, EstadoAnuncio, RutaAsesor, RutaDia, RutaPunto } from '../types';

// Selecciona la URL según plataforma en desarrollo
// iOS simulador  → 127.0.0.1:8080
// Android emulador → 10.0.2.2:8082
const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
const API_BASE: string =
  Platform.OS === 'ios'
    ? (extra?.apiUrlIos  ?? 'http://127.0.0.1:8080/api/v1')
    : (extra?.apiUrlAndroid ?? 'http://10.0.2.2:8082/api/v1');

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

export async function apiFetch<T>(
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

/** Restaura sesión desde un token guardado (usado por biometría) */
export async function loginWithToken(token: string): Promise<AuthState> {
  await saveToken(token);
  const user = await getMe();
  return { user, token, isAuthenticated: true };
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Si la API falla offline, igual limpiamos el token local
  }
  await removeToken();
}

/**
 * Solicita la cancelación/desactivación de la cuenta del usuario.
 * Requerimiento de Apple App Store.
 * Desactiva la cuenta en el servidor y revoca todos los tokens.
 */
export async function solicitarCancelacionCuenta(): Promise<void> {
  await apiFetch('/auth/solicitar-cancelacion', { method: 'POST' });
  await removeToken();
}

export async function getMe(): Promise<AuthState['user']> {
  const res = await apiFetch<ApiResponse<AuthState['user']>>('/auth/me');
  const u = res.data;
  if (u?.foto_perfil_url) {
    u.foto_perfil_url = resolveStorageUrl(u.foto_perfil_url);
  }
  return u;
}

export async function updatePerfil(data: {
  name?: string;
  telefono?: string;
  banco?: string;
  clabe?: string;
}): Promise<AuthState['user']> {
  const res = await apiFetch<{ message: string; data: AuthState['user'] }>('/auth/perfil', {
    method: 'PUT',
    body:   JSON.stringify(data),
  });
  const u = res.data;
  if (u?.foto_perfil_url) {
    u.foto_perfil_url = resolveStorageUrl(u.foto_perfil_url);
  }
  return u;
}

export async function subirFotoPerfil(uri: string): Promise<string | null> {
  const token = await getToken();
  const formData = new FormData();
  formData.append('foto', {
    uri,
    name: 'selfie.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const response = await fetch(`${API_BASE}/auth/perfil/foto`, {
    method:  'POST',
    headers: {
      'Accept':        'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? `Error ${response.status}`);
  }

  const res = await response.json();
  return resolveStorageUrl(res.foto_perfil_url) ?? null;
}

// ── Asesores (solo para super_admin) ──────────────────────────────────────

export interface AsesorBasico { id: number; name: string; email: string; }

/** Lista de asesores activos para el dropdown de filtro del super_admin */
export async function getAsesores(): Promise<AsesorBasico[]> {
  const res = await apiFetch<{ data: AsesorBasico[] }>('/auth/asesores');
  return res.data;
}

// ── Prospectos ─────────────────────────────────────────────────────────────

export async function getContactos(params?: { estado?: string; q?: string; page?: number; asesor_id?: number }): Promise<PaginatedResponse<Contacto>> {
  const p: Record<string, string> = {};
  if (params?.q)         p['q']         = params.q;
  if (params?.estado)    p['estado']     = params.estado;
  if (params?.page)      p['page']       = String(params.page);
  if (params?.asesor_id) p['asesor_id']  = String(params.asesor_id);
  const qs = new URLSearchParams(p).toString();
  return apiFetch<PaginatedResponse<Contacto>>(`/contactos${qs ? `?${qs}` : ''}`);
}

export async function getContacto(id: number): Promise<Contacto> {
  const res = await apiFetch<ApiResponse<Contacto>>(`/contactos/${id}`);
  const c = res.data;
  if (c?.foto_url)                  c.foto_url                  = resolveStorageUrl(c.foto_url);
  if (c?.simulador_screenshot_url)  c.simulador_screenshot_url  = resolveStorageUrl(c.simulador_screenshot_url);
  return c;
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

export async function uploadFotoContacto(
  id: number,
  foto: { uri: string; name: string; type: string },
): Promise<Contacto> {
  const form = new FormData();
  form.append('foto', { uri: foto.uri, name: foto.name, type: foto.type } as any);
  const res = await apiFetch<ApiResponse<Contacto>>(`/contactos/${id}/foto`, {
    method:  'POST',
    body:    form,
    headers: {}, // deja que fetch ponga el Content-Type multipart automáticamente
  });
  return res.data;
}

export async function uploadSimuladorScreenshot(
  id: number,
  screenshot: { uri: string; name: string; type: string },
): Promise<Contacto> {
  const form = new FormData();
  form.append('screenshot', { uri: screenshot.uri, name: screenshot.name, type: screenshot.type } as any);
  const res = await apiFetch<ApiResponse<Contacto>>(`/contactos/${id}/simulador-screenshot`, {
    method:  'POST',
    body:    form,
    headers: {},
  });
  const c = res.data;
  if (c?.simulador_screenshot_url) c.simulador_screenshot_url = resolveStorageUrl(c.simulador_screenshot_url);
  return c;
}

// ── Expedientes ────────────────────────────────────────────────────────────

export async function getExpedientes(params?: { estado?: string; etapa?: string; asesor_id?: number }): Promise<PaginatedResponse<Expediente>> {
  const p: Record<string, string> = Object.fromEntries(
    Object.entries(params ?? {})
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
  );
  const qs = new URLSearchParams(p).toString();
  const res = await apiFetch<PaginatedResponse<Expediente>>(`/expedientes${qs ? `?${qs}` : ''}`);
  // Resolver foto del contacto para cada expediente
  res.data = res.data.map(exp => {
    if (exp.contacto?.foto_url)
      exp.contacto.foto_url = resolveStorageUrl(exp.contacto.foto_url);
    return exp;
  });
  return res;
}

export async function getExpediente(id: number): Promise<Expediente> {
  const res = await apiFetch<ApiResponse<Expediente>>(`/expedientes/${id}`);
  const exp = res.data;
  if (exp.contacto?.foto_url)
    exp.contacto.foto_url = resolveStorageUrl(exp.contacto.foto_url);
  if (exp.contacto?.simulador_screenshot_url)
    exp.contacto.simulador_screenshot_url = resolveStorageUrl(exp.contacto.simulador_screenshot_url);
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

export async function uploadDocumento(expedienteId: number, uri: string, tipo: string, notas?: string, mimeType?: string, seccion?: string): Promise<Documento> {
  const token = await getToken();
  const mime = mimeType ?? 'image/jpeg';
  const ext  = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1] ?? 'jpg';
  const formData = new FormData();
  formData.append('archivo', { uri, type: mime, name: `doc_${Date.now()}.${ext}` } as unknown as Blob);
  formData.append('tipo_documento', tipo);
  if (seccion) formData.append('seccion', seccion);
  if (notas)   formData.append('notas', notas);

  const response = await fetch(`${API_BASE}/expedientes/${expedienteId}/documentos`, {
    method:  'POST',
    headers: {
      'Accept':        'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? `Error al subir documento: ${response.status}`);
  }
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
  // La firma se generó con APP_URL (consultoriaInmobiliaria.test).
  // Reemplazamos solo el origen para que el móvil pueda resolver la IP,
  // pero mantenemos path+query intactos para que la firma siga siendo válida
  // (Laravel valida contra el host del request entrante, que llega como APP_URL via nginx).
  return resolveStorageUrl(res.url) ?? res.url;
}

export async function reemplazarDocumento(expedienteId: number, documentoId: number, uri: string, mimeType?: string): Promise<Documento> {
  const token = await getToken();
  const mime = mimeType ?? 'image/jpeg';
  const ext  = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1] ?? 'jpg';
  const formData = new FormData();
  formData.append('archivo', { uri, type: mime, name: `doc_${Date.now()}.${ext}` } as unknown as Blob);

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

export async function getUbicacionesMapa(params?: { asesor_id?: number }): Promise<Ubicacion[]> {
  const qs = params?.asesor_id ? `?asesor_id=${params.asesor_id}` : '';
  const res = await apiFetch<ApiResponse<Ubicacion[]>>(`/ubicaciones/mapa${qs}`);
  // Resolver URLs de fotos para acceso desde móvil en dev
  return res.data.map(u => ({
    ...u,
    contacto_foto_url: u.contacto_foto_url ? resolveStorageUrl(u.contacto_foto_url) ?? u.contacto_foto_url : null,
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

// ── Escuelas ───────────────────────────────────────────────────────────────

/** Buscador de escuelas para vincular prospectos */
export async function getEscuelas(q?: string): Promise<Escuela[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await apiFetch<ApiResponse<Escuela[]>>(`/escuelas${qs}`);
  return res.data;
}

/** Cambia el semáforo de una escuela */
export async function actualizarSemaforoEscuela(
  id: number,
  semaforo: SemaforoEscuela,
  semaforo_notas?: string,
): Promise<Ubicacion> {
  const res = await apiFetch<ApiResponse<Ubicacion>>(`/ubicaciones/${id}/semaforo`, {
    method: 'PATCH',
    body:   JSON.stringify({ semaforo, semaforo_notas }),
  });
  return res.data;
}

// ── Anuncios ───────────────────────────────────────────────────────────────

/** Todos los anuncios activos para mostrar en el mapa (todos los asesores ven todos) */
export async function getAnunciosMapa(): Promise<Anuncio[]> {
  const res = await apiFetch<ApiResponse<Anuncio[]>>('/anuncios/mapa');
  return res.data.map(a => ({
    ...a,
    fotos: a.fotos?.map(f => ({ ...f, url: resolveStorageUrl(f.url) ?? f.url })),
  }));
}

/** Registra un anuncio colocado por el asesor */
export async function registrarAnuncio(data: Omit<Anuncio, 'id' | 'fotos'>): Promise<Anuncio> {
  const res = await apiFetch<ApiResponse<Anuncio>>('/anuncios', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
  return res.data;
}

/** Marca un anuncio como retirado o lo reactiva */
export async function actualizarEstadoAnuncio(id: number, estado: EstadoAnuncio): Promise<Anuncio> {
  const res = await apiFetch<ApiResponse<Anuncio>>(`/anuncios/${id}/estado`, {
    method: 'PATCH',
    body:   JSON.stringify({ estado }),
  });
  return res.data;
}

/** Sube fotos del anuncio */
export async function subirFotosAnuncio(
  anuncioId: number,
  fotos: { uri: string; name: string; type: string }[],
): Promise<{ id: number; url: string }[]> {
  const token = await getToken();
  const form  = new FormData();
  fotos.forEach(f => {
    form.append('fotos[]', { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
  });
  const response = await fetch(`${API_BASE}/anuncios/${anuncioId}/fotos`, {
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

// ── Comisiones ─────────────────────────────────────────────────────────────

export async function getComisiones(params?: {
  estado?: 'pagada' | 'pendiente';
  page?: number;
}): Promise<{ data: Comision[]; current_page: number; last_page: number; total: number }> {
  const p: Record<string, string> = {};
  if (params?.estado) p['estado'] = params.estado;
  if (params?.page)   p['page']   = String(params.page);
  const qs = new URLSearchParams(p).toString();
  return apiFetch(`/comisiones${qs ? `?${qs}` : ''}`);
}

export async function getResumenComisiones(): Promise<ResumenComisiones> {
  const res = await apiFetch<ApiResponse<ResumenComisiones>>('/comisiones/resumen');
  return res.data;
}

// ── Route Points ───────────────────────────────────────────────────────────────

export interface RoutePointPayload {
  lat:       number;
  lng:       number;
  precision: number;
  velocidad: number;
  timestamp: string;
}

export async function guardarPuntosRuta(puntos: RoutePointPayload[]): Promise<{ saved: number; ids: number[] }> {
  const res = await apiFetch<ApiResponse<{ saved: number; ids: number[] }>>('/routes/points', {
    method: 'POST',
    body:   JSON.stringify({ points: puntos }),
  });
  return res.data;
}

// ── Rutas ───────────────────────────────────────────────────────────────────

export async function getRutasAsesores(): Promise<RutaAsesor[]> {
  const res = await apiFetch<ApiResponse<RutaAsesor[]>>('/routes/asesores');
  return res.data;
}

export async function getRutasDias(asesorId: number): Promise<RutaDia[]> {
  const res = await apiFetch<ApiResponse<RutaDia[]>>(`/routes/dias?asesor_id=${asesorId}`);
  return res.data;
}

export async function getRutasPuntos(asesorId: number, fecha: string): Promise<RutaPunto[]> {
  const res = await apiFetch<ApiResponse<RutaPunto[]>>(`/routes/points?asesor_id=${asesorId}&fecha=${fecha}`);
  return res.data;
}
