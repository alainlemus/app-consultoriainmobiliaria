/**
 * Pantalla: Registrar contrato
 * Ruta: /contratos/registrar?expedienteId=X (expedienteId opcional, solo
 * para precargar datos si ya existe un expediente — el contrato NO depende
 * de tener uno).
 *
 * El contrato es independiente del expediente: se captura todo en el
 * momento, con el acreditado presente. Flujo:
 *  1. Acreditado — foto de su INE (con OCR) o capturar sus datos a mano.
 *  2. Obligado solidario — siempre se captura (escaneo o manual), todo
 *     contrato lleva uno.
 *  3. Datos del trámite — folio, tipo de trámite, monto, honorarios.
 *  4. Generar el PDF (100% local), guardarlo en el dispositivo y en el
 *     historial de "Contratos generados". Si el contrato se originó desde
 *     un expediente (vino con expedienteId), además se sube ahí como
 *     documento; si no, se queda solo en el historial local.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import Button from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getExpediente, uploadDocumento, uploadContratoGenerado } from '@/src/services/api';
import { getContratoConfig, renderPrestacionServiciosHtml } from '@/src/contratos/prestacionServicios';
import { reconocerIne, ocrDisponible, type DatosIneOcr } from '@/src/utils/ineOcr';
import { persistirDocumento, comprimirFoto } from '@/src/utils/comprimirFoto';
import { guardarContratoGenerado } from '@/src/services/contratosGenerados';
import { useSyncContext } from '@/src/contexts/SyncContext';
import type { Expediente } from '@/src/types';

type Persona = 'acreditado' | 'solidario';
type Mode = 'captura' | 'ocr' | 'revision' | 'datos-tramite' | 'generando' | 'listo';
type TamanoPapel = 'oficio' | 'carta';

const CONTRATO_TIPO_DOCUMENTO = 'Contrato de Prestación de Servicios';

// Puntos a 72 dpi (lo que espera expo-print). Carta = 216×279mm (8.5×11in,
// igual al default de expo-print). Oficio = 216×340mm, tamaño de hoja más
// usado en trámites en México.
const DIMENSIONES_PAPEL: Record<TamanoPapel, { width: number; height: number }> = {
  carta:  { width: 612, height: 792 },
  oficio: { width: 612, height: 964 },
};

interface DatosPersona {
  nombre:    string;
  curp:      string;
  rfc:       string;
  domicilio: string;
}

const PERSONA_VACIA: DatosPersona = { nombre: '', curp: '', rfc: '', domicilio: '' };

/**
 * Filtra un texto para dejar solo dígitos y un punto decimal.
 *
 * Se usa en vez de `keyboardType="decimal-pad"/"numeric"` porque en este
 * build (Expo 54 / RN 0.81, New Architecture) esos teclados restringidos en
 * iOS no disparan onChangeText — el campo se queda sin aceptar texto, ni
 * tecleando ni pegando. Con teclado normal + filtro en JS se evita el bug.
 */
function filtrarNumerico(v: string): string {
  const limpio = v.replace(/[^0-9.]/g, '');
  const [entero, ...resto] = limpio.split('.');
  return resto.length ? `${entero}.${resto.join('')}` : entero;
}

/** Honorarios = monto del crédito × % de honorarios, con 2 decimales. Vacío si falta algún dato. */
function calcularHonorarios(montoStr: string, pctStr: string): string {
  const monto = Number(montoStr);
  const pct   = Number(pctStr);
  if (!montoStr || !pctStr || Number.isNaN(monto) || Number.isNaN(pct)) return '';
  return (monto * pct / 100).toFixed(2);
}

