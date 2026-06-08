import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Badge, { ESTADO_EXPEDIENTE_BADGE } from '../../src/components/ui/Badge';
import type { BadgeVariant } from '../../src/components/ui/Badge';
import { getExpedientes } from '../../src/services/api';
import { cacheExpedientes, getCacheExpedientes } from '../../src/services/offline';
import { useSyncContext } from '../../src/contexts/SyncContext';
import type { Expediente } from '../../src/types';

const ETAPAS_FILTRO = [
  { value: 'todos',                  label: 'Todos' },
  { value: 'Expediente iniciado',    label: 'Iniciado' },
  { value: 'Documentos completos',   label: 'Docs completos' },
  { value: 'Validación SOFOM',       label: 'Val. SOFOM' },
  { value: 'Asignación a notaría',   label: 'Notaría' },
  { value: 'Firma ante notario',     label: 'Firma' },
  { value: 'Dispersión y cobro',     label: 'Dispersión' },
];

// Badge por etapa nombre
export const ETAPA_BADGE: Record<string, BadgeVariant> = {
  'Expediente iniciado':  'gray',
  'Documentos completos': 'info',
  'Validación SOFOM':     'warning',
  'Asignación a notaría': 'gold',
  'Firma ante notario':   'dark',
  'Dispersión y cobro':   'success',
};

export default function ExpedientesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { online } = useSyncContext();

  const [items,      setItems]      = useState<Expediente[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [desdeCache, setDesdeCache] = useState(false);
  const [etapa,      setEtapa]      = useState('todos');

  const load = useCallback(async (opts?: { refreshing?: boolean }) => {
    if (opts?.refreshing) setRefreshing(true);

    if (!online) {
      const cached = await getCacheExpedientes();
      const filtrados = etapa === 'todos'
        ? cached
        : cached.filter(e => e.etapa?.nombre === etapa);
      setItems(filtrados);
      setDesdeCache(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res = await getExpedientes({ etapa: etapa !== 'todos' ? etapa : undefined });
      setItems(res.data);
      setDesdeCache(false);
      if (etapa === 'todos') {
        cacheExpedientes(res.data).catch(() => {});
      }
    } catch {
      const cached = await getCacheExpedientes();
      if (cached.length > 0) {
        setItems(cached);
        setDesdeCache(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [online, etapa]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerSub}>CRM</Text>
            <Text style={styles.headerTitle}>Expedientes</Text>
          </View>
        </View>
        <View style={styles.goldLine} />

        <FlatList
          horizontal
          data={ETAPAS_FILTRO}
          keyExtractor={e => e.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: e }) => (
            <TouchableOpacity
              style={[styles.filterChip, etapa === e.value && styles.filterChipActive]}
              onPress={() => setEtapa(e.value)}
            >
              <Text style={[styles.filterText, etapa === e.value && styles.filterTextActive]}>
                {e.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Aviso cache offline */}
      {desdeCache && (
        <View style={styles.cacheBanner}>
          <Text style={styles.cacheText}>
            📴 Sin conexión — mostrando datos guardados en el dispositivo
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={styles.center} color={Colors.gold[400]} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={e => String(e.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.gold[400]} />
          }
          ListEmptyComponent={<Text style={styles.empty}>Sin expedientes.</Text>}
          renderItem={({ item: exp }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/expedientes/${exp.id}`)}
              activeOpacity={0.8}
            >
              {/* Foto del acreditado */}
              {exp.contacto?.foto_url ? (
                <Image source={{ uri: exp.contacto.foto_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>
                    {(exp.contacto?.nombre?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.info}>
                <Text style={styles.nombre} numberOfLines={1}>
                  {exp.contacto?.nombre ?? `Expediente #${exp.id}`}
                </Text>
                <Text style={styles.folio} numberOfLines={1}>
                  {exp.folio ?? `#${exp.id}`}
                </Text>
                <Text style={styles.tipo} numberOfLines={1}>
                  {exp.tipo_tramite?.nombre ?? '—'}
                </Text>
              </View>
                <View style={styles.rowRight}>
                  <Badge
                    label={exp.etapa?.nombre ?? exp.estado}
                    variant={ETAPA_BADGE[exp.etapa?.nombre ?? ''] ?? ESTADO_EXPEDIENTE_BADGE[exp.estado] ?? 'gray'}
                    small
                  />
                  <Text style={styles.chevron}>›</Text>
                </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: Colors.cream[50] },
  center: { flex: 1, marginTop: 60 },

  header:     { backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSub:  { fontSize: Typography.fontSize.xs, color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold, letterSpacing: Typography.letterSpacing.widest },
  headerTitle:{ fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black, color: Colors.cream[50] },
  goldLine:   { width: 32, height: 2, backgroundColor: Colors.gold[400], marginVertical: Spacing.sm },

  filterList: { gap: Spacing.xs, paddingBottom: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.dark[600] },
  filterChipActive: { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  filterText: { color: Colors.dark[400], fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, textTransform: 'capitalize' },
  filterTextActive: { color: Colors.dark[900] },

  listContent: { padding: Spacing.sm },
  row:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.xs, borderWidth: 1, borderColor: Colors.cream[300], gap: Spacing.sm },
  avatar:        { width: 48, height: 48, borderRadius: 24 },
  avatarFallback:{ width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.dark[800], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.gold[700] },
  avatarLetter:  { color: Colors.gold[400], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  info:   { flex: 1 },
  nombre: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800] },
  folio:  { fontSize: Typography.fontSize.xs, color: Colors.gold[600], fontWeight: Typography.fontWeight.semibold, marginTop: 1 },
  tipo:   { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  chevron:{ color: Colors.dark[400], fontSize: 20 },
  empty:  { textAlign: 'center', color: Colors.dark[400], marginTop: 40, fontSize: Typography.fontSize.sm },

  cacheBanner: {
    backgroundColor: Colors.dark[800],
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
  },
  cacheText: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.fontSize.xs },
});
