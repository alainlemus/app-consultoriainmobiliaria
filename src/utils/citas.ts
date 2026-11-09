/** Utilidades de fechas para citas (zona de México). */
const TZ = 'America/Mexico_City';

export function fechaLarga(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
}

export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
}

export function diaCorto(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
}

/** Fecha YYYY-MM-DD en zona de México. */
export function ymd(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = (t: string) => p.find(x => x.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/** Día ISO (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD. */
export function diaIso(fechaYmd: string): number {
  const [y, m, d] = fechaYmd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();   // 0 = domingo
  return dow === 0 ? 7 : dow;
}

/** Próximos N días (desde hoy) en los que la oficina atiende. */
export function proximosDias(dias: number[], n = 14): { fecha: string; label: string }[] {
  const out: { fecha: string; label: string }[] = [];
  const hoy = new Date();
  for (let i = 0; out.length < n && i < 45; i++) {
    const d = new Date(hoy.getTime() + i * 86400000);
    const f = ymd(d);
    if (!dias.includes(diaIso(f))) continue;
    out.push({ fecha: f, label: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }) });
  }
  return out;
}

export function esHoy(iso: string): boolean {
  return ymd(new Date(iso)) === ymd(new Date());
}

export const ESTADO_CITA_COLOR: Record<string, string> = {
  solicitada: '#b45309', confirmada: '#15803d', cancelada: '#b91c1c', realizada: '#374151', no_asistio: '#b91c1c',
};
