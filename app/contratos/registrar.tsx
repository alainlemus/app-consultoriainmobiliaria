/**
 * Pantalla: Registrar contrato
 * Ruta: /contratos/registrar?expedienteId=X (expedienteId opcional)
 *
 * Flujo (la captura de la INE es siempre el primer paso, independiente de
 * elegir expediente — si se llega sin expedienteId, se pide después de
 * escanear/cargar, no antes):
 *  1. Capturar la INE del acreditado (escanear / cámara / galería).
 *  2. OCR on-device (CURP confiable; nombre/domicilio heurísticos).
 *  3. Si no vino expedienteId → elegir a qué expediente pertenece esta INE.
 *  4. Formulario de revisión — todo editable, precargado por OCR con
 *     fallback a los datos ya guardados en el expediente.
 *  5. Generar el PDF (100% local), guardarlo en el dispositivo y en el
 *     historial de "Contratos generados".
 */

// ── Import nativo condicional del escáner (igual que documentos/subir.tsx) ──
import type DocScannerT from 'react-native-document-scanner-plugin';
// eslint-disable-next-line @typescript-eslint/no-require-imports
let DocumentScanner: typeof DocScannerT | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DocumentScanner = (require('react-native-document-scanner-plugin') as { default: typeof DocScannerT }).default;
} catch { /* no disponible en Expo Go */ }

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, FlatList, TextInput,
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
import { getExpedientes, getExpediente } from '@/src/services/api';
import { getContratoConfig, renderPrestacionServiciosHtml } from '@/src/contratos/prestacionServicios';
import { reconocerIne, type DatosIneOcr } from '@/src/utils/ineOcr';
import { persistirDocumento } from '@/src/utils/comprimirFoto';
import { guardarContratoGenerado } from '@/src/services/contratosGenerados';
import type { Expediente } from '@/src/types';

type Mode = 'captura' | 'ocr' | 'expediente' | 'revision' | 'generando' | 'listo';

