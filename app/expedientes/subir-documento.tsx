/**
 * Pantalla: Subir / Escanear Documento de un expediente
 * Ruta: /expedientes/subir-documento?expedienteId=X
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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
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

import { uploadDocumento, reemplazarDocumento } from '../../src/services/api';
import { persistirDocumento } from '../../src/utils/comprimirFoto';
import { Colors, Radius, Spacing, Typography } from '../../src/theme';
import { TIPOS_DOCUMENTO, REQUISITOS_GENERALES, tipoPorLabel } from '../../src/constants/documentos';
import { useSyncContext } from '../../src/contexts/SyncContext';

type Mode = 'selector' | 'processing' | 'preview';

/** Quita el prefijo `file://` — react-native-image-to-pdf espera paths absolutos */
const stripFilePrefix = (uri: string) => uri.replace(/^file:\/\//, '');

/** Garantiza que el URI tenga `file://` para FormData */
const toFileUri = (path: string) =>
  path.startsWith('file://') ? path : `file://${path}`;

export default function SubirDocumentoScreen() {
  const insets = useSafeAreaInsets();
  // reemplazarId + tipoLabel: se está cambiando un documento ya subido (el tipo no se puede cambiar)
  const { expedienteId, reemplazarId, tipoLabel, solicitudNota } = useLocalSearchParams<{
    expedienteId: string; reemplazarId?: string; tipoLabel?: string; solicitudNota?: string;
  }>();
  const reemplazando = !!reemplazarId;
  // Documento faltante que pidió un administrador: no tiene un tipo del catálogo, se muestra su nota
  const esSolicitado = reemplazando && !!solicitudNota;

  const [tipo,  setTipo]  = useState<string>(
    (tipoLabel ? tipoPorLabel(tipoLabel)?.value : undefined) ?? 'ine',
  );
  const [confirmar, setConfirmar] = useState(false);
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
        type: ['application/pdf', 'image/*'],
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
      // Determinar nombre de archivo con extensión correcta
      const ext       = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
      const nombre    = `doc_${tipo}_${Date.now()}.${ext}`;
      const etiqueta  = TIPOS_DOCUMENTO.find(t => t.value === tipo)?.label ?? 'Otro';
      const seccion   = tipo === 'otro' ? 'otros' : undefined;

      // Persistir en documentDirectory ANTES de encolar o subir
      // Esto garantiza que la URI sobrevive reinicios de app en Android e iOS
      const uriPersistida = await persistirDocumento(resultUri, nombre);

      if (reemplazarId) {
        if (!online) {
          Alert.alert('Sin conexión', 'Para reemplazar un documento necesitas internet. Inténtalo de nuevo cuando tengas conexión.');
          return;
        }
        await reemplazarDocumento(Number(expedienteId), Number(reemplazarId), uriPersistida, mimeType);
        Alert.alert('Listo', 'Documento reemplazado correctamente.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      const encolarYVolver = async () => {
        await encolarDoc({
          expedienteId: Number(expedienteId),
          uri:        uriPersistida,
          tipo:       etiqueta,
          seccion,
          mimeType,
          notas:        notas || undefined,
        });
        Alert.alert(
          'Guardado sin conexión',
          'El documento se enviará automáticamente cuando recuperes internet.',
          [{ text: 'Entendido', onPress: () => router.back() }],
        );
      };

      if (!online) {
        await encolarYVolver();
        return;
      }

      // Con red: intentar subir directo
      try {
        await uploadDocumento(
          Number(expedienteId),
          uriPersistida,
          etiqueta,
          notas || undefined,
          mimeType,
          seccion,
        );
        Alert.alert('Listo', 'Documento subido correctamente.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch (e: unknown) {
        const msg = (e instanceof Error ? e.message : '').toLowerCase();
        const esErrorDeRed = msg.includes('network') || msg.includes('failed') || msg.includes('timeout');
        if (esErrorDeRed) {
          // Red disponible pero débil/caída → encolar silenciosamente
          await encolarYVolver();
        } else {
          // Error del servidor (401, 422, etc.) → mostrar al usuario
          Alert.alert('Error al subir', e instanceof Error ? e.message : 'Error desconocido');
        }
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo procesar el documento.');
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
            <Ionicons name="arrow-back" size={22} color={Colors.dark[700]} style={s.backIcon} />
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
                <Ionicons name="document-text" size={20} color={Colors.dark[500]} style={s.pdfIcon} />
                <Text style={s.pdfLabel}>
                  PDF · {pages.length} página{pages.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          ) : (
            /* ── Vista previa imagen ── */
            <Image source={{ uri: resultUri! }} style={s.previewImg} resizeMode="contain" />
          )}

          {esSolicitado ? (
            <View style={s.solicitadoBox}>
              <Text style={s.solicitadoTitulo}>Documento solicitado</Text>
              <Text style={s.solicitadoNota}>{solicitudNota}</Text>
            </View>
          ) : (
          <>
          <Text style={s.sectionLabel}>Tipo de documento · elige uno</Text>
          <View style={s.chipWrap}>
            {TIPOS_DOCUMENTO.map(t => (
              <Pressable
                key={t.value}
                style={[s.chip, tipo === t.value && s.chipActivo, reemplazando && tipo !== t.value && s.chipBloqueado]}
                onPress={() => !reemplazando && setTipo(t.value)}
              >
                <Text style={[s.chipText, tipo === t.value && s.chipTextActivo]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <RequisitosCard tipo={tipo} />
          </>
          )}

          <Text style={s.sectionLabel}>Nota para identificarlo</Text>
          <TextInput
            style={s.input}
            placeholder="Ej: INE del dueño de la casa"
            placeholderTextColor={Colors.dark[400]}
            value={notas}
            onChangeText={setNotas}
            multiline
            numberOfLines={3}
          />
          <Text style={s.notaAyuda}>Puedes subir varios del mismo tipo (por ejemplo, otra INE). Anota de quién es para identificarlo rápido.</Text>

          <Pressable
            style={[s.btnSubir, uploading && s.btnDisabled]}
            onPress={() => (esSolicitado ? subir() : setConfirmar(true))}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.btnSubirText}>
                  {reemplazando ? 'Reemplazar documento' : online ? 'Subir documento' : 'Guardar (sin conexión)'}
                </Text>
            }
          </Pressable>

          {!online && (
            <Text style={s.offlineHint}>
              Sin internet — el documento quedará guardado en tu dispositivo y se enviará cuando recuperes señal.
            </Text>
          )}

          <Pressable style={s.btnSecundario} onPress={volverASelector}>
            <Text style={s.btnSecundarioText}>← Volver a capturar</Text>
          </Pressable>
        </ScrollView>

      {/* Antes de subir: recordatorio de lo que debe cumplir el documento */}
      <AvisoRequisitos
        visible={confirmar}
        tipo={tipo}
        accion={reemplazando ? 'reemplazar' : 'subir'}
        onCancelar={() => setConfirmar(false)}
        onAceptar={() => { setConfirmar(false); subir(); }}
      />
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
          <Ionicons name="arrow-back" size={22} color={Colors.dark[700]} style={s.backIcon} />
        </TouchableOpacity>
        <Text style={s.topTitle}>{reemplazando ? 'Reemplazar documento' : 'Agregar documento'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {esSolicitado ? (
          <View style={s.solicitadoBox}>
            <Text style={s.solicitadoTitulo}>Documento solicitado</Text>
            <Text style={s.solicitadoNota}>{solicitudNota}</Text>
          </View>
        ) : (
        <>
        <Text style={s.sectionLabel}>Tipo de documento · elige uno</Text>
        <View style={s.chipWrap}>
          {TIPOS_DOCUMENTO.map(t => (
            <Pressable
              key={t.value}
              style={[s.chip, tipo === t.value && s.chipActivo, reemplazando && tipo !== t.value && s.chipBloqueado]}
              onPress={() => !reemplazando && setTipo(t.value)}
            >
              <Text style={[s.chipText, tipo === t.value && s.chipTextActivo]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <RequisitosCard tipo={tipo} />
        </>
        )}

        <Text style={s.sectionLabel}>Nota para identificarlo</Text>
        <TextInput
          style={s.input}
          placeholder="Ej: INE del dueño de la casa"
          placeholderTextColor={Colors.dark[400]}
          value={notas}
          onChangeText={setNotas}
          multiline
          numberOfLines={3}
        />
        <Text style={s.notaAyuda}>Puedes subir varios del mismo tipo (por ejemplo, otra INE). Anota de quién es para identificarlo rápido.</Text>

        <View style={s.actions}>
          <Pressable style={s.btnEscanear} onPress={escanear}>
            <Ionicons name="scan" size={36} color={Colors.white} />
            <Text style={s.btnLabel}>Escanear documento</Text>
            <Text style={s.btnSubLabel}>
              {DocumentScanner ? 'Múltiples páginas → PDF' : 'Requiere EAS Build'}
            </Text>
          </Pressable>

          <Pressable style={s.btnGaleria} onPress={seleccionarGaleria}>
            <Ionicons name="folder-open" size={36} color={Colors.white} />
            <Text style={s.btnLabel}>Archivo</Text>
            <Text style={s.btnSubLabel}>PDF o foto de la galería</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


/** Lo que hay que revisar del tipo de documento elegido (aparece con un fundido al cambiar de tipo). */
function RequisitosCard({ tipo }: { tipo: string }) {
  const def  = TIPOS_DOCUMENTO.find(t => t.value === tipo);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [tipo, fade]);

  if (!def) return null;
  return (
    <Animated.View style={[s.requisitos, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      <View style={s.requisitosCabecera}>
        <Ionicons name="alert-circle" size={22} color={Colors.gold[600]} />
        <Text style={s.requisitosTitulo}>Antes de subirlo, revisa que:</Text>
      </View>
      {def.requisitos.map((r, i) => (
        <View key={i} style={s.requisitoFila}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.gold[600]} />
          <Text style={s.requisitosItem}>{r}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

/**
 * Aviso antes de subir: la tarjeta entra con un resorte, el icono late para llamar la
 * atención y cada requisito aparece uno tras otro.
 */
function AvisoRequisitos({ visible, tipo, accion, onCancelar, onAceptar }: {
  visible: boolean; tipo: string; accion: 'subir' | 'reemplazar'; onCancelar: () => void; onAceptar: () => void;
}) {
  const def        = TIPOS_DOCUMENTO.find(t => t.value === tipo);
  const requisitos = [...(def?.requisitos ?? []), ...REQUISITOS_GENERALES];

  const entrada = useRef(new Animated.Value(0)).current;
  const latido  = useRef(new Animated.Value(1)).current;
  const items   = useRef(Array.from({ length: 12 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;
    entrada.setValue(0);
    items.forEach(v => v.setValue(0));
    Animated.spring(entrada, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    Animated.stagger(
      140,
      items.slice(0, requisitos.length).map(v => Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
    ).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(latido, { toValue: 1.18, duration: 600, useNativeDriver: true }),
      Animated.timing(latido, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, tipo, entrada, latido, items, requisitos.length]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={s.avisoBackdrop}>
        <Animated.View style={[s.avisoCard, { opacity: entrada, transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
          <Animated.View style={[s.avisoIconoWrap, { transform: [{ scale: latido }] }]}>
            <Ionicons name="warning" size={44} color={Colors.white} />
          </Animated.View>
          <Text style={s.avisoTitulo}>¡Revisa tu documento!</Text>
          <Text style={s.avisoTexto}>
            Un documento incorrecto o vencido detiene el trámite. Antes de {accion}{' '}
            <Text style={s.avisoNegrita}>{def?.label}</Text>, confirma que:
          </Text>

          <ScrollView style={s.avisoLista} contentContainerStyle={{ gap: Spacing.sm }} showsVerticalScrollIndicator={false}>
            {requisitos.map((r, i) => (
              <Animated.View
                key={i}
                style={[s.avisoFila, { opacity: items[i] ?? 1, transform: [{ translateX: (items[i] ?? entrada).interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}
              >
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                <Text style={s.avisoItem}>{r}</Text>
              </Animated.View>
            ))}
          </ScrollView>

          <Pressable style={s.avisoBtnPrimario} onPress={onAceptar}>
            <Ionicons name="shield-checkmark" size={22} color={Colors.gold[400]} />
            <Text style={s.avisoBtnPrimarioText}>Sí, cumple — {accion}</Text>
          </Pressable>
          <Pressable style={s.avisoBtnSecundario} onPress={onCancelar}>
            <Text style={s.avisoBtnSecundarioText}>Revisar de nuevo</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  solicitadoBox: { backgroundColor: Colors.gold[50], borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gold[400], padding: Spacing.base, marginTop: Spacing.md },
  solicitadoTitulo: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.gold[700] },
  solicitadoNota: { fontSize: Typography.fontSize.base, color: Colors.dark[800], lineHeight: 24, marginTop: Spacing.xs },
  notaAyuda: { fontSize: Typography.fontSize.sm, color: Colors.dark[500], marginTop: Spacing.xs, lineHeight: 20 },
  chipBloqueado: { opacity: 0.35 },
  requisitos: {
    marginTop: Spacing.md, backgroundColor: Colors.gold[50], borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.gold[400], padding: Spacing.base, gap: Spacing.sm,
  },
  requisitosCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  requisitosTitulo:   { flex: 1, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.gold[700] },
  requisitoFila:      { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  requisitosItem:     { flex: 1, fontSize: Typography.fontSize.base, color: Colors.dark[800], lineHeight: 24 },

  avisoBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  avisoCard:     { width: '100%', maxHeight: '90%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.xl },
  avisoIconoWrap:{ alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.warning, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  avisoTitulo:   { fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black, color: Colors.dark[900], textAlign: 'center', marginBottom: Spacing.sm },
  avisoTexto:    { fontSize: Typography.fontSize.base, color: Colors.dark[600], textAlign: 'center', lineHeight: 24 },
  avisoNegrita:  { fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  avisoLista:    { marginTop: Spacing.md, marginBottom: Spacing.lg, backgroundColor: Colors.cream[100], borderRadius: Radius.md, padding: Spacing.md, flexGrow: 0 },
  avisoFila:     { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  avisoItem:     { flex: 1, fontSize: Typography.fontSize.base, color: Colors.dark[800], lineHeight: 24, fontWeight: Typography.fontWeight.medium },
  avisoBtnPrimario:     { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.dark[900], borderRadius: Radius.md, paddingVertical: Spacing.base, alignItems: 'center', justifyContent: 'center' },
  avisoBtnPrimarioText: { color: Colors.gold[400], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  avisoBtnSecundario:     { paddingVertical: Spacing.md, alignItems: 'center' },
  avisoBtnSecundarioText: { color: Colors.dark[600], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },

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
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.dark[300],
    backgroundColor: Colors.white,
  },
  chipActivo:     { backgroundColor: Colors.dark[900], borderColor: Colors.dark[900] },
  chipText:       { fontSize: Typography.fontSize.xs, color: Colors.dark[700], fontWeight: '500' },
  chipTextActivo: { color: Colors.white, fontWeight: Typography.fontWeight.bold },


  input: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.dark[300],
    borderRadius: Radius.md, padding: Spacing.md, color: Colors.dark[900],
    fontSize: Typography.fontSize.base, textAlignVertical: 'top', minHeight: 80,
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
