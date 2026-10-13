/**
 * Documentos de un expediente: botón para escanear/subir y la lista de lo ya subido.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { deleteDocumento, getDocumentosExpediente, getDocumentoUrl } from '../services/api';
import { useSyncContext } from '../contexts/SyncContext';
import type { Documento } from '../types';

export default function DocumentosExpediente({ expedienteId }: { expedienteId: number }) {
  const router = useRouter();
  const { online, pendientes } = useSyncContext();
  const [docs, setDocs]               = useState<Documento[]>([]);
  const [cargando, setCargando]       = useState(true);

  // Se recarga al volver de subir un documento y cuando la cola offline se vacía.
  useFocusEffect(
    useCallback(() => {
      if (!online) { setCargando(false); return; }
      getDocumentosExpediente(expedienteId)
        .then(setDocs)
        .catch(() => {})
        .finally(() => setCargando(false));
    }, [expedienteId, online, pendientes]),
  );

  const abrir = async (doc: Documento) => {
    if (!doc.id) return;
    try {
      Linking.openURL(await getDocumentoUrl(expedienteId, doc.id));
    } catch {
      Alert.alert('Error', 'No se pudo abrir el documento. Inténtalo de nuevo.');
    }
  };

  const eliminar = (doc: Documento) => {
    if (!doc.id) return;
    Alert.alert('Eliminar documento', `¿Eliminar "${doc.nombre ?? doc.tipo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDocumento(expedienteId, doc.id as number);
            setDocs(prev => prev.filter(d => d.id !== doc.id));
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.addBtn}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/expedientes/subir-documento', params: { expedienteId: String(expedienteId) } })}
      >
        <Text style={styles.addIcon}>📄</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.addLabel}>Escanear o subir documento</Text>
          <Text style={styles.addSub}>INE, CURP, comprobantes y más</Text>
        </View>
        <Text style={styles.addPlus}>＋</Text>
      </TouchableOpacity>

      {cargando ? (
        <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing.md }} />
      ) : docs.length === 0 ? (
        <Text style={styles.empty}>
          {online ? 'Aún no hay documentos.' : 'Sin conexión: los documentos que subas se enviarán al recuperar señal.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {docs.map((doc, i) => (
            <View key={doc.id ?? i} style={[styles.row, i > 0 && styles.rowBorder]}>
              <TouchableOpacity style={styles.rowMain} onPress={() => abrir(doc)} activeOpacity={0.7}>
                <Text style={styles.rowIcon}>{doc.ruta_archivo?.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{doc.nombre ?? doc.tipo}</Text>
                  {doc.created_at ? (
                    <Text style={styles.rowSub}>{new Date(doc.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => eliminar(doc)} hitSlop={10} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.dark[900], borderRadius: Radius.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.base,
  },
  addIcon:  { fontSize: 22 },
  addLabel: { color: Colors.white, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  addSub:   { color: Colors.cream[300], fontSize: Typography.fontSize.xs, marginTop: 1 },
  addPlus:  { color: Colors.gold[400], fontSize: 24, fontWeight: '700' },
  empty:    { color: Colors.dark[400], fontSize: Typography.fontSize.sm, textAlign: 'center', marginTop: Spacing.md },
  list: {
    marginTop: Spacing.sm, backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.cream[200], overflow: 'hidden',
  },
  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.cream[200] },
  rowMain:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  rowIcon:   { fontSize: 20 },
  rowTitle:  { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  rowSub:    { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 1 },
  deleteBtn: { paddingLeft: Spacing.md, paddingVertical: Spacing.md },
  deleteText:{ fontSize: 16 },
});