export default function RegistrarContratoScreen() {
  const router = useRouter();
  const { expedienteId: expedienteIdParam } = useLocalSearchParams<{ expedienteId?: string }>();

  // La captura de la INE siempre es el primer paso, sin importar si ya se
  // sabe el expediente (viene por parámetro) o se elegirá después.
  const [mode, setMode]             = useState<Mode>('captura');
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [cargandoExpediente, setCargandoExpediente] = useState(!!expedienteIdParam);

  // Selector de expediente
  const [busqueda,      setBusqueda]      = useState('');
  const [lista,         setLista]         = useState<Expediente[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  // Datos leídos por OCR (se guardan aparte para poder re-aplicarlos con
  // fallback al expediente en cuanto se elige, si no vino por parámetro)
  const [ocrDatos, setOcrDatos] = useState<DatosIneOcr>({});

  // Formulario de revisión
  const [nombre,    setNombre]    = useState('');
  const [curp,      setCurp]      = useState('');
  const [rfc,       setRfc]       = useState('');
  const [domicilio, setDomicilio] = useState('');

  const [pdfUri, setPdfUri] = useState<string | null>(null);

  // ── Cargar expediente cuando viene por parámetro ──────────────────────────
  useEffect(() => {
    if (!expedienteIdParam) return;
    (async () => {
      try {
        const exp = await getExpediente(Number(expedienteIdParam));
        setExpediente(exp);
      } catch {
        Alert.alert('Error', 'No se pudo cargar el expediente.', [{ text: 'OK', onPress: () => router.back() }]);
      } finally {
        setCargandoExpediente(false);
      }
    })();
  }, [expedienteIdParam]);

  // ── Cargar lista de expedientes para elegir ───────────────────────────────
  useEffect(() => {
    if (mode !== 'expediente') return;
    (async () => {
      setCargandoLista(true);
      try {
        const res = await getExpedientes();
        setLista(res.data);
      } catch {
        // sin conexión — lista vacía, el asesor puede reintentar
      } finally {
        setCargandoLista(false);
      }
    })();
  }, [mode]);

  const listaFiltrada = lista.filter(e => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (e.folio ?? '').toLowerCase().includes(q) || (e.contacto?.nombre ?? '').toLowerCase().includes(q);
  });

  /** Precarga el formulario: OCR primero, si falta el dato cae al expediente. */
  function aplicarDatos(datos: DatosIneOcr, exp: Expediente | null) {
    setNombre(datos.nombre || exp?.acreditado_nombre || '');
    setCurp(datos.curp || exp?.acreditado_curp || '');
    // La RFC nunca está impresa en la INE — siempre viene del expediente
    setRfc(exp?.acreditado_rfc || '');
    setDomicilio(datos.domicilio || exp?.acreditado_domicilio || '');
  }

  function seleccionarExpediente(exp: Expediente) {
    setExpediente(exp);
    aplicarDatos(ocrDatos, exp);
    setMode('revision');
  }

  // ── Captura de la INE ──────────────────────────────────────────────────────
  async function escanear() {
    if (!DocumentScanner) return;
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({ croppedImageQuality: 90, maxNumDocuments: 1 });
      if (!scannedImages || scannedImages.length === 0) return;
      await procesarImagen(scannedImages[0]);
    } catch (e: unknown) {
      Alert.alert('Error al escanear', e instanceof Error ? e.message : 'Error desconocido');
    }
  }

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
    const datos = await reconocerIne(uri);
    setOcrDatos(datos);
    aplicarDatos(datos, expediente);
    // Si ya sabemos el expediente (vino por parámetro) vamos directo a revisar;
    // si no, primero hay que elegir a quién pertenece esta INE.
    setMode(expediente ? 'revision' : 'expediente');
  }

  // ── Generar PDF ────────────────────────────────────────────────────────────
  async function generar() {
    if (!expediente) return;
    setMode('generando');
    try {
      const config = await getContratoConfig();
      const html = renderPrestacionServiciosHtml({
        folio:                 expediente.folio ?? `EXP-${expediente.id}`,
        acreditado:            nombre,
        curp,
        rfc,
        domAcreditado:         domicilio,
        tipoTramite:           expediente.tipo_tramite?.nombre ?? 'Crédito',
        montoCredito:          expediente.monto_credito,
        honorariosPorcentaje:  expediente.honorarios_porcentaje,
        honorariosMonto:       expediente.honorarios_monto,
        obligadoSolidario:     expediente.obligado_solidario_nombre,
      }, config);

      const { uri } = await Print.printToFileAsync({ html });
      const nombreArchivo  = `contrato_${expediente.folio ?? expediente.id}_${Date.now()}.pdf`;
      const uriPersistida  = await persistirDocumento(uri, nombreArchivo);

      await guardarContratoGenerado({
        expedienteId:  expediente.id,
        folio:         expediente.folio,
        clienteNombre: nombre || expediente.contacto?.nombre || 'Sin nombre',
        fileUri:       uriPersistida,
      });

      setPdfUri(uriPersistida);
      setMode('listo');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo generar el contrato.');
      setMode('revision');
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

  // ── Render: selector de expediente (después de capturar la INE) ──────────
  if (mode === 'expediente') {
    return (
      <View style={s.flex}>
        <Header title="¿A qué expediente pertenece?" subtitle="Vincula esta INE" onBack={() => setMode('captura')} />
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={Colors.dark[400]} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por folio o cliente…"
            placeholderTextColor={Colors.dark[400]}
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
        {cargandoLista ? (
          <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing.xl }} />
        ) : (
          <FlatList
            data={listaFiltrada}
            keyExtractor={e => String(e.id)}
            contentContainerStyle={s.list}
            ListEmptyComponent={<Text style={s.emptyText}>Sin expedientes.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.expRow} onPress={() => seleccionarExpediente(item)} activeOpacity={0.75}>
                <View style={{ flex: 1 }}>
                  <Text style={s.expNombre} numberOfLines={1}>{item.contacto?.nombre ?? 'Sin nombre'}</Text>
                  <Text style={s.expSub}>{item.folio ?? `Exp. #${item.id}`} · {item.tipo_tramite?.nombre ?? '—'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.dark[500]} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ── Render: captura de INE (siempre el primer paso) ───────────────────────
  if (mode === 'captura') {
    return (
      <View style={s.flex}>
        <Header title="Registrar contrato" subtitle={expediente?.folio ?? undefined} onBack={() => router.back()} />
        <View style={s.body}>
          {cargandoExpediente ? (
            <ActivityIndicator size="large" color={Colors.gold[400]} />
          ) : (
            <>
              <Ionicons name="card-outline" size={48} color={Colors.gold[400]} />
              <Text style={s.title}>Captura la INE del acreditado</Text>
              <Text style={s.subtitle}>
                La app leerá el CURP, nombre y domicilio de la credencial. Podrás revisar y
                corregir los datos, y elegir el expediente, antes de generar el contrato.
              </Text>

              <View style={{ gap: Spacing.sm, marginTop: Spacing.xl, alignSelf: 'stretch' }}>
                {DocumentScanner && (
                  <Button label="📷 Escanear INE" onPress={escanear} fullWidth />
                )}
                <Button label="📸 Tomar foto" onPress={tomarFoto} variant={DocumentScanner ? 'outline' : 'gold'} fullWidth />
                <Button label="🖼 Elegir de galería" onPress={elegirGaleria} variant="outline" fullWidth />
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
      <View style={[s.flex, s.centered]}>
        <ActivityIndicator size="large" color={Colors.gold[400]} />
        <Text style={s.loadingText}>Leyendo INE…</Text>
      </View>
    );
  }

  // ── Render: formulario de revisión ────────────────────────────────────────
  if (mode === 'revision') {
    return (
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="Revisar datos" subtitle="Confirma antes de generar" onBack={() => setMode('captura')} />
        <ScrollView contentContainerStyle={s.formBody} keyboardShouldPersistTaps="handled">
          <Text style={s.ocrHint}>
            Los datos se leyeron de la INE — revisa que sean correctos, especialmente el
            nombre y domicilio, antes de continuar. La RFC no viene impresa en la INE.
          </Text>

          <Input label="Nombre completo" dark value={nombre} onChangeText={setNombre} autoCapitalize="characters" />
          <Input label="CURP" dark value={curp} onChangeText={setCurp} autoCapitalize="characters" maxLength={18} />
          <Input label="RFC" dark value={rfc} onChangeText={setRfc} autoCapitalize="characters" maxLength={13} />
          <Input label="Domicilio" dark value={domicilio} onChangeText={setDomicilio} multiline numberOfLines={2} />

          <View style={s.infoCard}>
            <Text style={s.infoLabel}>Folio</Text>
            <Text style={s.infoValue}>{expediente?.folio ?? `Exp. #${expediente?.id}`}</Text>
            <Text style={s.infoLabel}>Trámite</Text>
            <Text style={s.infoValue}>{expediente?.tipo_tramite?.nombre ?? '—'}</Text>
          </View>

          <Button label="Generar contrato" onPress={generar} fullWidth style={{ marginTop: Spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: generando PDF ─────────────────────────────────────────────────
  if (mode === 'generando') {
    return (
      <View style={[s.flex, s.centered]}>
        <ActivityIndicator size="large" color={Colors.gold[400]} />
        <Text style={s.loadingText}>Generando contrato…</Text>
      </View>
    );
  }

  // ── Render: listo ──────────────────────────────────────────────────────────
  return (
    <View style={s.flex}>
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
  loadingText: { fontSize: Typography.fontSize.base, color: Colors.cream[200], fontWeight: Typography.fontWeight.semibold },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.base, marginTop: Spacing.sm,
    backgroundColor: Colors.dark[800], borderRadius: Radius.md, paddingHorizontal: Spacing.base,
  },
  searchInput: { flex: 1, color: Colors.cream[50], paddingVertical: Spacing.sm, fontSize: Typography.fontSize.sm },
  list: { padding: Spacing.base, gap: Spacing.sm },
  emptyText: { color: Colors.dark[400], textAlign: 'center', marginTop: Spacing.xl },
  expRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.dark[800], borderRadius: Radius.lg, padding: Spacing.base,
  },
  expNombre: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50] },
  expSub:    { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },

  formBody: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  ocrHint: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginBottom: Spacing.base, lineHeight: 18 },
  infoCard: { backgroundColor: Colors.dark[800], borderRadius: Radius.md, padding: Spacing.base, marginTop: Spacing.sm, gap: 2 },
  infoLabel: { fontSize: Typography.fontSize.xs, color: Colors.dark[500], textTransform: 'uppercase', marginTop: Spacing.xs },
  infoValue: { fontSize: Typography.fontSize.sm, color: Colors.cream[100], fontWeight: Typography.fontWeight.semibold },
});
