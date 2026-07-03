/**
 * useRouteTracking — hook para rastrear la ubicación del asesor en segundo plano.
 *
 * Solo se activa para usuarios con rol 'asesor' (no super_admin, no acreditados).
 *
 * Funcionalidad:
 * - Obtiene ubicación GPS cada 2 minutos (configurable)
 * - Si no hay red, guarda los puntos localmente
 * - Cuando recupera conexión, sincroniza automáticamente
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  guardarPuntoOffline,
  syncRoutePoints,
  contarPendientesRoute,
  iniciarRouteSyncAutomatico,
  detenerRouteSyncAutomatico,
  type RoutePoint,
} from '../services/routeTracking';

const KEY_TRACKING_ENABLED = 'route:tracking_enabled';
const INTERVALO_MS = 2 * 60 * 1000; // 2 minutos

interface UseRouteTrackingReturn {
  estaActivo:    boolean;
  pendientes:    number;
  iniciando:     boolean;
  error:         string | null;
  activar:       () => Promise<void>;
  desactivar:    () => Promise<void>;
  forzarSync:   () => Promise<void>;
}

/**
 * Hook principal de route tracking.
 * No hace nada si el usuario no es asesor.
 */
export function useRouteTracking(
  isAsesor: boolean,
): UseRouteTrackingReturn {
  const [estaActivo,     setEstaActivo]     = useState(false);
  const [iniciando,     setIniciando]     = useState(false);
  const [pendientes,     setPendientes]     = useState(0);
  const [error,          setError]          = useState<string | null>(null);

  const intervaloRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef     = useRef(true);

  // ── Verificar si está activo (persisted) ────────────────────────────────

  useEffect(() => {
    if (!isAsesor) return;
    AsyncStorage.getItem(KEY_TRACKING_ENABLED).then(val => {
      if (isMountedRef.current && val === '1') {
        setEstaActivo(true);
      }
    });
  }, [isAsesor]);

  // ── Actualizar contador de pendientes ───────────────────────────────────

  const actualizarPendientes = useCallback(async () => {
    if (!isMountedRef.current) return;
    const n = await contarPendientesRoute();
    if (isMountedRef.current) setPendientes(n);
  }, []);

  // ── Obtener y guardar un punto ─────────────────────────────────────────

  const obtenerYGuardarPunto = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado');
        return;
      }

      // Intentar con alta precisión primero; si falla o tarda, bajar a Balanced
      let loc: Location.LocationObject;
      try {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10_000,   // máximo 10 s de espera
        });
      } catch {
        // Fallback: última ubicación conocida (nunca lanza error)
        const last = await Location.getLastKnownPositionAsync();
        if (!last) {
          // Sin ubicación disponible — silencioso, no mostrar error al usuario
          return;
        }
        loc = last;
      }

      const punto: RoutePoint = {
        lat:       loc.coords.latitude,
        lng:       loc.coords.longitude,
        precision: loc.coords.accuracy ?? 0,
        velocidad: (loc.coords.speed ?? 0) * 3.6, // m/s → km/h
        timestamp: new Date(loc.timestamp).toISOString(),
      };

      // Siempre guardar offline primero (cola persistente)
      await guardarPuntoOffline(punto);

      // Luego intentar sync (isConnected === false solo cuando sabemos que no hay red)
      const state = await NetInfo.fetch();
      if (state.isConnected !== false) {
        try {
          await syncRoutePoints();
        } catch {
          // Ya está guardado offline, se sync más tarde
        }
      }

      if (isMountedRef.current) {
        setError(null);
        await actualizarPendientes();
      }
    } catch (e: unknown) {
      // Solo mostrar error si sigue montado — no mostrar errores de GPS menores
      if (isMountedRef.current) {
        const msg = e instanceof Error ? e.message : 'Error al obtener ubicación';
        // Ignorar errores de timeout de GPS — son normales en interiores
        if (!msg.toLowerCase().includes('timeout') && !msg.toLowerCase().includes('timed out')) {
          setError(msg);
        }
      }
    }
  }, [actualizarPendientes]);

  // ── Iniciar tracking ────────────────────────────────────────────────────

  const activar = useCallback(async () => {
    if (!isAsesor) return;

    setIniciando(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado. Actívalo en Configuración.');
        setIniciando(false);
        return;
      }

      // Obtener ubicación inicial
      await obtenerYGuardarPunto();

      // Intervalo de ubicación
      intervaloRef.current = setInterval(obtenerYGuardarPunto, INTERVALO_MS);

      // Sync periódico cada 30 segundos cuando hay red
      syncIntervalRef.current = setInterval(async () => {
        const state = await NetInfo.fetch();
        if (state.isConnected !== false) {
          await syncRoutePoints();
          await actualizarPendientes();
        }
      }, 30_000);

      // Listener automático de conectividad
      iniciarRouteSyncAutomatico();

      // Persistir estado
      await AsyncStorage.setItem(KEY_TRACKING_ENABLED, '1');

      if (isMountedRef.current) {
        setEstaActivo(true);
        setIniciando(false);
      }
    } catch (e: unknown) {
      if (isMountedRef.current) {
        setError(e instanceof Error ? e.message : 'Error al activar tracking');
        setIniciando(false);
      }
    }
  }, [isAsesor, obtenerYGuardarPunto, actualizarPendientes]);

  // ── Detener tracking ────────────────────────────────────────────────────

  const desactivar = useCallback(async () => {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    detenerRouteSyncAutomatico();

    // Intentar sync final antes de detener
    const state = await NetInfo.fetch();
    if (state.isConnected !== false) {
      await syncRoutePoints();
      await actualizarPendientes();
    }

    await AsyncStorage.setItem(KEY_TRACKING_ENABLED, '0');

    if (isMountedRef.current) {
      setEstaActivo(false);
      setError(null);
    }
  }, []);

  // ── Forzar sync manual ──────────────────────────────────────────────────

  const forzarSync = useCallback(async () => {
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return;
    await syncRoutePoints();
    await actualizarPendientes();
  }, [actualizarPendientes]);

  // ── Cleanup al desmontar ────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    actualizarPendientes();

    return () => {
      isMountedRef.current = false;
      if (intervaloRef.current) clearInterval(intervaloRef.current);
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      detenerRouteSyncAutomatico();
    };
  }, [actualizarPendientes]);

  return {
    estaActivo,
    pendientes,
    iniciando,
    error,
    activar,
    desactivar,
    forzarSync,
  };
}
