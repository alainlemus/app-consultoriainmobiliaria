/**
 * Login único (POST /v1/auth/entrar, backend 1.18.0): un solo formulario para
 * asesores, gestores, super admin y acreditados. El backend dice qué tipo de
 * cuenta es y aquí se guarda el token donde lo espera cada interfaz.
 */
import * as SecureStore from 'expo-secure-store';
import { apiFetch, nombreDispositivo, saveToken } from './api';
import { saveAcreditadoToken } from './acreditadoApi';
import type { AcreditadoAuthState, AuthState } from '../types';

export type ResultadoEntrar =
  | { tipo: 'staff'; state: AuthState }
  | { tipo: 'acreditado'; state: AcreditadoAuthState };

export async function entrar(email: string, password: string): Promise<ResultadoEntrar> {
  const res = await apiFetch<{ tipo: 'staff' | 'acreditado'; token: string; user?: AuthState['user']; acreditado?: AcreditadoAuthState['acreditado'] }>('/auth/entrar', {
    method: 'POST',
    body:   JSON.stringify({ email, password, device_name: await nombreDispositivo() }),
  });

  if (res.tipo === 'acreditado') {
    await saveAcreditadoToken(res.token);
    return { tipo: 'acreditado', state: { acreditado: res.acreditado!, token: res.token } };
  }

  await saveToken(res.token);
  await SecureStore.setItemAsync('cached_user', JSON.stringify(res.user)).catch(() => {});
  return { tipo: 'staff', state: { user: res.user!, token: res.token, isAuthenticated: true } };
}
