/**
 * OCR de INE — lectura on-device (Google ML Kit, sin conexión) de la foto/
 * escaneo de la credencial para extraer CURP, nombre y domicilio.
 *
 * Carga condicional del módulo nativo: igual que DocumentScanner/RNImageToPdf
 * en app/expedientes/documentos/subir.tsx — requiere EAS Build, no funciona
 * en Expo Go.
 *
 * Precisión esperada:
 *  - CURP:      confiable — tiene un patrón fijo de 18 caracteres.
 *  - Nombre/domicilio: heurístico (texto entre etiquetas de la credencial),
 *    el layout de la INE varía por versión/estado. SIEMPRE deben revisarse
 *    y poderse corregir en el formulario antes de generar el contrato.
 *  - RFC:       la INE no lo imprime (ni frente ni reverso) — nunca se
 *    obtiene por OCR, debe venir del expediente o captura manual.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import type TextRecognitionT from '@react-native-ml-kit/text-recognition';

// eslint-disable-next-line @typescript-eslint/no-require-imports
let TextRecognition: typeof TextRecognitionT | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TextRecognition = (require('@react-native-ml-kit/text-recognition') as { default: typeof TextRecognitionT }).default;
} catch { /* no disponible en Expo Go */ }

export interface DatosIneOcr {
  curp?:         string;
  nombre?:       string;
  domicilio?:    string;
  claveElector?: string;
}

/** true si el módulo nativo de OCR está disponible (build EAS, no Expo Go) */
export function ocrDisponible(): boolean {
  return TextRecognition !== null;
}

const CURP_REGEX          = /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/;
// La clave de elector es un código OCR-B de 18 caracteres alfanuméricos
// (letras del nombre + fecha de nacimiento + entidad/municipio + año de
// registro) — sin el patrón fijo de la CURP, así que solo se busca por
// longitud justo después de la etiqueta impresa.
const CLAVE_ELECTOR_REGEX = /\b[A-Z0-9]{18}\b/;

// Etiquetas tal como aparecen impresas en la INE (mayúsculas, con o sin acentos
// según cómo las lea el OCR)
const ETIQUETAS_NOMBRE    = ['NOMBRE'];
const ETIQUETAS_DOMICILIO = ['DOMICILIO'];
const ETIQUETAS_CORTE     = [
  'DOMICILIO', 'CLAVE DE ELECTOR', 'CURP', 'FECHA DE NACIMIENTO',
  'SEXO', 'AÑO DE REGISTRO', 'ESTADO', 'MUNICIPIO', 'SECCIÓN', 'SECCION', 'VIGENCIA',
];

/**
 * Extrae los renglones entre una línea que contiene alguna de las
 * `etiquetasInicio` y la siguiente línea que contiene alguna etiqueta de
 * `etiquetasCorte` (excluyendo la propia etiqueta de inicio). Se devuelven
 * los renglones por separado (sin unir) porque el orden importa para el
 * nombre — ver `ordenarNombre`.
 */
function extraerLineasEntreEtiquetas(lineas: string[], etiquetasInicio: string[], etiquetasCorte: string[]): string[] | undefined {
  const idxInicio = lineas.findIndex(l => etiquetasInicio.some(et => l.includes(et)));
  if (idxInicio === -1) return undefined;

  const resultado: string[] = [];
  for (let i = idxInicio + 1; i < lineas.length; i++) {
    const linea = lineas[i].trim();
    if (!linea) continue;
    if (etiquetasCorte.some(et => linea.includes(et))) break;
    resultado.push(linea);
  }
  return resultado.length > 0 ? resultado : undefined;
}

/**
 * Busca la etiqueta "CLAVE DE ELECTOR" y devuelve el código de 18 caracteres
 * que aparece en esa misma línea o en una de las 2 siguientes (el layout de
 * la INE varía: a veces el código va pegado a la etiqueta, a veces en su
 * propio renglón).
 */
function extraerClaveElector(lineas: string[]): string | undefined {
  const idx = lineas.findIndex(l => l.includes('CLAVE DE ELECTOR'));
  if (idx === -1) return undefined;

  for (let i = idx; i < Math.min(idx + 3, lineas.length); i++) {
    const match = lineas[i].match(CLAVE_ELECTOR_REGEX);
    if (match) return match[0];
  }
  return undefined;
}

/**
 * La INE imprime el nombre en 3 renglones, en este orden: apellido paterno,
 * apellido materno, nombre(s). Se reordena a "Nombre(s) Apellido paterno
 * Apellido materno" para que se vea natural en el contrato. Si no se
 * capturaron exactamente 3 renglones (foto imperfecta, nombre compuesto
 * que se parte en más líneas, etc.) no hay forma confiable de saber cuáles
 * son apellidos y cuál es el nombre — se devuelve tal cual vino, sin
 * inventar un orden.
 */
function ordenarNombre(lineasNombre: string[]): string {
  if (lineasNombre.length === 3) {
    const [apellidoPaterno, apellidoMaterno, nombres] = lineasNombre;
    return `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim();
  }
  return lineasNombre.join(' ').trim();
}

/** Reconoce CURP / nombre / domicilio a partir de la foto de la INE */
export async function reconocerIne(uri: string): Promise<DatosIneOcr> {
  if (!TextRecognition) return {};

  try {
    const resultado = await TextRecognition.recognize(uri);
    const texto  = resultado.text.toUpperCase();
    const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);

    // TEMPORAL — para diagnosticar por qué no se están extrayendo datos en
    // campo real. Revisa la consola de Metro/dev tools después de escanear.
    if (__DEV__) console.log('[ineOcr] texto reconocido:\n' + lineas.map((l, i) => `${i}: ${l}`).join('\n'));

    const curpMatch       = texto.match(CURP_REGEX);
    const lineasNombre    = extraerLineasEntreEtiquetas(lineas, ETIQUETAS_NOMBRE, ETIQUETAS_CORTE);
    const lineasDomicilio = extraerLineasEntreEtiquetas(lineas, ETIQUETAS_DOMICILIO, ETIQUETAS_CORTE.filter(e => e !== 'DOMICILIO'));
    const claveElector    = extraerClaveElector(lineas);

    return {
      curp:         curpMatch?.[0],
      nombre:       lineasNombre ? ordenarNombre(lineasNombre) : undefined,
      domicilio:    lineasDomicilio ? lineasDomicilio.join(' ').trim() : undefined,
      claveElector,
    };
  } catch (e) {
    // OCR falló (imagen ilegible, etc.) — el formulario de revisión sigue
    // permitiendo captura manual
    if (__DEV__) console.warn('[ineOcr] error al reconocer:', e);
    return {};
  }
}
