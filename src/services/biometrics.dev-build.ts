/**
 * Implementación real de biometría — usar cuando el development build esté listo.
 * Para activar:
 *   1. Reemplazar el contenido de src/services/biometrics.ts con este archivo
 *   2. Compilar con: npx expo run:ios o eas build
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_EMAIL_KEY   = 'biometric_email';
const BIOMETRIC_TOKEN_KEY   = 'biometric_token';

export const BIOMETRICS_SUPPORTED = true;

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  return await LocalAuthentication.isEnrolledAsync();
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return val === 'true';
}

export async function enableBiometric(email: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
  await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
}

export async function getBiometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Huella digital';
  return 'Biometría';
}

export async function authenticateWithBiometric(): Promise<{ email: string; token: string } | null> {
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
  if (!email || !token) return null;
  return { email, token };
}
