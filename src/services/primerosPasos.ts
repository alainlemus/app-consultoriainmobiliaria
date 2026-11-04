/**
 * Primeros pasos del acreditado sin expediente.
 *
 * Flujo: elige crédito (o "no sé" → ¿dónde trabajas?) → ¿ya tiene cuenta en el
 * portal? → guía de registro → simulador oficial → monto/captura →
 * presentaciones (si hay) → pide que un asesor le llame.
 *
 * Offline-first: el contenido vive en la app, el avance se guarda en el
 * teléfono y la solicitud final se encola si no hay señal; se envía sola al
 * volver la conexión (ver sincronizarSolicitudPendiente).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getServiciosDisponibles, solicitarAsesoria, urlPublica } from './acreditadoApi';
import { limpiarArchivoLocal } from '../utils/comprimirFoto';
import type { ServicioTramite } from '../types';

export type Credito = 'infonavit' | 'fovissste';
export type CreditoSolicitud = Credito | 'por_definir';
export type RespuestaCuenta = 'si' | 'no' | 'no_se';
export type Horario = 'manana' | 'tarde' | 'cualquiera';

export type Paso =
  | 'credito' | 'donde' | 'cuenta' | 'verificar' | 'guia'
  | 'simulador' | 'resultado' | 'presentaciones' | 'llamada' | 'listo';

export interface DatosPrimerosPasos {
  credito?:       CreditoSolicitud;
  cuenta?:        RespuestaCuenta;
  /** Tocó "Ya me registré" / "Sí, tengo cuenta" en la verificación */
  registrado?:    boolean;
  monto?:         string;
  puntos?:        string;
  salario?:       string;
  capturaUri?:    string;
  noPudoPrecalificar?: boolean;
  horario?:       Horario;
  mensaje?:       string;
}

export interface ProgresoPrimerosPasos {
  paso:      Paso;
  historial: Paso[];
  datos:     DatosPrimerosPasos;
}

// ── Contenido ─────────────────────────────────────────────────────────────────

interface Item { titulo: string; detalle?: string }

export interface Presentacion {
  titulo: string;
  /** p.ej. "PDF · 19 páginas · 5.4 MB" */
  detalle: string;
  tipo: 'pdf' | 'video';
  url: string;
}

export interface ContenidoCredito {
  nombre:           string;
  portalNombre:     string;
  portalUrl:        string;
  simuladorUrl:     string;
  cuentaTitulo:     string;
  cuentaSubtitulo:  string;
  guiaTitulo:       string;
  guiaSubtitulo:    string;
  requisitos:       Item[];
  pasosRegistro:    string[];
  verificarTitulo:  string;
  pasosVerificar:   string[];
  simuladorTitulo:  string;
  simuladorSeccion: string;
  pasosSimulador:   string[];
  /** Infonavit pide puntos, Fovissste salario */
  campoExtra:       { key: 'puntos' | 'salario'; label: string; placeholder: string; prefijo?: string };
  presentaciones:   Presentacion[];
}

