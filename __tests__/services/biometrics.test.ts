/**
 * Tests: src/services/biometrics.ts
 *
 * Cubre:
 *  - isBiometricAvailable según hardware/enrolamiento
 *  - enableBiometric/getBiometricTipo/isBiometricEnabled — storage de un
 *    solo slot etiquetado por tipo (asesor | acreditado)
 *  - Compatibilidad hacia atrás: enabled=true sin tipo guardado → 'asesor'
 *  - authenticateWithBiometric: null si falla el prompt o falta algo guardado
 *  - disableBiometric limpia todas las keys
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  getBiometricTipo,
  enableBiometric,
  disableBiometric,
  getBiometricLabel,
  authenticateWithBiometric,
} from '../../src/services/biometrics';

// El mock global de expo-secure-store en jest.setup.js ignora la key y
// siempre regresa el mismo valor — acá necesitamos un store real en memoria
// por key, porque biometrics.ts guarda 4 valores distintos.
function mockSecureStoreBackedByMemory(): Record<string, string | null> {
  const store: Record<string, string | null> = {};
  (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(store[key] ?? null)
  );
  (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation((key: string) => {
    delete store[key];
    return Promise.resolve();
  });
  return store;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSecureStoreBackedByMemory();
});

// ── isBiometricAvailable ─────────────────────────────────────────────────────

describe('isBiometricAvailable', () => {
  it('false si no hay hardware compatible', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(false);
    expect(await isBiometricAvailable()).toBe(false);
  });

  it('false si hay hardware pero no hay nada enrolado', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(false);
    expect(await isBiometricAvailable()).toBe(false);
  });

  it('true si hay hardware y hay algo enrolado', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(true);
    expect(await isBiometricAvailable()).toBe(true);
  });
});

// ── enableBiometric / getBiometricTipo / isBiometricEnabled ─────────────────

describe('enableBiometric — storage de un solo slot por tipo', () => {
  it('guarda tipo "asesor" por defecto si no se especifica', async () => {
    await enableBiometric('asesor@test.com', 'tok-asesor');
    expect(await getBiometricTipo()).toBe('asesor');
    expect(await isBiometricEnabled('asesor')).toBe(true);
    expect(await isBiometricEnabled('acreditado')).toBe(false);
  });

  it('guarda tipo "acreditado" cuando se especifica', async () => {
    await enableBiometric('cliente@test.com', 'tok-acreditado', 'acreditado');
    expect(await getBiometricTipo()).toBe('acreditado');
    expect(await isBiometricEnabled('acreditado')).toBe(true);
    expect(await isBiometricEnabled('asesor')).toBe(false);
  });

  it('activar para un tipo reemplaza lo que hubiera del otro (un solo slot)', async () => {
    await enableBiometric('asesor@test.com', 'tok-asesor', 'asesor');
    await enableBiometric('cliente@test.com', 'tok-acreditado', 'acreditado');

    expect(await getBiometricTipo()).toBe('acreditado');
    expect(await isBiometricEnabled('asesor')).toBe(false);
  });

  it('isBiometricEnabled() sin argumento solo pregunta si hay algo activo', async () => {
    expect(await isBiometricEnabled()).toBe(false);
    await enableBiometric('a@test.com', 'tok', 'asesor');
    expect(await isBiometricEnabled()).toBe(true);
  });

  it('getBiometricTipo() regresa null si nunca se activó biometría', async () => {
    expect(await getBiometricTipo()).toBeNull();
  });

  it('instalaciones previas sin tipo guardado (enabled=true sin biometric_tipo) asumen "asesor"', async () => {
    // Simula el estado de una instalación anterior a esta feature
    await SecureStore.setItemAsync('biometric_enabled', 'true');
    expect(await getBiometricTipo()).toBe('asesor');
  });
});

// ── disableBiometric ─────────────────────────────────────────────────────────

describe('disableBiometric', () => {
  it('limpia las 4 keys — no queda nada activo', async () => {
    await enableBiometric('a@test.com', 'tok', 'acreditado');
    await disableBiometric();

    expect(await getBiometricTipo()).toBeNull();
    expect(await isBiometricEnabled()).toBe(false);
  });
});

// ── getBiometricLabel ────────────────────────────────────────────────────────

describe('getBiometricLabel', () => {
  it('retorna "Face ID" si el hardware soporta reconocimiento facial', async () => {
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    expect(await getBiometricLabel()).toBe('Face ID');
  });

  it('retorna "Huella digital" si solo soporta huella', async () => {
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);
    expect(await getBiometricLabel()).toBe('Huella digital');
  });

  it('retorna "Biometría" genérico si no hay tipos soportados', async () => {
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([]);
    expect(await getBiometricLabel()).toBe('Biometría');
  });
});

// ── authenticateWithBiometric ────────────────────────────────────────────────

describe('authenticateWithBiometric', () => {
  it('null si el usuario cancela o falla el prompt', async () => {
    await enableBiometric('a@test.com', 'tok', 'asesor');
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: false });

    expect(await authenticateWithBiometric()).toBeNull();
  });

  it('null si no hay nada guardado aunque el prompt tenga éxito', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: true });
    expect(await authenticateWithBiometric()).toBeNull();
  });

  it('regresa email/token/tipo si el prompt tiene éxito y hay credenciales guardadas', async () => {
    await enableBiometric('cliente@test.com', 'tok-acreditado', 'acreditado');
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: true });

    const result = await authenticateWithBiometric();
    expect(result).toEqual({ email: 'cliente@test.com', token: 'tok-acreditado', tipo: 'acreditado' });
  });
});
