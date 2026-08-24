/**
 * Login biométrico (Face ID / huella) — asesor y acreditado.
 *
 * Almacenamiento de un solo slot (un email/token a la vez) etiquetado con
 * `tipo`: si se activa biometría para un modo, reemplaza lo que hubiera
 * guardado para el otro. En la práctica un mismo dispositivo casi siempre
 * pertenece a una sola persona con un solo rol, así que no vale la pena la
 * complejidad de mantener dos slots independientes.
 *
 * Requiere development build (expo-local-authentication no funciona en Expo Go).
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export type BiometricTipo = 'asesor' | 'acreditado';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_EMAIL_KEY   = 'biometric_email';
const BIOMETRIC_TOKEN_KEY   = 'biometric_token';
const BIOMETRIC_TIPO_KEY    = 'biometric_tipo';

export const BIOMETRICS_SUPPORTED = true;

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  return await LocalAuthentication.isEnrolledAsync();
}

/** Sin argumento: ¿hay algo guardado? Con `tipo`: ¿lo guardado es de ese tipo? */
export async function isBiometricEnabled(tipo?: BiometricTipo): Promise<boolean> {
  const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  if (val !== 'true') return false;
  if (!tipo) return true;
  return (await getBiometricTipo()) === tipo;
}

/** Qué tipo de cuenta tiene biometría activa ahora mismo, sin disparar el prompt. */
export async function getBiometricTipo(): Promise<BiometricTipo | null> {
  const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  if (val !== 'true') return null;
  const tipo = await SecureStore.getItemAsync(BIOMETRIC_TIPO_KEY);
  // Instalaciones previas a la separación asesor/acreditado no guardaban tipo
  return (tipo as BiometricTipo | null) ?? 'asesor';
}

export async function enableBiometric(email: string, token: string, tipo: BiometricTipo = 'asesor'): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
  await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
  await SecureStore.setItemAsync(BIOMETRIC_TIPO_KEY, tipo);
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_TIPO_KEY);
}

export async function getBiometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Huella digital';
  return 'Biometría';
}

export async function authenticateWithBiometric(): Promise<{ email: string; token: string; tipo: BiometricTipo } | null> {
  const label = await getBiometricLabel();
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage:         `Accede con ${label}`,
    cancelLabel:           'Cancelar',
    fallbackLabel:         'Usar contraseña',
    disableDeviceFallback: false,
  });
  if (!result.success) return null;
  const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
  const token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
  const tipo  = await getBiometricTipo();
  if (!email || !token || !tipo) return null;
  return { email, token, tipo };
}
