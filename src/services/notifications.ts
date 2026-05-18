/**
 * Servicio de Push Notifications (FCM / APNs via Expo)
 *
 * Flujo:
 *  1. Solicita permisos al usuario
 *  2. Obtiene el Expo Push Token (que internamente mapea a FCM / APNs)
 *  3. Registra el token en el backend (POST /api/v1/dispositivos)
 *  4. Configura listeners para notificaciones en foreground y tap
 *
 * El backend puede usar el fcm_token para enviar notificaciones directamente
 * con FCM, o usar el Expo Push Token con la API de Expo Notifications.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registrarDispositivo } from './api';

// ── Configuración global de presentación de notificaciones ──────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
 * Solicita permisos, obtiene el push token y lo registra en el backend.
 * Llamar una sola vez tras el login exitoso.
 */
export async function registrarPushToken(): Promise<string | null> {
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
      name:       'Consultoría Inmobiliaria',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#cd9d36', // gold brand color
    });
  }

  // Obtener token
  try {
    // projectId requerido en SDK 49+. En Expo Go / dev sin EAS no existe — se omite.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
                   ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    if (!projectId) {
      console.log('[FCM] Sin projectId — push notifications omitidas en dev');
      return null;
    }

    const tokenData     = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenData.data;

    // Registrar en el backend
    const plataforma = Platform.OS === 'ios' ? 'ios' : 'android';
    await registrarDispositivo(expoPushToken, plataforma);

    console.log('[FCM] Token registrado:', expoPushToken);
    return expoPushToken;
  } catch (e) {
    console.error('[FCM] Error al obtener/registrar token:', e);
    return null;
  }
}

// ── Listeners ────────────────────────────────────────────────────────────────

type NotifHandler   = (notif: Notifications.Notification) => void;
type ResponseHandler = (response: Notifications.NotificationResponse) => void;

/**
 * Registra handlers para:
 *  - foreground: notificación recibida mientras la app está abierta
 *  - tap: usuario toca la notificación
 *
 * Retorna función para limpiar los listeners (usar en useEffect cleanup).
 */
export function registrarListeners(
  onForeground: NotifHandler,
  onTap:        ResponseHandler,
): () => void {
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
  await Notifications.scheduleNotificationAsync({
    content: {
      title: titulo,
      body:  cuerpo,
      data:  datos ?? {},
      sound: true,
    },
    trigger: null, // inmediata
  });
}

// ── Limpiar badge ────────────────────────────────────────────────────────────

export async function limpiarBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
