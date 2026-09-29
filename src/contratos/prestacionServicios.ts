/**
 * Contrato de Prestación de Servicios — generación 100% local (offline).
 *
 * El texto (intro, declaraciones, cláusulas, firmas) NO se reescribe aquí:
 * es el mismo que ya existe en el backend (tabla `configuraciones`, editable
 * en Filament > "Contratos para clientes"), solo que en vez de pedirlo al
 * backend en el momento de generar, se lee de una caché local que se
 * refresca cada vez que la app sincroniza (ver src/services/offline.ts,
 * paso 7 de sincronizar()). DEFAULT_CONTRATO_CONFIG es el snapshot de ese
 * texto tomado el día que se construyó esta pantalla — sirve de respaldo
 * antes de la primera sincronización.
 *
 * El diseño (colores, cabecera, tabla de firmas) replica
 * resources/views/contratos/_layout.blade.php del backend.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { KEYS } from '../services/offline';
import type { ContratoPrestacionServiciosConfig } from '../services/api';

export const DEFAULT_CONTRATO_CONFIG: ContratoPrestacionServiciosConfig = {
  site_name: 'Consultoría Inmobiliaria',
  firma_prestador: 'JOSE ANTONIO SOLIS SANTUARIO',
  firma_juridico: 'LUZ ANGÉLICA PÉREZ MEJÍA',
  domicilio_juridico: '',
  domicilio_prestador: 'Huejutla de Reyes, Hidalgo',
  contrato_intro:
    'EN LA CIUDAD DE {ciudad} A LOS {fecha} DÍAS DEL MES DE MAYO DEL AÑO 2026, CELEBRAN EL PRESENTE CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES Y FINANCIAMIENTO DE GASTOS POR UNA PARTE EL LIC. JOSE ANTONIO SOLIS SANTUARIO, EN ADELANTE "EL PRESTADOR", CON DOMICILIO EN {domicilio}. Y POR LA OTRA EL C. {acreditado}, EN ADELANTE "EL INTERESADO", QUIEN CUENTA CON DOMICILIO EN {dom_acreditado}, QUIENES SE RECONOCEN CON CAPACIDADES LEGALES PARA OBLIGARSE, SUJETÁNDOSE A LAS SIGUIENTES:',
  contrato_declaraciones_prestador:
    '1.- QUE ES UNA EMPRESA CON PLENA CAPACIDAD LEGAL Y EXPERIENCIA EN LA TRAMITACIÓN DE {tipo_tramite}.\n2.- QUE SE ESPECIALIZA EN REALIZAR ÚNICAMENTE EL TRÁMITE JUNTO AL "INTERESADO" SIEMPRE Y CUANDO EXISTA UN {tipo_tramite} VIGENTE.\n3.- QUE EL DOMICILIO DE "EL PRESTADOR" ESTÁ UBICADO EN HUEJUTLA DE REYES, HGO. PLAZA TECOLUCO, AV. CORONA DEL ROSAL.\n4.- "EL PRESTADOR" ES EL ENCARGADO DE REALIZAR EL TRÁMITE EN CUESTIÓN DEL {tipo_tramite}.\n5.- QUE "EL PRESTADOR" FINANCIARÁ CON RECURSOS PROPIOS, EN CALIDAD DE PRÉSTAMO TEMPORAL, LOS GASTOS ESTRICTAMENTE NECESARIOS PARA EL TRÁMITE DEL {tipo_tramite} DE "EL INTERESADO", TALES COMO: EL AVALÚO DEL PREDIO O CASA HABITACIÓN, GASTOS ANTE EL REGISTRO PÚBLICO DE LA PROPIEDAD, ESCRITURAS PÚBLICAS Y OTROS GASTOS INDISPENSABLES PREVIAMENTE AUTORIZADOS POR ESCRITO POR "EL INTERESADO". DICHOS GASTOS SERÁN REEMBOLSADOS AL FINALIZAR EL TRÁMITE POR EL "INTERESADO".',
  contrato_declaraciones_interesado:
    '1.- QUE CUENTA CON UN {tipo_tramite} VIGENTE Y CAPACIDAD LEGAL PARA OBLIGARSE EN ESTE ACTO.\n2.- QUE ACEPTA QUE "EL PRESTADOR" FINANCIE LOS GASTOS ANTES INDICADOS, COMPROMETIÉNDOSE A REEMBOLSAR CONFORME LO PACTADO.\n3.- QUIEN SE IDENTIFICA CON CURP {curp}, QUIEN BAJO PROTESTA DE DECIR VERDAD ASEGURA CONTAR CON EL DERECHO DE PODER REALIZAR EL TRÁMITE.\n4.- QUE CUENTA CON DOMICILIO EN {dom_acreditado}.\n5.- QUE CUENTA CON RFC {rfc}.\n6.- QUE SE ENCUENTRA BIEN DE SUS FACULTADES MENTALES Y CUENTA CON EL DERECHO DE PODER REALIZAR EL TRÁMITE DEL {tipo_tramite}.',
  contrato_clausulas:
    'A.-) AMBAS PARTES ESTÁN TOTALMENTE DE ACUERDO EN QUE SE REALICE EL TRÁMITE DEL {tipo_tramite}.\nB.-) "EL PRESTADOR" SE COMPROMETE A DESEMPEÑAR TODO SU CONOCIMIENTO PARA CUMPLIR SATISFACTORIAMENTE EL OBJETIVO DEL PRESENTE CONTRATO BAJO SU EXPERIENCIA, ASÍ COMO RESPONDER POR LA CALIDAD DE SUS SERVICIOS Y DE CUALQUIER INCIDENTE QUE SUCEDA REFERENTE AL TRÁMITE DE "EL INTERESADO".\nC.-) EL "INTERESADO" SE OBLIGA A BRINDAR TODA LA INFORMACIÓN QUE SE REQUIERA POR PARTE DE "EL PRESTADOR" PARA PODER LLEVAR A CABO EL TRÁMITE DEL {tipo_tramite}.\nD.-) "EL PRESTADOR" FINANCIARÁ LOS GASTOS QUE CONLLEVE EL TRÁMITE TALES COMO AVALÚO, ESCRITURAS PÚBLICAS Y LOS DEMÁS QUE RESULTEN, OTORGÁNDOLOS EN FORMA DE PRÉSTAMO A "EL INTERESADO".\nE.-) "EL INTERESADO" SE COMPROMETE A REEMBOLSAR LOS GASTOS MENCIONADOS EN LA CLÁUSULA "D" AL MOMENTO DE FORMALIZAR EL TRÁMITE.\nF.-) "EL INTERESADO" REALIZARÁ LA ENTREGA DEL REMANENTE EN UNA SOLA EXHIBICIÓN.\nG.-) "EL INTERESADO" LE COMUNICARÁ A "EL PRESTADOR" CUALQUIER HECHO QUE SE SUSCITE DURANTE EL PROCESO.\nH.-) "EL PRESTADOR" PODRÁ RESCINDIR EL PRESENTE CONTRATO SIN TENER CLÁUSULAS PENALES NI RESPONSABILIDADES.\nI.-) POR PARTE DE "EL INTERESADO" NO PODRÁ RESCINDIR DICHO CONTRATO SIN CAUSA JUSTIFICADA.\nJ.-) EN CASO DE QUE "EL INTERESADO" RESCINDA EL CONTRATO, SE VERÁ EN LA NECESIDAD DE CUBRIR LOS PAGOS DE GASTOS REALIZADOS TALES COMO VALUADOR Y TRÁMITES NOTARIALES, ASÍ COMO EL 20% DEL MONTO TOTAL DEL {tipo_tramite}.\nK.-) "EL INTERESADO" SE COMPROMETE A NO COMETER ACTOS DE MOLESTIA NI ACTOS ILÍCITOS CONTRA "EL PRESTADOR", NI CAUSAR DAÑOS MORALES NI PATRIMONIALES.\nL.-) "EL INTERESADO" ACUDIRÁ A LAS INSTALACIONES DE "EL PRESTADOR" CUANDO SE LE SOLICITE, EN RAZÓN DE REQUERIR FIRMA O REQUISITOS ADICIONALES.\nM.-) EN CUESTIÓN DE LOS HONORARIOS DE "EL PRESTADOR", "EL INTERESADO" ACEPTA PAGAR {pct_honorarios} DE HONORARIOS SOBRE EL MONTO TOTAL DEL CRÉDITO, EQUIVALENTE A {monto_honorarios} MXN.\nN.-) DERIVADO DEL INCUMPLIMIENTO DEL INCISO ANTERIOR, "EL PRESTADOR" SE VERÁ EN LA NECESIDAD DE ACUDIR ANTE LOS TRIBUNALES CIVILES COMPETENTES PARA HACER CUMPLIR EL PRESENTE CONTRATO.\nÑ.-) "LAS PARTES" MANIFIESTAN QUE A LA FIRMA DEL PRESENTE CONTRATO NO EXISTE DOLO, ERROR, VIOLENCIA, MALA FE O CUALQUIER OTRO VICIO DE CONSENTIMIENTO QUE PUDIERA INVALIDARLO.',
};

/** Lee la caché sincronizada; si nunca sincronizó, usa el snapshot por defecto. 100% local, sin fetch. */
export async function getContratoConfig(): Promise<ContratoPrestacionServiciosConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CONTRATO_PRESTACION_SERVICIOS);
    if (raw) return JSON.parse(raw) as ContratoPrestacionServiciosConfig;
  } catch { /* caché corrupta — usar default */ }
  return DEFAULT_CONTRATO_CONFIG;
}

