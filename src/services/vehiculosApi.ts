/**
 * Préstamo de vehículos: solicitar, checklist de salida y entrega, y llaves.
 * Todo bajo /api/v1 con el token del asesor.
 */
import { apiFetch, API_BASE, getToken, resolveStorageUrl } from './api';
import type {
  Carga, CargaEnvio, ChecklistEnvio, FotoLocal, LicenciaEstado, Movimiento, NuevaReserva, Ocupacion,
  Reserva, ResguardoEnvio, RetomarEnvio, Vehiculo,
} from '../types/vehiculos';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Mensaje legible de un error de Laravel (422 junta los mensajes de cada campo). */
export function mensajeDeError(body: unknown, status: number): string {
  const b = (body ?? {}) as { message?: string; errors?: Record<string, string[]> };
  if (b.errors && Object.keys(b.errors).length) return Object.values(b.errors).flat().join(' ');
  return b.message ?? `Error ${status}`;
}

async function enviarMultipart<T>(path: string, form: FormData): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method:  'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body:    form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(mensajeDeError(body, res.status));
  return body as T;
}

/** Igual que apiFetch, pero con los mensajes de validación de cada campo. */
async function apiJson<T>(path: string, method: 'POST' | 'PUT', data?: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(mensajeDeError(body, res.status));
  return body as T;
}

const archivo = (f: FotoLocal) => ({ uri: f.uri, name: f.name, type: f.type } as unknown as Blob);

function urls(v: Vehiculo): Vehiculo {
  return { ...v, foto_url: resolveStorageUrl(v.foto_url) ?? null };
}

function urlsMovimiento(m: Movimiento | null): Movimiento | null {
  if (!m) return m;
  return { ...m, fotos: m.fotos.map(f => ({ ...f, url: resolveStorageUrl(f.url) ?? f.url, thumb_url: resolveStorageUrl(f.thumb_url) ?? null })) };
}

function urlsCarga(c: Carga): Carga {
  return { ...c, fotos: c.fotos.map(f => ({ ...f, url: resolveStorageUrl(f.url) ?? f.url, thumb_url: resolveStorageUrl(f.thumb_url) ?? null })) };
}

function urlsReserva(r: Reserva): Reserva {
  return {
    ...r,
    vehiculo:     { ...r.vehiculo, foto_url: resolveStorageUrl(r.vehiculo.foto_url) ?? null },
    salida:       urlsMovimiento(r.salida),
    entrega:      urlsMovimiento(r.entrega),
    resguardo:    urlsMovimiento(r.resguardo ?? null),
    cargas:       (r.cargas ?? []).map(urlsCarga),
    alternativas: r.alternativas ?? [],
    alertas:      r.alertas ?? [],
  };
}

/** Agrega lat/lng y las fotos por clave a un multipart. */
function agregarComunes(form: FormData, d: { lat?: number; lng?: number; fotos: Record<string, FotoLocal> }) {
  if (d.lat !== undefined && d.lng !== undefined) { form.append('lat', String(d.lat)); form.append('lng', String(d.lng)); }
  Object.entries(d.fotos).forEach(([clave, f]) => form.append(`fotos[${clave}]`, archivo(f)));
}

export function formResguardo(d: ResguardoEnvio): FormData {
  const form = new FormData();
  form.append('km', String(d.km));
  form.append('gasolina', String(d.gasolina));
  agregarComunes(form, d);
  return form;
}

export function formRetomar(d: RetomarEnvio): FormData {
  const form = new FormData();
  form.append('km', String(d.km));
  agregarComunes(form, d);
  return form;
}

export function formCarga(d: CargaEnvio): FormData {
  const form = new FormData();
  form.append('km', String(d.km));
  form.append('litros', String(d.litros));
  form.append('monto', String(d.monto));
  form.append('pago', d.pago);
  agregarComunes(form, d);
  return form;
}

/** Arma el multipart del checklist (salida o entrega). */
export function formChecklist(d: ChecklistEnvio): FormData {
  const form = new FormData();
  form.append('km', String(d.km));
  form.append('gasolina', String(d.gasolina));
  if (d.lat !== undefined && d.lng !== undefined) { form.append('lat', String(d.lat)); form.append('lng', String(d.lng)); }
  if (d.notas_danos) form.append('notas_danos', d.notas_danos);
  d.checklist.forEach(c => form.append('checklist[]', c));
  Object.entries(d.fotos).forEach(([clave, f]) => form.append(`fotos[${clave}]`, archivo(f)));
  d.fotos_danos.forEach(f => form.append('fotos_danos[]', archivo(f)));
  if (d.llaves_codigo) form.append('llaves_codigo', d.llaves_codigo);
  if (d.llaves_destino) form.append('llaves_destino', d.llaves_destino);
  return form;
}

// ── Vehículos ──────────────────────────────────────────────────────────────

