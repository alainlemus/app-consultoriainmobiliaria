/** Foto con la cámara (nunca de la galería) y ubicación solo si ya hay permiso. */
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import type TextRecognitionT from '@react-native-ml-kit/text-recognition';
import { comprimirFoto } from './comprimirFoto';
import { elegirKm } from './kmTablero';
import type { FotoLocal } from '../types/vehiculos';

let TextRecognition: typeof TextRecognitionT | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TextRecognition = (require('@react-native-ml-kit/text-recognition') as { default: typeof TextRecognitionT }).default;
} catch { /* no disponible en Expo Go */ }

/**
 * Propone el km leyendo la foto del tablero con el OCR del teléfono.
 * Devuelve null si no hay OCR (Expo Go), si falla, si tarda o si no encuentra
 * un número creíble. Nunca bloquea: el asesor siempre puede escribirlo.
 */
export async function leerKmTablero(uri: string, kmActual: number | null): Promise<number | null> {
  if (!TextRecognition) return null;
  try {
    const r = await Promise.race([
      TextRecognition.recognize(uri),
      new Promise<null>(res => setTimeout(() => res(null), 8000)),
    ]);
    return r ? elegirKm(r.text, kmActual) : null;
  } catch {
    return null;
  }
}

export async function tomarFoto(nombre: string): Promise<FotoLocal | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permiso requerido', 'Activa el acceso a la cámara en Configuración para tomar las fotos.');
    return null;
  }
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (r.canceled || !r.assets[0]) return null;
  const f = await comprimirFoto(r.assets[0].uri, nombre);
  return { uri: f.uri, name: f.name, type: f.type };
}

/** Coordenadas actuales si la app ya tiene permiso de ubicación. No pregunta ni bloquea. */
export async function ubicacionSiHayPermiso(): Promise<{ lat: number; lng: number } | undefined> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return undefined;
    const loc = await Promise.race<Location.LocationObject | null>([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise(res => setTimeout(() => res(null), 6000)),
    ]);
    const coords = loc?.coords ?? (await Location.getLastKnownPositionAsync())?.coords;
    return coords ? { lat: coords.latitude, lng: coords.longitude } : undefined;
  } catch {
    return undefined;
  }
}
