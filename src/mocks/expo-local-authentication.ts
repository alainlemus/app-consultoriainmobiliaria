// Mock de expo-local-authentication para Expo Go
// Este archivo reemplaza el módulo nativo en entornos sin soporte

export const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
};

export async function hasHardwareAsync(): Promise<boolean> { return false; }
export async function isEnrolledAsync(): Promise<boolean> { return false; }
export async function supportedAuthenticationTypesAsync(): Promise<number[]> { return []; }
export async function authenticateAsync(_opts?: object): Promise<{ success: false; error: string }> {
  return { success: false, error: 'not_available' };
}
