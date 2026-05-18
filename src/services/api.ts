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
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<PaginatedResponse<Expediente>>(`/expedientes${qs ? `?${qs}` : ''}`);
}

export async function getExpediente(id: number): Promise<Expediente> {
  const res = await apiFetch<ApiResponse<Expediente>>(`/expedientes/${id}`);
  return res.data;
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
  return res.data;
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