export const CONTENIDO: Record<Credito, ContenidoCredito> = {
  infonavit: {
    nombre:          'Infonavit',
    portalNombre:    'Mi Cuenta Infonavit',
    portalUrl:       'https://micuenta.infonavit.org.mx/',
    simuladorUrl:    'https://micuenta.infonavit.org.mx/',
    cuentaTitulo:    '¿Ya tienes cuenta en Mi Cuenta Infonavit?',
    cuentaSubtitulo: 'Ahí haces tu precalificación. Si no la tienes, te decimos cómo crearla.',
    guiaTitulo:      'Crea tu cuenta en Mi Cuenta Infonavit',
    guiaSubtitulo:   'Te toma unos 10 minutos. Al terminar, regresa a la app.',
    requisitos: [
      { titulo: 'NSS', detalle: 'Número de Seguridad Social, viene en tu recibo' },
      { titulo: 'CURP' },
      { titulo: 'RFC con homoclave' },
      { titulo: 'Correo electrónico' },
      { titulo: 'Celular', detalle: 'Te llega un código por SMS' },
    ],
    pasosRegistro: [
      'Entra al portal y toca “Regístrate”.',
      'Escribe tu NSS, CURP y RFC.',
      'Crea tu contraseña y confirma con el código que te llega por SMS.',
      'Regresa aquí y toca “Ya me registré”.',
    ],
    verificarTitulo: 'EN MI CUENTA INFONAVIT',
    pasosVerificar: [
      'Abre Mi Cuenta Infonavit con el botón de abajo.',
      'Toca “¿Olvidaste tu contraseña?” y escribe tu NSS.',
      'Si te llega un código por correo o SMS, ya tienes cuenta. Si te dice que no existe, todavía no.',
    ],
    simuladorTitulo:  'Precalifícate en Infonavit',
    simuladorSeccion: 'EN MI CUENTA INFONAVIT',
    pasosSimulador: [
      'Inicia sesión con tu correo y contraseña.',
      'Entra a “Precalificación y puntos”.',
      'Elige comprar vivienda y anota cuánto te prestan.',
      'Toma una captura de pantalla del resultado.',
    ],
    campoExtra:     { key: 'puntos', label: 'Tus puntos Infonavit', placeholder: '1,080' },
    presentaciones: [
      {
        titulo:  'Crédito Infonavit paso a paso',
        detalle: 'Video · 9 min · 6.5 MB',
        tipo:    'video',
        url:     urlPublica('presentaciones/credito-infonavit-paso-a-paso.mp4'),
      },
      {
        titulo:  'Crédito Infonavit paso a paso',
        detalle: 'PDF · 19 páginas · 3.1 MB',
        tipo:    'pdf',
        url:     urlPublica('presentaciones/credito-infonavit-paso-a-paso.pdf'),
      },
    ],
  },
  fovissste: {
    nombre:          'Fovissste',
    portalNombre:    'Mi Portal FOVISSSTE',
    portalUrl:       'https://inscripcioncontinua.fovissste.gob.mx/micrositio/',
    simuladorUrl:    'https://inscripcioncontinua.fovissste.gob.mx/micrositio/',
    cuentaTitulo:    '¿Ya te registraste en Fovissste?',
    cuentaSubtitulo: 'El registro es en Mi Portal FOVISSSTE (Inscripción Continua). Si no lo tienes, te decimos cómo hacerlo.',
    guiaTitulo:      'Regístrate en Mi Portal FOVISSSTE',
    guiaSubtitulo:   'Te toma unos 10 minutos. Al terminar, regresa a la app.',
    requisitos: [
      { titulo: 'CURP', detalle: 'Con ella el portal encuentra tus datos del ISSSTE' },
      { titulo: 'RFC con homoclave' },
      { titulo: 'Tu último talón de pago' },
      { titulo: 'Correo electrónico' },
      { titulo: 'Celular', detalle: 'Te llega un código por SMS' },
    ],
    pasosRegistro: [
      'Entra a Mi Portal FOVISSSTE.',
      'Escribe tu CURP y revisa que tus datos sean correctos.',
      'Confirma tu correo y tu celular con el código que te llega.',
      'Regresa aquí y toca “Ya me registré”.',
    ],
    verificarTitulo: 'EN MI PORTAL FOVISSSTE',
    pasosVerificar: [
      'Abre Mi Portal FOVISSSTE con el botón de abajo.',
      'Escribe tu CURP.',
      'Si el portal te pide tu contraseña, ya estás registrado. Si te pide crear una, todavía no.',
    ],
    simuladorTitulo:  'Simula tu crédito Fovissste',
    simuladorSeccion: 'EN MI PORTAL FOVISSSTE · ETAPA 1 «ESTIMA»',
    pasosSimulador: [
      'Entra a la etapa 1 «Estima». Si dice «Esquemas no disponibles», tu dependencia debe actualizar tu situación laboral.',
      'Llena el formulario: qué quieres hacer (comprar o construir), tu estado, tu salario y el valor aproximado de la vivienda.',
      'Revisa los esquemas que te muestra: monto, pago mensual, tasa y plazo.',
      'Toma una captura de pantalla del resultado.',
    ],
    campoExtra:     { key: 'salario', label: 'Tu salario mensual', placeholder: '18,500', prefijo: '$' },
    presentaciones: [
      {
        titulo:  'Tu crédito Fovissste, explicado',
        detalle: 'Video · 14 min · 6.1 MB',
        tipo:    'video',
        url:     urlPublica('presentaciones/credito-fovissste-explicado.mp4'),
      },
      {
        titulo:  'Tu crédito Fovissste, explicado',
        detalle: 'PDF · 22 páginas · 0.8 MB',
        tipo:    'pdf',
        url:     urlPublica('presentaciones/credito-fovissste-explicado.pdf'),
      },
    ],
  },
};

