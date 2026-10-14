import { anchoCuerpoIos } from './prestacionServicios';

/** Datos del acreditado con los que se llena el pagaré. */
export interface PagareVars {
  acreditado:    string;
  domAcreditado: string;
  rfc:           string;
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Dato capturado, o una raya para llenarlo a mano si falta. */
const dato = (v: string | undefined | null, ancho: number) =>
  v && v.trim() ? esc(v.trim()) : `<span class="linea" style="min-width:${ancho}px">&nbsp;</span>`;

const sinTitulo = (n: string) => n.replace(/^\s*(LIC\.?|C\.)\s+/i, '');

/**
 * Pagaré en el formato del documento oficial. Se llena con nombre, domicilio y
 * RFC del acreditado y la fecha del día; importe y vencimiento quedan en
 * blanco porque el contrato no captura ese dato. Igual al del backend.
 */
export function renderPagareHtml(vars: PagareVars, fecha: Date = new Date()): string {
  const nombre = vars.acreditado ? sinTitulo(vars.acreditado) : '';
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Pagaré</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #000; width: ${anchoCuerpoIos}px; padding: 0 40px; }
  h1 { font-size: 24px; text-align: center; letter-spacing: 1px; margin: 12px 0 26px; }
  p { margin-bottom: 14px; text-transform: uppercase; }
  .j { text-align: justify; }
  .lugar { margin-left: 80px; }
  .linea { border-bottom: 1px solid #000; display: inline-block; min-width: 60px; }
  table { width: 100%; border-collapse: collapse; margin-top: 22px; }
  td { border: 1px solid #000; padding: 10px 8px; vertical-align: top; text-transform: uppercase; }
  td.l { height: 50px; } td.f { height: 90px; }
</style></head><body>
<h1>PAGARÉ</h1>
<p class="lugar">Ciudad de Pachuca de Soto, Hidalgo, a ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}.</p>
<p class="j">Yo, C. ${dato(nombre, 260)}, con domicilio en ${dato(vars.domAcreditado, 280)}, y RFC: ${dato(vars.rfc, 130)}, en adelante "El Deudor", reconozco deber y pagar incondicionalmente a la orden de <strong>C. Jose Antonio Solis Santuario</strong>, con domicilio en Avenida Revolución 1014 Despacho 55 Plaza Las Marialuisas Colonia Periodistas Código Postal 42060 Pachuca de Soto Hidalgo, y RFC: <strong>SOSA860530LM7</strong>, en adelante "El Acreedor", la cantidad de:</p>
<p>1. Importe: la cantidad de $${dato(null, 90)} (${dato(null, 240)} pesos 00/100 M.N.).</p>
<p>2. Vencimiento: el presente pagaré vencerá el día ${dato(null, 36)} de ${dato(null, 100)} de 20${dato(null, 28)}, fecha en la cual deberá efectuarse el pago total del importe.</p>
<p class="j">3. Intereses: se causarán intereses moratorios a razón del 3% anual sobre saldos insolutos a partir del día siguiente al vencimiento.</p>
<p class="j">4. Lugar de pago: el pago se realizará en <strong>Pachuca de Soto, Hidalgo</strong> o en el domicilio que el acreedor designe por escrito.</p>
<p class="j">5. Gastos: cualquier gasto, desembolso o comisión que se origine por la cobranza o por incumplimiento será responsabilidad de El Deudor.</p>
<p>6. Jurisdicción: para la interpretación y cumplimiento de este documento, ambas partes se someten a las leyes y tribunales competentes de la ciudad de Pachuca de Soto, Hidalgo.</p>
<table><tr><td class="l">Lugar y fecha:</td></tr><tr><td class="f">Nombre y firma de El Deudor:</td></tr></table>
</body></html>`;
}
