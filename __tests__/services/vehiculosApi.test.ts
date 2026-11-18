/**
 * Tests: src/services/vehiculosApi.ts — multipart del checklist, errores 422 y rutas.
 */
import * as SecureStore from 'expo-secure-store';
import {
  cambiarVehiculo, crearReserva, formCarga, formChecklist, formResguardo, generarCodigoLlaves, getReembolsos, getReserva,
  mensajeDeError, registrarCarga, registrarResguardo, registrarSalida, retomarVehiculo,
} from '../../src/services/vehiculosApi';

function mockFetch(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

const RESERVA = {
  id: 7, estado: 'en_uso', estado_label: 'En uso', posicion_fila: null, vehiculo: { id: 1, nombre: 'Moto 1', placa: 'ABC', tipo_nombre: 'Moto' },
  todo_el_dia: false, inicio: '2026-11-19T10:00:00-06:00', fin: '2026-11-19T13:00:00-06:00', resguardo_casa: false, motivo: 'Visita', destino: null,
  cita_id: null, contacto_id: null, expediente_id: null, asesor: { id: 3, nombre: 'Juan' }, motivo_decision: null, licencia_vigente: true,
  puede: { cancelar: false, salida: false, entrega: true }, salida: null, entrega: null, km_recorridos: null, created_at: '2026-11-18T10:00:00Z',
};

beforeEach(() => {
  global.fetch = jest.fn();
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tok');
});

describe('vehiculosApi', () => {
  it('junta los mensajes de validación de Laravel', () => {
    expect(mensajeDeError({ message: 'x', errors: { km: ['El km es obligatorio.'], 'fotos.tablero': ['Falta el tablero.'] } }, 422))
      .toBe('El km es obligatorio. Falta el tablero.');
    expect(mensajeDeError({ message: 'No autorizado' }, 403)).toBe('No autorizado');
    expect(mensajeDeError(null, 500)).toBe('Error 500');
  });

  it('arma el multipart del checklist con fotos por clave', () => {
    const foto = { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' };
    const append = jest.spyOn(FormData.prototype, 'append');
    formChecklist({ km: 12430, gasolina: 3, lat: 20.1, lng: -98.7, checklist: ['Casco'], fotos: { tablero: foto, frente: foto }, fotos_danos: [foto], llaves_codigo: '4817' });
    const campos = append.mock.calls.map(([k]) => k);
    append.mockRestore();
    expect(campos).toEqual(expect.arrayContaining(['km', 'gasolina', 'lat', 'lng', 'checklist[]', 'fotos[tablero]', 'fotos[frente]', 'fotos_danos[]', 'llaves_codigo']));
    expect(campos).not.toContain('llaves_destino');
  });

  it('manda la salida al endpoint de la reserva con el token', async () => {
    mockFetch(200, { data: RESERVA });
    const r = await registrarSalida(7, { km: 1, gasolina: 2, checklist: [], fotos: {}, fotos_danos: [] });
    expect(r.id).toBe(7);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/vehiculos\/reservas\/7\/salida$/);
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer tok');
  });

  it('un 422 al solicitar lanza el mensaje del campo', async () => {
    mockFetch(422, { message: 'Datos inválidos', errors: { motivo: ['Escribe el motivo.'] } });
    await expect(crearReserva({ vehiculo_id: 1, todo_el_dia: true, fecha: '2026-11-19', resguardo_casa: false, motivo: '' })).rejects.toThrow('Escribe el motivo.');
  });

  it('arma el multipart de la carga de gasolina', () => {
    const foto = { uri: 'file:///t.jpg', name: 't.jpg', type: 'image/jpeg' };
    const append = jest.spyOn(FormData.prototype, 'append');
    formCarga({ km: 12450, litros: 10.5, monto: 250, pago: 'reembolso', fotos: { ticket: foto, tablero: foto } });
    const pares = append.mock.calls.map(([k, v]) => [k, typeof v === 'string' ? v : 'archivo']);
    append.mockRestore();
    expect(pares).toEqual(expect.arrayContaining([['km', '12450'], ['litros', '10.5'], ['monto', '250'], ['pago', 'reembolso'], ['fotos[ticket]', 'archivo'], ['fotos[tablero]', 'archivo']]));
  });

  it('arma el multipart de guardar en casa sin ubicación si no hay permiso', () => {
    const foto = { uri: 'file:///t.jpg', name: 't.jpg', type: 'image/jpeg' };
    const append = jest.spyOn(FormData.prototype, 'append');
    formResguardo({ km: 12460, gasolina: 2, fotos: { tablero: foto, estacionada: foto } });
    const campos = append.mock.calls.map(([k]) => k);
    append.mockRestore();
    expect(campos).toEqual(['km', 'gasolina', 'fotos[tablero]', 'fotos[estacionada]']);
  });

  it('guardar en casa, retomar, cargas y cambio de vehículo van a su endpoint', async () => {
    const foto = { uri: 'file:///t.jpg', name: 't.jpg', type: 'image/jpeg' };
    mockFetch(200, { data: { ...RESERVA, estado: 'resguardo' } });
    expect((await registrarResguardo(7, { km: 1, gasolina: 2, fotos: { tablero: foto, estacionada: foto } })).estado).toBe('resguardo');
    mockFetch(200, { data: RESERVA });
    await retomarVehiculo(7, { km: 1, fotos: { tablero: foto } });
    mockFetch(200, { data: RESERVA });
    await registrarCarga(7, { km: 1, litros: 1, monto: 1, pago: 'tarjeta_empresa', fotos: { ticket: foto, tablero: foto } });
    mockFetch(200, { data: RESERVA });
    await cambiarVehiculo(7, 2);
    const llamadas = (global.fetch as jest.Mock).mock.calls.map(([u, o]) => `${o.method} ${String(u).replace(/^.*\/vehiculos/, '/vehiculos')}`);
    expect(llamadas).toEqual([
      'POST /vehiculos/reservas/7/resguardo', 'POST /vehiculos/reservas/7/retomar',
      'POST /vehiculos/reservas/7/cargas', 'PUT /vehiculos/reservas/7/cambiar-vehiculo',
    ]);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[3][1].body)).toEqual({ vehiculo_id: 2 });
  });

  it('una reserva vieja sin campos de fase 2 queda con listas vacías', async () => {
    mockFetch(200, { data: RESERVA });
    const r = await getReserva(7);
    expect(r.cargas).toEqual([]);
    expect(r.alertas).toEqual([]);
    expect(r.alternativas).toEqual([]);
    expect(r.resguardo).toBeNull();
  });

  it('lista mis reembolsos', async () => {
    mockFetch(200, { data: [{ id: 1, km: 1, litros: 10, monto: 250, pago: 'reembolso', pago_label: 'Reembolso', reembolso: 'pendiente', fotos: [], creado_at: '2026-11-19T10:00:00Z', reserva_id: 7 }] });
    const r = await getReembolsos();
    expect(r[0].reembolso).toBe('pendiente');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/vehiculos\/reembolsos$/);
  });

  it('pide el código de llaves', async () => {
    mockFetch(200, { data: { codigo: '4817', expira_at: '2026-11-19T10:05:00Z' } });
    expect((await generarCodigoLlaves(1)).codigo).toBe('4817');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/vehiculos\/1\/llaves\/codigo$/);
  });
});
