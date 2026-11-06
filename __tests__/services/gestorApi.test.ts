/** API del gestor: caché sin señal y cola de subidas. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEncargos, getEncargo, entregarEncargo, reabrirEncargo, subirDocumento, subidasPendientes, sincronizarSubidasGestor } from '../../src/services/gestorApi';
import { apiFetch } from '../../src/services/api';

jest.mock('../../src/services/api', () => ({ apiFetch: jest.fn(), API_BASE: 'http://test/api/v1', getToken: jest.fn().mockResolvedValue('tok'), resolveStorageUrl: (u: string) => u }));
jest.mock('../../src/utils/comprimirFoto', () => ({ limpiarArchivoLocal: jest.fn() }));

const api = apiFetch as jest.Mock;
const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

beforeEach(async () => {
  await AsyncStorage.clear();
  api.mockReset();
  fetchMock.mockReset();
});

const encargo = { id: 1, estado: 'por_revisar', expediente: { id: 3 } };

it('sin señal muestra la última lista descargada', async () => {
  api.mockResolvedValueOnce({ data: [encargo] });
  expect((await getEncargos()).desdeCache).toBe(false);

  api.mockRejectedValueOnce(new Error('Network request failed'));
  const r = await getEncargos();
  expect(r.desdeCache).toBe(true);
  expect(r.data).toHaveLength(1);
});

it('una subida sin señal queda en cola y se envía sola después', async () => {
  fetchMock.mockRejectedValueOnce(new Error('Network request failed'));
  const r = await subirDocumento({ encargoId: 1, uri: 'file:///a.pdf', nombreArchivo: 'a.pdf', mimeType: 'application/pdf', tipo: 'CLG' });
  expect(r).toBe('encolado');
  expect(await subidasPendientes(1)).toHaveLength(1);

  fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
  expect(await sincronizarSubidasGestor()).toBe(1);
  expect(await subidasPendientes()).toHaveLength(0);
  expect(fetchMock.mock.calls[0][0]).toBe('http://test/api/v1/gestor/encargos/1/documentos');
});

it('si el servidor rechaza la subida avisa en vez de encolarla', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ errors: { estado: ['Podrás subir documentos cuando…'] } }) });
  await expect(subirDocumento({ encargoId: 1, uri: 'file:///a.pdf', nombreArchivo: 'a.pdf', mimeType: 'application/pdf', tipo: 'CLG' }))
    .rejects.toThrow('Podrás subir');
  expect(await subidasPendientes()).toHaveLength(0);
});

it('«Ya terminé» y reabrir llaman al servidor y actualizan el encargo guardado', async () => {
  api.mockResolvedValueOnce({ data: { ...encargo, estado: 'por_validar' } });
  expect((await entregarEncargo(1)).estado).toBe('por_validar');
  expect(api).toHaveBeenLastCalledWith('/gestor/encargos/1/entregar', { method: 'POST' });

  api.mockRejectedValueOnce(new Error('Network request failed'));
  expect((await getEncargo(1)).data.estado).toBe('por_validar');

  api.mockResolvedValueOnce({ data: { ...encargo, estado: 'en_tramite' } });
  expect((await reabrirEncargo(1)).estado).toBe('en_tramite');
  expect(api).toHaveBeenLastCalledWith('/gestor/encargos/1/reabrir', { method: 'POST' });
});
