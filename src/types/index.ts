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
  // Escuela vinculada (maestros FOVISSSTE)
  escuela_id?:      number | null;
  escuela?:         Escuela | null;
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
  // Campos para gestión offline local
  _local_id?:       string;
  _pendiente_sync?: boolean;
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
  honorarios_porcentaje?: number;
  notas?:            string;
  notas_internas?:   string;
  created_at:        string;
  updated_at:        string;
  documentos?:       Documento[];
  // Datos del acreditado — usados para llenar el Contrato de Prestación de
  // Servicios generado en la app (ver src/contratos/prestacionServicios.ts)
  acreditado_nombre?:    string;
  acreditado_curp?:      string | null;
  acreditado_rfc?:       string | null;
  acreditado_domicilio?: string | null;
  acreditado_colonia?:   string | null;
  acreditado_municipio?: string | null;
  acreditado_estado?:    string | null;
  acreditado_cp?:        string | null;
  obligado_solidario_nombre?: string | null;
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
  estado:          'pendiente' | 'recibido' | 'rechazado' | 'no_aplica';
  notas?:          string;
  created_at?:     string;
  _local_id?:      string;
  _pendiente_sync?: boolean;
}

export type TipoAnuncio = 'lona' | 'hoja_tienda' | 'hoja_poste' | 'volante' | 'otro';
export type EstadoAnuncio = 'activo' | 'retirado';

export const ANUNCIO_TIPO_LABEL: Record<TipoAnuncio, string> = {
  lona:        'Lona',
  hoja_tienda: 'Hoja en tienda',
  hoja_poste:  'Hoja en poste',
  volante:     'Volante',
  otro:        'Otro',
};

export const ANUNCIO_TIPO_EMOJI: Record<TipoAnuncio, string> = {
  lona:        '📢',
  hoja_tienda: '🏪',
  hoja_poste:  '📌',
  volante:     '📄',
  otro:        '📣',
};

export interface Anuncio {
  id?:          number;
  user_id?:     number;
  asesor?:      string;
  asesor_id?:   number;
  es_mio?:      boolean;
  latitud:      number;
  longitud:     number;
  tipo:         TipoAnuncio;
  estado?:      EstadoAnuncio;
  descripcion?: string;
  direccion?:   string;
  colonia?:     string;
  municipio?:   string;
  estado_geo?:  string;
  colocado_en?: string;
  fotos?:       { id: number; url: string }[];
  _local_id?:   string;
  _pendiente_sync?: boolean;
}

export type SemaforoEscuela = 'verde' | 'amarillo' | 'rojo';

export interface Escuela {
  id:             number;
  nombre_lugar?:  string;
  direccion?:     string;
  municipio?:     string;
  estado?:        string;
  latitud?:       number | null;
  longitud?:      number | null;
  semaforo:       SemaforoEscuela;
  semaforo_notas?: string | null;
  total_maestros: number;
}

export interface Ubicacion {
  id?:                 number;
  contacto_id?:        number;
  contacto?:           string;
  contacto_foto_url?:  string | null;
  user_id?:            number;
  asesor_id?:          number;   // alias de user_id, devuelto por el API
  latitud?:        number | null;
  longitud?:       number | null;
  tipo:            'visita_cliente' | 'propiedad' | 'escuela';
  semaforo?:       SemaforoEscuela;
  semaforo_notas?: string | null;
  total_maestros?: number;
  nombre_lugar?:   string;
  direccion?:      string;
  notas?:          string;
  municipio?:      string;
  estado?:         string;
  visitado_en:     string;
  fotos?:          { id: number; url: string }[];
  _local_id?:      string;
  _pendiente_sync?: boolean;
}

// Operación de sync offline
export type TipoOperacion =
  | 'crear_contacto'
  | 'actualizar_contacto'
  | 'crear_expediente'
  | 'actualizar_expediente'
  | 'subir_documento'
  | 'registrar_ubicacion'
  | 'registrar_anuncio';

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

// ── Tipos del Acreditado ────────────────────────────────────────────────────

export interface Acreditado {
  id:               number;
  name:             string;
  email:            string;
  telefono?:        string;
  curp?:            string;
  nss?:             string;
  rfc?:             string;
  foto_perfil_url?: string | null;
  curp_verificado:  boolean;
  tiene_expediente: boolean;
}

export interface AcreditadoAuthState {
  acreditado: Acreditado | null;
  token:      string | null;
}

export interface EtapaExpedienteAcreditado {
  orden:  number;
  nombre: string;
  total:  number;
}

export interface ExpedienteAcreditado {
  id:                    number;
  folio:                 string;
  estado:                string;
  etapa:                 EtapaExpedienteAcreditado;
  tipo_tramite?:         string;
  fecha_apertura?:       string;
  fecha_firma?:          string;
  fecha_esperada_pago?:  string;
  guia_paso_actual:      string;
  documentos_pendientes: number;
  asesor?: {
    name:      string;
    telefono?: string;
    email?:    string;
  };
}

export interface DocumentoAcreditado {
  id:                     number;
  nombre:                 string;
  seccion:                string;
  categoria?:             string;
  estado:                 'pendiente' | 'recibido' | 'rechazado' | 'no_aplica';
  tiene_archivo:          boolean;
  subido_por_acreditado:  boolean;
  notas?:                 string;
}

export interface SeguimientoAcreditado {
  tipo:        string;
  descripcion: string;
  fecha:       string;
}

export interface ServicioTramite {
  id:     number;
  nombre: string;
}

// ── Rutas de Asesores ────────────────────────────────────────────────────────

export interface RutaPunto {
  id:        number;
  lat:       number;
  lng:       number;
  precision: number;
  velocidad: number;
  hora:      string;
  timestamp: string;
  // Solo vienen cuando se consulta con asesor_id="todos" (super_admin)
  asesor_id?:     number;
  asesor_nombre?: string | null;
}

export interface RutaDia {
  fecha:  string;
  puntos: number;
}

export interface RutaAsesor {
  id:           number;
  name:         string;
  puntos_hoy:   number;   // puntos registrados hoy (0 si no registró)
  total_puntos: number;   // total histórico de puntos
}
