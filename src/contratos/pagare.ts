import { anchoCuerpoIos } from './prestacionServicios';

/** Datos del acreditado (deudor) y del obligado solidario (aval) con los que se llena el pagaré. */
export interface PagareVars {
  acreditado:    string;
  domAcreditado: string;
  claveElector:  string;
  solidario:     string;
  domSolidario:  string;
  ciudad:        string;
}

export const ACREEDOR = 'C. JOSE ANTONIO SOLIS SANTUARIO';
export const DOMICILIO_PAGO = 'AVENIDA REVOLUCIÓN 1014 DESPACHO 55 PLAZA LAS MARIALUISAS, COLONIA PERIODISTAS, C.P. 42060, PACHUCA DE SOTO, HIDALGO';

export const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Dato capturado, o una raya para llenarlo a mano si falta. */
export const dato = (v: string | undefined | null, ancho: number) =>
  v && v.trim() ? esc(v.trim().toUpperCase()) : `<span class="linea" style="min-width:${ancho}px">&nbsp;</span>`;

export const sinTitulo = (n: string) => n.replace(/^\s*(LIC\.?|C\.)\s+/i, '');

/**
 * Pagaré en el formato del cliente (deudor, aval y testigos). Se llena con los
 * datos del acreditado y del obligado solidario, la ciudad y la fecha del día;
 * importe, vencimiento, % de intereses y testigos quedan en blanco para
 * llenarse al firmar. Igual al del backend (resources/views/contratos/pagare.blade.php).
 */
export function renderPagareHtml(vars: PagareVars, fecha: Date = new Date()): string {
  const nombre = vars.acreditado ? sinTitulo(vars.acreditado) : '';
  const aval   = vars.solidario ? sinTitulo(vars.solidario) : '';
  const clave  = vars.claveElector?.trim();
  const fechaTxt = `${fecha.getDate()} DE ${MESES[fecha.getMonth()].toUpperCase()} DE ${fecha.getFullYear()}`;
  const testigo = (n: number) => `<td><p><strong>TESTIGO ${n}</strong></p><p>Nombre: ${dato(null, 230)}</p><p class="firma">Firma: ${dato(null, 240)}</p></td>`;
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Pagaré</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.45; color: #000; width: ${anchoCuerpoIos}px; padding: 0 40px; }
  h1 { font-size: 22px; text-align: center; letter-spacing: 1px; margin: 4px 0 10px; }
  h2 { font-size: 11px; margin: 14px 0 6px; }
  p { margin-bottom: 6px; }
  .j { text-align: justify; }
  .bueno { text-align: right; font-weight: bold; margin-bottom: 12px; }
  .firma { margin-top: 22px; }
  .linea { border-bottom: 1px solid #000; display: inline-block; min-width: 60px; }
  table { width: 100%; border-collapse: collapse; }
  td { width: 50%; vertical-align: top; }
</style></head><body>
<h1>PAGARÉ</h1>
<p class="bueno">BUENO POR: $${dato(null, 140)}</p>
<p>Lugar y fecha de suscripción: ${dato(vars.ciudad, 180)}, a ${fechaTxt}.</p>
<p>Fecha de vencimiento: ${dato(null, 280)}</p>
<p class="j" style="margin-top:12px">Por este pagaré, yo, ${dato(nombre, 280)}, prometo pagar incondicionalmente a la orden de <strong>${ACREEDOR}</strong>, la cantidad de:</p>
<p>$${dato(null, 140)} (${dato(null, 290)} PESOS 00/100 M.N.)</p>
<p class="j">Cantidad que pagaré en la fecha de vencimiento señalada, en el domicilio ubicado en: <strong>${DOMICILIO_PAGO}</strong>.</p>
<p class="j">En caso de incumplimiento en el pago oportuno, me obligo a cubrir intereses moratorios a razón del ${dato(null, 46)}% mensual, hasta la total liquidación del adeudo.</p>
<h2>DATOS DEL SUSCRIPTOR (DEUDOR)</h2>
<p>Nombre completo: ${dato(nombre, 380)}</p>
<p>Domicilio: ${dato(vars.domAcreditado, 430)}</p>
<p>Identificación oficial: ${clave ? `INE, CLAVE DE ELECTOR ${esc(clave.toUpperCase())}` : dato(null, 350)}</p>
<p class="firma">Firma: ${dato(null, 380)}</p>
<h2>DATOS DEL AVAL</h2>
<p class="j">Por medio del presente, yo, ${dato(aval, 280)}, declaro que avalo al suscriptor de este pagaré y garantizo el pago total de la obligación consignada en el mismo, obligándome solidariamente en los términos de la Ley General de Títulos y Operaciones de Crédito.</p>
<p>Domicilio: ${dato(vars.domSolidario, 430)}</p>
<p>Identificación oficial: ${dato(null, 350)}</p>
<p class="firma">NOMBRE Y FIRMA DEL AVAL: ${dato(null, 320)}</p>
<h2>TESTIGOS</h2>
<table><tr>${testigo(1)}${testigo(2)}</tr></table>
</body></html>`;
}