export const NOMBRE_CREDITO: Record<CreditoSolicitud, string> = {
  infonavit:   'Infonavit',
  fovissste:   'Fovissste',
  por_definir: 'Por definir',
};

export const HORARIO_LABEL: Record<Horario, string> = {
  manana:     'Mañana',
  tarde:      'Tarde',
  cualquiera: 'Cualquier hora',
};

/** Número de paso (de 5) que se muestra en el encabezado */
export const NUMERO_PASO: Record<Paso, number> = {
  credito: 1, donde: 1, cuenta: 2, verificar: 2, guia: 2,
  simulador: 3, resultado: 3, presentaciones: 4, llamada: 5, listo: 5,
};

export const NOMBRE_PASO: Record<Paso, string> = {
  credito:        'Elige tu crédito',
  donde:          '¿Dónde trabajas?',
  cuenta:         'Tu cuenta en el portal',
  verificar:      'Revisa si ya tienes cuenta',
  guia:           'Registro en el portal',
  simulador:      'Precalificación',
  resultado:      'Tu precalificación',
  presentaciones: 'Presentaciones',
  llamada:        'Un asesor te llama',
  listo:          'Listo',
};

export const PROGRESO_INICIAL: ProgresoPrimerosPasos = { paso: 'credito', historial: [], datos: {} };

// ── Avance (local) ────────────────────────────────────────────────────────────

const progresoKey = (acreditadoId: number) => `primeros_pasos_v1:${acreditadoId}`;
const PENDIENTE_KEY = 'primeros_pasos_solicitud_pendiente_v1';

export async function cargarProgreso(acreditadoId: number): Promise<ProgresoPrimerosPasos | null> {
  try {
    const raw = await AsyncStorage.getItem(progresoKey(acreditadoId));
    return raw ? (JSON.parse(raw) as ProgresoPrimerosPasos) : null;
  } catch {
    return null;
  }
}

export async function guardarProgreso(acreditadoId: number, p: ProgresoPrimerosPasos): Promise<void> {
  await AsyncStorage.setItem(progresoKey(acreditadoId), JSON.stringify(p)).catch(() => {});
}

export async function borrarProgreso(acreditadoId: number): Promise<void> {
  await AsyncStorage.removeItem(progresoKey(acreditadoId)).catch(() => {});
}

// ── Solicitud final ───────────────────────────────────────────────────────────

const RESPUESTA_CUENTA: Record<RespuestaCuenta, string> = { si: 'Sí', no: 'No', no_se: 'No estaba seguro' };

export function componerMensaje(d: DatosPrimerosPasos): string {
  const lineas = ['Solicitud desde Primeros pasos (app).', `Crédito: ${NOMBRE_CREDITO[d.credito ?? 'por_definir']}`];
  if (d.credito && d.credito !== 'por_definir') {
    const cuenta = d.registrado ? 'Sí' : d.cuenta ? RESPUESTA_CUENTA[d.cuenta] : 'Sin contestar';
    lineas.push(`Cuenta en el portal: ${cuenta}`);
    if (d.noPudoPrecalificar) lineas.push('Precalificación: no la pudo terminar');
    else if (d.monto) lineas.push(`Precalificación: $${d.monto}`);
    if (d.puntos)  lineas.push(`Puntos Infonavit: ${d.puntos}`);
    if (d.salario) lineas.push(`Salario mensual: $${d.salario}`);
  }
  if (d.horario) lineas.push(`Horario para llamar: ${HORARIO_LABEL[d.horario]}`);
  if (d.mensaje?.trim()) lineas.push('', `Mensaje: ${d.mensaje.trim()}`);
  return lineas.join('\n').slice(0, 1000);
}

