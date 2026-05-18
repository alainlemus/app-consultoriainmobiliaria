import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Header from '../../src/components/ui/Header';
import Card   from '../../src/components/ui/Card';
import Badge, { ESTADO_EXPEDIENTE_BADGE } from '../../src/components/ui/Badge';
import { getExpediente } from '../../src/services/api';
import type { Expediente } from '../../src/types';

const ETAPAS_LABEL: Record<string, string> = {
  en_proceso:    'En proceso',
  documentacion: 'Documentación',
  autorizado:    'Autorizado',
  escrituracion: 'Escrituración',
  cerrado:       'Cerrado',
  cancelado:     'Cancelado',
};

export default function DetalleExpedienteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [exp,     setExp]     = useState<Expediente | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getExpediente(Number(id)).then(setExp).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <View style={styles.flex}>
      <Header title="Cargando…" onBack={() => router.back()} />
      <ActivityIndicator style={{ marginTop: 60 }} color={Colors.gold[400]} />
    </View>
  );

  if (!exp) return (
    <View style={styles.flex}>
      <Header title="No encontrado" onBack={() => router.back()} />
      <Text style={styles.notFound}>No se encontró el expediente.</Text>
    </View>
  );

  const clienteNombre = exp.contacto
    ? `${exp.contacto.nombre} ${exp.contacto.apellido_paterno}`
    : `Expediente #${exp.id}`;

  return (
    <View style={styles.flex}>
      <Header
        title={exp.folio}
        subtitle="Expediente"
        onBack={() => router.back()}
        rightElement={
          <Badge
            label={exp.estado}
            variant={ESTADO_EXPEDIENTE_BADGE[exp.estado] ?? 'gray'}
            small
          />
        }
      />

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        {/* Datos generales */}
        <Card title={clienteNombre} subtitle="Cliente" style={styles.card}>
          <InfoRow label="Folio"           value={exp.folio} />
          <InfoRow label="Trámite"         value={exp.tipo_tramite?.nombre ?? '—'} />
          <InfoRow label="Etapa"           value={exp.etapa_tramite?.nombre ?? ETAPAS_LABEL[exp.estado] ?? '—'} />
          {exp.monto_credito ? (
            <InfoRow label="Monto crédito" value={`$${exp.monto_credito.toLocaleString('es-MX')}`} />
          ) : null}
          {exp.honorarios_monto ? (
            <InfoRow label="Honorarios"    value={`$${exp.honorarios_monto.toLocaleString('es-MX')}`} />
          ) : null}
          <InfoRow label="Estado"          value={ETAPAS_LABEL[exp.estado] ?? exp.estado} last />
        </Card>

        {/* Notas */}
        {exp.notas ? (
          <Card title="Notas" subtitle="Observaciones" style={styles.card}>
            <Text style={styles.notasText}>{exp.notas}</Text>
          </Card>
        ) : null}

        {/* Documentos */}
        <Card title={`Documentos (${exp.documentos?.length ?? 0})`} subtitle="Archivo" style={styles.card}>
          {exp.documentos && exp.documentos.length > 0 ? (
            exp.documentos.map((doc, i) => (
              <View key={doc.id} style={[styles.docRow, i > 0 && styles.docBorder]}>
                <Text style={styles.docIcon}>📄</Text>
                <View style={styles.docInfo}>
                  <Text style={styles.docNombre}>{doc.nombre}</Text>
                  <Text style={styles.docTipo}>{doc.tipo_documento}</Text>
                </View>
                <Badge
                  label={doc.estado === 'aprobado' ? '✓' : doc.estado === 'rechazado' ? '✗' : '…'}
                  variant={doc.estado === 'aprobado' ? 'success' : doc.estado === 'rechazado' ? 'danger' : 'warning'}
                  small
                />
              </View>
            ))
          ) : (
            <Text style={styles.emptyDocs}>Sin documentos aún.</Text>
          )}

          <TouchableOpacity
            style={styles.addDocBtn}
            onPress={() => router.push(`/expedientes/documentos/subir?expedienteId=${exp.id}`)}
          >
            <Text style={styles.addDocText}>+ Agregar documento</Text>
          </TouchableOpacity>
        </Card>

        {/* Contacto */}
        {exp.contacto && (
          <Card title="Prospecto relacionado" subtitle="Cliente" style={styles.card}>
            <TouchableOpacity
              style={styles.prospectoLink}
              onPress={() => router.push(`/prospectos/${exp.contacto!.id}`)}
            >
              <View style={styles.prospectoAvatar}>
                <Text style={styles.avatarLetter}>{exp.contacto.nombre[0]}</Text>
              </View>
              <View style={styles.prospectoInfo}>
                <Text style={styles.prospectoNombre}>{clienteNombre}</Text>
                <Text style={styles.prospectoSub}>Ver ficha completa →</Text>
              </View>
            </TouchableOpacity>
          </Card>
        )}

        {/* Meta */}
        <Card style={styles.card}>
          <InfoRow label="Creado"      value={new Date(exp.created_at).toLocaleDateString('es-MX')} />
          <InfoRow label="Actualizado" value={new Date(exp.updated_at).toLocaleDateString('es-MX')} last />
        </Card>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex:  { flex: 1, backgroundColor: Colors.cream[50] },
  body:  { padding: Spacing.base },
  card:  { marginBottom: Spacing.base },

  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.cream[200] },
  infoLabel:     { fontSize: Typography.fontSize.sm, color: Colors.dark[500], fontWeight: '600' },
  infoValue:     { fontSize: Typography.fontSize.sm, color: Colors.dark[800], flex: 1, textAlign: 'right' },

  notasText: { fontSize: Typography.fontSize.sm, color: Colors.dark[700], lineHeight: 20 },

  docRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  docBorder: { borderTopWidth: 1, borderTopColor: Colors.cream[200] },
  docIcon:   { fontSize: 20 },
  docInfo:   { flex: 1 },
  docNombre: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark[800] },
  docTipo:   { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  emptyDocs: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', paddingVertical: Spacing.md },

  addDocBtn:  { marginTop: Spacing.sm, backgroundColor: Colors.cream[100], borderRadius: Radius.sm, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.cream[300], borderStyle: 'dashed' },
  addDocText: { color: Colors.gold[600], fontWeight: '600', fontSize: Typography.fontSize.sm },

  prospectoLink:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  prospectoAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark[800], alignItems: 'center', justifyContent: 'center' },
  avatarLetter:    { color: Colors.gold[400], fontWeight: '700', fontSize: Typography.fontSize.base },
  prospectoInfo:   { flex: 1 },
  prospectoNombre: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark[800] },
  prospectoSub:    { fontSize: Typography.fontSize.xs, color: Colors.gold[600] },

  notFound: { textAlign: 'center', color: Colors.dark[400], marginTop: 40 },
});