function folioAuto(): string {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CT-${y}${m}${d}-${rand}`;
}

export default function RegistrarContratoScreen() {
  const router = useRouter();
  const { expedienteId: expedienteIdParam } = useLocalSearchParams<{ expedienteId?: string }>();
  const { online, encolarDoc, encolarContrato } = useSyncContext();

  const [mode, setMode]                 = useState<Mode>('captura');
  const [personaActual, setPersonaActual] = useState<Persona>('acreditado');

  // Expediente: opcional, solo para precargar datos si vino por parámetro.
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [cargandoExpediente, setCargandoExpediente] = useState(!!expedienteIdParam);

  // Datos leídos por OCR del documento que se está capturando en este momento.
  const [ocrDatos, setOcrDatos] = useState<DatosIneOcr>({});

  // Formularios de acreditado y solidario
  const [acreditado, setAcreditado] = useState<DatosPersona>(PERSONA_VACIA);
  const [nss,          setNss]          = useState('');
  const [claveElector, setClaveElector] = useState('');
  const [solidario,  setSolidario]  = useState<DatosPersona>(PERSONA_VACIA);

  // Fotos de INE persistidas (para historial + subida al backend) — se
  // llenan solo cuando se escanea/toma foto/elige de galería; en captura
  // manual quedan vacías.
  const [acreditadoFotoUri, setAcreditadoFotoUri] = useState<string | null>(null);
  const [solidarioFotoUri,  setSolidarioFotoUri]  = useState<string | null>(null);

  // Datos del trámite
  const [tramitePrefilled, setTramitePrefilled] = useState(false);
  const [folio,                setFolio]                = useState('');
  const [tipoTramite,          setTipoTramite]          = useState('');
  const [ciudad,               setCiudad]               = useState('Huejutla de Reyes');
  const [montoCredito,         setMontoCredito]         = useState('');
  const [honorariosPorcentaje, setHonorariosPorcentaje] = useState('10');
  const [honorariosMonto,      setHonorariosMonto]      = useState('');
  const [tamanoPapel,          setTamanoPapel]          = useState<TamanoPapel>('oficio');

  const [pdfUri, setPdfUri] = useState<string | null>(null);

  // ── Cargar expediente cuando viene por parámetro (solo para precargar) ────
  useEffect(() => {
    if (!expedienteIdParam) return;
    (async () => {
      try {
        const exp = await getExpediente(Number(expedienteIdParam));
        setExpediente(exp);
      } catch {
        // No bloquea el flujo — el contrato no depende del expediente.
      } finally {
        setCargandoExpediente(false);
      }
    })();
  }, [expedienteIdParam]);

  const datosPersonaActual = personaActual === 'acreditado' ? acreditado : solidario;
  const setDatosPersonaActual = personaActual === 'acreditado' ? setAcreditado : setSolidario;

  /** Precarga el formulario de la persona activa: OCR primero, con fallback al expediente (solo acreditado). */
  function aplicarDatos(datos: DatosIneOcr) {
    if (personaActual === 'acreditado') {
      setAcreditado({
        nombre:    datos.nombre || expediente?.acreditado_nombre || '',
        curp:      datos.curp || expediente?.acreditado_curp || '',
        // La RFC nunca está impresa en la INE — siempre viene del expediente o captura manual
        rfc:       expediente?.acreditado_rfc || '',
        domicilio: datos.domicilio || expediente?.acreditado_domicilio || '',
      });
      setNss(expediente?.contacto?.nss || '');
      setClaveElector(datos.claveElector || '');
    } else {
      setSolidario({
        nombre:    datos.nombre || expediente?.obligado_solidario_nombre || '',
        curp:      datos.curp || '',
        rfc:       '',
        domicilio: datos.domicilio || '',
      });
    }
  }

  // ── Captura de la INE ──────────────────────────────────────────────────────
  // Ojo: aquí NO se usa react-native-document-scanner-plugin (el escáner de
  // documentos de app/expedientes/documentos/subir.tsx) — ese realza
  // contraste/perspectiva pensando en hojas de papel, y sobre el plástico
  // brillante de la INE arruina el OCR. Foto normal + normalización de
  // orientación (ver procesarImagen) es lo que da buenos resultados.
  async function tomarFoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permiso requerido', 'Activa el acceso a la cámara en Configuración.'); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: false, base64: false });
      if (result.canceled) return;
      await procesarImagen(result.assets[0].uri);
    } catch { /* usuario canceló o error de cámara */ }
  }

  async function elegirGaleria() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permiso requerido', 'Activa el acceso a la galería en Configuración.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.9, mediaTypes: ['images'] });
      if (result.canceled) return;
      await procesarImagen(result.assets[0].uri);
    } catch { /* usuario canceló */ }
  }

  async function procesarImagen(uri: string) {
    setMode('ocr');

    // Normalizar primero (redimensiona y "hornea" la rotación EXIF en los
    // píxeles) y leer el OCR sobre esa versión — la foto cruda de la cámara
    // en iOS suele venir rotada solo por metadato EXIF, y el OCR no la
    // respeta: intenta leer el texto de lado y saca basura.
    let uriParaOcr = uri;
    try {
      const foto = await comprimirFoto(uri, `ine_${personaActual}`);
      uriParaOcr = foto.uri;
      if (__DEV__) console.log(`[ineOcr] foto normalizada: ${foto.width}x${foto.height} — ${foto.uri}`);
      if (personaActual === 'acreditado') setAcreditadoFotoUri(foto.uri);
      else setSolidarioFotoUri(foto.uri);
    } catch (e) {
      if (__DEV__) console.warn('[ineOcr] falló comprimirFoto, uso la original:', e);
      /* si falla la normalización, se intenta OCR con la original */
    }

    const datos = await reconocerIne(uriParaOcr);
    setOcrDatos(datos);
    aplicarDatos(datos);

    setMode('revision');
  }

  function capturarManual() {
    setOcrDatos({});
    aplicarDatos({});
    setMode('revision');
  }

  // ── Navegación entre pasos ─────────────────────────────────────────────────
  function continuarDesdeRevision() {
    if (personaActual === 'acreditado') {
      setPersonaActual('solidario');
      setOcrDatos({});
      setMode('captura');
      return;
    }
    // Terminó de revisar al solidario → datos del trámite
    if (!tramitePrefilled) {
      setFolio(expediente?.folio || folioAuto());
      setTipoTramite(expediente?.tipo_tramite?.nombre || '');
      if (expediente?.monto_credito != null) setMontoCredito(String(expediente.monto_credito));
      if (expediente?.honorarios_porcentaje != null) setHonorariosPorcentaje(String(expediente.honorarios_porcentaje));
      if (expediente?.honorarios_monto != null) setHonorariosMonto(String(expediente.honorarios_monto));
      setTramitePrefilled(true);
    }
    setMode('datos-tramite');
  }

  function volverACaptura() {
    setMode('captura');
  }

  function volverAPersonaAnterior() {
    if (personaActual === 'solidario' && mode === 'captura') {
      setPersonaActual('acreditado');
      setMode('revision');
      return;
    }
    setMode('revision');
  }

  // ── Generar PDF ────────────────────────────────────────────────────────────
  async function generar() {
    setMode('generando');
    try {
      // Si el usuario no tocó "Honorarios (monto)" a mano, se calcula aquí
      // a partir de monto + % (ver calcularHonorarios).
      const honorariosMontoFinal = honorariosMonto || calcularHonorarios(montoCredito, honorariosPorcentaje);

      const config = await getContratoConfig();
      const html = renderPrestacionServiciosHtml({
        folio:                 folio || folioAuto(),
        acreditado:            acreditado.nombre,
        curp:                  acreditado.curp,
        rfc:                   acreditado.rfc,
        nss,
        claveElector,
        domAcreditado:         acreditado.domicilio,
        tipoTramite:           tipoTramite || 'Crédito',
        montoCredito:          montoCredito ? Number(montoCredito) : null,
        honorariosPorcentaje:  honorariosPorcentaje ? Number(honorariosPorcentaje) : null,
        honorariosMonto:       honorariosMontoFinal ? Number(honorariosMontoFinal) : null,
        obligadoSolidario:     solidario.nombre,
        ciudad,
      }, config);

      const { uri } = await Print.printToFileAsync({ html, ...DIMENSIONES_PAPEL[tamanoPapel] });
      const nombreArchivo  = `contrato_${folio || Date.now()}.pdf`;
      const uriPersistida  = await persistirDocumento(uri, nombreArchivo);

      const entradaHistorial = await guardarContratoGenerado({
        expedienteId:      expediente?.id ?? null,
        folio,
        clienteNombre:     acreditado.nombre || 'Sin nombre',
        fileUri:           uriPersistida,
        ineAcreditadoUri:  acreditadoFotoUri,
        ineSolidarioUri:   solidarioFotoUri,
      });

      // Guardar el contrato (PDF + fotos de INE) como historial en el
      // backend — independiente del expediente. En campo suele haber poca
      // o nula señal, así que si falla o está offline se encola y se sube
      // solo apenas haya conexión (ver paso 8 de sincronizar() en offline.ts).
      const paramsContratoBackend = {
        localId:                 entradaHistorial.id,
        folio,
        tipoTramite,
        ciudad,
        acreditadoNombre:        acreditado.nombre,
        acreditadoCurp:          acreditado.curp,
        acreditadoRfc:           acreditado.rfc,
        acreditadoNss:           nss,
        acreditadoClaveElector:  claveElector,
        acreditadoDomicilio:     acreditado.domicilio,
        solidarioNombre:         solidario.nombre,
        solidarioCurp:           solidario.curp,
        solidarioRfc:            solidario.rfc,
        solidarioDomicilio:      solidario.domicilio,
        montoCredito:            montoCredito ? Number(montoCredito) : null,
        honorariosPorcentaje:    honorariosPorcentaje ? Number(honorariosPorcentaje) : null,
        honorariosMonto:         honorariosMontoFinal ? Number(honorariosMontoFinal) : null,
        pdfUri:                  uriPersistida,
        ineAcreditadoUri:        acreditadoFotoUri,
        ineSolidarioUri:         solidarioFotoUri,
      };
      try {
        if (online) {
          await uploadContratoGenerado(paramsContratoBackend);
        } else {
          await encolarContrato({ ...paramsContratoBackend, id_local: entradaHistorial.id });
        }
      } catch {
        await encolarContrato({ ...paramsContratoBackend, id_local: entradaHistorial.id }).catch(() => {});
      }

      // Si el contrato viene vinculado a un expediente, además se sube ahí
      // para que el acreditado lo vea en su pestaña Documentos. Si no hay
      // expediente, el contrato queda solo en el historial del dispositivo.
      if (expediente) {
        try {
          if (online) {
            await uploadDocumento(expediente.id, uriPersistida, CONTRATO_TIPO_DOCUMENTO, 'Generado desde la app', 'application/pdf', 'otros');
          } else {
            await encolarDoc({
              expedienteId: expediente.id,
              uri:          uriPersistida,
              tipo:         CONTRATO_TIPO_DOCUMENTO,
              seccion:      'otros',
              mimeType:     'application/pdf',
              notas:        'Generado desde la app',
            });
          }
        } catch {
          await encolarDoc({
            expedienteId: expediente.id,
            uri:          uriPersistida,
            tipo:         CONTRATO_TIPO_DOCUMENTO,
            seccion:      'otros',
            mimeType:     'application/pdf',
            notas:        'Generado desde la app',
          }).catch(() => {});
        }
      }

      setPdfUri(uriPersistida);
      setMode('listo');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo generar el contrato.');
      setMode('datos-tramite');
    }
  }

  async function verPdf() {
    if (!pdfUri) return;
    try { await Print.printAsync({ uri: pdfUri }); } catch { /* usuario canceló */ }
  }

  async function compartirPdf() {
    if (!pdfUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch { /* usuario canceló */ }
  }

  // ── Render: captura de INE (acreditado o solidario) ───────────────────────
  if (mode === 'captura') {
    const esAcreditado = personaActual === 'acreditado';
    return (
      <View style={s.flex} key={`captura-${personaActual}`}>
        <Header
          title={esAcreditado ? 'Registrar contrato' : 'Obligado solidario'}
          subtitle={expediente?.folio ?? undefined}
          onBack={esAcreditado ? () => router.back() : volverAPersonaAnterior}
        />
        <View style={s.body}>
          {cargandoExpediente ? (
            <ActivityIndicator size="large" color={Colors.gold[400]} />
          ) : (
            <>
              <Ionicons name="card-outline" size={48} color={Colors.gold[400]} />
              <Text style={s.title}>
                {esAcreditado ? 'Captura la INE del acreditado' : 'Captura la INE del obligado solidario'}
              </Text>
              <Text style={s.subtitle}>
                {ocrDisponible()
                  ? 'La app leerá el CURP, nombre y domicilio de la credencial. Podrás revisar y corregir los datos antes de generar el contrato, o capturarlos a mano.'
                  : 'El reconocimiento automático de datos no está disponible en esta versión de la app (requiere un development build, no funciona en Expo Go). Toma la foto para guardarla como referencia y usa "Capturar datos manualmente" para llenar los campos.'}
              </Text>
              {ocrDisponible() && (
                <Text style={s.tipReflejo}>
                  💡 La INE es de plástico brillante — inclínala un poco o aléjate de luces directas para
                  evitar reflejos sobre el nombre y el CURP, si no el reconocimiento puede fallar ahí.
                </Text>
              )}

              <View style={{ gap: Spacing.sm, marginTop: Spacing.xl, alignSelf: 'stretch' }}>
                <Button label="📸 Tomar foto" onPress={tomarFoto} fullWidth />
                <Button label="🖼 Elegir de galería" onPress={elegirGaleria} variant="outline" fullWidth />
                <Button label="✍️ Capturar datos manualmente" onPress={capturarManual} variant="ghost" fullWidth />
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  // ── Render: leyendo OCR ────────────────────────────────────────────────────
  if (mode === 'ocr') {
    return (
      <View style={[s.flex, s.centered]} key="ocr">
        <ActivityIndicator size="large" color={Colors.gold[400]} />
        <Text style={s.loadingText}>Leyendo INE…</Text>
      </View>
    );
  }

  // ── Render: formulario de revisión (acreditado o solidario) ──────────────
  if (mode === 'revision') {
    const esAcreditado = personaActual === 'acreditado';
    return (
      // key: sin esto, React reutiliza por posición los TextInput nativos de
      // esta pantalla al pasar a "datos-tramite" (mismo árbol raíz:
      // KeyboardAvoidingView > Header + ScrollView). Reciclaba, por ejemplo,
      // el campo RFC como "Monto del crédito" y el campo Domicilio (que es
      // multiline) como "Honorarios %" — cambiar `multiline` en una instancia
      // de TextInput ya montada la deja sin aceptar texto en iOS. El `key`
      // fuerza a React a desmontar y montar de cero al cambiar de pantalla.
      <KeyboardAvoidingView style={s.flex} key={`revision-${personaActual}`}>
        <Header
          title={esAcreditado ? 'Revisar datos del acreditado' : 'Revisar datos del solidario'}
          subtitle="Confirma antes de continuar"
          onBack={volverACaptura}
        />
        <ScrollView
          contentContainerStyle={s.formBody}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <Text style={s.ocrHint}>
            {ocrDatos.nombre || ocrDatos.curp || ocrDatos.domicilio
              ? 'Los datos se leyeron de la INE — revisa que sean correctos antes de continuar.'
              : 'Captura los datos a mano.'}
            {esAcreditado ? ' La RFC no viene impresa en la INE.' : ''}
          </Text>

          {(esAcreditado ? acreditadoFotoUri : solidarioFotoUri) && (
            <View style={s.fotoPreviewCard}>
              <Text style={s.fotoPreviewLabel}>Foto capturada — revisa que se lea bien</Text>
              <Image
                source={{ uri: (esAcreditado ? acreditadoFotoUri : solidarioFotoUri)! }}
                style={s.fotoPreview}
                resizeMode="contain"
              />
              <Button label="🔄 Volver a tomar foto" onPress={volverACaptura} variant="ghost" size="sm" />
            </View>
          )}

          <Input
            label="Nombre completo"
            dark
            value={datosPersonaActual.nombre}
            onChangeText={v => setDatosPersonaActual(d => ({ ...d, nombre: v }))}
            autoCapitalize="characters"
          />
          <Input
            label="CURP"
            dark
            value={datosPersonaActual.curp}
            onChangeText={v => setDatosPersonaActual(d => ({ ...d, curp: v }))}
            autoCapitalize="characters"
            maxLength={18}
          />
          <Input
            label="RFC"
            dark
            value={datosPersonaActual.rfc}
            onChangeText={v => setDatosPersonaActual(d => ({ ...d, rfc: v }))}
            autoCapitalize="characters"
            maxLength={13}
          />
          {esAcreditado && (
            <>
              <Input label="NSS (número de seguridad social)" dark value={nss} onChangeText={setNss} keyboardType="number-pad" />
              <Input label="Clave de elector" dark value={claveElector} onChangeText={setClaveElector} autoCapitalize="characters" maxLength={18} />
            </>
          )}
          <Input
            label="Domicilio"
            dark
            value={datosPersonaActual.domicilio}
            onChangeText={v => setDatosPersonaActual(d => ({ ...d, domicilio: v }))}
            multiline
            numberOfLines={2}
          />

          <Button label="Continuar" onPress={continuarDesdeRevision} fullWidth style={{ marginTop: Spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: datos del trámite ──────────────────────────────────────────────
  if (mode === 'datos-tramite') {
    return (
      // key: ver la nota en el bloque "revision" — sin esto React reciclaba
      // por posición los TextInput de la pantalla anterior.
      <KeyboardAvoidingView style={s.flex} key="datos-tramite">
        <Header title="Datos del trámite" subtitle="Confirma antes de generar" onBack={() => { setPersonaActual('solidario'); setMode('revision'); }} />
        <ScrollView
          contentContainerStyle={s.formBody}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <Input label="Folio" dark value={folio} onChangeText={setFolio} autoCapitalize="characters" />
          <Input label="Tipo de trámite" dark value={tipoTramite} onChangeText={setTipoTramite} placeholder="Ej. Crédito FOVISSSTE" placeholderTextColor={Colors.dark[400]} />
          <Input label="Ciudad" dark value={ciudad} onChangeText={setCiudad} />
          <Input
            label="Monto del crédito"
            dark
            value={montoCredito}
            onChangeText={v => setMontoCredito(filtrarNumerico(v))}
          />
          <Input
            label="Honorarios (%)"
            dark
            value={honorariosPorcentaje}
            onChangeText={v => setHonorariosPorcentaje(filtrarNumerico(v))}
          />
          <Input
            label="Honorarios (monto)"
            dark
            value={honorariosMonto}
            onChangeText={v => setHonorariosMonto(filtrarNumerico(v))}
            hint="Si lo dejas vacío, se calcula solo con el monto y el % al generar el contrato."
          />

          <Text style={[s.fieldLabel, { marginTop: Spacing.base }]}>Tamaño de hoja</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Button
              label="Oficio"
              onPress={() => setTamanoPapel('oficio')}
              variant={tamanoPapel === 'oficio' ? 'gold' : 'outline'}
              style={{ flex: 1 }}
            />
            <Button
              label="Carta"
              onPress={() => setTamanoPapel('carta')}
              variant={tamanoPapel === 'carta' ? 'gold' : 'outline'}
              style={{ flex: 1 }}
            />
          </View>

          <Button label="Generar contrato" onPress={generar} fullWidth style={{ marginTop: Spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: generando PDF ─────────────────────────────────────────────────
  if (mode === 'generando') {
    return (
      <View style={[s.flex, s.centered]} key="generando">
        <ActivityIndicator size="large" color={Colors.gold[400]} />
        <Text style={s.loadingText}>Generando contrato…</Text>
      </View>
    );
  }

  // ── Render: listo ──────────────────────────────────────────────────────────
  return (
    <View style={s.flex} key="listo">
      <Header title="Contrato generado" onBack={() => router.replace('/contratos')} />
      <View style={s.body}>
        <Ionicons name="checkmark-circle" size={56} color={Colors.gold[400]} />
        <Text style={s.title}>¡Contrato guardado!</Text>
        <Text style={s.subtitle}>Quedó guardado en "Contratos" para que lo consultes cuando quieras.</Text>

        <View style={{ gap: Spacing.sm, marginTop: Spacing.xl, alignSelf: 'stretch' }}>
          <Button label="Ver / Imprimir" onPress={verPdf} fullWidth />
          <Button label="Compartir" onPress={compartirPdf} variant="outline" fullWidth />
          <Button label="Volver a Contratos" onPress={() => router.replace('/contratos')} variant="ghost" fullWidth />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900] },
  centered: { alignItems: 'center', justifyContent: 'center', gap: Spacing.base },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },

  title:    { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50], marginTop: Spacing.base, textAlign: 'center' },
  subtitle: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  tipReflejo: { fontSize: Typography.fontSize.xs, color: Colors.gold[400], textAlign: 'center', marginTop: Spacing.sm, lineHeight: 17, paddingHorizontal: Spacing.base },
  loadingText: { fontSize: Typography.fontSize.base, color: Colors.cream[200], fontWeight: Typography.fontWeight.semibold },

  formBody: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  ocrHint: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginBottom: Spacing.base, lineHeight: 18 },
  fieldLabel: {
    fontSize:      Typography.fontSize.sm,
    fontWeight:    Typography.fontWeight.semibold,
    color:         Colors.cream[200],
    marginBottom:  Spacing.xs,
    letterSpacing: Typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },

  fotoPreviewCard: { backgroundColor: Colors.dark[800], borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.base, gap: Spacing.xs },
  fotoPreviewLabel: { fontSize: Typography.fontSize.xs, color: Colors.cream[200], fontWeight: Typography.fontWeight.semibold },
  fotoPreview: { width: '100%', height: 220, borderRadius: Radius.sm, backgroundColor: Colors.dark[900] },
});