export async function getVehiculos(): Promise<{ data: Vehiculo[]; meta: { licencia: LicenciaEstado } }> {
  const r = await apiFetch<{ data: Vehiculo[]; meta: { licencia: LicenciaEstado } }>('/vehiculos');
  return { data: r.data.map(urls), meta: r.meta };
}

export async function getVehiculo(id: number): Promise<Vehiculo> {
  return urls((await apiFetch<{ data: Vehiculo }>(`/vehiculos/${id}`)).data);
}

export async function getOcupacion(vehiculoId: number, fecha: string): Promise<Ocupacion[]> {
  return (await apiFetch<{ data: Ocupacion[] }>(`/vehiculos/${vehiculoId}/ocupacion?fecha=${fecha}`)).data;
}

// ── Reservas ───────────────────────────────────────────────────────────────

export async function getReservas(): Promise<Reserva[]> {
  return (await apiFetch<{ data: Reserva[] }>('/vehiculos/reservas')).data.map(urlsReserva);
}

export async function getReserva(id: number): Promise<Reserva> {
  return urlsReserva((await apiFetch<{ data: Reserva }>(`/vehiculos/reservas/${id}`)).data);
}

export async function crearReserva(d: NuevaReserva): Promise<{ message: string; data: Reserva }> {
  const r = await apiJson<{ message: string; data: Reserva }>('/vehiculos/reservas', 'POST', d);
  return { message: r.message, data: urlsReserva(r.data) };
}

export async function cancelarReserva(id: number, motivo?: string): Promise<Reserva> {
  return urlsReserva((await apiJson<{ data: Reserva }>(`/vehiculos/reservas/${id}/cancelar`, 'PUT', { motivo })).data);
}

export async function registrarSalida(id: number, d: ChecklistEnvio): Promise<Reserva> {
  return urlsReserva((await enviarMultipart<{ data: Reserva }>(`/vehiculos/reservas/${id}/salida`, formChecklist(d))).data);
}

export async function registrarEntrega(id: number, d: ChecklistEnvio): Promise<Reserva> {
  return urlsReserva((await enviarMultipart<{ data: Reserva }>(`/vehiculos/reservas/${id}/entrega`, formChecklist(d))).data);
}

/** Acepta un vehículo alternativo cuando la reserva quedó en espera o la desplazaron. */
export async function cambiarVehiculo(id: number, vehiculoId: number): Promise<Reserva> {
  return urlsReserva((await apiJson<{ data: Reserva }>(`/vehiculos/reservas/${id}/cambiar-vehiculo`, 'PUT', { vehiculo_id: vehiculoId })).data);
}

/** Guardar en casa (resguardo nocturno). */
export async function registrarResguardo(id: number, d: ResguardoEnvio): Promise<Reserva> {
  return urlsReserva((await enviarMultipart<{ data: Reserva }>(`/vehiculos/reservas/${id}/resguardo`, formResguardo(d))).data);
}

/** Retomar el vehículo guardado en casa. */
export async function retomarVehiculo(id: number, d: RetomarEnvio): Promise<Reserva> {
  return urlsReserva((await enviarMultipart<{ data: Reserva }>(`/vehiculos/reservas/${id}/retomar`, formRetomar(d))).data);
}

// ── Gasolina ───────────────────────────────────────────────────────────────

export async function registrarCarga(id: number, d: CargaEnvio): Promise<Reserva> {
  return urlsReserva((await enviarMultipart<{ data: Reserva }>(`/vehiculos/reservas/${id}/cargas`, formCarga(d))).data);
}

/** Mis cargas que pagué yo (reembolsos pendientes y pagados). */
export async function getReembolsos(): Promise<Carga[]> {
  return (await apiFetch<{ data: Carga[] }>('/vehiculos/reembolsos')).data.map(urlsCarga);
}

// ── Llaves ─────────────────────────────────────────────────────────────────

export async function generarCodigoLlaves(vehiculoId: number): Promise<{ codigo: string; expira_at: string }> {
  return (await apiJson<{ data: { codigo: string; expira_at: string } }>(`/vehiculos/${vehiculoId}/llaves/codigo`, 'POST')).data;
}

export async function recibirLlaves(vehiculoId: number, codigo: string): Promise<Vehiculo> {
  return urls((await apiJson<{ data: Vehiculo }>(`/vehiculos/${vehiculoId}/llaves/recibir`, 'POST', { codigo })).data);
}

export async function dejarLlavesEnOficina(vehiculoId: number, foto: FotoLocal, pos?: { lat: number; lng: number }): Promise<Vehiculo> {
  const form = new FormData();
  form.append('fotos[llaves]', archivo(foto));
  if (pos) { form.append('lat', String(pos.lat)); form.append('lng', String(pos.lng)); }
  return urls((await enviarMultipart<{ data: Vehiculo }>(`/vehiculos/${vehiculoId}/llaves/oficina`, form)).data);
}
