import { codigoDesdeUrl } from '../../src/utils/ligaQr';

describe('codigoDesdeUrl (liga del QR /a/{codigo})', () => {
  it('saca el código de la liga https y del esquema propio', () => {
    expect(codigoDesdeUrl('https://consultoriainmobiliaria.com.mx/a/K7M2PX')).toBe('K7M2PX');
    expect(codigoDesdeUrl('https://dev.consultoriainmobiliaria.com.mx/a/k7m2px?x=1')).toBe('K7M2PX');
    expect(codigoDesdeUrl('consultoriainmobiliaria://a/K7M2PX')).toBe('K7M2PX');
    expect(codigoDesdeUrl('/a/K7M-2PX')).toBe('K7M2PX');
  });
  it('null para otras rutas o sin URL', () => {
    expect(codigoDesdeUrl('https://consultoriainmobiliaria.com.mx/descargar-app')).toBeNull();
    expect(codigoDesdeUrl('https://consultoriainmobiliaria.com.mx/blog/a/casa')).toBeNull();
    expect(codigoDesdeUrl('consultoriainmobiliaria://')).toBeNull();
    expect(codigoDesdeUrl(null)).toBeNull();
  });
});
