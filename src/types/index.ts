// Tipos principales que espeja los modelos del CRM Laravel

export interface User {
  id: number;
  name: string;
  email: string;
  telefono?: string;
  banco?: string;
  clabe?: string;
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

export interface Contacto {
  id:               number;
  nombre:           string;
  telefono?:        string;
  email?:           string;
  servicio?:        'FOVISSSTE' | 'INFONAVIT';
  estado_prospecto: EstadoProspecto;
  asesor_id?:       number;
  notas?:           string;
  latitud?:          number;
  longitud?:         number;
  updated_at?:      string;
  created_at?:      string;
  // Expediente activo — solo viene en el endpoint show (detalle)
  expediente_activo?: {
    id:     number;
    folio?: string | null;
    estado: string;
  } | null;
}
  created_at:        string;
  updated_at:        string;
  // Offline
  _local_id?:        string;   // UUID local para sync
  _pendiente_sync?:  boolean;
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
  etapa_tramite?:    { id: number; nombre: string }; // alias frontend
  etapa?:            { id: number; nombre: string }; // nombre real en API
  monto_credito?:    number;
  honorarios_monto?: number;
  notas?:            string;
  notas_internas?:   string;
  created_at:        string;
  updated_at:        string;
  documentos?:       Documento[];
  _local_id?:        string;
  _pendiente_sync?:  boolean;
}

export interface Documento {
  id:              number;
  expediente_id:   number;
  nombre:          string;
  tipo:            string;
  tipo_documento?: string;
  ruta_archivo?:   string | null;
  tiene_archivo:   boolean;          // true = hay archivo subido
  url?:            string | null;    // siempre null en listado; se obtiene via getDocumentoUrl()
  uri_local?:      string;
  estado:          'pendiente' | 'recibido' | 'no_aplica';
  notas?:          string;
  created_at:      string;
  _local_id?:      string;
  _pendiente_sync?: boolean;
}

export interface Ubicacion {
  id?:          number;
  contacto_id?: number;   // opcional — visitas desde mapa no tienen contacto asociado
  latitud:      number;
  longitud:     number;
  tipo:         'visita_cliente' | 'propiedad';
  notas?:       string;
  visitado_en:  string;   // ISO string
  _local_id?:   string;
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
