/**
 * Pantalla: Subir / Escanear Documento
 * Ruta: /expedientes/documentos/subir?expedienteId=X
 *
 * Flujo primario:  DocumentScanner nativo → N imágenes → PDF → preview → subir
 * Flujo secundario: Archivo → PDF u otro archivo → preview → subir
 *
 * Los módulos nativos (DocumentScanner, RNImageToPdf) se cargan con require()
 * dentro de un try-catch: si no están disponibles (Expo Go / simulador) el
 * componente carga igual y muestra la opción de archivo como única opción.
 * En producción (EAS Build) ambos módulos están compilados y el escáner funciona.
 */

// ── Imports nativos condicionales ─────────────────────────────────────────────
// type-only import: no genera código de runtime, solo tipos para TypeScript
import type DocScannerT  from 'react-native-document-scanner-plugin';
import type RNImageToPdfT from 'react-native-image-to-pdf';

// eslint-disable-next-line @typescript-eslint/no-require-imports
let DocumentScanner: typeof DocScannerT | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
let RNImageToPdf: typeof RNImageToPdfT | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DocumentScanner = (require('react-native-document-scanner-plugin') as { default: typeof DocScannerT }).default;
} catch { /* no disponible en Expo Go / simulador */ }

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RNImageToPdf = (require('react-native-image-to-pdf') as { default: typeof RNImageToPdfT }).default;
} catch { /* no disponible en Expo Go / simulador */ }

// ── Resto de imports ──────────────────────────────────────────────────────────
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { uploadDocumento } from '../../../src/services/api';
import { Colors, Radius, Spacing, Typography } from '../../../src/theme';
import { useSyncContext } from '../../../src/contexts/SyncContext';

const TIPOS_DOCUMENTO = [
  { value: 'identificacion_oficial', label: 'Identificación oficial' },
  { value: 'curp',                   label: 'CURP' },
  { value: 'comprobante_domicilio',  label: 'Comprobante domicilio' },
  { value: 'estado_cuenta',         label: 'Estado de cuenta' },
  { value: 'comprobante_ingresos',  label: 'Comprobante ingresos' },
  { value: 'acta_nacimiento',       label: 'Acta de nacimiento' },
  { value: 'poder_notarial',        label: 'Poder notarial' },
  { value: 'otro',                  label: 'Otro' },
] as const;

type TipoDocumento = typeof TIPOS_DOCUMENTO[number]['value'];
type Mode = 'selector' | 'processing' | 'preview';

