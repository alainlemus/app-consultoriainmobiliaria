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

/** Paso del seguimiento fijo del trámite (7 pasos, avanzan solos en el backend). */
export interface Seguimiento {
  paso:    string;
  nombre:  string;
  orden:   number;
  total:   number;
  mensaje: string;
  fecha?:  string | null;
  pasos:   { paso: string; nombre: string; orden: number }[];
}

/** CUV (Clave Única de Vivienda, 16 dígitos) registrada en el expediente. */
export interface CuvInfo {
  valor:  string;
  fecha?: string | null;
  por?:   string | null;
}

/** Notificación de la bandeja de la app (solo lectura). */
export interface Notificacion {
  id:     string;
  titulo: string;
  cuerpo: string;
  tipo:   string;
  color:  string;
  leida:  boolean;
  fecha:  string;
  ruta?:  { screen?: string; id?: string; expediente_id?: string; contacto_id?: string; encargo_id?: string } | null;
}

export interface NotificacionesPagina {
  data: Notificacion[];
  meta: { pagina: number; ultima: number; total: number; no_leidas: number };
}

/** Oficina que recibe citas (Panel → Cobertura). */
export interface OficinaCita {
  id:                number;
  nombre:            string;
  direccion?:        string | null;
  dias:              number[];     // ISO: 1 = lunes … 7 = domingo
  inicio:            string;
  fin:               string;
  duracion_min:      number;
  permite_domicilio: boolean;
}

export interface HuecoCita { inicia: string; termina: string; disponible: boolean }

export type EstadoCita = 'solicitada' | 'confirmada' | 'cancelada' | 'realizada' | 'no_asistio';

export interface Cita {
  id:            number;
  tipo:          'oficina' | 'domicilio';
  estado:        EstadoCita;
  estado_label:  string;
  nombre:        string;
  telefono?:     string | null;
  inicia_at:     string;
  termina_at:    string;
  fecha_texto:   string;
  oficina?:      { id: number; nombre: string; direccion?: string | null } | null;
  direccion?:    string | null;
  lugar:         string;
  notas?:        string | null;
  motivo_cancelacion?: string | null;
  asesor?:       { id: number; nombre: string; telefono?: string | null } | null;
  contacto_id?:  number | null;
  expediente_id?: number | null;
  folio?:        string | null;
  creada_por:    'asesor' | 'acreditado' | 'admin';
}

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
  seguimiento?:      Seguimiento;
  cuv_info?:         CuvInfo | null;
  _local_id?:        string;
  _pendiente_sync?:  boolean;
  documentos_count?: number;
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
  /** Ya validado por un administrador: el asesor solo lo ve. */
  validado?:       boolean;
  /** Lo subió un gestor (o es la CUV): el asesor solo lo ve. */
  de_gestor?:      boolean;
  /** Lo calcula el backend según el rol: puede reemplazar o borrar. */
  puede_modificar?: boolean;
  /** Lo decide un administrador: en revisión, validado o rechazado (con motivo). */
  validacion?:     'en_revision' | 'validado' | 'rechazado';
  motivo_rechazo?: string | null;
  /** Documento faltante que un administrador pidió (al acreditado o al asesor) y aún no se sube. */
  solicitado_at?:  string | null;
  solicitado_a?:   'acreditado' | 'asesor' | null;
  solicitud_nota?: string | null;
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

export const ANUNCIO_TIPO_ICONO: Record<TipoAnuncio, string> = {
  lona:        'megaphone',
  hoja_tienda: 'storefront',
  hoja_poste:  'pin',
  volante:     'document-text',
  otro:        'megaphone-outline',
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
  /** Ya pidió asesoría desde la app (está registrado como prospecto). */
  solicitud_enviada?: boolean;
  /** Asesor ligado por el código del QR impreso (lona, tarjeta…); null si llegó sin código. */
  asesor?: { id: number; nombre: string | null; telefono?: string | null } | null;
}

/** Cuenta de la app ligada a un asesor por su QR, vista desde el lado del asesor (GET /acreditados-qr). */
export interface AcreditadoQr {
  id:               number;
  nombre:           string;
  telefono?:        string | null;
  email?:           string | null;
  codigo?:          string | null;
  asesor?:          string | null;
  /** sin_solicitud: solo creó la cuenta · solicitud: ya pidió asesoría · expediente: ya tiene trámite */
  paso:             'sin_solicitud' | 'solicitud' | 'expediente';
  estado_prospecto?: string | null;
  contacto_id?:     number | null;
  registrado_en?:   string | null;
}

export interface AcreditadosQrMeta {
  total: number; sin_solicitud: number; con_solicitud: number; con_expediente: number;
}

/** De dónde salió el código de asesor que se manda al registrarse. */
export type OrigenCodigoAsesor = 'codigo_manual' | 'referrer' | 'huella';

/** Respuesta de GET /acreditado/codigo-asesor/{codigo} */
export interface CodigoAsesor {
  codigo: string;
  asesor: { id: number; nombre: string | null };
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
  seguimiento?:          Seguimiento;
  cuv?:                  string | null;
  documentos_pendientes: number;
  /** Documentos que un administrador pidió y aún no sube (con la nota que explica cuál falta). */
  documentos_solicitados?: { id: number; tipo: string; nota: string; solicitado_at?: string }[];
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
  /** Nota del administrador cuando el documento fue solicitado. */
  solicitud_nota?:        string | null;
}

export interface ServicioTramite {
  id:     number;
  nombre: string;
}

// ── Rutas de Asesores ────────────────────────────────────────────────────────

export type RutaPuntoTipo = 'gps' | 'visita_cliente' | 'propiedad' | 'escuela';

export interface RutaPunto {
  id:        string;
  lat:       number;
  lng:       number;
  precision: number;
  velocidad: number;
  tipo:      RutaPuntoTipo;
  nombre_lugar: string | null;
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
