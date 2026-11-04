/**
 * Subir documento (gestor): escanear (se arma un PDF), foto o PDF/Word.
 * Sin señal se guarda en el teléfono y se sube solo después.
 */
import type DocScannerT from 'react-native-document-scanner-plugin';
import type RNImageToPdfT from 'react-native-image-to-pdf';

let DocumentScanner: typeof DocScannerT | null = null;
let RNImageToPdf: typeof RNImageToPdfT | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DocumentScanner = (require('react-native-document-scanner-plugin') as { default: typeof DocScannerT }).default;
} catch { /* no disponible en Expo Go */ }
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RNImageToPdf = (require('react-native-image-to-pdf') as { default: typeof RNImageToPdfT }).default;
} catch { /* no disponible en Expo Go */ }

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { comprimirFoto, persistirDocumento } from '@/src/utils/comprimirFoto';
import { subirDocumento } from '@/src/services/gestorApi';

const SUGERENCIAS = [
  'Certificado de libertad de gravamen', 'Avalúo catastral', 'Constancia de no adeudo',
  'Recibo de pago', 'Acuse', 'Plano', 'Escritura',
];

const MIME_WORD = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const stripFilePrefix = (uri: string) => uri.replace(/^file:\/\//, '');
const toFileUri = (p: string) => (p.startsWith('file://') ? p : `file://${p}`);

interface Archivo { uri: string; nombre: string; mime: string; detalle: string }

export default function SubirGestorScreen() {
  const params = useLocalSearchParams<{ encargoId: string; folio?: string; reemplazaId?: string; tipo?: string }>();
  const encargoId = Number(params.encargoId);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tipo, setTipo]       = useState(params.tipo ?? '');
  const [notas, setNotas]     = useState('');
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [subiendo, setSubiendo]     = useState(false);

  async function escanear() {
    if (!DocumentScanner || !RNImageToPdf) {
      Alert.alert('Escáner no disponible', 'Usa Foto o PDF o Word.');
      return;
    }
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({ croppedImageQuality: 90, maxNumDocuments: 15 });
      if (!scannedImages?.length) return;
      setProcesando(true);
      const { filePath } = await RNImageToPdf.createPDFbyImages({ imagePaths: scannedImages.map(stripFilePrefix), name: `gestor_${Date.now()}` });
      setArchivo({ uri: toFileUri(filePath), nombre: 'escaneo.pdf', mime: 'application/pdf', detalle: `PDF · ${scannedImages.length} página${scannedImages.length === 1 ? '' : 's'}` });
    } catch (e) {
      Alert.alert('Error al escanear', e instanceof Error ? e.message : '');
    } finally {
      setProcesando(false);
    }
  }

  async function foto() {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) { Alert.alert('Permiso necesario', 'Permite el acceso a la cámara para tomar la foto.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (r.canceled || !r.assets?.[0]) return;
    setProcesando(true);
    try {
      const f = await comprimirFoto(r.assets[0].uri, 'gestor');
      setArchivo({ uri: f.uri, nombre: f.name, mime: 'image/jpeg', detalle: 'Foto' });
    } finally {
      setProcesando(false);
    }
  }

  async function elegirArchivo() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', ...MIME_WORD], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    const n = (a.name ?? '').toLowerCase();
    const mime = a.mimeType ?? (n.endsWith('.pdf') ? 'application/pdf' : n.endsWith('.doc') ? MIME_WORD[0] : MIME_WORD[1]);
    const mb = a.size ? ` · ${(a.size / 1_048_576).toFixed(1)} MB` : '';
    if (a.size && a.size > 20 * 1_048_576) { Alert.alert('Archivo muy pesado', 'El archivo no puede pesar más de 20 MB.'); return; }
    setArchivo({ uri: a.uri, nombre: a.name ?? 'documento', mime, detalle: (mime === 'application/pdf' ? 'PDF' : 'Word') + mb });
  }

  async function subir() {
    if (!archivo || !tipo.trim()) return;
    setSubiendo(true);
    try {
      const ext = archivo.mime === 'application/pdf' ? 'pdf' : archivo.mime === 'image/jpeg' ? 'jpg' : archivo.nombre.toLowerCase().endsWith('.doc') ? 'doc' : 'docx';
      const nombre = `gestor_${Date.now()}.${ext}`;
      const uri = archivo.mime === 'image/jpeg' ? archivo.uri : await persistirDocumento(archivo.uri, nombre);
      const r = await subirDocumento({
        encargoId, uri, nombreArchivo: nombre, mimeType: archivo.mime, tipo: tipo.trim(),
        notas: notas.trim() || undefined, reemplazaId: params.reemplazaId ? Number(params.reemplazaId) : undefined,
      });
      Alert.alert(
        r === 'subido' ? 'Documento subido' : 'Guardado sin señal',
        r === 'subido' ? 'Avisamos a la administración para que lo revise.' : 'Se subirá solo cuando regrese la señal.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert('No se pudo subir', e instanceof Error ? e.message : '');
    } finally {
      setSubiendo(false);
    }
  }

  const listo = !!archivo && tipo.trim().length > 0;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Cerrar"><Ionicons name="close" size={24} color={Colors.cream[50]} /></TouchableOpacity>
          <View style={{ flex: 1 }}>
            {!!params.folio && <Text style={s.headerSub}>{params.folio}</Text>}
            <Text style={s.headerTitle}>{params.reemplazaId ? 'Volver a subir' : 'Subir documento'}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>¿QUÉ DOCUMENTO ES?</Text>
        <View style={s.chips}>
          {SUGERENCIAS.map(t => (
            <TouchableOpacity key={t} style={[s.chip, tipo === t && s.chipOn]} onPress={() => setTipo(t)}>
              <Text style={[s.chipText, tipo === t && s.chipTextOn]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={s.input} placeholder="U escribe el nombre del documento" placeholderTextColor={Colors.dark[400]} value={tipo} onChangeText={setTipo} maxLength={120} />

        <Text style={s.label}>ARCHIVO</Text>
        <View style={s.fuentes}>
          {([['scan-outline', 'Escanear', escanear], ['camera-outline', 'Foto', foto], ['document-attach-outline', 'PDF o Word', elegirArchivo]] as const).map(([icon, l, fn]) => (
            <TouchableOpacity key={l} style={s.fuente} onPress={fn} disabled={procesando || subiendo}>
              <Ionicons name={icon} size={24} color={Colors.gold[700]} />
              <Text style={s.fuenteText}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {procesando && <ActivityIndicator color={Colors.gold[400]} />}
        {archivo && (
          <View style={s.preview}>
            <Ionicons name={archivo.mime.startsWith('image') ? 'image-outline' : archivo.mime === 'application/pdf' ? 'document-text-outline' : 'document-outline'} size={28} color={Colors.dark[500]} />
            <View style={{ flex: 1 }}>
              <Text style={s.previewName} numberOfLines={1}>{archivo.nombre}</Text>
              <Text style={s.muted}>{archivo.detalle}</Text>
            </View>
            <TouchableOpacity onPress={() => setArchivo(null)} hitSlop={10}><Ionicons name="trash-outline" size={20} color={Colors.dark[400]} /></TouchableOpacity>
          </View>
        )}

        <Text style={s.label}>NOTA PARA LA ADMINISTRACIÓN (OPCIONAL)</Text>
        <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Ej: Sale sin gravámenes. El original lo llevo el lunes." placeholderTextColor={Colors.dark[400]} value={notas} onChangeText={setNotas} multiline maxLength={500} />

        <View style={s.aviso}>
          <Ionicons name="cloud-offline-outline" size={16} color={Colors.dark[600]} />
          <Text style={s.avisoText}>Si no hay señal, el documento se guarda en el teléfono y se sube solo cuando regrese.</Text>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TouchableOpacity style={[s.btn, !listo && s.btnOff]} onPress={subir} disabled={!listo || subiendo}>
          {subiendo ? <ActivityIndicator color={Colors.dark[900]} /> : (
            <><Ionicons name="cloud-upload" size={18} color={listo ? Colors.dark[900] : Colors.dark[400]} />
              <Text style={[s.btnText, !listo && { color: Colors.dark[400] }]}>SUBIR</Text></>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: Colors.cream[50] },
  header:      { backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.base, paddingBottom: Spacing.md },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerSub:   { fontSize: Typography.fontSize.xs, color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold, letterSpacing: 2 },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.black, color: Colors.cream[50] },
  body:        { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  label:       { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, letterSpacing: 1.5, color: Colors.dark[400], marginTop: Spacing.sm },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:        { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.white },
  chipOn:      { borderColor: Colors.gold[400], backgroundColor: Colors.gold[50] },
  chipText:    { fontSize: Typography.fontSize.sm, color: Colors.dark[700] },
  chipTextOn:  { color: Colors.gold[700], fontWeight: Typography.fontWeight.bold },
  input:       { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300], borderRadius: Radius.sm, padding: Spacing.md, fontSize: Typography.fontSize.sm, color: Colors.dark[800] },
  fuentes:     { flexDirection: 'row', gap: Spacing.sm },
  fuente:      { flex: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.base, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.white },
  fuenteText:  { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[700] },
  preview:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.white },
  previewName: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800] },
  muted:       { fontSize: Typography.fontSize.xs, color: Colors.dark[400] },
  aviso:       { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.cream[100], borderRadius: Radius.sm, padding: Spacing.md, marginTop: Spacing.sm },
  avisoText:   { flex: 1, fontSize: Typography.fontSize.xs, color: Colors.dark[600], lineHeight: Typography.fontSize.xs * 1.4 },
  footer:      { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.cream[300] },
  btn:         { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.gold[400], borderRadius: Radius.sm, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  btnOff:      { backgroundColor: Colors.cream[200] },
  btnText:     { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.extrabold, letterSpacing: 1, color: Colors.dark[900] },
});
