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
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  contarPendientesRoute,
  syncRoutePoints,
  guardarPuntoOffline,
} from '../services/routeTracking';

import { programarRecordatoriosRuta, cancelarRecordatoriosRuta } from '../services/notifications';

const KEY_TRACKING_ENABLED = 'route:tracking_enabled';
const KEY_TRACKING_SINCE   = 'route:tracking_since';

/** Hora local a partir de la cual una ruta olvidada se desactiva sola. */
const HORA_CIERRE_AUTOMATICO = 22;

/**
 * Una ruta activa se da por olvidada si ya pasó el cierre del día en que se
 * activó (o si ya es otro día). Sin rastreo en segundo plano no se puede tomar
 * un punto final real, así que el cierre automático no agrega ninguno.
 */
export function rutaOlvidada(desde: Date, ahora: Date = new Date()): boolean {
  const cierre = new Date(desde);
  cierre.setHours(HORA_CIERRE_AUTOMATICO, 0, 0, 0);
  if (desde.getTime() >= cierre.getTime()) cierre.setDate(cierre.getDate() + 1);
  return ahora.getTime() >= cierre.getTime();
}

/**
 * Posición para el punto de inicio/fin sin colgar el interruptor: en la sierra
 * el GPS puede tardar mucho en fijar. Espera 15 s y si no, usa la última
 * posición conocida (solo si tiene menos de 30 min); si no hay, devuelve null
 * y la ruta se activa/apaga igual.
 */
async function posicionRapida(): Promise<Location.LocationObject | null> {
  try {
    const loc = await Promise.race<Location.LocationObject | null>([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 15_000)),
    ]);
    if (loc) return loc;
  } catch {}
  return Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 }).catch(() => null);
}

/** El punto lleva la hora del momento (activar/apagar), no la de la lectura del GPS. */
async function guardarPunto(loc: Location.LocationObject): Promise<void> {
  await guardarPuntoOffline({
    lat:       loc.coords.latitude,
    lng:       loc.coords.longitude,
    precision: loc.coords.accuracy ?? 0,
    velocidad: Math.max(0, (loc.coords.speed ?? 0) * 3.6),
    timestamp: new Date().toISOString(),
  });
}

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

  // ── Cierre automático de rutas olvidadas ───────────────────────────────────

  const revisarOlvido = useCallback(async () => {
    const desdeRaw = await AsyncStorage.getItem(KEY_TRACKING_SINCE);
    const desde = desdeRaw ? new Date(desdeRaw) : null;
    if (!desde || isNaN(desde.getTime())) {
      // Ruta activada en una versión anterior: se empieza a contar desde ahora.
      await AsyncStorage.setItem(KEY_TRACKING_SINCE, new Date().toISOString());
      return;
    }
    if (!rutaOlvidada(desde)) return;
    await syncRoutePoints();
    await AsyncStorage.setItem(KEY_TRACKING_ENABLED, '0');
    await cancelarRecordatoriosRuta();
    if (isMountedRef.current) {
      setEstaActivo(false);
      setError('Tu ruta se desactivó sola porque quedó activa después de las 10 pm.');
      await actualizarPendientes();
    }
  }, [actualizarPendientes]);

  // ── Restaurar estado al montar ──────────────────────────────────────────────

  useEffect(() => {
    if (!isAsesor) return;
    (async () => {
      const guardado = await AsyncStorage.getItem(KEY_TRACKING_ENABLED);
      if (isMountedRef.current && guardado === '1') {
        setEstaActivo(true);
        await revisarOlvido();
      }
    })();
  }, [isAsesor, revisarOlvido]);

  // Al volver a la app, si la ruta quedó activa pasado el cierre, se apaga sola.
  useEffect(() => {
    if (!isAsesor || !estaActivo) return;
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') revisarOlvido(); });
    return () => sub.remove();
  }, [isAsesor, estaActivo, revisarOlvido]);

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

      // Punto de inicio: se guarda en el teléfono y se envía aparte, sin
      // esperar a la red (con 2G/3G o sin señal el interruptor no se traba).
      const loc = await posicionRapida();
      if (loc) await guardarPunto(loc);

      await AsyncStorage.setItem(KEY_TRACKING_ENABLED, '1');
      await AsyncStorage.setItem(KEY_TRACKING_SINCE, new Date().toISOString());
      programarRecordatoriosRuta();

      if (isMountedRef.current) {
        setEstaActivo(true);
        setIniciando(false);
        await actualizarPendientes();
      }
      syncRoutePoints().then(actualizarPendientes).catch(() => {});
    } catch (e: unknown) {
      if (isMountedRef.current) {
        setError(e instanceof Error ? e.message : 'Error al activar tracking');
        setIniciando(false);
      }
    }
  }, [isAsesor, actualizarPendientes]);

  // ── Desactivar ─────────────────────────────────────────────────────────────

  const desactivar = useCallback(async () => {
    setIniciando(true);
    try {
      // Punto final (misma regla que el de inicio: nunca traba el apagado)
      const loc = await posicionRapida();
      if (loc) await guardarPunto(loc);
    } catch {}

    await AsyncStorage.setItem(KEY_TRACKING_ENABLED, '0');
    cancelarRecordatoriosRuta();

    if (isMountedRef.current) {
      setEstaActivo(false);
      setError(null);
      setIniciando(false);
      await actualizarPendientes();
    }
    // Se envía en segundo plano; si no hay señal queda en cola y sale solo después
    syncRoutePoints().then(actualizarPendientes).catch(() => {});
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