/** Tipo de trámite del catálogo que corresponde al crédito elegido */
export function tipoTramiteDe(credito: CreditoSolicitud, servicios: ServicioTramite[]): number | undefined {
  const buscar = (...res: RegExp[]) => {
    for (const re of res) {
      const s = servicios.find(x => re.test(x.nombre));
      if (s) return s.id;
    }
    return undefined;
  };
  if (credito === 'fovissste') return buscar(/tradicional.*fovissste/i, /^cr[eé]dito.*fovissste/i, /fovissste/i);
  if (credito === 'infonavit') return buscar(/infonavit.*tradicional/i, /tradicional.*infonavit/i, /^cr[eé]dito.*infonavit/i);
  return buscar(/asesor[ií]a personalizada/i);
}

interface SolicitudPendiente {
  credito:    CreditoSolicitud;
  mensaje:    string;
  capturaUri?: string;
  creadaEn:   string;
  intentos:   number;
}

const esErrorDeRed = (e: unknown) => {
  const msg = (e instanceof Error ? e.message : '').toLowerCase();
  return msg.includes('network') || msg.includes('failed') || msg.includes('timeout') || msg.includes('aborted');
};

async function enviar(p: SolicitudPendiente): Promise<void> {
  const servicios = await getServiciosDisponibles();
  await solicitarAsesoria({
    tipo_tramite_id: tipoTramiteDe(p.credito, servicios),
    mensaje:         p.mensaje,
    screenshotUri:   p.capturaUri,
  });
}

/**
 * Envía la solicitud; si no hay señal la deja en cola.
 * @returns 'enviada' | 'encolada'. Lanza si el servidor la rechazó (p.ej. 422).
 */
export async function enviarSolicitud(datos: DatosPrimerosPasos): Promise<'enviada' | 'encolada'> {
  const p: SolicitudPendiente = {
    credito:    datos.credito ?? 'por_definir',
    mensaje:    componerMensaje(datos),
    capturaUri: datos.noPudoPrecalificar ? undefined : datos.capturaUri,
    creadaEn:   new Date().toISOString(),
    intentos:   0,
  };
  try {
    await enviar(p);
    if (p.capturaUri) await limpiarArchivoLocal(p.capturaUri);
    return 'enviada';
  } catch (e) {
    if (!esErrorDeRed(e)) throw e;
    await AsyncStorage.setItem(PENDIENTE_KEY, JSON.stringify(p));
    return 'encolada';
  }
}

export async function haySolicitudPendiente(): Promise<boolean> {
  try {
    return !!(await AsyncStorage.getItem(PENDIENTE_KEY));
  } catch {
    return false;
  }
}

let enProceso = false;

/** Reintenta la solicitud guardada sin señal. Se llama desde el layout del acreditado. */
export async function sincronizarSolicitudPendiente(): Promise<boolean> {
  if (enProceso) return false;
  enProceso = true;
  try {
    const raw = await AsyncStorage.getItem(PENDIENTE_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw) as SolicitudPendiente;
    try {
      await enviar(p);
    } catch (e) {
      if (esErrorDeRed(e)) return false;
      // El servidor la rechazó: se reintenta un par de veces y luego se descarta.
      if (p.intentos < 2) {
        await AsyncStorage.setItem(PENDIENTE_KEY, JSON.stringify({ ...p, intentos: p.intentos + 1 }));
        return false;
      }
    }
    await AsyncStorage.removeItem(PENDIENTE_KEY);
    if (p.capturaUri) await limpiarArchivoLocal(p.capturaUri);
    return true;
  } catch {
    return false;
  } finally {
    enProceso = false;
  }
}