export interface ContratoVars {
  folio:                  string;
  acreditado:              string;
  curp:                    string;
  rfc:                     string;
  nss?:                    string;
  claveElector?:           string;
  domAcreditado:           string;
  tipoTramite:             string;
  montoCredito?:           number | null;
  honorariosPorcentaje?:   number | null;
  honorariosMonto?:        number | null;
  obligadoSolidario:       string;
  ciudad?:                 string;
}

const BLANCO = '________________________';

/**
 * Márgenes de página en puntos (72pt = 1in) para Print.printToFileAsync.
 * Compartidos por todas las pantallas que imprimen el contrato porque el
 * HTML depende de ellos (ver ANCHO_PAPEL_PT / anchoCuerpoIos abajo).
 */
export const MARGENES_PAGINA = { top: 24, bottom: 24, left: 18, right: 18 };

/** Carta y Oficio comparten ancho (8.5in = 612pt); solo cambia el alto. */
const ANCHO_PAPEL_PT = 612;
const ALTO_PAPEL_PT: Record<'carta' | 'oficio', number> = { carta: 792, oficio: 964 };

/** Tamaño de hoja para Print.printToFileAsync (puntos a 72 dpi). */
export const DIMENSIONES_PAPEL: Record<'carta' | 'oficio', { width: number; height: number }> = {
  carta:  { width: ANCHO_PAPEL_PT, height: ALTO_PAPEL_PT.carta },
  oficio: { width: ANCHO_PAPEL_PT, height: ALTO_PAPEL_PT.oficio },
};

