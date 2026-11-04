/**
 * Rol del usuario "staff" (los que entran con /v1/auth/login: asesor,
 * super_admin, gestor…). El gestor comparte login y token con el asesor,
 * pero tiene sus propias pantallas en /(gestor).
 */
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types';

/** Misma key que usa AuthContext para el perfil cacheado */
export const USER_CACHE_KEY = 'cached_user';

export function esGestor(user: Pick<User, 'roles'> | null | undefined): boolean {
  const roles = user?.roles;
  const lista = Array.isArray(roles) ? roles : Object.values((roles ?? {}) as Record<string, string>);
  return lista.includes('gestor');
}

/** Inicio de la app para un usuario staff según su rol */
export function inicioStaff(user: Pick<User, 'roles'> | null | undefined): '/(gestor)' | '/(tabs)' {
  return esGestor(user) ? '/(gestor)' : '/(tabs)';
}

/** Lee el perfil cacheado (sin red) para decidir el inicio al abrir la app */
export async function inicioStaffCacheado(): Promise<'/(gestor)' | '/(tabs)'> {
  try {
    const raw = await SecureStore.getItemAsync(USER_CACHE_KEY);
    return inicioStaff(raw ? JSON.parse(raw) : null);
  } catch {
    return '/(tabs)';
  }
}