/** Quita el prefijo `file://` — react-native-image-to-pdf espera paths absolutos */
const stripFilePrefix = (uri: string) => uri.replace(/^file:\/\//, '');

/** Garantiza que el URI tenga `file://` para FormData */
const toFileUri = (path: string) =>
  path.startsWith('file://') ? path : `file://${path}`;

export default function SubirDocumentoScreen() {
  const insets = useSafeAreaInsets();
  const { expedienteId, tipo: tipoParam, seccion: seccionParam } = useLocalSearchParams<{
    expedienteId: string;
    tipo?: string;
    seccion?: string;
  }>();

  const [tipo,  setTipo]  = useState<TipoDocumento>((tipoParam as TipoDocumento) ?? 'identificacion_oficial');
  const [notas, setNotas] = useState('');
  const { online, encolarDoc } = useSyncContext();

  const [mode,      setMode]      = useState<Mode>('selector');
  const [pages,     setPages]     = useState<string[]>([]);   // URIs de páginas escaneadas
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [mimeType,  setMimeType]  = useState<string>('application/pdf');
  const [uploading, setUploading] = useState(false);

  // ── Escanear con DocumentScanner nativo ──────────────────────────────────────
  const escanear = async () => {
    if (!DocumentScanner || !RNImageToPdf) {
      Alert.alert(
        'Escáner no disponible',
        'El escáner de documentos requiere un build nativo (EAS Build). Por ahora usa la opción Archivo.',
      );
      return;
    }
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        croppedImageQuality: 90,
        maxNumDocuments: 10, // hasta 10 páginas, sin auto-captura forzada
      });
      if (!scannedImages || scannedImages.length === 0) return; // usuario canceló

      setPages(scannedImages);
      setMode('processing');

      const nombre = `doc_${Date.now()}`;
      const { filePath } = await RNImageToPdf.createPDFbyImages({
        imagePaths: scannedImages.map(stripFilePrefix),
        name: nombre,
      });

      setResultUri(toFileUri(filePath));
      setMimeType('application/pdf');
      setMode('preview');
    } catch (err: unknown) {
      setMode('selector');
      Alert.alert('Error al escanear', err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  // ── Seleccionar archivo (PDF, imágenes, etc.) ─────────────────────────────────
  const seleccionarGaleria = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const uri = asset.uri;
      const mime = asset.mimeType ?? (asset.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      setPages([uri]);
      setResultUri(uri);
      setMimeType(mime);
      setMode('preview');
    } catch (err) {
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  };

  // ── Subir ─────────────────────────────────────────────────────────────────────
  const subir = async () => {
    if (!resultUri || !expedienteId) return;
    setUploading(true);
    try {
      if (!online) {
        // Sin internet: encolar el documento para subir después
        await encolarDoc({
          expedienteId: Number(expedienteId),
          uri:          resultUri,
          tipo,
          seccion:      seccionParam || undefined,
          mimeType,
          notas:        notas || undefined,
        });
        Alert.alert(
          'Guardado sin conexión',
          'El documento se subirá al expediente automáticamente cuando recuperes internet.',
          [{ text: 'Entendido', onPress: () => router.back() }],
        );
        return;
      }

      await uploadDocumento(Number(expedienteId), resultUri, tipo, notas || undefined, mimeType, seccionParam || undefined);
      Alert.alert('Listo', 'Documento subido correctamente.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error al subir', e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setUploading(false);
    }
  };

  const volverASelector = () => {
    setMode('selector');
    setPages([]);
    setResultUri(null);
  };

  // ── Procesando (convirtiendo a PDF) ──────────────────────────────────────────
  if (mode === 'processing') {
    return (
      <View style={[s.flex, s.centered, { backgroundColor: Colors.dark[900] }]}>
        <ActivityIndicator size="large" color={Colors.gold[400]} />
        <Text style={s.processingText}>Generando PDF…</Text>
        <Text style={s.processingSubText}>
          {pages.length} página{pages.length !== 1 ? 's' : ''}
        </Text>
      </View>
    );
  }

  // ── Preview ──────────────────────────────────────────────────────────────────
  if (mode === 'preview') {
    const esPdf = mimeType === 'application/pdf';
    return (
      <KeyboardAvoidingView
        style={[s.flex, { backgroundColor: Colors.cream[50] }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={volverASelector} style={s.backBtn}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={s.topTitle}>Revisar documento</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {esPdf ? (
            /* ── Vista previa PDF: miniaturas de páginas + badge ── */
            <View style={s.pdfPreview}>
              <View style={s.pdfThumbs}>
                {pages.slice(0, 3).map((uri, i) => (
                  <Image key={i} source={{ uri }} style={s.pdfThumb} resizeMode="cover" />
                ))}
                {pages.length > 3 && (
                  <View style={[s.pdfThumb, s.pdfThumbMore]}>
                    <Text style={s.pdfThumbMoreText}>+{pages.length - 3}</Text>
                  </View>
                )}
              </View>
              <View style={s.pdfBadge}>
                <Text style={s.pdfIcon}>📄</Text>
                <Text style={s.pdfLabel}>
                  PDF · {pages.length} página{pages.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          ) : (
            /* ── Vista previa imagen ── */
            <Image source={{ uri: resultUri! }} style={s.previewImg} resizeMode="contain" />
          )}

          <Text style={s.sectionLabel}>Tipo de documento</Text>
          {tipoParam ? (
            /* Tipo fijado desde el checklist — no se puede cambiar para garantizar que el
               documento quede ligado correctamente al requerido del expediente */
            <View style={s.tipoFijo}>
              <Text style={s.tipoFijoText}>{tipoParam}</Text>
            </View>
          ) : (
            <View style={s.chipWrap}>
              {TIPOS_DOCUMENTO.map(t => (
                <Pressable
                  key={t.value}
                  style={[s.chip, tipo === t.value && s.chipActivo]}
                  onPress={() => setTipo(t.value)}
                >
                  <Text style={[s.chipText, tipo === t.value && s.chipTextActivo]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={s.sectionLabel}>Notas (opcional)</Text>
          <TextInput
            style={s.input}
            placeholder="Descripción del documento…"
            placeholderTextColor={Colors.dark[400]}
            value={notas}
            onChangeText={setNotas}
            multiline
            numberOfLines={3}
          />

          <Pressable
            style={[s.btnSubir, uploading && s.btnDisabled]}
            onPress={subir}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.btnSubirText}>
                  {online ? 'Subir documento' : 'Guardar (sin conexión)'}
                </Text>
            }
          </Pressable>

          {!online && (
            <Text style={s.offlineHint}>
              Sin internet — el documento quedará guardado en tu dispositivo y se enviará al expediente cuando recuperes señal.
            </Text>
          )}

          <Pressable style={s.btnSecundario} onPress={volverASelector}>
            <Text style={s.btnSecundarioText}>← Volver a capturar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Selector ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: Colors.cream[50] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>Agregar documento</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionLabel}>Tipo de documento</Text>
        {tipoParam ? (
          <View style={s.tipoFijo}>
            <Text style={s.tipoFijoText}>{tipoParam}</Text>
          </View>
        ) : (
          <View style={s.chipWrap}>
            {TIPOS_DOCUMENTO.map(t => (
              <Pressable
                key={t.value}
                style={[s.chip, tipo === t.value && s.chipActivo]}
                onPress={() => setTipo(t.value)}
              >
                <Text style={[s.chipText, tipo === t.value && s.chipTextActivo]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={s.sectionLabel}>Notas (opcional)</Text>
        <TextInput
          style={s.input}
          placeholder="Ej: INE vigente, anverso y reverso"
          placeholderTextColor={Colors.dark[400]}
          value={notas}
          onChangeText={setNotas}
          multiline
          numberOfLines={3}
        />

        <View style={s.actions}>
          <Pressable style={s.btnEscanear} onPress={escanear}>
            <Text style={s.btnIcon}>📄</Text>
            <Text style={s.btnLabel}>Escanear documento</Text>
            <Text style={s.btnSubLabel}>
              {DocumentScanner ? 'Múltiples páginas → PDF' : 'Requiere EAS Build'}
            </Text>
          </Pressable>

          <Pressable style={s.btnGaleria} onPress={seleccionarGaleria}>
            <Text style={s.btnIcon}>📁</Text>
            <Text style={s.btnLabel}>Archivo</Text>
            <Text style={s.btnSubLabel}>Seleccionar archivo PDF</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex:     { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  processingText:    {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: 16,
  },
  processingSubText: { color: Colors.dark[400], fontSize: Typography.fontSize.sm },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.cream[300],
  },
  backBtn:  { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.dark[700] },
  topTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.dark[900],
  },

  body: { padding: Spacing.base },

  sectionLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.dark[500],
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cream[300],
    backgroundColor: Colors.white,
  },
  chipActivo:     { backgroundColor: Colors.dark[900], borderColor: Colors.dark[900] },
  chipText:       { fontSize: Typography.fontSize.xs, color: Colors.dark[700], fontWeight: '500' },
  chipTextActivo: { color: Colors.white, fontWeight: Typography.fontWeight.bold },

  // Tipo fijo (desde el checklist del expediente — no editable)
  tipoFijo: {
    backgroundColor: Colors.cream[100], borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.cream[300],
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  tipoFijoText: {
    fontSize: Typography.fontSize.sm, color: Colors.dark[800],
    fontWeight: '600',
  },

  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300],
    borderRadius: Radius.md, padding: Spacing.md, color: Colors.dark[900],
    fontSize: Typography.fontSize.sm, textAlignVertical: 'top', minHeight: 80,
  },

  // ── Botones selector ──
  actions:     { gap: Spacing.md, marginTop: Spacing.xl },
  btnEscanear: {
    backgroundColor: Colors.gold[400], borderRadius: Radius.lg,
    paddingVertical: Spacing.xl, paddingHorizontal: Spacing.xl,
    alignItems: 'center', gap: 4,
  },
  btnGaleria: {
    backgroundColor: Colors.dark[800], borderRadius: Radius.lg,
    paddingVertical: Spacing.base, paddingHorizontal: Spacing.xl,
    alignItems: 'center', gap: 4,
  },
  btnIcon:     { fontSize: 32 },
  btnLabel:    {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  btnSubLabel: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.7)' },

  // ── PDF preview ──
  pdfPreview: {
    backgroundColor: Colors.dark[900], borderRadius: Radius.lg,
    overflow: 'hidden', marginBottom: Spacing.sm,
  },
  pdfThumbs: { flexDirection: 'row', height: 180, gap: 2 },
  pdfThumb:  { flex: 1, backgroundColor: Colors.dark[700] },
  pdfThumbMore: {
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.dark[600],
  },
  pdfThumbMoreText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  pdfBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.base,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pdfIcon:  { fontSize: 18 },
  pdfLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },

  // ── Image preview ──
  previewImg: {
    width: '100%', height: 260, borderRadius: Radius.lg,
    backgroundColor: Colors.dark[900], marginBottom: Spacing.sm,
  },

  // ── Subir ──
  btnSubir: {
    backgroundColor: Colors.gold[400], borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.xl,
  },
  btnDisabled:       { opacity: 0.6 },
  btnSubirText:      {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  btnSecundario:     { marginTop: Spacing.sm, paddingVertical: Spacing.md, alignItems: 'center' },
  btnSecundarioText: { fontSize: Typography.fontSize.sm, color: Colors.dark[500] },

  offlineHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.dark[500],
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.base,
    lineHeight: 18,
  },
});
