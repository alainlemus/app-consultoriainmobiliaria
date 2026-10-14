import { renderPagareHtml } from '../src/contratos/pagare';

describe('renderPagareHtml', () => {
  const fecha = new Date(2026, 9, 14);

  it('llena nombre, domicilio, RFC y fecha del acreditado', () => {
    const html = renderPagareHtml({ acreditado: 'LIC. Juan <Pérez>', domAcreditado: 'Calle 1', rfc: 'PEJJ800101ABC' }, fecha);
    expect(html).toContain('Yo, C. Juan &lt;Pérez&gt;');
    expect(html).toContain('con domicilio en Calle 1');
    expect(html).toContain('RFC: PEJJ800101ABC');
    expect(html).toContain('a 14 de octubre de 2026');
    expect(html).toContain('SOSA860530LM7');
  });

  it('deja rayas cuando falta un dato', () => {
    const html = renderPagareHtml({ acreditado: '', domAcreditado: '', rfc: '' }, fecha);
    expect(html).toContain('Yo, C. <span class="linea"');
  });
});
