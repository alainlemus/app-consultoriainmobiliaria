import { renderPagareHtml, ACREEDOR } from '../src/contratos/pagare';
import { renderRegresionFasesHtml } from '../src/contratos/regresionFases';

const fecha = new Date(2026, 9, 14);

describe('renderPagareHtml', () => {
  const vars = {
    acreditado: 'LIC. Juan <Pérez>', domAcreditado: 'Calle 1', claveElector: 'pejj800101',
    solidario: 'María López', domSolidario: 'Calle 2', ciudad: 'Huejutla de Reyes',
  };

  it('llena deudor, aval, lugar y fecha', () => {
    const html = renderPagareHtml(vars, fecha);
    expect(html).toContain('yo, JUAN &lt;PÉREZ&gt;, prometo pagar');
    expect(html).toContain('Nombre completo: JUAN &lt;PÉREZ&gt;');
    expect(html).toContain('Domicilio: CALLE 1');
    expect(html).toContain('INE, CLAVE DE ELECTOR PEJJ800101');
    expect(html).toContain('yo, MARÍA LÓPEZ, declaro que avalo');
    expect(html).toContain('Domicilio: CALLE 2');
    expect(html).toContain('suscripción: HUEJUTLA DE REYES, a 14 DE OCTUBRE DE 2026.');
    expect(html).toContain(ACREEDOR);
  });

  it('deja rayas cuando falta un dato', () => {
    const html = renderPagareHtml({ acreditado: '', domAcreditado: '', claveElector: '', solidario: '', domSolidario: '', ciudad: '' }, fecha);
    expect(html).toContain('yo, <span class="linea"');
    expect(html).toContain('Identificación oficial: <span class="linea"');
  });
});

describe('renderRegresionFasesHtml', () => {
  it('lleva a los dos firmantes, el lugar y la fecha; el número de crédito en blanco', () => {
    const html = renderRegresionFasesHtml({ acreditado: 'Juan Pérez', solidario: 'Juana Pérez', ciudad: 'Huejutla de Reyes' }, fecha);
    expect(html).toContain('Huejutla de Reyes, Estado de Hidalgo; a 14 de octubre de 2026.');
    expect(html).toContain('suscribimos <strong>JUAN PÉREZ</strong> y <strong>JUANA PÉREZ</strong>');
    expect(html).toContain('con el número <span class="linea"');
    expect(html).toContain('C. JUANA PÉREZ</p>');
  });

  it('no repite el estado si la ciudad ya lo trae', () => {
    const html = renderRegresionFasesHtml({ acreditado: '', solidario: '', ciudad: 'Pachuca, Hidalgo' }, fecha);
    expect(html).toContain('Pachuca, Hidalgo; a 14');
  });
});
