/**
 * Tests: src/services/api.ts
 *
 * Cubre:
 *  - Token storage (save, get, remove)
 *  - Auth: login, logout, getMe
 *  - Contactos: getContactos, getContacto, createContacto, updateContacto
 *  - Expedientes: getExpedientes, getExpediente, createExpediente
 *  - Documentos: uploadDocumento
 *  - Ubicaciones: registrarUbicacion, getUbicacionesMapa
 *  - Sync: syncBatch
 *  - Dispositivos: registrarDispositivo
 *  - Error handling: respuesta no-ok lanza Error
 */

import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import {
  saveToken, getToken, removeToken,
  login, logout, getMe,
  getContactos, getContacto, createContacto, updateContacto,
  getExpedientes, getExpediente, createExpediente,
  uploadDocumento,
  registrarUbicacion, getUbicacionesMapa,
  syncBatch,
  registrarDispositivo,
} from '../../src/services/api';

// ── helpers ────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok:   status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

const MOCK_USER = { id: 1, name: 'Asesor Test', email: 'a@test.com', role: 'asesor' as const };
const MOCK_CONTACTO = {
  id: 1, nombre: 'Juan Pérez',
  email: 'juan@test.com', telefono: '5500000000', estado_prospecto: 'nuevo',
  created_at: '2025-01-01', updated_at: '2025-01-01',
};
const MOCK_EXPEDIENTE = {
  id: 1, folio: 'EXP-001', contacto_id: 1, asesor_id: 1, tipo_tramite_id: 1,
  etapa_tramite_id: 1, estado: 'en_proceso', created_at: '2025-01-01', updated_at: '2025-01-01',
};

// ── Token storage ──────────────────────────────────────────────────────────

describe('Token storage', () => {
  it('saveToken llama SecureStore.setItemAsync', async () => {
    await saveToken('abc123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'abc123');
  });

  it('getToken llama SecureStore.getItemAsync', async () => {
    const token = await getToken();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth_token');
    expect(token).toBe('mock-token-123');
  });

  it('removeToken llama SecureStore.deleteItemAsync', async () => {
    await removeToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });
});

// ── Auth ───────────────────────────────────────────────────────────────────

describe('Auth', () => {
  it('login guarda token y retorna AuthState', async () => {
    mockFetch(200, { token: 'tok-xyz', user: MOCK_USER });
    const result = await login('a@test.com', 'pass');
    expect(result.isAuthenticated).toBe(true);
    expect(result.token).toBe('tok-xyz');
    expect(result.user).toEqual(MOCK_USER);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'tok-xyz');
  });

  it('login lanza error si la API responde 401', async () => {
    mockFetch(401, { message: 'Credenciales inválidas' });
    await expect(login('bad@test.com', 'wrong')).rejects.toThrow('Credenciales inválidas');
  });

  it('logout limpia token aunque la API falle', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    await expect(logout()).resolves.toBeUndefined();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });

  it('logout exitoso limpia token', async () => {
    mockFetch(200, { message: 'ok' });
    await logout();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });

  it('getMe retorna datos del usuario autenticado', async () => {
    mockFetch(200, { data: MOCK_USER });
    const user = await getMe();
    expect(user).toEqual(MOCK_USER);
  });
});

// ── Contactos ──────────────────────────────────────────────────────────────

