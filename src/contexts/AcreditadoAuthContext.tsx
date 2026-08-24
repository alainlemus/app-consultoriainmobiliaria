/**
 * AcreditadoAuthContext — sesión del acreditado separada del asesor.
 * Persiste el acreditado en SecureStore con clave diferente a la del asesor.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { getMeAcreditado, getAcreditadoToken, removeAcreditadoToken, ACREDITADO_CACHE_KEY as CACHE_KEY } from '../services/acreditadoApi';
import type { Acreditado } from '../types';

interface AcreditadoAuthContextType {
  acreditado: Acreditado | null;
  loading:    boolean;
  refresh:    () => Promise<void>;
  clearAcreditado: () => void;
}

const AcreditadoAuthContext = createContext<AcreditadoAuthContextType | null>(null);

export function AcreditadoAuthProvider({ children }: { children: React.ReactNode }) {
  const [acreditado, setAcreditado] = useState<Acreditado | null>(null);
  const [loading,    setLoading]    = useState(true);

  const refresh = useCallback(async () => {
    try {
      const a = await getMeAcreditado();
      setAcreditado(a);
      await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(a));
    } catch {}
  }, []);

  const clearAcreditado = useCallback(() => {
    setAcreditado(null);
    SecureStore.deleteItemAsync(CACHE_KEY).catch(() => {});
    removeAcreditadoToken().catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Cargar caché inmediatamente
        const cached = await SecureStore.getItemAsync(CACHE_KEY);
        if (cached) setAcreditado(JSON.parse(cached));

        // Verificar que el token sigue válido
        const token = await getAcreditadoToken();
        if (token) {
          await refresh();
        } else {
          setAcreditado(null);
        }
      } catch {
        setAcreditado(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AcreditadoAuthContext.Provider value={{ acreditado, loading, refresh, clearAcreditado }}>
      {children}
    </AcreditadoAuthContext.Provider>
  );
}

export function useAcreditadoAuth(): AcreditadoAuthContextType {
  const ctx = useContext(AcreditadoAuthContext);
  if (!ctx) throw new Error('useAcreditadoAuth must be inside AcreditadoAuthProvider');
  return ctx;
}
