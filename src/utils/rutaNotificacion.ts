/**
 * A qué pantalla lleva una notificación push al tocarla.
 * Siempre hay destino: el detalle si se conoce (expediente, prospecto, documentos…)
 * y, si no, el inicio de quien la recibe.
 */
export interface DatosNotificacion {
  screen?:        string;
  id?:            string | number;
  expediente_id?: string | number;
  contacto_id?:   string | number;
}

export const INICIO_ASESOR    = '/(tabs)';
export const INICIO_ACREDITADO = '/(acreditado)';

/** ¿Es un inicio (se usa navigate) y no un detalle (se usa push)? */
export const esInicio = (ruta: string) => ruta === INICIO_ASESOR || ruta === INICIO_ACREDITADO;

export function rutaParaNotificacion(data: DatosNotificacion | undefined | null, esAcreditado: boolean): string {
  const d = data ?? {};

  if (esAcreditado) {
    // Documentos (subida, validación, rechazo, expediente completo) traen expediente_id;
    // cambios de etapa o cierre solo traen `id` y se ven en Mi Trámite.
    if (d.expediente_id || d.screen === 'documentos') return '/(acreditado)/documentos';
    return INICIO_ACREDITADO;
  }

  if (d.expediente_id) return `/expedientes/${d.expediente_id}`;
  if (d.contacto_id)   return `/prospectos/${d.contacto_id}`;
  if (d.id && (d.screen === 'expedientes' || d.screen === 'expediente')) return `/expedientes/${d.id}`;
  if (d.id && d.screen === 'prospectos') return `/prospectos/${d.id}`;
  if (d.screen === 'visitas') return '/mapa';          // las visitas se ven en el mapa
  return INICIO_ASESOR;                                // comisiones, cuentas y demás: al inicio
}
