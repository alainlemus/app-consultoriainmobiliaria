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
  Alert, RefreshControl, ActivityIndicator, Linking,
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const stripFilePrefix = (uri: string) => uri.replace(/^file:\/\//, '');
const toFileUri = (path: string) =>
  path.startsWith('file://') ? path : `file://${path}`;

const TIPOS_DOCUMENTO = [
  'CURP', 'INE', 'Constancia SAT', 'Talón de nómina', 'AFORE',
  'Acta de nacimiento', 'CFE', 'NSS', 'Escritura', 'Contrato', 'Otro',
];

const ESTADO_COLOR: Record<string, string> = {
  pendiente:  '#b45309',
  recibido:   '#15803d',
  no_aplica:  '#374151',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente:  'Pendiente',
  recibido:   'Recibido',
  no_aplica:  'No aplica',
};

export default function DocumentosScreen() {
  const insets = useSafeAreaInsets();
  const [documentos, setDocumentos] = useState<DocumentoAcreditado[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subiendo,   setSubiendo]   = useState(false);

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
      opciones.push({ text: '📷 Escanear documento', onPress: () => escanear() });
    } else {
      opciones.push({ text: '📷 Tomar foto', onPress: () => subirDesde('camara') });
    }

    opciones.push(
      { text: '📄 Archivo PDF',  onPress: () => subirDesde('archivo') },
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
      TIPOS_DOCUMENTO.map(tipo => ({
        text: tipo,
        onPress: async () => {
          setSubiendo(true);
          try {
            // Persistir en documentDirectory para que sobreviva reinicios de app
            const ext        = mime === 'application/pdf' ? 'pdf' : 'jpg';
            const nombre     = `${tipo}_${Date.now()}.${ext}`;
            const uriPersist = await persistirDocumento(uri, nombre);

            try {
              await subirDocumentoAcreditado(uriPersist, nombreBase || tipo, mime);
              await cargar();
              Alert.alert('✅ Listo', `${tipo} subido correctamente.`);
            } catch (e: unknown) {
              const msg = (e instanceof Error ? e.message : '').toLowerCase();
              if (msg.includes('network') || msg.includes('failed') || msg.includes('timeout')) {
                // Red débil o nula → encolar para reintento automático
                await encolarDocAcreditado({ uri: uriPersist, tipo, mimeType: mime });
                Alert.alert(
                  '📋 Guardado sin conexión',
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
        },
      }))
    );
  }

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
    </View>
  );
}

const styles = StyleSheet.create({
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
  docEstado:    { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  docEstadoText:{ fontSize: 10, fontWeight: Typography.fontWeight.bold },
  empty:        { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: Spacing.base, paddingHorizontal: Spacing['2xl'] },
  emptyText:    { fontSize: Typography.fontSize.base, color: Colors.cream[200], fontWeight: Typography.fontWeight.semibold },
  emptySubText: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', lineHeight: 20 },
});
