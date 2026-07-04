/**
 * useRouteTracking — hook para rastrear la ubicación del asesor.
 *
 * Usa expo-task-manager + Location.startLocationUpdatesAsync() para que
 * el tracking continúe aunque la app esté minimizada, el teléfono bloqueado,
 * o el usuario esté usando otras apps (Maps, WhatsApp, llamadas, etc.).
 *
 * Solo se activa para usuarios con rol 'asesor' (no super_admin, no acreditados).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  contarPendientesRoute,
  syncRoutePoints,
  guardarPuntoOffline,
} from '../services/routeTracking';

import {
  startBackgroundTracking,
  stopBackgroundTracking,
  isBackgroundTrackingActive,
} from '../services/backgroundTracking';

const KEY_TRACKING_ENABLED = 'route:tracking_enabled';

interface UseRouteTrackingReturn {
  estaActivo:  boolean;
  pendientes:  number;
  iniciando:   boolean;
  error:       string | null;
  activar:     () => Promise<void>;
  desactivar:  () => Promise<void>;
  forzarSync:  () => Promise<void>;
}

export function useRouteTracking(isAsesor: boolean): UseRouteTrackingReturn {
  const [estaActivo,  setEstaActivo]  = useState(false);
  const [iniciando,   setIniciando]   = useState(false);
  const [pendientes,  setPendientes]  = useState(0);
  const [error,       setError]       = useState<string | null>(null);

  const isMountedRef     = useRef(true);
  const syncIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Actualizar contador de pendientes ──────────────────────────────────────

  const actualizarPendientes = useCallback(async () => {
    if (!isMountedRef.current) return;
    const n = await contarPendientesRoute();
    if (isMountedRef.current) setPendientes(n);
  }, []);

  // ── Restaurar estado al montar (el tracking puede estar activo en background) ─

  useEffect(() => {
    if (!isAsesor) return;
    (async () => {
      const [guardado, bgActivo] = await Promise.all([
        AsyncStorage.getItem(KEY_TRACKING_ENABLED),
        isBackgroundTrackingActive(),
      ]);
      if (isMountedRef.current && (guardado === '1' || bgActivo)) {
        setEstaActivo(true);
      }
    })();
  }, [isAsesor]);

  // ── Sync periódico mientras la app está en foreground ──────────────────────

  useEffect(() => {
    if (!estaActivo) return;

    syncIntervalRef.current = setInterval(async () => {
      await syncRoutePoints();
      await actualizarPendientes();
    }, 30_000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [estaActivo, actualizarPendientes]);

  // ── Activar ────────────────────────────────────────────────────────────────

  const activar = useCallback(async () => {
    if (!isAsesor) return;

    setIniciando(true);
    setError(null);

    try {
      // 1. Pedir permiso de foreground primero
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setError('Permiso de ubicación denegado. Actívalo en Configuración.');
        setIniciando(false);
        return;
      }

      // 2. Iniciar tarea de background (pide permiso "Siempre" en iOS si es necesario)
      await startBackgroundTracking();

      // 3. Registrar un punto inicial inmediatamente
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await guardarPuntoOffline({
          lat:       loc.coords.latitude,
          lng:       loc.coords.longitude,
          precision: loc.coords.accuracy ?? 0,
          velocidad: (loc.coords.speed ?? 0) * 3.6,
          timestamp: new Date(loc.timestamp).toISOString(),
        });
        await syncRoutePoints();
      } catch {
        // Punto inicial falla silenciosamente — background seguirá capturando
      }

      await AsyncStorage.setItem(KEY_TRACKING_ENABLED, '1');

      if (isMountedRef.current) {
        setEstaActivo(true);
        setIniciando(false);
        await actualizarPendientes();
      }
    } catch (e: unknown) {
      if (isMountedRef.current) {
        setError(e instanceof Error ? e.message : 'Error al activar tracking');
        setIniciando(false);
      }
    }
  }, [isAsesor, actualizarPendientes]);

  // ── Desactivar ─────────────────────────────────────────────────────────────

  const desactivar = useCallback(async () => {
    try {
      // Detener la tarea de background
      await stopBackgroundTracking();

      // Sync final
      await syncRoutePoints();
      await actualizarPendientes();
    } catch {}

    await AsyncStorage.setItem(KEY_TRACKING_ENABLED, '0');

    if (isMountedRef.current) {
      setEstaActivo(false);
      setError(null);
    }
  }, [actualizarPendientes]);

  // ── Forzar sync manual ─────────────────────────────────────────────────────

  const forzarSync = useCallback(async () => {
    await syncRoutePoints();
    await actualizarPendientes();
  }, [actualizarPendientes]);

  // ── Cleanup al desmontar ───────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    actualizarPendientes();

    return () => {
      isMountedRef.current = false;
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      // NO detener la tarea de background al desmontar el componente —
      // debe seguir corriendo aunque el componente se desmonte.
    };
  }, [actualizarPendientes]);

  return { estaActivo, pendientes, iniciando, error, activar, desactivar, forzarSync };
}
