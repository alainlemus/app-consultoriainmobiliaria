/**
 * useRouteTracking — hook para registrar la ruta del asesor.
 *
 * No usa ubicación en segundo plano: registra un punto al activar y otro al
 * desactivar el toggle, y el resto del recorrido se arma en el backend
 * combinando esos puntos con las visitas a clientes/escuelas/propiedades
 * (ver RouteController::getPoints en el backend) — cada una ya captura su
 * propia ubicación en primer plano al registrarse desde app/mapa.tsx.
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

  // ── Restaurar estado al montar ──────────────────────────────────────────────

  useEffect(() => {
    if (!isAsesor) return;
    (async () => {
      const guardado = await AsyncStorage.getItem(KEY_TRACKING_ENABLED);
      if (isMountedRef.current && guardado === '1') {
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
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setError('Permiso de ubicación denegado. Actívalo en Configuración.');
        setIniciando(false);
        return;
      }

      // Registrar el punto de inicio de la ruta
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
        // Punto inicial falla silenciosamente — no bloquea la activación
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
      // Registrar el punto final antes de detener — así la ruta del día
      // queda con inicio y fin explícitos.
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
      } catch {
        // Punto final falla silenciosamente — no bloquea la desactivación
      }

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
    };
  }, [actualizarPendientes]);

  return { estaActivo, pendientes, iniciando, error, activar, desactivar, forzarSync };
}
