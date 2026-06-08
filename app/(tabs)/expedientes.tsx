import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Badge, { ESTADO_EXPEDIENTE_BADGE } from '../../src/components/ui/Badge';
import { getExpedientes } from '../../src/services/api';
import { cacheExpedientes, getCacheExpedientes } from '../../src/services/offline';
import { useSyncContext } from '../../src/contexts/SyncContext';
import type { Expediente } from '../../src/types';

const ESTADOS_EXP = ['todos', 'en_proceso', 'documentacion', 'autorizado', 'escrituracion', 'cerrado', 'cancelado'];

const ESTADO_LABEL: Record<string, string> = {
  en_proceso:    'En proceso',
  documentacion: 'Documentación',
  autorizado:    'Autorizado',
  escrituracion: 'Escrituración',
  cerrado:       'Cerrado',
  cancelado:     'Cancelado',
};

export default function ExpedientesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { online } = useSyncContext();

  const [items,      setItems]      = useState<Expediente[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [desdeCache, setDesdeCache] = useState(false);
  const [estado,     setEstado]     = useState('todos');

  const load = useCallback(async (opts?: { refreshing?: boolean }) => {
    if (opts?.refreshing) setRefreshing(true);

    if (!online) {
      const cached = await getCacheExpedientes();
      const filtrados = estado === 'todos' ? cached : cached.filter(e => e.estado === estado);
      setItems(filtrados);
      setDesdeCache(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res = await getExpedientes({ estado: estado !== 'todos' ? estado : undefined });
      setItems(res.data);
      setDesdeCache(false);
      if (estado === 'todos') {
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
  }, [online, estado]);

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
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/expedientes/nuevo')}
            activeOpacity={0.8}
          >
            <Text style={styles.newBtnText}>+ Nuevo</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.goldLine} />

        <FlatList
          horizontal
          data={ESTADOS_EXP}
          keyExtractor={e => e}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: e }) => (
            <TouchableOpacity
              style={[styles.filterChip, estado === e && styles.filterChipActive]}
              onPress={() => setEstado(e)}
            >
              <Text style={[styles.filterText, estado === e && styles.filterTextActive]}>
                {e === 'todos' ? 'Todos' : (ESTADO_LABEL[e] ?? e)}
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
                <Badge label={ESTADO_LABEL[exp.estado] ?? exp.estado} variant={ESTADO_EXPEDIENTE_BADGE[exp.estado] ?? 'gray'} small />
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
  newBtn:     { backgroundColor: Colors.gold[400], borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  newBtnText: { color: Colors.dark[900], fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.sm },

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
