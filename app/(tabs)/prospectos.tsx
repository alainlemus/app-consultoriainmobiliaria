import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Badge, { ESTADO_PROSPECTO_BADGE } from '../../src/components/ui/Badge';
import { getContactos } from '../../src/services/api';
import type { Contacto } from '../../src/types';

const ESTADOS = [
  { value: 'todos',         label: 'Todos' },
  { value: 'nuevo',         label: 'Nuevo' },
  { value: 'contactado',    label: 'Contactado' },
  { value: 'precalificado', label: 'Precalificado' },
  { value: 'en_tramite',    label: 'En trámite' },
  { value: 'cerrado',       label: 'Cerrado' },
  { value: 'no_interesado', label: 'No interesado' },
];

export default function ProspectosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ refresh?: string }>();

  const [items,      setItems]      = useState<Contacto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [query,      setQuery]      = useState('');
  const [estado,     setEstado]     = useState('todos');

  async function load(opts?: { refreshing?: boolean }) {
    if (opts?.refreshing) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);

    try {
      const res = await getContactos({
        q:      query  || undefined,
        estado: estado !== 'todos' ? estado : undefined,
      });
      setItems(res.data);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Un solo efecto: carga cuando cambian los filtros (incluyendo montaje inicial)
  useEffect(() => {
    load();
  }, [query, estado]);

  // Efecto separado solo para el refresh tras crear prospecto
  useEffect(() => {
    if (params.refresh) load();
  }, [params.refresh]);

  return (
    <View style={[styles.flex, { backgroundColor: Colors.cream[50] }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Prospectos</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/prospectos/nuevo')}
          >
            <Text style={styles.addBtnText}>＋ Nuevo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar nombre, teléfono…"
            placeholderTextColor={Colors.dark[400]}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          horizontal
          data={ESTADOS}
          keyExtractor={e => e.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: e }) => (
            <TouchableOpacity
              style={[styles.filterChip, estado === e.value && styles.filterChipActive]}
              onPress={() => setEstado(e.value)}
            >
              <Text style={[styles.filterText, estado === e.value && styles.filterTextActive]}>
                {e.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── Error ── */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️  {errorMsg}</Text>
          <TouchableOpacity onPress={() => load()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Contenido ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold[400]} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ refreshing: true })}
              tintColor={Colors.gold[400]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>Sin prospectos</Text>
              <Text style={styles.emptyText}>
                Agrega tu primer prospecto con el botón Nuevo
              </Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/prospectos/${c.id}`)}
              activeOpacity={0.75}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {(c.nombre?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.nombre} numberOfLines={1}>{c.nombre}</Text>
                <Text style={styles.detalle} numberOfLines={1}>
                  {c.servicio ? `${c.servicio} · ` : ''}
                  {c.email ?? c.telefono ?? '—'}
                </Text>
              </View>
              <Badge
                label={c.estado_prospecto}
                variant={ESTADO_PROSPECTO_BADGE[c.estado_prospecto] ?? 'gray'}
                small
              />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor:   Colors.white,
    paddingHorizontal: Spacing.base,
    paddingBottom:     Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[300],
  },
  headerTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   Spacing.md,
  },
  headerTitle: {
    fontSize:   Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color:      Colors.dark[900],
  },
  addBtn: {
    backgroundColor:   Colors.dark[900],
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.xs,
    borderRadius:      Radius.md,
  },
  addBtnText: {
    color:      Colors.white,
    fontWeight: Typography.fontWeight.semibold,
    fontSize:   Typography.fontSize.sm,
  },

  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.cream[100],
    borderRadius:      Radius.md,
    paddingHorizontal: Spacing.sm,
    marginBottom:      Spacing.sm,
    borderWidth:       1,
    borderColor:       Colors.cream[300],
  },
  searchIcon:  { fontSize: 14, marginRight: 6 },
  searchInput: {
    flex:            1,
    paddingVertical: Spacing.sm,
    fontSize:        Typography.fontSize.sm,
    color:           Colors.dark[800],
  },
  clearBtn: { color: Colors.dark[400], fontSize: 14, padding: 4 },

  filterList:        { gap: Spacing.xs, paddingBottom: Spacing.xs },
  filterChip:        { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.cream[50] },
  filterChipActive:  { backgroundColor: Colors.dark[900], borderColor: Colors.dark[900] },
  filterText:        { color: Colors.dark[500], fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold },
  filterTextActive:  { color: Colors.white },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fef2f2', borderBottomWidth: 1, borderBottomColor: '#fecaca',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  errorText:  { color: '#dc2626', fontSize: Typography.fontSize.xs, flex: 1 },
  retryText:  { color: '#dc2626', fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, marginLeft: Spacing.sm },

  listContent: { padding: Spacing.sm },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.cream[200], gap: Spacing.sm,
  },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.cream[200], alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: Colors.dark[700], fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.base },
  info:         { flex: 1 },
  nombre:       { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  detalle:      { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },

  emptyWrap:  { alignItems: 'center', paddingTop: 80 },
  emptyIcon:  { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[700], marginBottom: Spacing.xs },
  emptyText:  { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', paddingHorizontal: Spacing.xl },
});
