/** Reglas y textos del préstamo de vehículos (sin dependencias de React Native, para poder probarlas). */
import type { EstadoReserva, FormaPago, NivelGasolina, Reserva, Vehiculo } from '../types/vehiculos';

export const GASOLINA: { valor: NivelGasolina; corto: string; largo: string }[] = [
  { valor: 0, corto: 'Res.',  largo: 'Reserva' },
  { valor: 1, corto: '¼',     largo: '¼ de tanque' },
  { valor: 2, corto: '½',     largo: '½ tanque' },
  { valor: 3, corto: '¾',     largo: '¾ de tanque' },
  { valor: 4, corto: 'Lleno', largo: 'Lleno' },
];

export function gasolinaTexto(n: NivelGasolina | null | undefined): string {
  if (n === null || n === undefined) return 'Sin dato';
  return GASOLINA.find(g => g.valor === n)?.largo ?? 'Sin dato';
}

export const ESTADO_RESERVA_COLOR: Record<EstadoReserva, string> = {
  solicitada: '#b45309', en_espera: '#b45309', autorizada: '#15803d', en_uso: '#1d4ed8', resguardo: '#7c3aed',
  entregada: '#374151', rechazada: '#b91c1c', cancelada: '#6b7280', no_presento: '#b91c1c',
};

/** Texto del estado si el servidor no manda `estado_label`. */
export const ESTADO_RESERVA_TEXTO: Record<EstadoReserva, string> = {
  solicitada: 'Pendiente de autorización', en_espera: 'En espera', autorizada: 'Autorizada', en_uso: 'En uso',
  resguardo: 'Guardado en casa', entregada: 'Entregada', rechazada: 'Rechazada', cancelada: 'Cancelada', no_presento: 'No se presentó',
};

export const ESTADO_VEHICULO: Record<Vehiculo['estado'], { texto: string; color: string }> = {
  disponible: { texto: 'Disponible', color: '#15803d' },
  en_uso:     { texto: 'En uso',     color: '#1d4ed8' },
  taller:     { texto: 'En taller',  color: '#b91c1c' },
};

/** Reservas que siguen vivas (arriba en la lista). */
export function reservaActiva(r: Pick<Reserva, 'estado'>): boolean {
  return r.estado === 'solicitada' || r.estado === 'en_espera' || r.estado === 'autorizada' || r.estado === 'en_uso' || r.estado === 'resguardo';
}

/** Texto de dónde están las llaves, desde el punto de vista de quien mira. */
export function llavesTexto(v: Pick<Vehiculo, 'llaves'>): string {
  if (v.llaves.en === 'oficina') return 'En la oficina';
  if (v.llaves.soy_yo) return 'Las tienes tú';
  return v.llaves.usuario ? `Las tiene ${v.llaves.usuario.nombre}` : 'Con una persona';
}

/** Agrupa los vehículos por tipo, en el orden en que llegan. */
export function agruparPorTipo(vs: Vehiculo[]): { tipo: Vehiculo['tipo']; vehiculos: Vehiculo[] }[] {
  const grupos = new Map<number, { tipo: Vehiculo['tipo']; vehiculos: Vehiculo[] }>();
  vs.forEach(v => {
    const g = grupos.get(v.tipo.id) ?? { tipo: v.tipo, vehiculos: [] };
    g.vehiculos.push(v);
    grupos.set(v.tipo.id, g);
  });
  return [...grupos.values()];
}

/**
 * Inicio y fin de una reserva por horas, en hora de México (UTC-6, sin horario de verano desde 2022).
 * `hora` en 0–23. Devuelve ISO con zona para que el servidor no dude.
 */
export function isoMexico(fecha: string, hora: number, minuto = 0): string {
  const hh = String(hora).padStart(2, '0');
  const mm = String(minuto).padStart(2, '0');
  return `${fecha}T${hh}:${mm}:00-06:00`;
}

