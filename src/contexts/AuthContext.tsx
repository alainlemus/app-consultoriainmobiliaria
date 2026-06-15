/**
 * AuthContext — usuario autenticado y su rol accesibles en toda la app.
 *
 * Persiste el usuario en SecureStore para que esté disponible
 * sin necesidad de llamar getMe() en cada pantalla.
 *
 * Uso:
 *   const { user, isSuperAdmin, logout } = useAuth();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { getMe } from '../services/api';
import type { User } from '../types';

const USER_CACHE_KEY = 'cached_user';

interface AuthContextType {
  user:         User | null;
  isSuperAdmin: boolean;
  loading:      boolean;
  /** Recarga el usuario desde el API y actualiza el caché */
  refresh:      () => Promise<void>;
  /** Limpia el usuario del estado (llamar al hacer logout) */
  clearUser:    () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.roles?.includes('super_admin') ?? false;

  const refresh = useCallback(async () => {
    try {
      const u = await getMe();
      setUser(u);
      // Persistir en SecureStore para acceso inmediato en reinicios
      await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(u));
    } catch {
      // Si falla (sin red), mantener el caché existente
    }
  }, []);

  const clearUser = useCallback(() => {
    setUser(null);
    SecureStore.deleteItemAsync(USER_CACHE_KEY).catch(() => {});
  }, []);

  useEffect(() => {
    // Al montar: cargar desde caché inmediatamente, luego refrescar desde API
    (async () => {
      try {
        const cached = await SecureStore.getItemAsync(USER_CACHE_KEY);
        if (cached) {
          setUser(JSON.parse(cached) as User);
        }
      } catch {}

      // Intentar refrescar desde API si hay token
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        await refresh();
      }
      setLoading(false);
    })();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, isSuperAdmin, loading, refresh, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
