/**
 * Tipos de documento que se piden para el trámite FOVISSSTE y lo que el asesor
 * debe revisar ANTES de subirlos. Un documento vencido o ilegible detiene el
 * trámite, por eso se muestra el aviso antes de cada subida.
 */
export interface TipoDocumento {
  value:      string;
  label:      string;
  /** Qué revisar de este documento antes de subirlo. */
  requisitos: string[];
}

export const TIPOS_DOCUMENTO: readonly TipoDocumento[] = [
  {
    value: 'ine', label: 'INE',
    requisitos: ['Vigente (no vencida).', 'Anverso y reverso, en la misma hoja o en dos fotos.', 'A color, legible, sin recortes ni reflejos.'],
  },
  {
    value: 'curp', label: 'CURP',
    requisitos: ['Formato actualizado, descargado de gob.mx.', 'Con código QR y legible.'],
  },
  {
    value: 'acta_nacimiento', label: 'Acta de nacimiento',
    requisitos: ['Copia certificada o digital con código QR.', 'Completa y legible, sin tachaduras ni enmendaduras.'],
  },
  {
    value: 'acta_matrimonio', label: 'Acta de matrimonio',
    requisitos: ['Solo si el acreditado es casado.', 'Copia certificada o digital con código QR, completa y legible.'],
  },
  {
    value: 'comprobante_domicilio', label: 'Comprobante de domicilio',
    requisitos: ['No mayor a 3 meses.', 'Recibo de luz, agua, teléfono fijo o predial.', 'Con el domicilio completo y legible; a nombre del acreditado o de un familiar directo.'],
  },
  {
    value: 'talon_pago', label: 'Talón de pago',
    requisitos: ['Los últimos 3 talones de pago.', 'Completos y legibles, de meses consecutivos.', 'Puedes subirlos juntos en un solo PDF o uno por uno.'],
  },
  {
    value: 'constancia_laboral', label: 'Constancia laboral',
    requisitos: ['No mayor a 3 meses.', 'Con sello y firma del área de recursos humanos.', 'Debe indicar antigüedad y sueldo.'],
  },
  {
    value: 'constancia_fiscal', label: 'Constancia de situación fiscal',
    requisitos: ['No mayor a 3 meses.', 'Descargada del SAT, con código QR y RFC vigente.'],
  },
  {
    value: 'estado_cuenta', label: 'Estado de cuenta',
    requisitos: ['No mayor a 3 meses.', 'Todas las hojas del estado de cuenta, completo y legible.', 'A nombre del acreditado, con la CLABE visible.'],
  },
  {
    value: 'otro', label: 'Otro',
    requisitos: ['Legible y completo.', 'Que corresponda al trámite del acreditado.'],
  },
] as const;

export const REQUISITOS_GENERALES = [
  'Que se lea todo el documento (sin sombras, cortes ni borrosidad).',
  'Que sea el documento correcto y esté vigente.',
];

export function tipoPorLabel(label: string): TipoDocumento | undefined {
  // Los documentos subidos pueden llevar sufijo "(2)", "(3)"…
  const base = label.replace(/\s*\(\d+\)$/, '');
  return TIPOS_DOCUMENTO.find(t => t.label === base);
}