/** Margen lateral del texto en px CSS, además de MARGENES_PAGINA (48px + 18pt ≈ 1.9 cm). */
const MARGEN_LATERAL_PX = 48;

/**
 * En iOS expo-print carga el HTML en un WKWebView de 612px de ancho, pero al
 * imprimir WebKit usa 1px CSS = 0.75pt, así que el área imprimible
 * (612 − márgenes laterales = 576pt) equivale a 768px. Fijar el body a ese
 * ancho hace que el contenido llene la hoja y que el layout del WebView y el
 * de impresión coincidan (con anchos distintos el alto medido no cuadraba y
 * se recortaba el final del contrato).
 */
const PT_POR_PX_IMPRESION = 0.75;
const anchoCuerpoIos = Math.floor(
  (ANCHO_PAPEL_PT - MARGENES_PAGINA.left - MARGENES_PAGINA.right) / PT_POR_PX_IMPRESION,
);

/** Quita un "LIC." / "C." inicial para no imprimir "LIC. LIC. …" o "C. LIC. …". */
const sinTitulo = (nombre: string) => nombre.replace(/^\s*(LIC\.?|C\.)\s+/i, '');

const fechaLarga = () => {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const hoy = new Date();
  return `${hoy.getDate()} DÍAS DEL MES DE ${meses[hoy.getMonth()].toUpperCase()} DEL AÑO ${hoy.getFullYear()}`;
};

