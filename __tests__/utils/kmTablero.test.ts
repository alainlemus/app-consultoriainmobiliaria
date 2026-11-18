import { elegirKm } from '../../src/utils/kmTablero';

describe('elegirKm: km leído de la foto del tablero', () => {
  it('ignora la hora y toma el odómetro', () => {
    expect(elegirKm('12:30\n012430\n24°C', 12400)).toBe(12430);
    expect(elegirKm('18:05 12441', 12430)).toBe(12441);
  });

  it('ignora el parcial (TRIP) aunque tenga muchos dígitos', () => {
    expect(elegirKm('TRIP A 00345\nODO 012461', 12430)).toBe(12461);
    expect(elegirKm('123.4\n12461', 12430)).toBe(12461);
  });

  it('entiende separador de miles', () => {
    expect(elegirKm('12,430 km', 12000)).toBe(12430);
    expect(elegirKm('12.430', null)).toBe(12430);
  });

  it('prefiere el más cercano mayor o igual al km actual', () => {
    expect(elegirKm('98765\n12470\n12440', 12430)).toBe(12440);
  });

  it('no propone nada si todo es menor que el km actual', () => {
    expect(elegirKm('11500', 12430)).toBeNull();
  });

  it('sin números o sin texto, nada', () => {
    expect(elegirKm('KM/H RPM FUEL', 12430)).toBeNull();
    expect(elegirKm('', 12430)).toBeNull();
    expect(elegirKm(null)).toBeNull();
  });

  it('acepta km cortos en vehículos nuevos', () => {
    expect(elegirKm('00812', 800)).toBe(812);
    expect(elegirKm('812', 800)).toBe(812);
    expect(elegirKm('812', 12000)).toBeNull();
  });

  it('corrige la O que el OCR lee en lugar de 0', () => {
    expect(elegirKm('O1246O', 12000)).toBe(12460);
  });

  it('sin km actual prefiere el renglón ODO y luego el más largo', () => {
    expect(elegirKm('34567\nODO 12345', null)).toBe(12345);
    expect(elegirKm('34567\n1234567', null)).toBe(1234567);
  });
});
