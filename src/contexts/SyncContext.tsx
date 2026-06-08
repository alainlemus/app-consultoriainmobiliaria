/**
 * SyncContext — estado global de conectividad y sincronización
 *
 * Un solo listener de red para toda la app. Provee:
 *   online      — true si hay internet disponible
 *   pendientes  — número de ops + docs pendientes de sync
 *   isSyncing   — true mientras está procesando la cola
 *   encolar()   — encola una operación JSON (crear/actualizar)
 *   encolarDoc()— encola un documento para subir
 *   sync()      — dispara sincronización manual
 *
 * Uso:
 *   const { online, pendientes } = useSyncContext();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import NetInfo from '@react-native-community/netinfo';

import {
  contarPendientes,
  encolarDocumento,
  encolarOperacion,
  sincronizar,
} from '../services/offline';
import type { OperacionSync } from '../types';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface DocParams {
  expedienteId: number;
  uri:          string;
  tipo:         string;
  seccion?:     string;
  mimeType:     string;
  notas?:       string;
}

interface SyncContextType {
  online:       boolean;
  pendientes:   number;
  isSyncing:    boolean;
  encolar:      (tipo: OperacionSync['tipo'], datos: Record<string, unknown>) => Promise<string>;
  encolarDoc:   (params: DocParams) => Promise<string>;
  sync:         () => Promise<{ ok: number; errores: number }>;
  /** Alias de sync — compatibilidad con código existente */
  sincronizar:  () => Promise<{ ok: number; errores: number }>;
  refrescar:    () => Promise<void>;
}

// ── Contexto ─────────────────────────────────────────────────────────────────

const SyncContext = createContext<SyncContextType | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [online,     setOnline]     = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [isSyncing,  setIsSyncing]  = useState(false);

  // Evitar múltiples sync simultáneos
  const syncingRef = useRef(false);

  const refrescar = useCallback(async () => {
    const n = await contarPendientes();
    setPendientes(n);
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return { ok: 0, errores: 0 };
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await sincronizar();
      await refrescar();
      return result;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refrescar]);

  // Único listener de red para toda la app
  useEffect(() => {
    // Estado inicial (no esperar el primer evento)
    NetInfo.fetch().then(state => {
      setOnline(!!(state.isConnected && state.isInternetReachable));
    });

    const unsub = NetInfo.addEventListener(state => {
      const conectado = !!(state.isConnected && state.isInternetReachable);
      setOnline(conectado);
      // Sincronizar automáticamente al recuperar conexión
      if (conectado) {
        sync();
      }
    });

    refrescar();
    return unsub;
  }, [sync, refrescar]);

  const encolar = useCallback(
    async (tipo: OperacionSync['tipo'], datos: Record<string, unknown>) => {
      const id = await encolarOperacion(tipo, datos);
      await refrescar();
      return id;
    },
    [refrescar],
  );

  const encolarDoc = useCallback(
    async (params: DocParams) => {
      const id = await encolarDocumento(params);
      await refrescar();
      return id;
    },
    [refrescar],
  );

  return (
    <SyncContext.Provider value={{ online, pendientes, isSyncing, encolar, encolarDoc, sync, sincronizar: sync, refrescar }}>
      {children}
    </SyncContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSyncContext(): SyncContextType {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext debe usarse dentro de <SyncProvider>');
  return ctx;
}
