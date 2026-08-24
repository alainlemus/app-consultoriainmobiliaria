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
import { KEYS } from '../services/offline';
import type { ContratoPrestacionServiciosConfig } from '../services/api';

export const DEFAULT_CONTRATO_CONFIG: ContratoPrestacionServiciosConfig = {
  site_name: 'Consultoría Inmobiliaria',
  firma_prestador: 'LIC. JOSE ANTONIO SOLIS SANTUARIO',
  firma_juridico: 'LIC. LUZ ANGÉLICA PÉREZ MEJÍA',
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
  domAcreditado:           string;
  tipoTramite:             string;
  montoCredito?:           number | null;
  honorariosPorcentaje?:   number | null;
  honorariosMonto?:        number | null;
  obligadoSolidario?:      string | null;
  ciudad?:                 string;
}

const BLANCO = '________________________';

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

function nl2br(texto: string): string {
  return texto.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

export function renderPrestacionServiciosHtml(vars: ContratoVars, config: ContratoPrestacionServiciosConfig): string {
  const ciudad  = (vars.ciudad ?? 'Huejutla de Reyes').toUpperCase();
  const acreditado = (vars.acreditado || BLANCO).toUpperCase();
  const curp        = (vars.curp || BLANCO).toUpperCase();
  const rfc          = (vars.rfc || BLANCO).toUpperCase();
  const domAcreditado = (vars.domAcreditado || BLANCO).toUpperCase();
  const tipoTramite    = (vars.tipoTramite || 'CRÉDITO').toUpperCase();
  const pctHon   = vars.honorariosPorcentaje != null ? `${vars.honorariosPorcentaje}%` : '10%';
  const montoHon = moneda(vars.honorariosMonto);
  const montoCredito = moneda(vars.montoCredito);

  const placeholders: Record<string, string> = {
    '{ciudad}':           ciudad,
    '{fecha}':             fechaLarga(),
    '{domicilio}':         (config.domicilio_prestador || '').toUpperCase(),
    '{acreditado}':        acreditado,
    '{dom_acreditado}':    domAcreditado,
    '{tipo_tramite}':      tipoTramite,
    '{curp}':               curp,
    '{rfc}':                 rfc,
    '{nss}':                 BLANCO,
    '{folio}':               vars.folio,
    '{monto_credito}':       montoCredito,
    '{pct_honorarios}':      pctHon,
    '{monto_honorarios}':    montoHon,
    '{site_name}':           (config.site_name || '').toUpperCase(),
  };

  const intro          = nl2br(reemplazarPlaceholders(config.contrato_intro, placeholders));
  const declPrestador   = nl2br(reemplazarPlaceholders(config.contrato_declaraciones_prestador, placeholders));
  const declInteresado  = nl2br(reemplazarPlaceholders(config.contrato_declaraciones_interesado, placeholders));
  const clausulas        = nl2br(reemplazarPlaceholders(config.contrato_clausulas, placeholders));

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Contrato de Prestación de Servicios</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #1a1a1a; background: #ffffff; }
        .page { padding: 0; }
        .header { background: #1a1a1a; padding: 14px 28px 0 28px; }
        .header-empresa { font-size: 18px; font-weight: bold; color: #d4af37; letter-spacing: 1.5px; text-transform: uppercase; }
        .header-slogan { font-size: 10px; color: #a0936a; margin-top: 2px; letter-spacing: 0.5px; padding-bottom: 12px; }
        .header-divider { height: 4px; background: linear-gradient(to right, #d4af37, #9b2335, #d4af37); }
        .doc-titulo-bar { background: #9b2335; padding: 8px 28px; text-align: center; }
        .doc-titulo-bar span { font-size: 13px; font-weight: bold; color: #ffffff; text-transform: uppercase; letter-spacing: 1.5px; }
        .folio-area { padding: 10px 28px 0 28px; text-align: right; }
        .folio-box { display: inline-block; background: #fdf9ee; border: 1px solid #d4af37; border-radius: 4px; padding: 4px 12px; font-size: 10px; color: #96760f; }
        .body-content { padding: 14px 28px 24px 28px; }
        h2 { font-size: 12px; font-weight: bold; color: #9b2335; border-bottom: 2px solid #d4af37; padding-bottom: 3px; margin-top: 16px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1.5px; }
        p { margin-bottom: 8px; text-align: justify; }
        .firma-bloque { margin-top: 40px; }
        .firmas { width: 100%; border-collapse: collapse; }
        .firmas td { width: 50%; padding: 0 24px; text-align: center; vertical-align: bottom; }
        .linea-firma { border-top: 2px solid #1a1a1a; padding-top: 8px; font-size: 12px; line-height: 1.6; }
        .footer { margin-top: 24px; padding: 8px 32px 0 32px; border-top: 1px solid #d4af37; }
        .footer-inner { display: flex; justify-content: space-between; font-size: 10px; }
        .footer-left { color: #96760f; }
        .footer-right { color: #9b2335; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="header-empresa">${config.site_name || 'Consultoría Inmobiliaria'}</div>
          <div class="header-slogan">Gestión de trámites hipotecarios y patrimoniales</div>
        </div>
        <div class="header-divider"></div>
        <div class="doc-titulo-bar"><span>Contrato de Prestación de Servicios Profesionales y Financiamiento de Gastos</span></div>
        <div class="folio-area">
          <div class="folio-box">Expediente: <strong>${vars.folio}</strong></div>
        </div>
        <div class="body-content">
          <p>${intro}</p>

          <h2>Declaraciones</h2>
          <p><strong>POR PARTE DE "EL PRESTADOR":</strong></p>
          <p style="margin-left:12px;">${declPrestador}</p>
          <p><strong>DECLARA EL INTERESADO:</strong></p>
          <p style="margin-left:12px;">${declInteresado}</p>

          <h2>Cláusulas</h2>
          <p>AMBAS PARTES SE COMPROMETEN A SOMETERSE AL TENOR DE LAS SIGUIENTES CLÁUSULAS SIN QUE EXISTAN VICIOS DE CONSENTIMIENTO:</p>
          <p style="margin-left:12px;">${clausulas}</p>

          <p style="margin-top:16px;">
            EN LA CIUDAD DE <strong>${ciudad}</strong>, A LOS <strong>${fechaLarga()}</strong>,
            HABIENDO LEÍDO Y COMPRENDIDO EL CONTENIDO DEL PRESENTE CONTRATO, LAS PARTES LO SUSCRIBEN EN SEÑAL DE CONFORMIDAD.
          </p>

          <div class="firma-bloque">
            <table class="firmas">
              <tr><td style="height:70px;"></td><td style="height:70px;"></td></tr>
              <tr>
                <td><div class="linea-firma"><strong>FIRMA DE "EL PRESTADOR"</strong><br>${(config.firma_prestador || '').toUpperCase()}<br><small>${(config.site_name || '').toUpperCase()}</small></div></td>
                <td><div class="linea-firma"><strong>FIRMA DEL "INTERESADO"</strong><br>C. ${acreditado}<br><small>RFC: ${rfc} &nbsp; CURP: ${curp}</small></div></td>
              </tr>
            </table>
            <table class="firmas" style="margin-top:40px;">
              <tr><td style="height:70px;"></td><td style="height:70px;"></td></tr>
              <tr>
                <td><div class="linea-firma"><strong>FIRMA POR PARTE DEL JURÍDICO</strong><br>${(config.firma_juridico || '').toUpperCase()}</div></td>
                <td><div class="linea-firma"><strong>FIRMA DEL "OBLIGADO SOLIDARIO"</strong><br>C. ${(vars.obligadoSolidario || BLANCO).toUpperCase()}</div></td>
              </tr>
            </table>
          </div>
        </div>
        <div class="footer">
          <div class="footer-inner">
            <span class="footer-left">${config.site_name || 'Consultoría Inmobiliaria'} &bull; Documento generado el ${new Date().toLocaleDateString('es-MX')}</span>
            <span class="footer-right">${vars.folio}</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
