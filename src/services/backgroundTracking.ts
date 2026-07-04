/**
 * backgroundTracking.ts
 *
 * Tracking GPS en segundo plano usando expo-task-manager + expo-location.
 *
 * La tarea BACKGROUND_LOCATION_TASK se registra al arrancar la app (app/_layout.tsx)
 * y corre aunque la app esté minimizada o el teléfono bloqueado.
 *
 * Flujo:
 *  1. El asesor activa el tracking desde la pantalla de inicio.
 *  2. Se llama startBackgroundTracking() que inicia Location.startLocationUpdatesAsync().
 *  3. iOS/Android llama a la tarea cada vez que el dispositivo se mueve (distancia mínima).
 *  4. La tarea guarda el punto en la cola offline (AsyncStorage).
 *  5. Cuando hay red, syncRoutePoints() envía los puntos al backend.
 *  6. Al desactivar se llama stopBackgroundTracking().
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { guardarPuntoOffline, syncRoutePoints } from './routeTracking';
import type { RoutePoint } from './routeTracking';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

// ── Definición de la tarea ────────────────────────────────────────────────────
// IMPORTANTE: debe estar en el top-level del módulo (fuera de funciones/componentes)
// para que expo-task-manager la encuentre al arrancar.

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations?: Location.LocationObject[] }>) => {
  if (error) {
    console.warn('[BGTracking] Error en tarea:', error.message);
    return;
  }

  const locations = data?.locations;
  if (!locations || locations.length === 0) return;

  for (const loc of locations) {
    const punto: RoutePoint = {
      lat:       loc.coords.latitude,
      lng:       loc.coords.longitude,
      precision: loc.coords.accuracy ?? 0,
      velocidad: (loc.coords.speed ?? 0) * 3.6, // m/s → km/h
      timestamp: new Date(loc.timestamp).toISOString(),
    };

    try {
      await guardarPuntoOffline(punto);
    } catch (e) {
      console.warn('[BGTracking] Error guardando punto:', e);
    }
  }

  // Intentar sync silencioso — si falla, los puntos quedan en la cola
  try {
    await syncRoutePoints();
  } catch {}
});

// ── Iniciar tracking en background ───────────────────────────────────────────

export async function startBackgroundTracking(): Promise<void> {
  // Verificar permisos de background
  const { status: fg } = await Location.getForegroundPermissionsAsync();
  if (fg !== 'granted') {
    throw new Error('Se necesita permiso de ubicación en primer plano.');
  }

  const { status: bg } = await Location.getBackgroundPermissionsAsync();
  if (bg !== 'granted') {
    // Solicitar permiso de background (iOS muestra "Siempre" vs "Solo al usar")
    const { status: solicitado } = await Location.requestBackgroundPermissionsAsync();
    if (solicitado !== 'granted') {
      // Si el usuario no da permiso "Siempre", funcionar solo en foreground
      // (no lanzar error — la app sigue funcionando con foreground tracking)
      console.warn('[BGTracking] Permiso de background denegado, usando foreground tracking.');
      return;
    }
  }

  const yaActiva = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (yaActiva) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy:           Location.Accuracy.Balanced,
    timeInterval:       2 * 60 * 1000,   // mínimo 2 minutos entre updates
    distanceInterval:   50,               // mínimo 50 metros de movimiento
    showsBackgroundLocationIndicator: true,  // indicador azul en iOS (requerido)
    foregroundService: {
      // Android: notificación persistente requerida para background
      notificationTitle:   'Consultoría Inmobiliaria',
      notificationBody:    'Registrando tu ruta de trabajo…',
      notificationColor:   '#cd9d36',
    },
    pausesUpdatesAutomatically: false,   // no pausar cuando el dispositivo está quieto
  });
}

// ── Detener tracking en background ───────────────────────────────────────────

export async function stopBackgroundTracking(): Promise<void> {
  const activa = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (!activa) return;

  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

// ── Verificar si está activa ──────────────────────────────────────────────────

export async function isBackgroundTrackingActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
}
