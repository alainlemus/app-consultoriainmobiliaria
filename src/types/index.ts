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
  nombre:           string;           // nombre completo
  telefono?:        string;
  email?:           string;
  servicio?:        'FOVISSSTE' | 'INFONAVIT';
  estado_prospecto: EstadoProspecto;
  asesor_id?:       number;
  notas?:           string;
  // GPS — se agrega con la app
  latitud?:          number;
  longitud?:         number;
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
  folio:             string;
  contacto_id:       number;
  contacto?:         Contacto;
  asesor_id:         number;
  tipo_tramite_id:   number;
  tipo_tramite?:     { id: number; nombre: string };
  estado:            EstadoExpediente;
  etapa_tramite_id?: number;
  etapa_tramite?:    { id: number; nombre: string };
  monto_credito?:    number;
  honorarios_monto?: number;
  notas?:            string;
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
  tipo_documento:  string;
  url?:            string;
  uri_local?:      string;   // ruta local antes de subir
  estado:          'pendiente_revision' | 'aprobado' | 'rechazado';
  notas?:          string;
  created_at:      string;
  _local_id?:      string;
  _pendiente_sync?: boolean;
}

export interface Ubicacion {
  id?:          number;
  contacto_id:  number;
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
}