/** Valida los datos de la solicitud antes de mandarla. Devuelve el primer problema o null. */
export function validarSolicitud(d: {
  vehiculoId: number | null; tipoId: number | null; todoElDia: boolean;
  fecha: string | null; horaInicio: number | null; horaFin: number | null; motivo: string;
}): string | null {
  if (!d.vehiculoId && !d.tipoId) return 'Elige un vehículo o «el que esté libre».';
  if (!d.fecha) return 'Elige el día.';
  if (!d.todoElDia) {
    if (d.horaInicio === null) return 'Elige la hora de salida.';
    if (d.horaFin === null) return 'Elige la hora de regreso.';
    if (d.horaFin <= d.horaInicio) return 'La hora de regreso debe ser después de la salida.';
  }
  if (d.motivo.trim().length < 3) return 'Escribe para qué la necesitas.';
  return null;
}

/** Claves de foto que pide el checklist: tablero + las del tipo + llaves si toca. */
export function fotosObligatorias(tipo: Pick<Vehiculo['tipo'], 'fotos_requeridas'>, conLlaves: boolean): string[] {
  return ['tablero', ...tipo.fotos_requeridas.map(f => f.clave), ...(conLlaves ? ['llaves'] : [])];
}

export function fotosFaltantes(obligatorias: string[], tomadas: Record<string, unknown>): string[] {
  return obligatorias.filter(c => !tomadas[c]);
}

/** El km es un entero positivo; en la entrega no puede ser menor que el de salida. */
export function validarKm(texto: string, minimo: number | null): string | null {
  const limpio = texto.replace(/[^\d]/g, '');
  if (!limpio) return 'Escribe el kilometraje del tablero.';
  const km = Number(limpio);
  if (minimo !== null && km < minimo) return `El kilometraje no puede ser menor al de salida (${minimo.toLocaleString('es-MX')} km).`;
  return null;
}

export function kmNumero(texto: string): number {
  return Number(texto.replace(/[^\d]/g, '') || '0');
}

/** Segundos que le quedan a un código de llaves. */
export function segundosRestantes(expiraIso: string, ahora = Date.now()): number {
  return Math.max(0, Math.floor((new Date(expiraIso).getTime() - ahora) / 1000));
}

/** DD/MM/AAAA → AAAA-MM-DD (o null si no es una fecha real). */
export function fechaDmyAIso(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const f = new Date(Date.UTC(y, mo - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== mo - 1 || f.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ── Gasolina: cargas y reembolsos ──────────────────────────────────────────

export const FORMAS_PAGO: { valor: FormaPago; texto: string; ayuda: string }[] = [
  { valor: 'tarjeta_empresa',  texto: 'Tarjeta de la empresa',  ayuda: 'Pagaste con la tarjeta o vales de la empresa' },
  { valor: 'efectivo_empresa', texto: 'Efectivo de la empresa', ayuda: 'Con dinero que te dio la empresa' },
  { valor: 'reembolso',        texto: 'Pagué yo · reembolso',   ayuda: 'Te lo devuelven; queda como reembolso pendiente' },
];

/** «12.5», «12,5», «$250.00» → número (o NaN si no es un número). */
export function numeroDecimal(texto: string): number {
  const limpio = texto.replace(/[$\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(limpio)) return NaN;
  return Number(limpio);
}

/** Valida la carga de gasolina antes de mandarla. Devuelve el primer problema o null. */
export function validarCarga(d: {
  km: string; litros: string; monto: string; pago: FormaPago | null;
  fotos: { ticket?: unknown; tablero?: unknown }; kmMinimo?: number | null;
}): string | null {
  if (!d.fotos.ticket) return 'Toma una foto del ticket.';
  if (!d.fotos.tablero) return 'Toma una foto del tablero.';
  const kmMal = validarKm(d.km, d.kmMinimo ?? null);
  if (kmMal) return kmMal;
  const litros = numeroDecimal(d.litros);
  if (!(litros > 0)) return 'Escribe cuántos litros cargaste.';
  if (litros > 200) return 'Revisa los litros: parecen demasiados.';
  const monto = numeroDecimal(d.monto);
  if (!(monto > 0)) return 'Escribe cuánto pagaste.';
  if (!d.pago) return 'Indica cómo se pagó.';
  return null;
}

export function pesos(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fechaIsoADmy(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}
