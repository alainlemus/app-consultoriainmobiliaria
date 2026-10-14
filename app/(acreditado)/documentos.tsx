/**
 * Pantalla: Documentos del Acreditado
 *
 * Flujo de subida:
 *   1. Escanear con DocumentScanner nativo → PDF automático (EAS Build)
 *   2. Cámara normal → imagen JPEG (fallback)
 *   3. Galería → imagen o PDF
 *   4. Archivo PDF directo
 *
 * Los módulos nativos se cargan condicionalmente igual que en subir.tsx del asesor.
 */

// ── Imports nativos condicionales ─────────────────────────────────────────────
import type DocScannerT  from 'react-native-document-scanner-plugin';
import type RNImageToPdfT from 'react-native-image-to-pdf';

// eslint-disable-next-line @typescript-eslint/no-require-imports
let DocumentScanner: typeof DocScannerT | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
let RNImageToPdf: typeof RNImageToPdfT | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DocumentScanner = (require('react-native-document-scanner-plugin') as { default: typeof DocScannerT }).default;
} catch { /* no disponible en Expo Go */ }

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RNImageToPdf = (require('react-native-image-to-pdf') as { default: typeof RNImageToPdfT }).default;
} catch { /* no disponible en Expo Go */ }

// ── Resto de imports ──────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator, Linking, Modal, ScrollView, Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import {
  getDocumentosAcreditado,
  subirDocumentoAcreditado,
  getUrlDocumentoAcreditado,
} from '@/src/services/acreditadoApi';
import { encolarDocAcreditado } from '@/src/services/offline';
import { persistirDocumento } from '@/src/utils/comprimirFoto';
import type { DocumentoAcreditado } from '@/src/types';
import { DOCUMENTOS_ACREDITADO, AVISOS_ACREDITADO, REQUISITOS_GENERALES } from '@/src/constants/documentos';

