/**
 * Tests: src/services/atribucion.ts
 *
 * Fase 2 del QR: detectar de qué QR vino la instalación sin que la persona
 * teclee el código.
 *  - Android: Play Install Referrer (exacto)
 *  - iPhone / Android sin referrer: cruce por huella en el backend (probable)
 *  - una sola vez por instalación; sin red se reintenta después
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const mockGetReferrer = jest.fn();
jest.mock('../../modules/install-referrer', () => ({
  __esModule: true,
  default: { getReferrerAsync: (...a: unknown[]) => mockGetReferrer(...a) },
}));

jest.mock('expo-device', () => ({ osVersion: '13', modelName: 'SM-A135M' }));

const mockAtribuir = jest.fn();
jest.mock('../../src/services/acreditadoApi', () => ({
  atribuirInstalacion: (...a: unknown[]) => mockAtribuir(...a),
}));

import {
  codigoDesdeReferrer, detectarCodigoAsesor, obtenerCodigoDetectado, limpiarCodigoDetectado,
} from '../../src/services/atribucion';

const store: Record<string, string> = {};
beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(store)) delete store[k];
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => store[k] ?? null);
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (k: string, v: string) => { store[k] = v; });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (k: string) => { delete store[k]; });
  Platform.OS = 'android';
});

describe('codigoDesdeReferrer', () => {
  it('saca codigo_asesor de la cadena que manda nuestra liga a Play Store', () => {
    expect(codigoDesdeReferrer('utm_source=qr&utm_medium=lona&utm_campaign=K7M2PX&codigo_asesor=K7M2PX')).toBe('K7M2PX');
  });
  it('usa utm_campaign si no viene codigo_asesor, y normaliza', () => {
    expect(codigoDesdeReferrer('utm_campaign=k7m-2px')).toBe('K7M2PX');
  });
  it('null si viene el referrer genérico de Play Store o vacío', () => {
    expect(codigoDesdeReferrer('utm_source=google-play&utm_medium=organic')).toBeNull();
    expect(codigoDesdeReferrer('')).toBeNull();
    expect(codigoDesdeReferrer(null)).toBeNull();
  });
});

describe('detectarCodigoAsesor', () => {
  it('Android con referrer: guarda el código con origen referrer y no llama al backend', async () => {
    mockGetReferrer.mockResolvedValueOnce({ installReferrer: 'utm_source=qr&codigo_asesor=K7M2PX' });

    const d = await detectarCodigoAsesor();

    expect(d).toEqual({ codigo: 'K7M2PX', origen: 'referrer' });
    expect(mockAtribuir).not.toHaveBeenCalled();
    expect(await obtenerCodigoDetectado()).toEqual({ codigo: 'K7M2PX', origen: 'referrer' });
  });

  it('Android sin referrer: cae al cruce por huella con plataforma, versión y modelo', async () => {
    mockGetReferrer.mockResolvedValueOnce(null);
    mockAtribuir.mockResolvedValueOnce({ codigo: 'K7M2PX', asesor: { id: 3, nombre: 'Juan Pérez' } });

    const d = await detectarCodigoAsesor();

    expect(mockAtribuir).toHaveBeenCalledWith({ plataforma: 'android', os_version: '13', modelo: 'SM-A135M' });
    expect(d).toEqual({ codigo: 'K7M2PX', origen: 'huella', asesorNombre: 'Juan Pérez' });
  });

  it('iPhone: no toca el Install Referrer y va directo a la huella', async () => {
    Platform.OS = 'ios';
    mockAtribuir.mockResolvedValueOnce(null);

    const d = await detectarCodigoAsesor();

    expect(mockGetReferrer).not.toHaveBeenCalled();
    expect(mockAtribuir).toHaveBeenCalledWith(expect.objectContaining({ plataforma: 'ios' }));
    expect(d).toBeNull();
    // Sin match: queda marcada como hecha, no se vuelve a preguntar
    expect(store['atribucion_qr_hecha']).toBe('1');
  });

  it('solo corre una vez: la segunda llamada regresa lo guardado sin consultar nada', async () => {
    mockGetReferrer.mockResolvedValueOnce({ installReferrer: 'codigo_asesor=K7M2PX' });
    await detectarCodigoAsesor();

    const d = await detectarCodigoAsesor();

    expect(d?.codigo).toBe('K7M2PX');
    expect(mockGetReferrer).toHaveBeenCalledTimes(1);
    expect(mockAtribuir).not.toHaveBeenCalled();
  });

  it('sin red en el backend no marca como hecha, para reintentar en el siguiente arranque', async () => {
    mockGetReferrer.mockResolvedValueOnce(null);
    mockAtribuir.mockRejectedValueOnce(new Error('Network request failed'));

    expect(await detectarCodigoAsesor()).toBeNull();
    expect(store['atribucion_qr_hecha']).toBeUndefined();
  });

  it('limpiarCodigoDetectado borra el código pero conserva la marca de hecha', async () => {
    mockGetReferrer.mockResolvedValueOnce({ installReferrer: 'codigo_asesor=K7M2PX' });
    await detectarCodigoAsesor();

    await limpiarCodigoDetectado();

    expect(await obtenerCodigoDetectado()).toBeNull();
    expect(store['atribucion_qr_hecha']).toBe('1');
  });
});
