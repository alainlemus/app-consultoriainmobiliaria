/**
 * comprimirFoto / persistirDocumento / limpiarArchivoLocal
 *
 * Utilidades de almacenamiento para archivos que necesitan sobrevivir
 * reinicios de app (cola offline, subida en background):
 *
 * - comprimirFoto      → redimensiona imágenes y las mueve a documentDirectory
 * - comprimirFotos     → versión batch de comprimirFoto
 * - persistirDocumento → copia PDFs/archivos a documentDirectory
 * - limpiarArchivoLocal→ elimina archivo local tras upload exitoso
 * - limpiarFotoLocal   → alias de limpiarArchivoLocal (retrocompatibilidad)
 *
 * Problema resuelto:
 *   expo-image-manipulator y DocumentPicker (copyToCacheDirectory) guardan
 *   en cacheDir que el SO puede limpiar bajo presión de memoria.
 *   documentDirectory es permanente en iOS y Android.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_WIDTH = 1280;
const QUALITY   = 0.7;
const DIR_FOTOS = `${FileSystem.documentDirectory}fotos_pendientes/`;
const DIR_DOCS  = `${FileSystem.documentDirectory}docs_pendientes/`;

async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export interface FotoComprimida {
  uri:    string;
  name:   string;
  type:   string;
  width:  number;
  height: number;
}

/**
 * Comprime una imagen y la mueve a documentDirectory/fotos_pendientes/.
 */
export async function comprimirFoto(
  uri:    string,
  nombre: string = 'foto',
): Promise<FotoComprimida> {
  const resultado = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  await ensureDir(DIR_FOTOS);
  const nombreFinal = `${nombre}_${Date.now()}.jpg`;
  const destino     = `${DIR_FOTOS}${nombreFinal}`;
  await FileSystem.moveAsync({ from: resultado.uri, to: destino });

  return { uri: destino, name: nombreFinal, type: 'image/jpeg', width: resultado.width, height: resultado.height };
}

/**
 * Comprime un array de imágenes en paralelo.
 */
export async function comprimirFotos(
  assets: { uri: string; fileName?: string | null }[],
  prefijo: string = 'foto',
): Promise<FotoComprimida[]> {
  return Promise.all(
    assets.map((a, i) =>
      comprimirFoto(a.uri, a.fileName?.replace(/\.[^.]+$/, '') ?? `${prefijo}_${i + 1}`)
    ),
  );
}

/**
 * Copia un archivo (PDF u otro) a documentDirectory/docs_pendientes/
 * para que la URI sobreviva reinicios de app en Android e iOS.
 *
 * Usar siempre antes de encolar un documento en la cola offline.
 *
 * @param uri    URI original (file:// o content:// de DocumentPicker/Scanner)
 * @param nombre Nombre de archivo sugerido (con extensión, ej: "ine.pdf")
 * @returns      URI permanente en documentDirectory
 */
export async function persistirDocumento(uri: string, nombre: string): Promise<string> {
  await ensureDir(DIR_DOCS);
  const nombreFinal = `${Date.now()}_${nombre}`;
  const destino     = `${DIR_DOCS}${nombreFinal}`;
  await FileSystem.copyAsync({ from: uri, to: destino });
  return destino;
}

/**
 * Elimina un archivo local tras upload exitoso o descarte definitivo.
 * Solo actúa sobre archivos dentro de documentDirectory.
 */
export async function limpiarArchivoLocal(uri: string): Promise<void> {
  try {
    const base = FileSystem.documentDirectory ?? '';
    if (uri.startsWith(base)) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // No es crítico
  }
}

/** Alias para retrocompatibilidad */
export const limpiarFotoLocal = limpiarArchivoLocal;
