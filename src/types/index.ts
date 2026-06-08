// Tipos principales que espeja los modelos del CRM Laravel

export interface User {
  id: number;
  name: string;
  email: string;
  telefono?: string;
  banco?: string;
  clabe?: string;
  foto_perfil_url?: string | null;
  roles: string[];
}

export interface AuthState {
  user:  User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export type EstadoProspecto =
  | 'nuevo'
  | 'contactado'
  | 'precalificado'
  | 'en_tramite'
  | 'cerrado'
  | 'no_interesado';

export type ServicioProspecto =
  | 'FOVISSSTE'
  | 'INFONAVIT'
  | 'AVALUO'
  | 'ESCRITURACION'
  | 'ASESORIA_PERSONALIZADA'
  | 'OTRO'
  | '';

export const SERVICIO_LABEL: Record<string, string> = {
  FOVISSSTE:              'FOVISSSTE',
  INFONAVIT:              'INFONAVIT',
  AVALUO:                 'Avalúo',
  ESCRITURACION:          'Escrituración',
  ASESORIA_PERSONALIZADA: 'Asesoría personalizada',
  OTRO:                   'Otro',
};

export interface Contacto {
  id:               number;
  nombre:           string;
  telefono?:        string;
  email?:           string;
  curp?:            string | null;
  nss?:             string | null;
  foto_url?:        string | null;
  servicio?:        ServicioProspecto;
  estado_prospecto: EstadoProspecto;
  asesor_id?:       number;
  notas?:           string;
  latitud?:          number;
  longitud?:         number;
  updated_at?:      string;
  created_at?:      string;
  // Precalificación FOVISSSTE
  estado_uso_credito?:    string | null;
  municipio_uso_credito?: string | null;
  estado_residencia?:     string | null;
  regimen_pensionario?:   string | null;
  tiene_discapacidad?:    boolean;
  simulador_screenshot_url?: string | null;
  // Expediente activo — solo viene en el endpoint show (detalle)
  expediente_activo?: {
    id:     number;
    folio?: string | null;
    estado: string;
  } | null;
}

export type EstadoExpediente =
  | 'en_proceso'
  | 'documentacion'
  | 'autorizado'
  | 'escrituracion'
  | 'cerrado'
  | 'cancelado';

export interface Expediente {
  id:                number;
  folio?:            string | null;
  contacto_id:       number;
  contacto?:         Contacto;
  asesor_id:         number;
  tipo_tramite_id:   number;
  tipo_tramite?:     { id: number; nombre: string };
  estado:            EstadoExpediente;
  etapa_tramite_id?: number;
  etapa_tramite?:    { id: number; nombre: string };
  etapa?:            { id: number; nombre: string };
  monto_credito?:    number;
  honorarios_monto?: number;
  notas?:            string;
  notas_internas?:   string;
  created_at:        string;
  updated_at:        string;
  documentos?:       Documento[];
  documentos_requeridos_total?:  number;
  documentos_subidos_total?:     number;
  documentos_pendientes_total?:  number;
  _local_id?:        string;
  _pendiente_sync?:  boolean;
}

export interface Documento {
  id:              number | null;  // null = requerido sin subir
  expediente_id?:  number;
  nombre?:         string;
  tipo:            string;
  tipo_documento?: string;
  seccion?:        'acreditado' | 'vendedor' | 'vivienda' | 'otros';
  orden?:          number;
  obligatorio?:    boolean;
  descripcion?:    string | null;
  ruta_archivo?:   string | null;
  tiene_archivo:   boolean;
  url?:            string | null;
  uri_local?:      string;
  estado:          'pendiente' | 'recibido' | 'no_aplica';
  notas?:          string;
  created_at?:     string;
  _local_id?:      string;
  _pendiente_sync?: boolean;
}

export interface Ubicacion {
  id?:           number;
  contacto_id?:  number;
  contacto?:     string;
  latitud:       number;
  longitud:      number;
  tipo:          'visita_cliente' | 'propiedad' | 'escuela';
  nombre_lugar?: string;
  direccion?:    string;
  notas?:        string;
  municipio?:    string;
  estado?:       string;
  visitado_en:   string;
  fotos?:        { id: number; url: string }[];
  _local_id?:    string;
  _pendiente_sync?: boolean;
}

// Operación de sync offline
export type TipoOperacion =
  | 'crear_contacto'
  | 'actualizar_contacto'
  | 'crear_expediente'
  | 'actualizar_expediente'
  | 'subir_documento'
  | 'registrar_ubicacion';

export interface OperacionSync {
  id_local:  string;
  tipo:      TipoOperacion;
  datos:     Record<string, unknown>;
  timestamp: string;
  intentos:  number;
  estado:    'pendiente' | 'procesando' | 'ok' | 'error';
  error?:    string;
}

// Respuestas API
export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total:        number;
    current_page: number;
    last_page:    number;
    per_page:     number;
  };
}

export interface SyncResultado {
  id_local:     string;
  estado:       'ok' | 'error';
  id_servidor?: number;
  mensaje?:     string;
}

export interface SyncResponse {
  resultados: SyncResultado[];
  procesados?: number;
  errores?:    number;
}

export type EstadoComision = 'pendiente' | 'aprobada' | 'pagada' | 'rechazada';

export interface Comision {
  id:                   number;
  expediente_id:        number;
  acreditado?:          string;
  monto_credito?:       number;
  expediente_estado?:   string;
  monto_base:           number;
  porcentaje_comision:  number;
  monto_comision:       number;
  estado:               EstadoComision;
  fecha_generacion?:    string;
  fecha_aprobacion?:    string;
  fecha_pago?:          string;
  notas?:               string;
}

export interface ResumenComisiones {
  total_pagado:        number;
  total_pendiente:     number;
  cantidad_pagadas:    number;
  cantidad_pendientes: number;
}
