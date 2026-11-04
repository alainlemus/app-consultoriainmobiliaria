/**
 * Primeros pasos: mensaje al asesor, tipo de trámite según el crédito y
 * solicitud que se guarda sin señal y se envía sola al volver la conexión.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  componerMensaje, tipoTramiteDe, enviarSolicitud, haySolicitudPendiente, sincronizarSolicitudPendiente,
} from '../../src/services/primerosPasos';
import { getServiciosDisponibles, solicitarAsesoria } from '../../src/services/acreditadoApi';

jest.mock('../../src/services/acreditadoApi', () => ({
  getServiciosDisponibles: jest.fn(),
  solicitarAsesoria: jest.fn(),
  urlPublica: (ruta: string) => `http://test/${ruta}`,
}));
jest.mock('../../src/utils/comprimirFoto', () => ({ limpiarArchivoLocal: jest.fn() }));

const servicios = getServiciosDisponibles as jest.Mock;
const solicitar = solicitarAsesoria as jest.Mock;

const CATALOGO = [
  { id: 1, nombre: 'Crédito Tradicional FOVISSSTE' },
  { id: 2, nombre: 'Crédito Pensionados FOVISSSTE' },
  { id: 6, nombre: 'Asesoría Personalizada' },
  { id: 7, nombre: 'FOVISSSTE-INFONAVIT Individual' },
  { id: 10, nombre: 'Crédito INFONAVIT Tradicional' },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  servicios.mockReset().mockResolvedValue(CATALOGO);
  solicitar.mockReset();
});

describe('tipoTramiteDe', () => {
  it('elige el trámite tradicional de cada instituto y asesoría si no sabe', () => {
    expect(tipoTramiteDe('fovissste', CATALOGO)).toBe(1);
    expect(tipoTramiteDe('infonavit', CATALOGO)).toBe(10);
    expect(tipoTramiteDe('por_definir', CATALOGO)).toBe(6);
  });
});

describe('componerMensaje', () => {
  it('resume crédito, cuenta, precalificación y horario', () => {
    const m = componerMensaje({ credito: 'infonavit', cuenta: 'no', registrado: true, monto: '485,000', puntos: '1,120', horario: 'tarde', mensaje: ' vivo en Zacualtipán ' });
    expect(m).toContain('Crédito: Infonavit');
    expect(m).toContain('Cuenta en el portal: Sí');
    expect(m).toContain('Precalificación: $485,000');
    expect(m).toContain('Puntos Infonavit: 1,120');
    expect(m).toContain('Horario para llamar: Tarde');
    expect(m).toContain('Mensaje: vivo en Zacualtipán');
  });

  it('no pasa de 1000 caracteres (límite del backend)', () => {
    expect(componerMensaje({ credito: 'fovissste', mensaje: 'x'.repeat(2000) }).length).toBeLessThanOrEqual(1000);
  });
});

describe('enviarSolicitud', () => {
  it('envía con el tipo de trámite y la captura', async () => {
    solicitar.mockResolvedValue(undefined);
    const r = await enviarSolicitud({ credito: 'fovissste', capturaUri: 'file:///cap.jpg', monto: '620,000' });
    expect(r).toBe('enviada');
    expect(solicitar).toHaveBeenCalledWith(expect.objectContaining({ tipo_tramite_id: 1, screenshotUri: 'file:///cap.jpg' }));
    expect(await haySolicitudPendiente()).toBe(false);
  });

  it('no manda la captura si no pudo terminar la precalificación', async () => {
    solicitar.mockResolvedValue(undefined);
    await enviarSolicitud({ credito: 'infonavit', capturaUri: 'file:///cap.jpg', noPudoPrecalificar: true });
    expect(solicitar).toHaveBeenCalledWith(expect.objectContaining({ screenshotUri: undefined }));
  });

  it('sin señal la guarda y se envía sola después', async () => {
    servicios.mockRejectedValueOnce(new Error('Network request failed'));
    expect(await enviarSolicitud({ credito: 'infonavit' })).toBe('encolada');
    expect(await haySolicitudPendiente()).toBe(true);

    solicitar.mockResolvedValue(undefined);
    expect(await sincronizarSolicitudPendiente()).toBe(true);
    expect(solicitar).toHaveBeenCalledWith(expect.objectContaining({ tipo_tramite_id: 10 }));
    expect(await haySolicitudPendiente()).toBe(false);
  });

  it('si el servidor la rechaza avisa en vez de encolarla', async () => {
    solicitar.mockRejectedValue(new Error('Ya tienes un expediente activo.'));
    await expect(enviarSolicitud({ credito: 'fovissste' })).rejects.toThrow('expediente activo');
    expect(await haySolicitudPendiente()).toBe(false);
  });
});
