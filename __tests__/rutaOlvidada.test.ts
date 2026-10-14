jest.mock('../src/services/notifications', () => ({ programarRecordatoriosRuta: jest.fn(), cancelarRecordatoriosRuta: jest.fn() }));
jest.mock('../src/services/routeTracking', () => ({ contarPendientesRoute: jest.fn(), syncRoutePoints: jest.fn(), guardarPuntoOffline: jest.fn() }));
import { rutaOlvidada } from '../src/hooks/useRouteTracking';

describe('rutaOlvidada', () => {
  const activada = new Date(2026, 9, 14, 9, 0);
  it('no se cierra antes de las 10 pm del mismo día', () => {
    expect(rutaOlvidada(activada, new Date(2026, 9, 14, 21, 59))).toBe(false);
  });
  it('se cierra a partir de las 10 pm', () => {
    expect(rutaOlvidada(activada, new Date(2026, 9, 14, 22, 0))).toBe(true);
  });
  it('se cierra si ya es otro día', () => {
    expect(rutaOlvidada(activada, new Date(2026, 9, 15, 8, 0))).toBe(true);
  });
  it('si se activó después de las 10 pm, cierra hasta la noche siguiente', () => {
    const tarde = new Date(2026, 9, 14, 23, 0);
    expect(rutaOlvidada(tarde, new Date(2026, 9, 15, 6, 0))).toBe(false);
    expect(rutaOlvidada(tarde, new Date(2026, 9, 15, 22, 0))).toBe(true);
  });
});
