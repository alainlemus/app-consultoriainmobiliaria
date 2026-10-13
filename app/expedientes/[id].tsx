/**
 * Detalle del expediente de un cliente: sus datos básicos y sus documentos
 * (escanear o subir, ver, eliminar). Sin etapas ni estados: eso se lleva en el panel.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../../src/theme';
import { getExpediente } from '../../src/services/api';
import DocumentosExpediente from '../../src/components/DocumentosExpediente';
import type { Expediente } from '../../src/types';

export default function DetalleExpedienteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exp, setExp]         = useState<Expediente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getExpediente(Number(id))
      .then(setExp)
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar el expediente'))
      .finally(() => setCargando(false));
  }, [id]);

  const contacto = exp?.contacto;

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Expediente</Text>
        <View style={{ width: 40 }} />
      </View>

      {cargando ? (
        <ActivityIndicator style={styles.center} color={Colors.gold[400]} />
      ) : error || !exp ? (
        <Text style={styles.error}>{error ?? 'Expediente no encontrado'}</Text>
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          {/* Cliente */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={contacto ? 0.8 : 1}
            onPress={() => contacto && router.push(`/prospectos/${contacto.id}`)}
          >
            {contacto?.foto_url ? (
              <Image source={{ uri: contacto.foto_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>{(contacto?.nombre?.[0] ?? '?').toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre} numberOfLines={2}>{contacto?.nombre ?? `Expediente #${exp.id}`}</Text>
              <Text style={styles.sub}>{exp.folio ?? `#${exp.id}`}{exp.tipo_tramite?.nombre ? ` · ${exp.tipo_tramite.nombre}` : ''}</Text>
              {contacto?.telefono ? <Text style={styles.sub}>{contacto.telefono}</Text> : null}
            </View>
            {contacto ? <Text style={styles.chevron}>›</Text> : null}
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>Documentos</Text>
          <DocumentosExpediente expedienteId={exp.id} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: Colors.cream[50] },
  center: { marginTop: Spacing.xl * 2 },
  error:  { textAlign: 'center', color: Colors.crimson[600], marginTop: Spacing.xl * 2, paddingHorizontal: Spacing.xl },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.cream[200],
  },
  backBtn:  { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.dark[700] },
  topTitle: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  body:     { padding: Spacing.base },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[200],
    padding: Spacing.md,
  },
  avatar:         { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.dark[900], alignItems: 'center', justifyContent: 'center' },
  avatarLetter:   { color: Colors.gold[400], fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold },
  nombre:  { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  sub:     { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.dark[300] },
  sectionLabel: {
    fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[500],
    letterSpacing: 1, textTransform: 'uppercase', marginTop: Spacing.lg, marginBottom: Spacing.xs,
  },
});
