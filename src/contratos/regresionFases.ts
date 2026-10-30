import { anchoCuerpoIos } from './prestacionServicios';
import { MESES, dato, esc, sinTitulo } from './pagare';

/** Firmantes y lugar del oficio de regresión de fases. */
export interface RegresionFasesVars {
  acreditado: string;
  solidario:  string;
  ciudad:     string;
}

/**
 * Oficio de regresión de fases: el acreditado y el obligado solidario piden a
 * FOVISSSTE (AT'N Hipotecaria Hogar) que se decline el crédito. El número de
 * crédito queda en blanco para llenarse al firmar. Igual al del backend
 * (resources/views/contratos/regresion_fases.blade.php).
 */
export function renderRegresionFasesHtml(vars: RegresionFasesVars, fecha: Date = new Date()): string {
  const acreditado = vars.acreditado ? sinTitulo(vars.acreditado) : '';
  const solidario  = vars.solidario ? sinTitulo(vars.solidario) : '';
  const ciudad = vars.ciudad?.trim() || 'Huejutla de Reyes';
  // "Huejutla de Reyes, Estado de Hidalgo"; si la ciudad ya trae el estado, no se repite.
  const lugar = /hidalgo/i.test(ciudad) ? ciudad : `${ciudad}, Estado de Hidalgo`;
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Regresión de fases</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #000; width: ${anchoCuerpoIos}px; padding: 0 60px; }
  .fecha { text-align: right; margin: 20px 0 50px; }
  .destino, .attn { font-weight: bold; }
  .attn { margin-top: 36px; }
  .cuerpo { margin-top: 36px; text-align: justify; line-height: 1.8; }
  .cierre, .atte { margin-top: 32px; }
  .atte { font-weight: bold; }
  .firma { margin-top: 60px; }
  .linea { border-bottom: 1px solid #000; display: inline-block; min-width: 60px; }
</style></head><body>
<p class="fecha">${esc(lugar)}; a ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}.</p>
<p class="destino">FONDO DE LA VIVIENDA DEL INSTITUTO DE SEGURIDAD<br>Y SERVICIOS SOCIALES DE LOS TRABAJADORES DEL ESTADO “FOVISSSTE”<br>P R E S E N T E</p>
<p class="attn">AT’N: “HIPOTECARIA HOGAR”, S. A. DE C. V.<br><span style="font-weight:normal">Sociedad Financiera de Objeto Múltiple, Entidad no Regulada</span></p>
<p class="cuerpo">Los que suscribimos <strong>${dato(acreditado, 200)}</strong> y <strong>${dato(solidario, 200)}</strong> por medio del presente hacemos de su conocimiento que por así convenir a nuestros intereses solicitamos de la manera más atenta que se decline el crédito identificado con el número ${dato(null, 170)}, reconocemos que el recurso deberá reintegrarse en su totalidad al FOVISSSTE a la cuenta que se nos indique.</p>
<p class="cierre">Quedo a sus órdenes para cualquier duda o aclaración.</p>
<p class="atte">A T E N T A M E N T E:</p>
<p class="firma">C. ${dato(acreditado, 260)}</p>
<p class="firma">C. ${dato(solidario, 260)}</p>
</body></html>`;
}
