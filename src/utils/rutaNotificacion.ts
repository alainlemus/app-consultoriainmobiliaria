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
  encargo_id?:    string | number;
}

export const INICIO_ASESOR    = '/(tabs)';
export const INICIO_ACREDITADO = '/(acreditado)';
export const INICIO_GESTOR    = '/(gestor)';

/** ¿Es un inicio (se usa navigate) y no un detalle (se usa push)? */
export const esInicio = (ruta: string) => ruta === INICIO_ASESOR || ruta === INICIO_ACREDITADO || ruta === INICIO_GESTOR;

export function rutaParaNotificacion(data: DatosNotificacion | undefined | null, esAcreditado: boolean): string {
  const d = data ?? {};

  if (esAcreditado) {
    // Aviso de documento solicitado: el aviso está en Mi Trámite
    if (d.screen === 'tramite') return INICIO_ACREDITADO;
    // Documentos (subida, validación, rechazo, expediente completo) traen expediente_id;
    // cambios de etapa o cierre solo traen `id` y se ven en Mi Trámite.
    if (d.expediente_id || d.screen === 'documentos') return '/(acreditado)/documentos';
    return INICIO_ACREDITADO;
  }

  // Avisos del gestor: abrir su encargo (los del super_admin traen screen 'expedientes')
  if (d.screen === 'gestor_encargo') return d.encargo_id ? `/gestor/${d.encargo_id}` : INICIO_GESTOR;
  if (d.expediente_id) return `/expedientes/${d.expediente_id}`;
  if (d.contacto_id)   return `/prospectos/${d.contacto_id}`;
  if (d.id && (d.screen === 'expedientes' || d.screen === 'expediente')) return `/expedientes/${d.id}`;
  if (d.id && d.screen === 'prospectos') return `/prospectos/${d.id}`;
  if (d.screen === 'visitas') return '/mapa';          // las visitas se ven en el mapa
  return INICIO_ASESOR;                                // comisiones, cuentas y demás: al inicio
}
