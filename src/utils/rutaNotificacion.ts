/**
 * A qué pantalla lleva una notificación push al tocarla.
 * Devuelve null si no hay pantalla que corresponda (solo se abre la app).
 */
export interface DatosNotificacion {
  screen?:        string;
  id?:            string | number;
  expediente_id?: string | number;
  contacto_id?:   string | number;
}

export function rutaParaNotificacion(data: DatosNotificacion | undefined | null, esAcreditado: boolean): string | null {
  if (!data) return null;

  // El acreditado solo tiene su portal: todo lo del expediente se ve en Documentos.
  if (esAcreditado) {
    return data.expediente_id || data.screen === 'documentos' ? '/(acreditado)/documentos' : null;
  }

  if (data.expediente_id) return `/expedientes/${data.expediente_id}`;
  if (data.contacto_id)   return `/prospectos/${data.contacto_id}`;
  if (data.id && data.screen === 'expedientes') return `/expedientes/${data.id}`;
  if (data.id && data.screen === 'prospectos')  return `/prospectos/${data.id}`;
  return null;
}
