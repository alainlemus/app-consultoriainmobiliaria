import * as SecureStore from 'expo-secure-store';

// Biometría deshabilitada en Expo Go — requiere development build
// Implementación real en: src/services/biometrics.dev-build.ts
export const BIOMETRICS_SUPPORTED = false;

export async function isBiometricAvailable(): Promise<boolean> { return false; }
export async function isBiometricEnabled(): Promise<boolean> { return false; }
export async function getBiometricLabel(): Promise<string> { return 'Biometría'; }
export async function enableBiometric(_email: string, _token: string): Promise<void> {}
export async function disableBiometric(): Promise<void> {}
export async function authenticateWithBiometric(): Promise<{ email: string; token: string } | null> { return null; }
