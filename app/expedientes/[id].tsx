import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Badge, { ESTADO_EXPEDIENTE_BADGE } from '../../src/components/ui/Badge';
import { getExpediente, deleteDocumento, reemplazarDocumento, getDocumentoUrl } from '../../src/services/api';
import type { Expediente, Documento } from '../../src/types';

const ESTADO_LABEL: Record<string, string> = {
  en_proceso:    'En proceso',
  documentacion: 'Documentación',
  autorizado:    'Autorizado',
  escrituracion: 'Escrituración',
  cerrado:       'Cerrado',
  cancelado:     'Cancelado',
};

const DOC_ESTADO_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  recibido:  { bg: '#f0fdf4', text: '#15803d', label: 'Recibido ✓' },
  no_aplica: { bg: '#f3f4f6', text: '#6b7280', label: 'No aplica' },
  pendiente: { bg: '#fefce8', text: '#a16207', label: 'Pendiente' },
};

export default function DetalleExpedienteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [exp,     setExp]     = useState<Expediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    if (!id) return;
    getExpediente(Number(id))
      .then(setExp)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <View style={styles.flex}>
      <TopBar title="Cargando…" onBack={() => router.back()} insetTop={insets.top} />
      <View style={styles.center}>
        <ActivityIndicator color={Colors.gold[400]} size="large" />
      </View>
    </View>
  );

  if (error || !exp) return (
    <View style={styles.flex}>
      <TopBar title="No encontrado" onBack={() => router.back()} insetTop={insets.top} />
      <Text style={styles.notFound}>No se encontró el expediente.</Text>
    </View>
  );

  const clienteNombre = exp.contacto?.nombre ?? `Expediente #${exp.id}`;
  const docs          = exp.documentos ?? [];
  const recibidos     = docs.filter(d => d.estado === 'recibido').length;
  const pendientes    = docs.filter(d => d.estado === 'pendiente').length;

  const handleEliminar = (doc: Documento) => {
    Alert.alert(
      'Eliminar documento',
      `¿Eliminar "${doc.tipo_documento ?? doc.tipo}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocumento(exp!.id, doc.id);
              const updated = await getExpediente(exp!.id);
              setExp(updated);
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar');
            }
          },
        },
      ],
    );
  };

  const handleReemplazar = async (doc: Documento) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el acceso a la galería en Configuración.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    try {
      await reemplazarDocumento(exp!.id, doc.id, result.assets[0].uri);
      const updated = await getExpediente(exp!.id);
      setExp(updated);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo reemplazar');
    }
  };

  const handleVer = async (doc: Documento) => {
    try {
      const url = await getDocumentoUrl(exp!.id, doc.id);
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch {
      Alert.alert('Error', 'No se pudo abrir el documento. Inténtalo de nuevo.');
    }
  };

  return (
    <View style={styles.flex}>
      <TopBar
        title={exp.folio ?? `Exp. #${exp.id}`}
        subtitle="Expediente"
        onBack={() => router.back()}
        insetTop={insets.top}
        rightElement={
          <Badge
            label={ESTADO_LABEL[exp.estado] ?? exp.estado}
            variant={ESTADO_EXPEDIENTE_BADGE[exp.estado] ?? 'gray'}
            small
          />
        }
      />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Datos generales ── */}
        <SectionLabel>Información del trámite</SectionLabel>
        <View style={styles.card}>
          <InfoRow label="Cliente"       value={clienteNombre} />
          <InfoRow label="Trámite"       value={exp.tipo_tramite?.nombre ?? '—'} />
          <InfoRow label="Etapa"         value={(exp.etapa ?? exp.etapa_tramite)?.nombre ?? '—'} />
          {exp.monto_credito ? (
            <InfoRow label="Monto"       value={`$${Number(exp.monto_credito).toLocaleString('es-MX')}`} />
          ) : null}
          <InfoRow label="Estado"        value={ESTADO_LABEL[exp.estado] ?? exp.estado} last />
        </View>

        {/* ── Documentos ── */}
        <View style={styles.docHeader}>
          <SectionLabel>Documentos</SectionLabel>
          <View style={styles.docStats}>
            <Text style={styles.docStatText}>
              <Text style={{ color: '#15803d', fontWeight: '700' }}>{recibidos}</Text>
              /{docs.length} recibidos
            </Text>
            {pendientes > 0 && (
              <View style={styles.pendienteBadge}>
                <Text style={styles.pendienteBadgeText}>{pendientes} pendientes</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          {docs.length === 0 ? (
            <Text style={styles.emptyDocs}>Sin documentos en el checklist.</Text>
          ) : (
            docs.map((doc, i) => {
              const tieneArchivo = doc.tiene_archivo;
              const esPendiente  = doc.estado === 'pendiente';
              const estado       = DOC_ESTADO_COLOR[doc.estado] ?? DOC_ESTADO_COLOR['pendiente'];
              const label        = doc.tipo_documento ?? doc.tipo ?? '—';

              return (
                <View key={doc.id} style={[styles.docRow, i > 0 && styles.docBorder]}>
                  {/* Icono: archivo subido vs vacío */}
                  <View style={[styles.docIconWrap, !tieneArchivo && styles.docIconWrapEmpty]}>
                    <Text style={styles.docIcon}>{tieneArchivo ? '📄' : '📋'}</Text>
                  </View>

                  <View style={styles.docInfo}>
                    <Text style={styles.docNombre} numberOfLines={1}>{label}</Text>

                    {/* Estado visual */}
                    {tieneArchivo ? (
                      <View style={[styles.docEstadoPill, { backgroundColor: estado.bg, alignSelf: 'flex-start', marginTop: 3 }]}>
                        <Text style={[styles.docEstadoText, { color: estado.text }]}>{estado.label}</Text>
                      </View>
                    ) : (
                      <Text style={styles.docSinArchivo}>Sin archivo — pendiente de subir</Text>
                    )}

                    {/* Acciones */}
                    <View style={styles.docActions}>
                      {tieneArchivo && (
                        <TouchableOpacity style={styles.docActionBtn} onPress={() => handleVer(doc)}>
                          <Text style={styles.docActionText}>👁 Ver</Text>
                        </TouchableOpacity>
                      )}
                      {!tieneArchivo && (
                        <TouchableOpacity
                          style={[styles.docActionBtn, styles.docActionPrimary]}
                          onPress={() => router.push(`/expedientes/documentos/subir?expedienteId=${exp.id}&tipo=${doc.tipo}`)}
                        >
                          <Text style={[styles.docActionText, styles.docActionPrimaryText]}>↑ Subir</Text>
                        </TouchableOpacity>
                      )}
                      {tieneArchivo && esPendiente && (
                        <>
                          <TouchableOpacity style={styles.docActionBtn} onPress={() => handleReemplazar(doc)}>
                            <Text style={styles.docActionText}>🔄 Reemplazar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.docActionBtn, styles.docActionDanger]}
                            onPress={() => handleEliminar(doc)}
                          >
                            <Text style={[styles.docActionText, styles.docActionDangerText]}>🗑 Eliminar</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}

          <TouchableOpacity
            style={styles.addDocBtn}
            onPress={() => router.push(`/expedientes/documentos/subir?expedienteId=${exp.id}`)}
            activeOpacity={0.75}
          >
            <Text style={styles.addDocText}>＋ Agregar documento</Text>
          </TouchableOpacity>
        </View>

        {/* ── Prospecto relacionado ── */}
        {exp.contacto && (
          <>
            <SectionLabel>Prospecto</SectionLabel>
            <TouchableOpacity
              style={styles.prospectoCard}
              onPress={() => router.push(`/prospectos/${exp.contacto!.id}`)}
              activeOpacity={0.75}
            >
              <View style={styles.prospectoAvatar}>
                <Text style={styles.avatarLetter}>
                  {(exp.contacto.nombre?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <View style={styles.prospectoInfo}>
                <Text style={styles.prospectoNombre}>{clienteNombre}</Text>
                <Text style={styles.prospectoSub}>Ver ficha completa →</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* ── Meta ── */}
        <SectionLabel>Fechas</SectionLabel>
        <View style={styles.card}>
          <InfoRow label="Creado"      value={new Date(exp.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} />
          <InfoRow label="Actualizado" value={new Date(exp.updated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} last />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function TopBar({ title, subtitle, onBack, insetTop, rightElement }: {
  title: string; subtitle?: string; onBack: () => void;
  insetTop: number; rightElement?: React.ReactNode;
}) {
  return (
    <View style={[tb.wrap, { paddingTop: insetTop + 8 }]}>
      <TouchableOpacity style={tb.back} onPress={onBack}>
        <Text style={tb.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={tb.mid}>
        {subtitle ? <Text style={tb.sub}>{subtitle}</Text> : null}
        <Text style={tb.title} numberOfLines={1}>{title}</Text>
      </View>
      <View style={tb.right}>{rightElement ?? <View style={{ width: 60 }} />}</View>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const tb = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.cream[300] },
  back:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.dark[700] },
  mid:      { flex: 1, alignItems: 'center' },
  sub:      { fontSize: 10, color: Colors.dark[400], letterSpacing: 1, textTransform: 'uppercase' },
  title:    { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  right:    { minWidth: 60, alignItems: 'flex-end' },
});

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: Colors.cream[50] },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound:{ textAlign: 'center', color: Colors.dark[400], marginTop: 40 },
  body:    { padding: Spacing.base },

  sectionLabel: {
    fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold,
    color: Colors.dark[500], letterSpacing: 1, textTransform: 'uppercase',
    marginTop: Spacing.base, marginBottom: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.cream[200], overflow: 'hidden',
  },

  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.cream[200] },
  infoLabel:     { fontSize: Typography.fontSize.sm, color: Colors.dark[500], fontWeight: '600', flex: 1 },
  infoValue:     { fontSize: Typography.fontSize.sm, color: Colors.dark[800], flex: 2, textAlign: 'right' },

  // Documentos
  docHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.base, marginBottom: Spacing.sm },
  docStats:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  docStatText:{ fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  pendienteBadge:     { backgroundColor: '#fefce8', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  pendienteBadgeText: { fontSize: Typography.fontSize.xs, color: '#a16207', fontWeight: '700' },

  docRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  docBorder: { borderTopWidth: 1, borderTopColor: Colors.cream[200] },
  docIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.cream[100], alignItems: 'center', justifyContent: 'center' },
  docIcon:   { fontSize: 16 },
  docInfo:   { flex: 1 },
  docNombre: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark[800] },
  docTipo:   { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 1 },
  docEstadoPill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  docEstadoText: { fontSize: Typography.fontSize.xs, fontWeight: '700' },

  docIconWrapEmpty: { backgroundColor: Colors.cream[100], borderWidth: 1, borderColor: Colors.cream[300], borderStyle: 'dashed' },
  docSinArchivo:    { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2, fontStyle: 'italic' },
  docActions:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  docActionBtn:        { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm, backgroundColor: Colors.cream[100], borderWidth: 1, borderColor: Colors.cream[300] },
  docActionText:       { fontSize: 10, color: Colors.dark[600], fontWeight: '600' },
  docActionPrimary:    { backgroundColor: Colors.gold[50] ?? '#fefce8', borderColor: Colors.gold[400] },
  docActionPrimaryText:{ color: Colors.gold[600] },
  docActionDanger:     { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  docActionDangerText: { color: '#dc2626' },

  emptyDocs: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md },

  addDocBtn:  { margin: Spacing.md, backgroundColor: Colors.cream[50], borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.cream[300], borderStyle: 'dashed' },
  addDocText: { color: Colors.gold[600], fontWeight: '700', fontSize: Typography.fontSize.sm },

  prospectoCard:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[200], padding: Spacing.md },
  prospectoAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark[800], alignItems: 'center', justifyContent: 'center' },
  avatarLetter:    { color: Colors.gold[400], fontWeight: '700', fontSize: Typography.fontSize.base },
  prospectoInfo:   { flex: 1 },
  prospectoNombre: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark[800] },
  prospectoSub:    { fontSize: Typography.fontSize.xs, color: Colors.gold[600], marginTop: 2 },
});
