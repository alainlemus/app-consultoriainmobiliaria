/**
 * Rol del usuario "staff" (los que entran con /v1/auth/login: asesor,
 * super_admin, gestor…). El gestor comparte login y token con el asesor,
 * pero tiene sus propias pantallas en /(gestor).
 *
 * Un usuario puede tener los dos roles (gestor y asesor). Entonces elige con
 * qué interfaz trabajar y puede cambiar desde Perfil sin cerrar sesión; la
 * elección se guarda en el celular (INTERFAZ_KEY).
 */
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types';

/** Misma key que usa AuthContext para el perfil cacheado */
export const USER_CACHE_KEY = 'cached_user';
/** Interfaz elegida por quien tiene ambos roles: 'asesor' | 'gestor' */
export const INTERFAZ_KEY = 'interfaz_staff';

export type Interfaz = 'asesor' | 'gestor';
export type InicioStaff = '/(gestor)' | '/(tabs)';

function roles(user: Pick<User, 'roles'> | null | undefined): string[] {
  const r = user?.roles;
  return Array.isArray(r) ? r : Object.values((r ?? {}) as Record<string, string>);
}

export function esGestor(user: Pick<User, 'roles'> | null | undefined): boolean {
  return roles(user).includes('gestor');
}

/** Puede usar la interfaz de asesor (asesor o super_admin). */
export function esAsesor(user: Pick<User, 'roles'> | null | undefined): boolean {
  const r = roles(user);
  return r.includes('asesor') || r.includes('super_admin');
}

/** Gestor y asesor a la vez: puede cambiar de interfaz. */
export function tieneAmbasInterfaces(user: Pick<User, 'roles'> | null | undefined): boolean {
  return esGestor(user) && esAsesor(user);
}

/** Solo gestor: nunca debe caer en las pantallas del asesor. */
export function esSoloGestor(user: Pick<User, 'roles'> | null | undefined): boolean {
  return esGestor(user) && ! esAsesor(user);
}

/**
 * Inicio de la app para un usuario staff según su rol. Con ambos roles manda
 * la interfaz preferida (la guardada o la que se pasa); sin preferencia, gestor.
 */
export function inicioStaff(user: Pick<User, 'roles'> | null | undefined, preferida?: Interfaz | null): InicioStaff {
  if (tieneAmbasInterfaces(user)) return preferida === 'asesor' ? '/(tabs)' : '/(gestor)';
  return esGestor(user) ? '/(gestor)' : '/(tabs)';
}

export async function getInterfazGuardada(): Promise<Interfaz | null> {
  try {
    const v = await SecureStore.getItemAsync(INTERFAZ_KEY);
    return v === 'asesor' || v === 'gestor' ? v : null;
  } catch {
    return null;
  }
}

export async function guardarInterfaz(interfaz: Interfaz): Promise<void> {
  await SecureStore.setItemAsync(INTERFAZ_KEY, interfaz).catch(() => {});
}

export async function limpiarInterfaz(): Promise<void> {
  await SecureStore.deleteItemAsync(INTERFAZ_KEY).catch(() => {});
}

/** Lee el perfil cacheado y la interfaz guardada (sin red) para decidir el inicio al abrir la app */
export async function inicioStaffCacheado(): Promise<InicioStaff> {
  try {
    const raw = await SecureStore.getItemAsync(USER_CACHE_KEY);
    return inicioStaff(raw ? JSON.parse(raw) : null, await getInterfazGuardada());
  } catch {
    return '/(tabs)';
  }
}
