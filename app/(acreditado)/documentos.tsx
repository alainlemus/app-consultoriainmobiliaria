import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../../src/theme';
import {
  getDocumentosAcreditado,
  subirDocumentoAcreditado,
  getUrlDocumentoAcreditado,
} from '../../../src/services/acreditadoApi';
import type { DocumentoAcreditado } from '../../../src/types';
import { Linking } from 'react-native';

const TIPOS_DOCUMENTO = [
  'CURP', 'INE', 'Constancia SAT', 'Talón de nómina', 'AFORE',
  'Acta de nacimiento', 'CFE', 'NSS', 'Otro',
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
  const insets  = useSafeAreaInsets();
  const [documentos,  setDocumentos]  = useState<DocumentoAcreditado[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [subiendo,    setSubiendo]    = useState(false);

  const cargar = useCallback(async () => {
    try {
      const docs = await getDocumentosAcreditado();
      setDocumentos(docs);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { cargar(); }, []);

  async function handleVerDocumento(doc: DocumentoAcreditado) {
    try {
      const url = await getUrlDocumentoAcreditado(doc.id);
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'No se pudo abrir el documento.');
    }
  }

  async function handleSubirDocumento() {
    Alert.alert(
      'Subir documento',
      '¿Cómo quieres obtener el documento?',
      [
        { text: 'Cámara', onPress: () => subirDesde('camara') },
        { text: 'Galería', onPress: () => subirDesde('galeria') },
        { text: 'Archivo PDF', onPress: () => subirDesde('archivo') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  }

  async function subirDesde(origen: 'camara' | 'galeria' | 'archivo') {
    let uri   = '';
    let mime  = 'application/octet-stream';
    let nombre = '';

    try {
      if (origen === 'camara') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permiso requerido', 'Activa el acceso a la cámara.'); return; }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
        if (result.canceled) return;
        uri  = result.assets[0].uri;
        mime = result.assets[0].mimeType ?? 'image/jpeg';
      } else if (origen === 'galeria') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permiso requerido', 'Activa el acceso a la galería.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: ImagePicker.MediaTypeOptions.Images });
        if (result.canceled) return;
        uri  = result.assets[0].uri;
        mime = result.assets[0].mimeType ?? 'image/jpeg';
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
        if (result.canceled) return;
        uri    = result.assets[0].uri;
        mime   = 'application/pdf';
        nombre = result.assets[0].name?.replace('.pdf', '') ?? 'Documento';
      }
    } catch { return; }

    // Preguntar tipo de documento
    Alert.alert(
      'Tipo de documento',
      'Selecciona el tipo de documento que estás subiendo:',
      TIPOS_DOCUMENTO.map(tipo => ({
        text: tipo,
        onPress: async () => {
          setSubiendo(true);
          try {
            await subirDocumentoAcreditado(uri, nombre || tipo, mime);
            await cargar();
            Alert.alert('✅ Listo', `${tipo} subido correctamente.`);
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'No se pudo subir el documento.');
          } finally {
            setSubiendo(false);
          }
        },
      }))
    );
  }

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={Colors.gold[400]} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={Colors.dark[600]} />
            <Text style={styles.emptyText}>Aún no tienes documentos.</Text>
            <Text style={styles.emptySubText}>Toca "Subir" para agregar tus documentos.</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.lg },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  subirBtn:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.gold[400], paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  subirBtnText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing['3xl'] },
  docCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark[800], borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.base },
  docIcon:  { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.dark[700], alignItems: 'center', justifyContent: 'center' },
  docInfo:  { flex: 1 },
  docNombre:    { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50] },
  docSeccion:   { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },
  docSubidoPor: { fontSize: Typography.fontSize.xs, color: Colors.gold[400], marginTop: 2 },
  docEstado:    { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  docEstadoText:{ fontSize: 10, fontWeight: Typography.fontWeight.bold },
  empty:        { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: Spacing.base },
  emptyText:    { fontSize: Typography.fontSize.base, color: Colors.cream[200], fontWeight: Typography.fontWeight.semibold },
  emptySubText: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center' },
});
