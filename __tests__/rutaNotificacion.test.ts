import { rutaParaNotificacion } from '../src/utils/rutaNotificacion';

describe('rutaParaNotificacion', () => {
  it('asesor: expediente, prospecto y datos con screen + id', () => {
    expect(rutaParaNotificacion({ expediente_id: '14' }, false)).toBe('/expedientes/14');
    expect(rutaParaNotificacion({ contacto_id: 3 }, false)).toBe('/prospectos/3');
    expect(rutaParaNotificacion({ screen: 'prospectos', id: '7' }, false)).toBe('/prospectos/7');
    expect(rutaParaNotificacion({ screen: 'expedientes', id: '9' }, false)).toBe('/expedientes/9');
  });
  it('acreditado: las del expediente abren Documentos', () => {
    expect(rutaParaNotificacion({ screen: 'documentos', expediente_id: '14' }, true)).toBe('/(acreditado)/documentos');
    expect(rutaParaNotificacion({ expediente_id: '14' }, true)).toBe('/(acreditado)/documentos');
  });
  it('sin pantalla que corresponda solo abre la app', () => {
    expect(rutaParaNotificacion({ screen: 'comisiones' }, false)).toBeNull();
    expect(rutaParaNotificacion({ screen: 'comisiones' }, true)).toBeNull();
    expect(rutaParaNotificacion(undefined, false)).toBeNull();
  });
});