const moneda = (n?: number | null) =>
  n != null ? `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN` : BLANCO;

function reemplazarPlaceholders(texto: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.split(k).join(v), texto);
}

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

/** Una línea de la plantilla (inciso / declaración) = un bloque paginable. */
function lineas(texto: string): string {
  const items = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  return items
    .map((l, i) => `<div class="bloque item${i === items.length - 1 ? ' ultimo' : ''}">${escapar(l)}</div>`)
    .join('\n');
}

/**
 * Oficio (más alta que carta) admite un espaciado más generoso; en carta se
 * compacta un poco para no gastar hojas de más. El reparto en hojas y que las
 * firmas no queden solas lo resuelve paginarContrato().
 */
function espaciadoPorPapel(tamanoPapel: 'carta' | 'oficio') {
  return tamanoPapel === 'oficio'
    ? { fontSize: 12, lineHeight: 1.65, pMarginBottom: 14, h2MarginTop: 20, h2MarginBottom: 12, closingMarginTop: 24, firmaBloqueMarginTop: 48 }
    : { fontSize: 11, lineHeight: 1.5,  pMarginBottom: 8,  h2MarginTop: 16, h2MarginBottom: 10, closingMarginTop: 16, firmaBloqueMarginTop: 40 };
}

export function renderPrestacionServiciosHtml(
  vars: ContratoVars,
  config: ContratoPrestacionServiciosConfig,
  tamanoPapel: 'carta' | 'oficio' = 'carta',
): string {
  const espaciado = espaciadoPorPapel(tamanoPapel);
  const ciudad  = (vars.ciudad ?? 'Huejutla de Reyes').toUpperCase();
  const acreditado = (vars.acreditado || BLANCO).toUpperCase();
  const curp        = (vars.curp || BLANCO).toUpperCase();
  const rfc          = (vars.rfc || BLANCO).toUpperCase();
  const domAcreditado = (vars.domAcreditado || BLANCO).toUpperCase();
  const tipoTramite    = (vars.tipoTramite || 'CRÉDITO').toUpperCase();
  const pctHon   = vars.honorariosPorcentaje != null ? `${vars.honorariosPorcentaje}%` : '10%';
  const montoHon = moneda(vars.honorariosMonto);
  const montoCredito = moneda(vars.montoCredito);
  const obligadoSolidario = (vars.obligadoSolidario || BLANCO).toUpperCase();

  const placeholders: Record<string, string> = {
    '{ciudad}':           ciudad,
    '{fecha}':             fechaLarga(),
    '{domicilio}':         (config.domicilio_prestador || '').toUpperCase(),
    '{domicilio_juridico}': (config.domicilio_juridico || '').toUpperCase(),
    '{firma_prestador}':    (config.firma_prestador || '').toUpperCase(),
    '{firma_juridico}':     (config.firma_juridico || '').toUpperCase(),
    '{acreditado}':        acreditado,
    '{dom_acreditado}':    domAcreditado,
    '{tipo_tramite}':      tipoTramite,
    '{curp}':               curp,
    '{rfc}':                 rfc,
    '{nss}':                 (vars.nss || BLANCO).toUpperCase(),
    '{clave_elector}':       (vars.claveElector || BLANCO).toUpperCase(),
    '{folio}':               vars.folio,
    '{monto_credito}':       montoCredito,
    '{pct_honorarios}':      pctHon,
    '{monto_honorarios}':    montoHon,
    '{obligado_solidario}':  obligadoSolidario,
    '{site_name}':           (config.site_name || '').toUpperCase(),
  };

  // {fecha} ya incluye "N DÍAS DEL MES DE <MES> DEL AÑO <AAAA>"; la plantilla
  // del backend trae además un mes/año fijos ("… DÍAS DEL MES DE MAYO DEL AÑO
  // 2026") que imprimían la fecha dos veces. Se descarta ese texto fijo.
  const introPlantilla = config.contrato_intro.replace(
    /\{fecha\}\s*DÍAS\s+DEL\s+MES\s+DE\s+\S+\s+DEL\s+AÑO\s+\d{4}/i,
    '{fecha}',
  );
  const intro          = escapar(reemplazarPlaceholders(introPlantilla, placeholders));
  const declPrestador   = lineas(reemplazarPlaceholders(config.contrato_declaraciones_prestador, placeholders));
  const declInteresado  = lineas(reemplazarPlaceholders(config.contrato_declaraciones_interesado, placeholders));
  const clausulas        = lineas(reemplazarPlaceholders(config.contrato_clausulas, placeholders));

  const siteName = config.site_name || 'Consultoría Inmobiliaria';
  const footerHtml = `
    <div class="footer">
      <span class="footer-left">${siteName} &bull; Documento generado el ${new Date().toLocaleDateString('es-MX')}</span>
      <span class="footer-right">${vars.folio}<span class="footer-hoja"></span></span>
    </div>`;

  // Alto útil de cada hoja en px CSS (ver PT_POR_PX_IMPRESION). Se restan unos
  // px de holgura: si la hoja HTML midiera siquiera 1px más que la física, cada
  // hoja se desbordaría a la siguiente y saldrían hojas en blanco intercaladas.
  const altoHojaPx = Math.floor(
    (ALTO_PAPEL_PT[tamanoPapel] - MARGENES_PAGINA.top - MARGENES_PAGINA.bottom) / PT_POR_PX_IMPRESION,
  ) - 8;
  const paginar = Platform.OS === 'ios';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Contrato de Prestación de Servicios</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: ${espaciado.fontSize}px; line-height: ${espaciado.lineHeight}; color: #1a1a1a; background: #ffffff; }
        ${paginar ? `body { width: ${anchoCuerpoIos}px; }` : ''}
        .header { background: #1a1a1a; padding: 14px ${MARGEN_LATERAL_PX}px 0 ${MARGEN_LATERAL_PX}px; }
        .header-empresa { font-size: 18px; font-weight: bold; color: #d4af37; letter-spacing: 1.5px; text-transform: uppercase; }
        .header-slogan { font-size: 10px; color: #a0936a; margin-top: 2px; letter-spacing: 0.5px; padding-bottom: 12px; }
        .header-divider { height: 4px; background: linear-gradient(to right, #d4af37, #9b2335, #d4af37); }
        .doc-titulo-bar { background: #9b2335; padding: 8px ${MARGEN_LATERAL_PX}px; text-align: center; }
        .doc-titulo-bar span { font-size: 13px; font-weight: bold; color: #ffffff; text-transform: uppercase; letter-spacing: 1.5px; }
        .folio-area { padding: 10px 0 0 0; text-align: right; }
        .folio-box { display: inline-block; background: #fdf9ee; border: 1px solid #d4af37; border-radius: 4px; padding: 4px 12px; font-size: 10px; color: #96760f; }
        .contenido { padding: 0 ${MARGEN_LATERAL_PX}px; }
        .bloque { padding-bottom: ${espaciado.pMarginBottom}px; text-align: justify; }
        .bloque.item { padding-bottom: 0; margin-left: 12px; }
        .bloque.item.ultimo { padding-bottom: ${espaciado.pMarginBottom}px; }
        h2 { font-size: 12px; font-weight: bold; color: #9b2335; border-bottom: 2px solid #d4af37; padding-bottom: 3px; margin-top: ${espaciado.h2MarginTop}px; margin-bottom: ${espaciado.h2MarginBottom}px; text-transform: uppercase; letter-spacing: 1.5px; }
        .cierre { padding-top: ${espaciado.closingMarginTop}px; page-break-inside: avoid; break-inside: avoid; }
        .cierre p { text-align: justify; }
        .firma-bloque { margin-top: ${espaciado.firmaBloqueMarginTop}px; }
        .firmas { width: 100%; border-collapse: collapse; }
        .firmas td { width: 50%; padding: 0 24px; text-align: center; vertical-align: bottom; }
        .linea-firma { border-top: 2px solid #1a1a1a; padding-top: 8px; font-size: 12px; line-height: 1.6; }
        .footer { display: flex; justify-content: space-between; margin: 28px ${MARGEN_LATERAL_PX}px 0 ${MARGEN_LATERAL_PX}px; padding-top: 8px; border-top: 1px solid #d4af37; font-size: 10px; line-height: 1.4; }
        .footer-left { color: #96760f; }
        .footer-right { color: #9b2335; }
        /* Hojas armadas por el script de abajo (solo iOS): alto fijo = alto
           imprimible, el cuerpo crece y el pie queda pegado al fondo de cada hoja. */
        .hoja { height: ${altoHojaPx}px; display: flex; flex-direction: column; overflow: hidden; page-break-after: always; break-after: page; }
        .hoja:last-child { page-break-after: auto; break-after: auto; }
        .hoja-cuerpo { flex: 1; overflow: hidden; }
        .hoja .footer { margin-top: 0; }
      </style>
    </head>
    <body>
      <div id="fuente">
        <div class="bloque" style="padding-bottom:0;">
          <div class="header">
            <div class="header-empresa">${siteName}</div>
            <div class="header-slogan">Gestión de trámites hipotecarios y patrimoniales</div>
          </div>
          <div class="header-divider"></div>
          <div class="doc-titulo-bar"><span>Contrato de Prestación de Servicios Profesionales y Financiamiento de Gastos</span></div>
        </div>
        <div class="contenido">
          <div class="bloque folio-area"><div class="folio-box">Expediente: <strong>${vars.folio}</strong></div></div>
          <div class="bloque" style="padding-top:14px;">${intro}</div>

          <div class="bloque junto"><h2>Declaraciones</h2></div>
          <div class="bloque junto"><strong>POR PARTE DE "EL PRESTADOR":</strong></div>
          ${declPrestador}
          <div class="bloque junto"><strong>DECLARA EL INTERESADO:</strong></div>
          ${declInteresado}

          <div class="bloque junto"><h2>Cláusulas</h2></div>
          <div class="bloque junto">AMBAS PARTES SE COMPROMETEN A SOMETERSE AL TENOR DE LAS SIGUIENTES CLÁUSULAS SIN QUE EXISTAN VICIOS DE CONSENTIMIENTO:</div>
          ${clausulas}

          <div class="bloque cierre">
            <p>
              EN LA CIUDAD DE <strong>${ciudad}</strong>, A LOS <strong>${fechaLarga()}</strong>,
              HABIENDO LEÍDO Y COMPRENDIDO EL CONTENIDO DEL PRESENTE CONTRATO, LAS PARTES LO SUSCRIBEN EN SEÑAL DE CONFORMIDAD.
            </p>
            <div class="firma-bloque">
              <table class="firmas">
                <tr><td style="height:70px;"></td><td style="height:70px;"></td></tr>
                <tr>
                  <td><div class="linea-firma"><strong>FIRMA DE "EL PRESTADOR"</strong><br>C. ${sinTitulo(config.firma_prestador || '').toUpperCase()}<br><small>${(config.site_name || '').toUpperCase()}</small></div></td>
                  <td><div class="linea-firma"><strong>FIRMA DEL "INTERESADO"</strong><br>C. ${acreditado}<br><small>RFC: ${rfc} &nbsp; CURP: ${curp}</small></div></td>
                </tr>
              </table>
              <table class="firmas" style="margin-top:40px;">
                <tr><td style="height:70px;"></td><td style="height:70px;"></td></tr>
                <tr>
                  <td><div class="linea-firma"><strong>FIRMA POR PARTE DEL JURÍDICO</strong><br>LIC. ${sinTitulo(config.firma_juridico || '').toUpperCase()}</div></td>
                  <td><div class="linea-firma"><strong>FIRMA DEL "OBLIGADO SOLIDARIO"</strong><br>C. ${obligadoSolidario}</div></td>
                </tr>
              </table>
            </div>
          </div>
        </div>
        ${footerHtml}
      </div>
      ${paginar ? `<script>${SCRIPT_PAGINAR}
paginarContrato(${altoHojaPx});</script>` : ''}
    </body>
    </html>
  `;
}

/**
 * Corre DENTRO del WebView de expo-print. Va como string (no como función con
 * toString()) porque en builds de release Hermes compila a bytecode y
 * toString() ya no devuelve el código fuente.
 *
 * Reparte los .bloque en hojas de alto fijo con el pie al fondo de cada una:
 *  - Un bloque que no cabe pasa completo a la hoja siguiente (nunca se parte).
 *  - Los títulos/encabezados (.junto) no se quedan solos al final de una hoja.
 *  - Si el cierre (párrafo final + firmas) no cabe, se lleva consigo las
 *    últimas cláusulas, para que las firmas nunca queden solas en una hoja.
 */
const SCRIPT_PAGINAR = `
function paginarContrato(altoHoja) {
  var fuente = document.getElementById('fuente');
  if (!fuente) return;
  var header = fuente.firstElementChild;
  var contenido = fuente.querySelector('.contenido');
  var footerModelo = fuente.querySelector('.footer');
  var bloques = Array.prototype.slice.call(contenido.children);
  var LLEVAR_CON_FIRMAS = 2;
  var hojas = [];
  var cuerpo;

  function nuevaHoja() {
    var hoja = document.createElement('div');
    hoja.className = 'hoja';
    cuerpo = document.createElement('div');
    cuerpo.className = 'hoja-cuerpo';
    var inner = document.createElement('div');
    inner.className = 'contenido';
    cuerpo.appendChild(inner);
    hoja.appendChild(cuerpo);
    hoja.appendChild(footerModelo.cloneNode(true));
    document.body.appendChild(hoja);
    hojas.push(hoja);
    return inner;
  }
  function cabe() { return cuerpo.scrollHeight <= cuerpo.clientHeight; }

  var actual = nuevaHoja();
  cuerpo.insertBefore(header, actual);

  for (var i = 0; i < bloques.length; i++) {
    var bloque = bloques[i];
    actual.appendChild(bloque);
    if (cabe() || actual.children.length === 1) continue;

    var llevar = [bloque];
    var extra = bloque.classList.contains('cierre') ? LLEVAR_CON_FIRMAS : 0;
    var prev = bloque.previousElementSibling;
    while (prev && (extra > 0 || prev.classList.contains('junto')) && actual.children.length > llevar.length + 1) {
      if (!prev.classList.contains('junto')) extra--;
      llevar.unshift(prev);
      prev = prev.previousElementSibling;
    }
    actual = nuevaHoja();
    for (var j = 0; j < llevar.length; j++) actual.appendChild(llevar[j]);
  }

  fuente.parentNode.removeChild(fuente);
  for (var k = 0; k < hojas.length; k++) {
    var n = hojas[k].querySelector('.footer-hoja');
    if (n) n.textContent = ' • Hoja ' + (k + 1) + ' de ' + hojas.length;
  }
}
`;
