/**
 * Atribución de la instalación a un QR de asesor (fase 2).
 *
 * Corre UNA vez por instalación, en el primer arranque y solo si no hay sesión
 * (asesor ni acreditado). Averigua de qué QR vino la instalación sin que la
 * persona teclee nada:
 *
 *  1. Android: Play Install Referrer. Play Store entrega el `referrer` con el
 *     que se abrió la tienda; nuestra liga /a/{codigo} lo manda con
 *     codigo_asesor=XXX. Exacto.
 *  2. iPhone (y Android sin referrer): cruce por huella en el backend. Probable;
 *     si es ambiguo regresa null y listo.
 *
 * El resultado se guarda en SecureStore y el registro del acreditado lo usa
 * para precargar el campo "Código de asesor". La persona siempre puede
 * cambiarlo o borrarlo; si lo cambia, el origen pasa a 'codigo_manual'.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import InstallReferrer from '../../modules/install-referrer';
import { atribuirInstalacion } from './acreditadoApi';
import type { OrigenCodigoAsesor } from '../types';

const KEY_HECHA     = 'atribucion_qr_hecha';
const KEY_DETECTADO = 'codigo_asesor_detectado';

export interface CodigoDetectado {
  codigo: string;
  origen: Exclude<OrigenCodigoAsesor, 'codigo_manual'>;
  asesorNombre?: string | null;
}

/** Igual que el backend: mayúsculas, solo letras y números. */
export function normalizarCodigo(v: string): string {
  return v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
}

/** Saca codigo_asesor (o utm_campaign) de la cadena del Install Referrer. */
export function codigoDesdeReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  const params = new URLSearchParams(referrer);
  const codigo = normalizarCodigo(params.get('codigo_asesor') ?? params.get('utm_campaign') ?? '');
  return codigo.length >= 4 ? codigo : null;
}

async function guardar(detectado: CodigoDetectado | null): Promise<void> {
  if (detectado) await SecureStore.setItemAsync(KEY_DETECTADO, JSON.stringify(detectado));
  await SecureStore.setItemAsync(KEY_HECHA, '1');
}

/**
 * Detecta el código una sola vez por instalación. Idempotente y silenciosa:
 * cualquier fallo (sin red, Play Store viejo…) deja la instalación sin código
 * y la persona lo teclea como en la fase 1.
 */
export async function detectarCodigoAsesor(): Promise<CodigoDetectado | null> {
  if (await SecureStore.getItemAsync(KEY_HECHA)) return obtenerCodigoDetectado();

  // 1. Android: Install Referrer
  if (Platform.OS === 'android' && InstallReferrer) {
    try {
      const info   = await InstallReferrer.getReferrerAsync();
      const codigo = codigoDesdeReferrer(info?.installReferrer);
      if (codigo) {
        const detectado: CodigoDetectado = { codigo, origen: 'referrer' };
        await guardar(detectado);
        return detectado;
      }
    } catch { /* sin dato: seguimos a la huella */ }
  }

  // 2. Cruce por huella en el backend (iPhone, o Android sin referrer)
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      const res = await atribuirInstalacion({
        plataforma: Platform.OS,
        os_version: Device.osVersion ?? String(Platform.Version),
        modelo:     Device.modelName ?? undefined,
      });
      if (res?.codigo) {
        const detectado: CodigoDetectado = { codigo: res.codigo, origen: 'huella', asesorNombre: res.asesor?.nombre };
        await guardar(detectado);
        return detectado;
      }
    } catch {
      // Sin red en el primer arranque: no marcar como hecha, se reintenta
      // la próxima vez que abra la app sin sesión (la ventana es de 48 h).
      return null;
    }
  }

  await guardar(null);
  return null;
}

export async function obtenerCodigoDetectado(): Promise<CodigoDetectado | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_DETECTADO);
    return raw ? (JSON.parse(raw) as CodigoDetectado) : null;
  } catch {
    return null;
  }
}

/** Ya se usó al crear la cuenta (o la persona lo descartó). */
export async function limpiarCodigoDetectado(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_DETECTADO).catch(() => {});
}