// ── Helpers ───────────────────────────────────────────────────────────────────
const stripFilePrefix = (uri: string) => uri.replace(/^file:\/\//, '');
const toFileUri = (path: string) =>
  path.startsWith('file://') ? path : `file://${path}`;

const TIPOS_DOCUMENTO = [...DOCUMENTOS_ACREDITADO.map(d => d.tipo), 'Otro'];

/** Requisitos de un tipo (los de la lista oficial + los generales). */
const requisitosDe = (tipo: string) => [
  ...(DOCUMENTOS_ACREDITADO.find(d => d.tipo === tipo)?.requisitos ?? ['Legible y completo.', 'Que corresponda a tu trámite.']),
  ...REQUISITOS_GENERALES,
];

const ESTADO_COLOR: Record<string, string> = {
  pendiente:  '#b45309',
  recibido:   '#15803d',
  rechazado:  '#dc2626',
  no_aplica:  '#374151',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente:  'Pendiente',
  recibido:   'Recibido',
  rechazado:  'Rechazado — vuelve a subirlo',
  no_aplica:  'No aplica',
};

export default function DocumentosScreen() {
  const insets = useSafeAreaInsets();
  const [documentos, setDocumentos] = useState<DocumentoAcreditado[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subiendo,   setSubiendo]   = useState(false);
  const [confirmar,  setConfirmar]  = useState<{ tipo: string; uri: string; mime: string; nombreBase: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const docs = await getDocumentosAcreditado();
      setDocumentos(docs);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { cargar(); }, []);

  // ── Ver documento ─────────────────────────────────────────────────────────
  async function handleVerDocumento(doc: DocumentoAcreditado) {
    try {
      const url = await getUrlDocumentoAcreditado(doc.id);
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'No se pudo abrir el documento.');
    }
  }

  // ── Selector de origen ────────────────────────────────────────────────────
  function handleSubirDocumento() {
    const opciones: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];

    if (DocumentScanner && RNImageToPdf) {
      opciones.push({ text: 'Escanear documento', onPress: () => escanear() });
    } else {
      opciones.push({ text: 'Tomar foto', onPress: () => subirDesde('camara') });
    }

    opciones.push(
      { text: 'Archivo PDF',  onPress: () => subirDesde('archivo') },
      { text: 'Cancelar', style: 'cancel' },
    );

    Alert.alert('Subir documento', '¿Cómo quieres obtener el documento?', opciones);
  }

  // ── Escáner nativo (DocumentScanner + RNImageToPdf) ───────────────────────
  async function escanear() {
    if (!DocumentScanner || !RNImageToPdf) return;
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        croppedImageQuality: 90,
        maxNumDocuments: 10,
      });
      if (!scannedImages || scannedImages.length === 0) return;

      setSubiendo(true);
      const nombre = `doc_${Date.now()}`;
      const { filePath } = await RNImageToPdf.createPDFbyImages({
        imagePaths: scannedImages.map(stripFilePrefix),
        name: nombre,
      });

      await seleccionarTipoYSubir(toFileUri(filePath), 'application/pdf', '');
    } catch (e: unknown) {
      Alert.alert('Error al escanear', e instanceof Error ? e.message : 'Error desconocido');
      setSubiendo(false);
    }
  }

  // ── Cámara / galería / archivo ────────────────────────────────────────────
  async function subirDesde(origen: 'camara' | 'archivo') {
    let uri   = '';
    let mime  = 'application/octet-stream';
    let nombre = '';

    try {
      if (origen === 'camara') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status === 'undetermined') {
          // Primera vez — el sistema mostrará el diálogo nativo de permisos
          const second = await ImagePicker.requestCameraPermissionsAsync();
          if (!second.granted) { Alert.alert('Permiso requerido', 'Activa el acceso a la cámara en Configuración.'); return; }
        } else if (!perm.granted) {
          Alert.alert('Permiso requerido', 'Activa el acceso a la cámara en Configuración.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.9,
          allowsEditing: false,
          base64: false,
        });
        if (result.canceled) return;
        uri  = result.assets[0].uri;
        mime = result.assets[0].mimeType ?? 'image/jpeg';

      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'] });
        if (result.canceled) return;
        uri    = result.assets[0].uri;
        mime   = 'application/pdf';
        nombre = result.assets[0].name?.replace(/\.[^/.]+$/, '') ?? 'Documento';
      }
    } catch { return; }

    await seleccionarTipoYSubir(uri, mime, nombre);
  }

  // ── Preguntar tipo y subir ─────────────────────────────────────────────────
  async function seleccionarTipoYSubir(uri: string, mime: string, nombreBase: string) {
    Alert.alert(
      'Tipo de documento',
      'Selecciona el tipo de documento:',
      [
        ...TIPOS_DOCUMENTO.map(tipo => ({
          text: tipo,
          // Antes de subir se muestran los requisitos de ese documento
          onPress: () => { setSubiendo(false); setConfirmar({ tipo, uri, mime, nombreBase }); },
        })),
        { text: 'Cancelar', style: 'cancel' as const, onPress: () => setSubiendo(false) },
      ],
    );
  }

  async function subirConTipo(tipo: string, uri: string, mime: string, nombreBase: string) {
    setSubiendo(true);
    try {
      // Persistir en documentDirectory para que sobreviva reinicios de app
      const ext        = mime === 'application/pdf' ? 'pdf' : 'jpg';
      const nombre     = `${tipo}_${Date.now()}.${ext}`;
      const uriPersist = await persistirDocumento(uri, nombre);

      try {
        await subirDocumentoAcreditado(uriPersist, nombreBase || tipo, mime);
        await cargar();
        Alert.alert('Listo', `${tipo} subido correctamente.`);
      } catch (e: unknown) {
        const msg = (e instanceof Error ? e.message : '').toLowerCase();
        if (msg.includes('network') || msg.includes('failed') || msg.includes('timeout')) {
          // Red débil o nula → encolar para reintento automático
          await encolarDocAcreditado({ uri: uriPersist, tipo, mimeType: mime });
          Alert.alert(
            'Guardado sin conexión',
            `El documento "${tipo}" se enviará automáticamente cuando tengas mejor señal.`,
          );
        } else {
          Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo subir el documento.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo procesar el documento.');
    } finally {
      setSubiendo(false);
    }
  }

  /** ¿Ya entregó este documento? (por nombre del documento en el expediente) */
  const yaSubido = (tipo: string) =>
    documentos.some(d => d.tiene_archivo && d.estado !== 'rechazado' && d.nombre?.toLowerCase().startsWith(tipo.toLowerCase()));

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.gold[400]} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Documentos</Text>
        <TouchableOpacity
          style={styles.subirBtn}
          onPress={handleSubirDocumento}
          disabled={subiendo}
        >
          {subiendo
            ? <ActivityIndicator color={Colors.dark[900]} size="small" />
            : <>
                <Ionicons name="cloud-upload-outline" size={18} color={Colors.dark[900]} />
                <Text style={styles.subirBtnText}>Subir</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      <FlatList
        data={documentos}
        keyExtractor={d => d.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            tintColor={Colors.gold[400]}
          />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.guia}>
            <Text style={styles.guiaTitulo}>Documentos que debes subir</Text>
            {DOCUMENTOS_ACREDITADO.map(d => {
              const listo = yaSubido(d.tipo);
              return (
                <View key={d.tipo} style={styles.guiaItem}>
                  <Ionicons
                    name={listo ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={listo ? Colors.success : Colors.gold[400]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.guiaItemTitulo}>{d.tipo}{listo ? '  ·  Entregado' : ''}</Text>
                    {d.requisitos.map((r, i) => <Text key={i} style={styles.guiaItemTexto}>• {r}</Text>)}
                    <Text style={styles.guiaDonde}>{d.donde}</Text>
                    {d.url && (
                      <TouchableOpacity onPress={() => Linking.openURL(d.url!)}>
                        <Text style={styles.guiaLink}>Abrir enlace</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={styles.guiaAvisos}>
              <View style={styles.guiaAvisosCab}>
                <Ionicons name="alert-circle" size={18} color={Colors.gold[400]} />
                <Text style={styles.guiaAvisosTitulo}>Importante</Text>
              </View>
              {AVISOS_ACREDITADO.map((a, i) => <Text key={i} style={styles.guiaItemTexto}>• {a}</Text>)}
            </View>
            {documentos.length > 0 && <Text style={styles.guiaTitulo2}>Mis documentos</Text>}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={Colors.dark[600]} />
            <Text style={styles.emptyText}>Aún no tienes documentos.</Text>
            <Text style={styles.emptySubText}>
              Toca "Subir" para agregar tus documentos con la cámara, galería o un PDF.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.docCard}
            onPress={() => item.tiene_archivo && handleVerDocumento(item)}
            disabled={!item.tiene_archivo}
          >
            <View style={styles.docIcon}>
              <Ionicons
                name={item.tiene_archivo ? 'document-text' : 'document-text-outline'}
                size={24}
                color={item.tiene_archivo ? Colors.gold[400] : Colors.dark[500]}
              />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docNombre} numberOfLines={1}>{item.nombre}</Text>
              <Text style={styles.docSeccion}>{item.seccion}</Text>
              {item.subido_por_acreditado && (
                <Text style={styles.docSubidoPor}>Subido por ti</Text>
              )}
              {item.estado === 'rechazado' && item.notas && (
                <Text style={styles.docMotivoRechazo} numberOfLines={2}>Motivo: {item.notas}</Text>
              )}
            </View>
            <View style={[styles.docEstado, { backgroundColor: ESTADO_COLOR[item.estado] + '33' }]}>
              <Text style={[styles.docEstadoText, { color: ESTADO_COLOR[item.estado] }]}>
                {ESTADO_LABEL[item.estado]}
              </Text>
            </View>
            {item.tiene_archivo && (
              <Ionicons name="chevron-forward" size={16} color={Colors.dark[500]} />
            )}
          </TouchableOpacity>
        )}
      />
      <Modal visible={!!confirmar} transparent animationType="fade" onRequestClose={() => setConfirmar(null)}>
        <View style={styles.avisoBackdrop}>
          <View style={styles.avisoCard}>
            <Ionicons name="warning" size={40} color={Colors.gold[500]} style={{ alignSelf: 'center' }} />
            <Text style={styles.avisoTitulo}>¡Revisa tu documento!</Text>
            <Text style={styles.avisoTexto}>
              Antes de subir <Text style={{ fontWeight: '700' }}>{confirmar?.tipo}</Text>, confirma que:
            </Text>
            <ScrollView style={styles.avisoLista} showsVerticalScrollIndicator={false}>
              {confirmar && requisitosDe(confirmar.tipo).map((r, i) => (
                <View key={i} style={styles.avisoFila}>
                  <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                  <Text style={styles.avisoItem}>{r}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={styles.avisoBtn}
              onPress={() => { const c = confirmar!; setConfirmar(null); subirConTipo(c.tipo, c.uri, c.mime, c.nombreBase); }}
            >
              <Text style={styles.avisoBtnText}>Sí, cumple — subir</Text>
            </Pressable>
            <Pressable style={styles.avisoCancelar} onPress={() => setConfirmar(null)}>
              <Text style={styles.avisoCancelarText}>Revisar de nuevo</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  guia: { backgroundColor: Colors.dark[800], borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.base, gap: Spacing.md },
  guiaTitulo: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  guiaTitulo2: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.cream[100], marginTop: Spacing.sm },
  guiaItem: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  guiaItemTitulo: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50], marginBottom: 2 },
  guiaItemTexto: { fontSize: Typography.fontSize.sm, color: Colors.cream[200], lineHeight: 20 },
  guiaDonde: { fontSize: Typography.fontSize.sm, color: Colors.gold[400], marginTop: 4, lineHeight: 20 },
  guiaLink: { fontSize: Typography.fontSize.sm, color: Colors.gold[400], fontWeight: Typography.fontWeight.bold, textDecorationLine: 'underline', marginTop: 2 },
  guiaAvisos: { backgroundColor: Colors.dark[700], borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  guiaAvisosCab: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  guiaAvisosTitulo: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.gold[400] },
  avisoBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  avisoCard: { width: '100%', maxHeight: '90%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.xl },
  avisoTitulo: { fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black, color: Colors.dark[900], textAlign: 'center', marginTop: Spacing.sm },
  avisoTexto: { fontSize: Typography.fontSize.base, color: Colors.dark[600], textAlign: 'center', marginTop: Spacing.xs },
  avisoLista: { marginTop: Spacing.md, marginBottom: Spacing.lg, backgroundColor: Colors.cream[100], borderRadius: Radius.md, padding: Spacing.md, flexGrow: 0 },
  avisoFila: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginBottom: Spacing.sm },
  avisoItem: { flex: 1, fontSize: Typography.fontSize.base, color: Colors.dark[800], lineHeight: 22 },
  avisoBtn: { backgroundColor: Colors.dark[900], borderRadius: Radius.md, paddingVertical: Spacing.base, alignItems: 'center' },
  avisoBtnText: { color: Colors.gold[400], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  avisoCancelar: { paddingVertical: Spacing.md, alignItems: 'center' },
  avisoCancelarText: { color: Colors.dark[600], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
  flex:   { flex: 1, backgroundColor: Colors.dark[900] },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
  },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  subirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.gold[400],
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  subirBtnText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing['3xl'] },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark[800],
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.base,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo:      { flex: 1 },
  docNombre:    { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50] },
  docSeccion:   { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },
  docSubidoPor: { fontSize: Typography.fontSize.xs, color: Colors.gold[400], marginTop: 2 },
  docMotivoRechazo: { fontSize: Typography.fontSize.xs, color: '#dc2626', marginTop: 2, lineHeight: 15 },
  docEstado:    { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  docEstadoText:{ fontSize: 10, fontWeight: Typography.fontWeight.bold },
  empty:        { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: Spacing.base, paddingHorizontal: Spacing['2xl'] },
  emptyText:    { fontSize: Typography.fontSize.base, color: Colors.cream[200], fontWeight: Typography.fontWeight.semibold },
  emptySubText: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', lineHeight: 20 },
});