describe('Contactos', () => {
  it('getContactos retorna lista paginada', async () => {
    const paginated = { data: [MOCK_CONTACTO], meta: { total: 1, per_page: 15, current_page: 1, last_page: 1 } };
    mockFetch(200, paginated);
    const result = await getContactos();
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('getContactos pasa parámetros en query string', async () => {
    const paginated = { data: [], meta: { total: 0, per_page: 15, current_page: 1, last_page: 1 } };
    mockFetch(200, paginated);
    await getContactos({ estado: 'nuevo', q: 'Juan', page: 2 });
    const url = (global.fetch as jest.Mock).mock.calls.at(-1)[0] as string;
    expect(url).toContain('estado=nuevo');
    expect(url).toContain('q=Juan');
    expect(url).toContain('page=2');
  });

  it('getContacto retorna contacto por id', async () => {
    mockFetch(200, { data: MOCK_CONTACTO });
    const c = await getContacto(1);
    expect(c.id).toBe(1);
    expect(c.nombre).toBe('Juan Pérez');
  });

  it('createContacto envía POST y retorna contacto creado', async () => {
    mockFetch(201, { data: MOCK_CONTACTO });
    const c = await createContacto({ nombre: 'Juan Pérez' });
    expect(c.id).toBe(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls.at(-1);
    expect(opts.method).toBe('POST');
    expect(url).toContain('/contactos');
  });

  it('updateContacto envía PUT y retorna contacto actualizado', async () => {
    mockFetch(200, { data: { ...MOCK_CONTACTO, nombre: 'Juan M.' } });
    const c = await updateContacto(1, { nombre: 'Juan M.' });
    expect(c.nombre).toBe('Juan M.');
    const [, opts] = (global.fetch as jest.Mock).mock.calls.at(-1);
    expect(opts.method).toBe('PUT');
  });
});

// ── Expedientes ────────────────────────────────────────────────────────────

describe('Expedientes', () => {
  it('getExpedientes retorna lista paginada', async () => {
    const paginated = { data: [MOCK_EXPEDIENTE], meta: { total: 1, per_page: 15, current_page: 1, last_page: 1 } };
    mockFetch(200, paginated);
    const result = await getExpedientes();
    expect(result.data).toHaveLength(1);
  });

  it('getExpediente retorna expediente por id', async () => {
    mockFetch(200, { data: MOCK_EXPEDIENTE });
    const e = await getExpediente(1);
    expect(e.folio).toBe('EXP-001');
  });

  it('createExpediente envía POST', async () => {
    mockFetch(201, { data: MOCK_EXPEDIENTE });
    const e = await createExpediente({ contacto_id: 1, tipo_tramite_id: 1 });
    expect(e.id).toBe(1);
    const [, opts] = (global.fetch as jest.Mock).mock.calls.at(-1);
    expect(opts.method).toBe('POST');
  });
});

// ── Documentos ─────────────────────────────────────────────────────────────

describe('Documentos', () => {
  it('uploadDocumento envía multipart/form-data', async () => {
    const mockDoc = { id: 1, expediente_id: 1, tipo_documento: 'ine', estado: 'pendiente' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 201,
      json: () => Promise.resolve({ data: mockDoc }),
    });
    const doc = await uploadDocumento(1, 'file://test.jpg', 'ine', 'nota');
    expect(doc.tipo_documento).toBe('ine');
    const [url, opts] = (global.fetch as jest.Mock).mock.calls.at(-1);
    expect(url).toContain('/expedientes/1/documentos');
    expect(opts.body).toBeInstanceOf(FormData);
  });

  it('uploadDocumento lanza error si la respuesta no es ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 422, json: () => Promise.resolve({}) });
    await expect(uploadDocumento(1, 'file://test.jpg', 'ine')).rejects.toThrow('422');
  });
});

// ── Ubicaciones ────────────────────────────────────────────────────────────

describe('Ubicaciones', () => {
  const MOCK_UBICACION = {
    id: 1, contacto_id: 1, latitud: 19.43, longitud: -99.13,
    tipo: 'visita_cliente' as const, notas: 'primer visita', created_at: '2025-01-01',
  };

  it('registrarUbicacion envía POST', async () => {
    mockFetch(201, { data: MOCK_UBICACION });
    const u = await registrarUbicacion({ contacto_id: 1, latitud: 19.43, longitud: -99.13, tipo: 'visita_cliente', visitado_en: '2025-01-01' });
    expect(u.tipo).toBe('visita_cliente');
    const [, opts] = (global.fetch as jest.Mock).mock.calls.at(-1);
    expect(opts.method).toBe('POST');
  });

  it('getUbicacionesMapa retorna array', async () => {
    mockFetch(200, { data: [MOCK_UBICACION] });
    const ubicaciones = await getUbicacionesMapa();
    expect(ubicaciones).toHaveLength(1);
    expect(ubicaciones[0].latitud).toBe(19.43);
  });
});

// ── Sync ───────────────────────────────────────────────────────────────────

describe('syncBatch', () => {
  it('envía operaciones y retorna resultados', async () => {
    const mockResponse = {
      resultados: [{ id_local: 'uuid-1', estado: 'ok', mensaje: 'ok' }],
      procesados: 1, errores: 0,
    };
    mockFetch(200, mockResponse);
    const res = await syncBatch([
      { id_local: 'uuid-1', tipo: 'crear_contacto', datos: { nombre: 'Ana' }, timestamp: '2025-01-01', intentos: 0, estado: 'pendiente' }
    ]);
    expect(res.procesados).toBe(1);
    expect(res.resultados[0].estado).toBe('ok');
  });
});

// ── Dispositivos ───────────────────────────────────────────────────────────

describe('registrarDispositivo', () => {
  it('envía fcm_token y plataforma al backend', async () => {
    mockFetch(201, { message: 'ok' });
    await registrarDispositivo('ExponentPushToken[abc]', 'android');
    const [, opts] = (global.fetch as jest.Mock).mock.calls.at(-1);
    const body = JSON.parse(opts.body as string);
    expect(body.fcm_token).toBe('ExponentPushToken[abc]');
    expect(body.plataforma).toBe('android');
  });
});

// ── Cabeceras de autorización ──────────────────────────────────────────────

describe('Cabeceras de autorización', () => {
  it('apiFetch incluye Bearer token en cabecera', async () => {
    mockFetch(200, { data: MOCK_USER });
    await getMe();
    const [, opts] = (global.fetch as jest.Mock).mock.calls.at(-1);
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer mock-token-123');
  });
});

// ── Sesión expirada (401) ────────────────────────────────────────────────────

describe('apiFetch — sesión expirada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('en un 401 de un endpoint normal, limpia el token y redirige a login', async () => {
    mockFetch(401, { message: 'Unauthenticated.' });

    await expect(getContacto(1)).rejects.toThrow('Sesión expirada. Inicia sesión de nuevo.');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('un 401 en /auth/me (revisar si el token sigue siendo válido) también fuerza el logout', async () => {
    // Antes se excluía cualquier ruta bajo /auth/, lo que sin querer tapaba
    // /auth/me — justo el endpoint que valida la sesión al abrir la app.
    mockFetch(401, { message: 'Unauthenticated.' });

    await expect(getMe()).rejects.toThrow('Sesión expirada. Inicia sesión de nuevo.');
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('login con contraseña incorrecta (401) no fuerza el logout global', async () => {
    mockFetch(401, { message: 'Credenciales incorrectas.' });

    await expect(login('a@test.com', 'mala')).rejects.toThrow('Credenciales incorrectas.');
    expect(router.replace).not.toHaveBeenCalled();
  });
});
