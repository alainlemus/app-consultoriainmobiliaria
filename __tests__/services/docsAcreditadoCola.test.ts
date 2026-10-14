/**
 * Cola de documentos del acreditado: un fallo de red conserva el documento sin gastar intentos;
 * un rechazo del servidor sí cuenta (máx 3) y los enviados salen de la cola.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { encolarDocAcreditado, getDocsAcreditadoQueue, sincronizarDocsAcreditado } from '../../src/services/offline';
import { subirDocumentoAcreditado } from '../../src/services/acreditadoApi';

jest.mock('../../src/services/acreditadoApi', () => ({
  subirDocumentoAcreditado: jest.fn(),
  subirFotoAcreditado: jest.fn(),
}));
jest.mock('../../src/services/api', () => ({ syncBatch: jest.fn() }));
const subir = subirDocumentoAcreditado as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  subir.mockReset();
});

describe('sincronizarDocsAcreditado', () => {
  it('envía los pendientes con su nota y vacía la cola', async () => {
    subir.mockResolvedValue({});
    await encolarDocAcreditado({ uri: 'file:///a.pdf', tipo: 'CURP', mimeType: 'application/pdf', notas: 'mi CURP' });

    const r = await sincronizarDocsAcreditado();

    expect(r).toEqual({ ok: 1, errores: 0 });
    expect(subir).toHaveBeenCalledWith('file:///a.pdf', 'CURP', 'application/pdf', 'mi CURP');
    expect(await getDocsAcreditadoQueue()).toHaveLength(0);
  });

  it('sin señal conserva el documento y no cuenta intentos', async () => {
    subir.mockRejectedValue(new Error('Network request failed'));
    await encolarDocAcreditado({ uri: 'file:///a.pdf', tipo: 'CURP', mimeType: 'application/pdf' });

    for (let i = 0; i < 5; i++) await sincronizarDocsAcreditado();

    const cola = await getDocsAcreditadoQueue();
    expect(cola).toHaveLength(1);
    expect(cola[0].intentos).toBe(0);
  });

  it('si el servidor lo rechaza se reintenta máximo 3 veces y luego se descarta', async () => {
    subir.mockRejectedValue(new Error('El archivo no es válido'));
    await encolarDocAcreditado({ uri: 'file:///a.pdf', tipo: 'CURP', mimeType: 'application/pdf' });

    await sincronizarDocsAcreditado();
    await sincronizarDocsAcreditado();
    await sincronizarDocsAcreditado();
    expect(await getDocsAcreditadoQueue()).toHaveLength(1);
    await sincronizarDocsAcreditado();
    expect(await getDocsAcreditadoQueue()).toHaveLength(0);
  });
});
