/**
 * Hook: useOfflineSync
 *
 * Expone el estado de sincronización offline y una función para
 * encolar operaciones cuando no hay conexión.
 *
 * Uso:
 *   const { online, pendientes, encolar, sincronizar } = useOfflineSync();
 */

import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';

import {
  contarPendientes,
  encolarOperacion,
  sincronizar as doSync,
} from '../services/offline';
import type { OperacionSync } from '../types';

interface OfflineSyncState {
  /** true si hay conexión a internet */
  online:      boolean;
  /** número de operaciones pendientes de sincronizar */
  pendientes:  number;
  /** encola una operación para sincronizar después */
  encolar:     (tipo: OperacionSync['tipo'], datos: Record<string, unknown>) => Promise<string>;
  /** dispara sincronización manual */
  sincronizar: () => Promise<{ ok: number; errores: number }>;
  /** actualiza el contador de pendientes */
  refrescar:   () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState {
  const [online,     setOnline]     = useState(true);
  const [pendientes, setPendientes] = useState(0);

  const refrescar = useCallback(async () => {
    const n = await contarPendientes();
    setPendientes(n);
  }, []);

  // Escucha conectividad
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const conectado = !!(state.isConnected && state.isInternetReachable);
      setOnline(conectado);
      if (conectado) {
        doSync().then(refrescar);
      }
    });

    // Estado inicial
    NetInfo.fetch().then(state => {
      setOnline(!!(state.isConnected && state.isInternetReachable));
    });

    refrescar();

    return unsub;
  }, [refrescar]);

  const encolar = useCallback(
    async (tipo: OperacionSync['tipo'], datos: Record<string, unknown>) => {
      const id = await encolarOperacion(tipo, datos);
      await refrescar();
      return id;
    },
    [refrescar],
  );

  const sincronizar = useCallback(async () => {
    const res = await doSync();
    await refrescar();
    return res;
  }, [refrescar]);

  return { online, pendientes, encolar, sincronizar, refrescar };
}
