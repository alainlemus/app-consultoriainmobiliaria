/** Préstamo de vehículos (motos, coches…) para asesores. Contrato de /api/v1/vehiculos. */

export type NivelGasolina = 0 | 1 | 2 | 3 | 4;   // 0 reserva · 1 ¼ · 2 ½ · 3 ¾ · 4 lleno

export interface PersonaBasica { id: number; nombre: string }

export interface FotoRequerida { clave: string; etiqueta: string }

export interface TipoVehiculo {
  id:               number;
  nombre:           string;
  icono:            string | null;
  fotos_requeridas: FotoRequerida[];
  checklist:        string[];
  licencia_tipo:    string | null;
}

export interface Vehiculo {
  id:               number;
  nombre:           string;
  placa:            string | null;
  marca:            string | null;
  modelo:           string | null;
  color:            string | null;
  foto_url:         string | null;
  km_actual:        number;
  gasolina_actual:  NivelGasolina | null;
  estado:           'disponible' | 'en_uso' | 'taller';
  tipo:             TipoVehiculo;
  llaves:           { en: 'oficina' | 'usuario'; usuario: PersonaBasica | null; soy_yo: boolean };
  en_uso_por:       PersonaBasica | null;
  regreso_previsto: string | null;
}

export interface LicenciaEstado { tiene: boolean; vigente: boolean; vence: string | null }


export interface Ocupacion { id: number; inicio: string; fin: string; estado: EstadoReserva; asesor: PersonaBasica }

export type EstadoReserva =
  | 'solicitada' | 'en_espera' | 'autorizada' | 'en_uso' | 'resguardo'
  | 'entregada' | 'rechazada' | 'cancelada' | 'no_presento';

export interface FotoMovimiento { id: number; clave: string; etiqueta: string; url: string; thumb_url: string | null }

export interface Movimiento {
  id:             number;
  tipo:           string;
  km:             number;
  gasolina:       NivelGasolina;
  gasolina_label: string;
  lat:            number | null;
  lng:            number | null;
  notas_danos:    string | null;
  checklist:      string[];
  llaves_modo:    'oficina' | 'codigo' | 'ya_las_tenia' | null;
  llaves_de:      PersonaBasica | null;
  fotos:          FotoMovimiento[];
  creado_at:      string;
}

export interface Reserva {
  id:              number;
  estado:          EstadoReserva;
  estado_label:    string;
  posicion_fila:   number | null;
  vehiculo:        Vehiculo & { tipo_nombre: string };
  todo_el_dia:     boolean;
  inicio:          string;
  fin:             string;
  resguardo_casa:  boolean;
  motivo:          string;
  destino:         string | null;
  cita_id:         number | null;
  contacto_id:     number | null;
  expediente_id:   number | null;
  asesor:          PersonaBasica;
  motivo_decision: string | null;
  licencia_vigente: boolean;
  puede:           {
    cancelar: boolean; salida: boolean; entrega: boolean;
    resguardo?: boolean; retomar?: boolean; carga?: boolean; cambiar_vehiculo?: boolean;
  };
  salida:          Movimiento | null;
  entrega:         Movimiento | null;
  /** El último «guardar en casa» (resguardo nocturno). */
  resguardo?:      Movimiento | null;
  /** La administración le dio prioridad a otra visita. */
  desplazada?:     { motivo: string | null; por: PersonaBasica | null; at: string } | null;
  /** Vehículos del mismo tipo libres en este horario (solo en espera). */
  alternativas?:   AlternativaVehiculo[];
  cargas?:         Carga[];
  alertas?:        string[];
  km_recorridos:   number | null;
  created_at:      string;
}

export interface NuevaReserva {
  vehiculo_id?:   number | null;
  tipo_id?:       number;
  todo_el_dia:    boolean;
  fecha?:         string;
  inicio?:        string;
  fin?:           string;
  resguardo_casa: boolean;
  motivo:         string;
  destino?:       string;
  cita_id?:       number;
  contacto_id?:   number;
  expediente_id?: number;
}

/** Foto ya tomada y comprimida, lista para mandar en multipart. */
export interface FotoLocal { uri: string; name: string; type: string }

export interface ChecklistEnvio {
  km:            number;
  gasolina:      NivelGasolina;
  lat?:          number;
  lng?:          number;
  notas_danos?:  string;
  checklist:     string[];
  fotos:         Record<string, FotoLocal>;   // tablero, <clave>…, llaves
  fotos_danos:   FotoLocal[];
  llaves_codigo?: string;                       // salida
  llaves_destino?: 'oficina' | 'conmigo';       // entrega
}

export interface AlternativaVehiculo { id: number; nombre: string; placa: string | null }

export type FormaPago = 'tarjeta_empresa' | 'efectivo_empresa' | 'reembolso';

export interface Carga {
  id:         number;
  km:         number;
  litros:     number;
  monto:      number;
  pago:       FormaPago;
  pago_label: string;
  reembolso:  'pendiente' | 'pagado' | null;
  fotos:      FotoMovimiento[];
  creado_at:  string;
  reserva_id: number;
}

/** Guardar en casa: tablero (km y gasolina) y foto del vehículo estacionado. */
export interface ResguardoEnvio {
  km:       number;
  gasolina: NivelGasolina;
  lat?:     number;
  lng?:     number;
  fotos:    { tablero: FotoLocal; estacionada: FotoLocal };
}

/** Retomar a la mañana siguiente: foto del tablero y km. */
export interface RetomarEnvio {
  km:    number;
  lat?:  number;
  lng?:  number;
  fotos: { tablero: FotoLocal };
}

export interface CargaEnvio {
  km:     number;
  litros: number;
  monto:  number;
  pago:   FormaPago;
  fotos:  { ticket: FotoLocal; tablero: FotoLocal };
}
