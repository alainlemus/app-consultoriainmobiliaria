/**
 * Servicio de Push Notifications (FCM / APNs via Expo)
 *
 * NOTA SDK 53: expo-notifications fue removido de Expo Go en SDK 53.
 * Este módulo detecta si corre en Expo Go y omite todo silenciosamente.
 * Para usar push notifications en Android se requiere un development build
 * (eas build --profile development) o build de producción.
 *
 * Flujo:
 *  1. Solicita permisos al usuario
 *  2. Obtiene el Expo Push Token (que internamente mapea a FCM / APNs)
 *  3. Registra el token en el backend (POST /api/v1/dispositivos)
 *  4. Configura listeners para notificaciones en foreground y tap
 */

import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registrarDispositivo } from './api';
import { registrarDispositivoAcreditado } from './acreditadoApi';

// ── Detectar Expo Go ─────────────────────────────────────────────────────────

/**
 * En Expo Go (SDK 53+) expo-notifications no está disponible en Android.
 * appOwnership === 'expo' indica que corre dentro de Expo Go.
 */
const esExpoGo = Constants.appOwnership === 'expo';

// ── Importación dinámica segura ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;

if (!esExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
  } catch {
    // development build sin el módulo compilado aún
  }
}

// ── Configuración global de presentación de notificaciones ──────────────────

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldPlaySound:  true,
      shouldSetBadge:   true,
      shouldShowBanner: true,
      shouldShowList:   true,
    }),
  });
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface NotificacionData {
  tipo?:          string;
  expediente_id?: number;
  contacto_id?:   number;
  mensaje?:       string;
  [key: string]:  unknown;
}

// ── Registro de dispositivo ──────────────────────────────────────────────────

/**
 * Solicita permisos, obtiene el push token y lo registra en el backend con
 * la función de registro dada (asesor o acreditado — cada uno usa su propio
 * endpoint/token de auth, ver registrarPushToken / registrarPushTokenAcreditado).
 */
async function registrarPushTokenCon(
  registrar: (fcmToken: string, plataforma: 'ios' | 'android') => Promise<void>,
): Promise<string | null> {
  if (esExpoGo) {
    console.log('[FCM] Push notifications no disponibles en Expo Go (SDK 53+). Usa un development build.');
    return null;
  }

  if (!Notifications) {
    console.log('[FCM] expo-notifications no disponible');
    return null;
  }

  // Solo en dispositivos físicos (no en simulador/emulador)
  if (!Device.isDevice) {
    console.log('[FCM] Notificaciones no disponibles en simulador');
    return null;
  }

  // Permisos
  const { status: existente } = await Notifications.getPermissionsAsync();
  let status = existente;

  if (existente !== 'granted') {
    const { status: nuevo } = await Notifications.requestPermissionsAsync();
    status = nuevo;
  }

  if (status !== 'granted') {
    console.log('[FCM] Permiso de notificaciones denegado');
    return null;
  }

  // Canal Android (requerido para Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:             'Consultoría Inmobiliaria',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#cd9d36',
    });
  }

  // Obtener token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
                   ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    if (!projectId) {
      console.log('[FCM] Sin projectId — push notifications omitidas en dev');
      return null;
    }

    const tokenData     = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenData.data;

    const plataforma = Platform.OS === 'ios' ? 'ios' : 'android';
    await registrar(expoPushToken, plataforma);

    console.log('[FCM] Token registrado:', expoPushToken);
    return expoPushToken;
  } catch (e) {
    console.error('[FCM] Error al obtener/registrar token:', e);
    return null;
  }
}

/** Llamar una sola vez tras el login exitoso del asesor/admin. */
export async function registrarPushToken(): Promise<string | null> {
  return registrarPushTokenCon(registrarDispositivo);
}

/** Llamar una sola vez tras el login/registro exitoso del acreditado. */
export async function registrarPushTokenAcreditado(): Promise<string | null> {
  return registrarPushTokenCon(registrarDispositivoAcreditado);
}

// ── Listeners ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotifHandler    = (notif: any) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResponseHandler = (response: any) => void;

/**
 * Registra handlers para foreground y tap.
 * Retorna función para limpiar los listeners (usar en useEffect cleanup).
 * En Expo Go retorna un no-op.
 */
export function registrarListeners(
  onForeground: NotifHandler,
  onTap:        ResponseHandler,
): () => void {
  if (esExpoGo || !Notifications) {
    return () => {};
  }

  const sub1 = Notifications.addNotificationReceivedListener(onForeground);
  const sub2 = Notifications.addNotificationResponseReceivedListener(onTap);

  return () => {
    sub1.remove();
    sub2.remove();
  };
}

// ── Notificación local (para tests / confirmaciones offline) ─────────────────

export async function mostrarNotificacionLocal(
  titulo:  string,
  cuerpo:  string,
  datos?:  NotificacionData,
): Promise<void> {
  if (esExpoGo || !Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: titulo,
      body:  cuerpo,
      data:  datos ?? {},
      sound: true,
    },
    trigger: null,
  });
}

// ── Limpiar badge ────────────────────────────────────────────────────────────

export async function limpiarBadge(): Promise<void> {
  if (esExpoGo || !Notifications) return;
  await Notifications.setBadgeCountAsync(0);
}
