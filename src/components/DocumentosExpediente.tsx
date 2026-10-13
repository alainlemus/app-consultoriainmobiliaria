/**
 * Documentos de un expediente: agregar (escanear o subir), y por cada uno
 * ver, reemplazar y eliminar.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { deleteDocumento, getDocumentosExpediente, getDocumentoUrl } from '../services/api';
import { useSyncContext } from '../contexts/SyncContext';
import type { Documento } from '../types';

const esPdf = (doc: Documento) => (doc.ruta_archivo ?? '').toLowerCase().endsWith('.pdf');

// Los documentos viejos se guardaron con el nombre del archivo (doc_123.jpg): se muestran como "Documento".
const nombreLegible = (doc: Documento) => {
  const nombre = doc.nombre ?? doc.tipo ?? '';
  return /^doc_\d+|\.(jpe?g|png|pdf|heic|webp)$/i.test(nombre) ? 'Documento' : nombre;
};

const fechaCorta = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function DocumentosExpediente({ expedienteId }: { expedienteId: number }) {
  const router = useRouter();
  const { online, pendientes } = useSyncContext();
  const [docs, setDocs]         = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState<number | null>(null);

  // Se recarga al volver de subir/reemplazar y cuando la cola offline se vacía.
  useFocusEffect(
    useCallback(() => {
      if (!online) { setCargando(false); return; }
      getDocumentosExpediente(expedienteId)
        .then(setDocs)
        .catch(() => {})
        .finally(() => setCargando(false));
    }, [expedienteId, online, pendientes]),
  );

  const ver = async (doc: Documento) => {
    if (!doc.id) return;
    setAbriendo(doc.id);
    try {
      Linking.openURL(await getDocumentoUrl(expedienteId, doc.id));
    } catch {
      Alert.alert('Error', 'No se pudo abrir el documento. Inténtalo de nuevo.');
    } finally {
      setAbriendo(null);
    }
  };

  const reemplazar = (doc: Documento) => {
    if (!online) {
      Alert.alert('Sin conexión', 'Para reemplazar un documento necesitas internet.');
      return;
    }
    router.push({
      pathname: '/expedientes/subir-documento',
      params: { expedienteId: String(expedienteId), reemplazarId: String(doc.id), tipoLabel: nombreLegible(doc) },
    });
  };

  const eliminar = (doc: Documento) => {
    if (!doc.id) return;
    Alert.alert('Eliminar documento', `¿Eliminar "${nombreLegible(doc)}"? Esta acción no se puede deshacer.`, [
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
          <Text style={styles.addSub}>Te diremos qué revisar antes de subirlo</Text>
        </View>
        <Text style={styles.addPlus}>＋</Text>
      </TouchableOpacity>

      {cargando ? (
        <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing.md }} />
      ) : docs.length === 0 ? (
        <View style={styles.vacio}>
          <Text style={styles.vacioIcono}>🗂️</Text>
          <Text style={styles.vacioTexto}>
            {online ? 'Aún no hay documentos cargados.' : 'Sin conexión: conéctate para ver los documentos cargados. Los que subas ahora se enviarán al recuperar señal.'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.contador}>{docs.length} documento{docs.length === 1 ? '' : 's'} cargado{docs.length === 1 ? '' : 's'}</Text>
          {docs.map(doc => (
            <View key={doc.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.tile, esPdf(doc) ? styles.tilePdf : styles.tileFoto]}>
                  <Text style={styles.tileText}>{esPdf(doc) ? 'PDF' : 'FOTO'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.titulo} numberOfLines={2}>{nombreLegible(doc)}</Text>
                  <Text style={styles.sub}>Subido el {fechaCorta(doc.created_at)}</Text>
                  {doc.notas ? <Text style={styles.notas} numberOfLines={2}>{doc.notas}</Text> : null}
                </View>
              </View>

              <View style={styles.acciones}>
                <TouchableOpacity style={[styles.accion, styles.accionVer]} onPress={() => ver(doc)} activeOpacity={0.8}>
                  {abriendo === doc.id
                    ? <ActivityIndicator size="small" color={Colors.dark[900]} />
                    : <Text style={styles.accionVerText}>Ver</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.accion} onPress={() => reemplazar(doc)} activeOpacity={0.8}>
                  <Text style={styles.accionText}>Reemplazar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.accion} onPress={() => eliminar(doc)} activeOpacity={0.8}>
                  <Text style={[styles.accionText, styles.accionEliminar]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
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

  vacio:      { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.xs },
  vacioIcono: { fontSize: 34 },
  vacioTexto: { color: Colors.dark[400], fontSize: Typography.fontSize.sm, textAlign: 'center', paddingHorizontal: Spacing.base },

  contador: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: Spacing.md, marginBottom: Spacing.xs, fontWeight: Typography.fontWeight.semibold },
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[200],
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  cardTop: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  tile:    { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  tilePdf:  { backgroundColor: '#fef2f2' },
  tileFoto: { backgroundColor: '#eff6ff' },
  tileText: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[700] },
  titulo:   { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  sub:      { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },
  notas:    { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2, fontStyle: 'italic' },

  acciones: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.md },
  accion: {
    flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.dark[300], backgroundColor: Colors.white,
  },
  accionVer:      { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  accionVerText:  { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  accionText:     { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[700] },
  accionEliminar: { color: Colors.crimson[600] },
});
