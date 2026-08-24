/**
 * Tests: src/services/acreditadoApi.ts
 *
 * Cubre:
 *  - Token storage del acreditado (clave separada de la del asesor)
 *  - loginAcreditado / loginWithTokenAcreditado
 *  - acreditadoFetch: manejo de 401 (sesión expirada → limpiar + redirigir),
 *    sin ese manejo en endpoints /auth/ (login/registro con credenciales malas)
 *  - registrarDispositivoAcreditado
 */

import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import {
  saveAcreditadoToken, getAcreditadoToken, removeAcreditadoToken,
  loginAcreditado, loginWithTokenAcreditado, getMeAcreditado,
  getExpedienteAcreditado,
  registrarDispositivoAcreditado,
  ACREDITADO_CACHE_KEY,
} from '../../src/services/acreditadoApi';

function mockFetch(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok:   status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

// router.replace/SecureStore.* son mocks compartidos entre tests de este
// archivo — limpiar el historial de llamadas evita falsos negativos en los
// asserts de "no se llamó" por acumulación de tests previos.
beforeEach(() => {
  jest.clearAllMocks();
});

const MOCK_ACREDITADO = {
  id: 1, name: 'Cliente Test', email: 'cliente@test.com',
  curp: null, nss: null, rfc: null, foto_perfil_url: null,
  curp_verificado: false, tiene_expediente: false,
};

// ── Token storage ────────────────────────────────────────────────────────────

describe('Token storage (acreditado)', () => {
  it('saveAcreditadoToken usa la key acreditado_token, distinta de la del asesor', async () => {
    await saveAcreditadoToken('tok-acreditado');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('acreditado_token', 'tok-acreditado');
  });

  it('getAcreditadoToken lee de la key acreditado_token', async () => {
    await getAcreditadoToken();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('acreditado_token');
  });

  it('removeAcreditadoToken borra solo la key del acreditado', async () => {
    await removeAcreditadoToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('acreditado_token');
  });
});

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('Auth (acreditado)', () => {
  it('loginAcreditado guarda el token y retorna el acreditado', async () => {
    mockFetch(200, { token: 'tok-login', acreditado: MOCK_ACREDITADO });
    const result = await loginAcreditado('cliente@test.com', 'pass123');
    expect(result.token).toBe('tok-login');
    expect(result.acreditado).toEqual(MOCK_ACREDITADO);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('acreditado_token', 'tok-login');
  });

  it('loginAcreditado con credenciales incorrectas lanza error y NO fuerza logout global', async () => {
    mockFetch(401, { message: 'Credenciales incorrectas.' });
    await expect(loginAcreditado('cliente@test.com', 'mala')).rejects.toThrow('Credenciales incorrectas.');
    // /auth/login está excluido del manejo de "sesión expirada"
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('loginWithTokenAcreditado guarda el token y trae el perfil (restaurar sesión por biometría)', async () => {
    mockFetch(200, { data: MOCK_ACREDITADO });
    const result = await loginWithTokenAcreditado('tok-biometrico');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('acreditado_token', 'tok-biometrico');
    expect(result.acreditado).toEqual(MOCK_ACREDITADO);
    expect(result.token).toBe('tok-biometrico');
  });
});

// ── Sesión expirada (401) ────────────────────────────────────────────────────

describe('acreditadoFetch — sesión expirada', () => {
  it('en un 401 de un endpoint normal, limpia token + caché y redirige a login', async () => {
    mockFetch(401, { message: 'Unauthenticated.' });

    await expect(getExpedienteAcreditado()).rejects.toThrow('Sesión expirada. Inicia sesión de nuevo.');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('acreditado_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(ACREDITADO_CACHE_KEY);
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('un 401 en /auth/me (revisar si el token sigue siendo válido) también fuerza el logout', async () => {
    // Este es justo el endpoint que AcreditadoAuthContext.refresh() llama al
    // abrir la app — si el token ya no es válido, aquí es donde se entera.
    mockFetch(401, { message: 'Unauthenticated.' });

    await expect(getMeAcreditado()).rejects.toThrow('Sesión expirada. Inicia sesión de nuevo.');
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('sin token guardado, un 401 no fuerza el logout global (nunca debió ir autenticado)', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    mockFetch(401, { message: 'Unauthenticated.' });

    await expect(getMeAcreditado()).rejects.toThrow();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

// ── Dispositivo (push) ───────────────────────────────────────────────────────

describe('registrarDispositivoAcreditado', () => {
  it('llama a /acreditado/dispositivos con el fcm_token y la plataforma', async () => {
    mockFetch(201, { message: 'Dispositivo registrado.' });
    await registrarDispositivoAcreditado('expo-token-abc', 'ios');

    const [url, opts] = (global.fetch as jest.Mock).mock.calls.at(-1);
    expect(url).toContain('/v1/acreditado/dispositivos');
    expect(JSON.parse(opts.body)).toEqual({ fcm_token: 'expo-token-abc', plataforma: 'ios' });
  });
});
