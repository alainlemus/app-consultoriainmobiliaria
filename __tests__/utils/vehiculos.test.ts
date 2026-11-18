import {
  agruparPorTipo, fechaDmyAIso, fechaIsoADmy, fotosFaltantes, fotosObligatorias, gasolinaTexto,
  isoMexico, kmNumero, llavesTexto, numeroDecimal, pesos, reservaActiva, segundosRestantes, validarCarga, validarKm, validarSolicitud,
} from '../../src/utils/vehiculos';
import type { Vehiculo } from '../../src/types/vehiculos';

describe('vehículos fase 2: resguardo y gasolina', () => {
  it('guardado en casa sigue siendo una reserva activa; no se presentó ya no', () => {
    expect(reservaActiva({ estado: 'resguardo' })).toBe(true);
    expect(reservaActiva({ estado: 'no_presento' })).toBe(false);
  });

  it('lee decimales con punto, coma o signo de pesos', () => {
    expect(numeroDecimal('10.5')).toBe(10.5);
    expect(numeroDecimal('10,5')).toBe(10.5);
    expect(numeroDecimal('$250.00')).toBe(250);
    expect(numeroDecimal('')).toBeNaN();
    expect(numeroDecimal('abc')).toBeNaN();
  });

  it('valida la carga de gasolina paso a paso', () => {
    const foto = {};
    const base = { km: '12450', litros: '10.5', monto: '250', pago: 'reembolso' as const, fotos: { ticket: foto, tablero: foto }, kmMinimo: 12430 };
    expect(validarCarga(base)).toBeNull();
    expect(validarCarga({ ...base, fotos: { tablero: foto } })).toMatch(/ticket/);
    expect(validarCarga({ ...base, fotos: { ticket: foto } })).toMatch(/tablero/);
    expect(validarCarga({ ...base, km: '12000' })).toMatch(/no puede ser menor/);
    expect(validarCarga({ ...base, litros: '0' })).toMatch(/litros/);
    expect(validarCarga({ ...base, litros: '500' })).toMatch(/demasiados/);
    expect(validarCarga({ ...base, monto: '' })).toMatch(/pagaste/);
    expect(validarCarga({ ...base, pago: null })).toMatch(/cómo se pagó/);
  });

  it('formatea pesos', () => {
    expect(pesos(250)).toBe('$250.00');
  });
});

const tipoMoto = { id: 1, nombre: 'Moto', icono: null, licencia_tipo: 'Motociclista', checklist: ['Casco'], fotos_requeridas: [{ clave: 'frente', etiqueta: 'Frente' }, { clave: 'atras', etiqueta: 'Atrás' }] };
const veh = (id: number, tipo = tipoMoto, llaves: Vehiculo['llaves'] = { en: 'oficina', usuario: null, soy_yo: false }): Vehiculo => ({
  id, nombre: `Moto ${id}`, placa: null, marca: null, modelo: null, color: null, foto_url: null, km_actual: 100, gasolina_actual: 3,
  estado: 'disponible', tipo, llaves, en_uso_por: null, regreso_previsto: null,
});

describe('vehículos: reglas de la app', () => {
  it('gasolina en palabras', () => {
    expect(gasolinaTexto(0)).toBe('Reserva');
    expect(gasolinaTexto(4)).toBe('Lleno');
    expect(gasolinaTexto(null)).toBe('Sin dato');
  });

  it('reservas activas vs. historial', () => {
    expect(reservaActiva({ estado: 'en_espera' })).toBe(true);
    expect(reservaActiva({ estado: 'en_uso' })).toBe(true);
    expect(reservaActiva({ estado: 'entregada' })).toBe(false);
    expect(reservaActiva({ estado: 'rechazada' })).toBe(false);
  });

  it('dónde están las llaves', () => {
    expect(llavesTexto(veh(1))).toBe('En la oficina');
    expect(llavesTexto(veh(1, tipoMoto, { en: 'usuario', usuario: { id: 2, nombre: 'Laura' }, soy_yo: true }))).toBe('Las tienes tú');
    expect(llavesTexto(veh(1, tipoMoto, { en: 'usuario', usuario: { id: 2, nombre: 'Laura' }, soy_yo: false }))).toBe('Las tiene Laura');
  });

  it('agrupa por tipo en el orden de llegada', () => {
    const coche = { ...tipoMoto, id: 2, nombre: 'Coche' };
    const g = agruparPorTipo([veh(1), veh(2, coche), veh(3)]);
    expect(g.map(x => x.tipo.nombre)).toEqual(['Moto', 'Coche']);
    expect(g[0].vehiculos.map(v => v.id)).toEqual([1, 3]);
  });

  it('hora de México con zona', () => {
    expect(isoMexico('2026-11-19', 9)).toBe('2026-11-19T09:00:00-06:00');
    expect(isoMexico('2026-11-19', 14, 30)).toBe('2026-11-19T14:30:00-06:00');
  });

  it('valida la solicitud', () => {
    const base = { vehiculoId: 1, tipoId: null, todoElDia: false, fecha: '2026-11-19', horaInicio: 9, horaFin: 13, motivo: 'Visita a prospecto' };
    expect(validarSolicitud(base)).toBeNull();
    expect(validarSolicitud({ ...base, vehiculoId: null })).toMatch(/vehículo/);
    expect(validarSolicitud({ ...base, vehiculoId: null, tipoId: 1 })).toBeNull();
    expect(validarSolicitud({ ...base, horaFin: 9 })).toMatch(/después/);
    expect(validarSolicitud({ ...base, todoElDia: true, horaInicio: null, horaFin: null })).toBeNull();
    expect(validarSolicitud({ ...base, motivo: ' ' })).toMatch(/para qué/);
  });

  it('fotos obligatorias según el tipo y las llaves', () => {
    expect(fotosObligatorias(tipoMoto, false)).toEqual(['tablero', 'frente', 'atras']);
    expect(fotosObligatorias(tipoMoto, true)).toEqual(['tablero', 'frente', 'atras', 'llaves']);
    expect(fotosFaltantes(['tablero', 'frente'], { tablero: {} })).toEqual(['frente']);
  });

  it('kilometraje: obligatorio y no menor al de salida', () => {
    expect(validarKm('', null)).toMatch(/kilometraje/);
    expect(validarKm('12,430', null)).toBeNull();
    expect(validarKm('12400', 12430)).toMatch(/menor/);
    expect(validarKm('12430', 12430)).toBeNull();
    expect(kmNumero('12,468')).toBe(12468);
  });

  it('cuenta regresiva del código de llaves', () => {
    const ahora = Date.parse('2026-11-19T10:00:00Z');
    expect(segundosRestantes('2026-11-19T10:05:00Z', ahora)).toBe(300);
    expect(segundosRestantes('2026-11-19T09:59:00Z', ahora)).toBe(0);
  });

  it('fechas de la licencia', () => {
    expect(fechaDmyAIso('15/03/2028')).toBe('2028-03-15');
    expect(fechaDmyAIso('5/3/2028')).toBe('2028-03-05');
    expect(fechaDmyAIso('31/02/2028')).toBeNull();
    expect(fechaDmyAIso('2028-03-15')).toBeNull();
    expect(fechaIsoADmy('2028-03-15')).toBe('15/03/2028');
    expect(fechaIsoADmy(null)).toBe('');
  });
});
