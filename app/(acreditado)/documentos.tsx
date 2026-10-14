/**
 * Pantalla: Documentos del Acreditado
 * Muestra qué documentos debe subir (con requisitos y dónde obtenerlos) y su estado.
 * El botón "Subir" abre /subir-documento-acreditado (elegir tipo, nota, escanear o archivo).
 */

// ── Resto de imports ──────────────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import {
  getDocumentosAcreditado,
  getUrlDocumentoAcreditado,
} from '@/src/services/acreditadoApi';
import type { DocumentoAcreditado } from '@/src/types';
import { DOCUMENTOS_ACREDITADO, AVISOS_ACREDITADO } from '@/src/constants/documentos';

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
  const router = useRouter();
  const [documentos, setDocumentos] = useState<DocumentoAcreditado[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const docs = await getDocumentosAcreditado();
      setDocumentos(docs);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Al volver de subir un documento se recarga la lista
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // ── Ver documento ─────────────────────────────────────────────────────────
  async function handleVerDocumento(doc: DocumentoAcreditado) {
    try {
      const url = await getUrlDocumentoAcreditado(doc.id);
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'No se pudo abrir el documento.');
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
          onPress={() => router.push('/subir-documento-acreditado')}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={Colors.dark[900]} />
          <Text style={styles.subirBtnText}>Subir</Text>
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
              {item.solicitud_nota && !item.tiene_archivo && (
                <Text style={styles.docMotivoRechazo} numberOfLines={3}>Solicitado: {item.solicitud_nota}</Text>
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
