import { rutaParaNotificacion } from '../src/utils/rutaNotificacion';

describe('rutaParaNotificacion', () => {
  it('asesor: detalle de expediente y de prospecto', () => {
    expect(rutaParaNotificacion({ screen: 'documentos', expediente_id: '14' }, false)).toBe('/expedientes/14');   // rechazado / validado
    expect(rutaParaNotificacion({ screen: 'expedientes', expediente_id: '14' }, false)).toBe('/expedientes/14'); // documento subido, completo
    expect(rutaParaNotificacion({ screen: 'expediente', expediente_id: 14 }, false)).toBe('/expedientes/14');    // pago recibido
    expect(rutaParaNotificacion({ screen: 'expedientes', id: '9' }, false)).toBe('/expedientes/9');              // etapa / cerrado
    expect(rutaParaNotificacion({ screen: 'prospectos', id: '7' }, false)).toBe('/prospectos/7');                // prospecto asignado
    expect(rutaParaNotificacion({ contacto_id: 3 }, false)).toBe('/prospectos/3');
  });
  it('asesor: visitas al mapa; comisiones, cuentas o sin datos al inicio', () => {
    expect(rutaParaNotificacion({ screen: 'visitas', id: '5' }, false)).toBe('/mapa');
    expect(rutaParaNotificacion({ screen: 'comisiones' }, false)).toBe('/(tabs)');
    expect(rutaParaNotificacion({ screen: 'users', id: '2' }, false)).toBe('/(tabs)');
    expect(rutaParaNotificacion(undefined, false)).toBe('/(tabs)');
  });
  it('acreditado: documentos y trámite', () => {
    expect(rutaParaNotificacion({ screen: 'documentos', expediente_id: '14' }, true)).toBe('/(acreditado)/documentos');
    expect(rutaParaNotificacion({ screen: 'expedientes', expediente_id: '14' }, true)).toBe('/(acreditado)/documentos');
    expect(rutaParaNotificacion({ screen: 'expedientes', id: '9' }, true)).toBe('/(acreditado)');
    expect(rutaParaNotificacion(undefined, true)).toBe('/(acreditado)');
  });
});

describe('documento solicitado', () => {
  it('al acreditado lo lleva a Mi Trámite y al asesor al expediente', () => {
    expect(rutaParaNotificacion({ screen: 'tramite', expediente_id: '14' }, true)).toBe('/(acreditado)');
    expect(rutaParaNotificacion({ screen: 'expedientes', expediente_id: '14' }, false)).toBe('/expedientes/14');
  });
});
