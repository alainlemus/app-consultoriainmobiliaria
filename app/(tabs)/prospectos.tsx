import React, { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Modal, Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Badge, { ESTADO_PROSPECTO_BADGE } from '../../src/components/ui/Badge';
import { getContactos, getAsesores, type AsesorBasico } from '../../src/services/api';
import { cacheContactos, getCacheContactos, getContactosPendientesSync } from '../../src/services/offline';
import { useSyncContext } from '../../src/contexts/SyncContext';
import { useAuth } from '../../src/contexts/AuthContext';
import type { Contacto } from '../../src/types';

const ESTADOS = [
  { value: 'todos',         label: 'Todos' },
  { value: 'nuevo',         label: 'Nuevo' },
  { value: 'precalificado', label: 'Precalificado' },
];

export default function ProspectosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ refresh?: string }>();
  const { online } = useSyncContext();
  const { isSuperAdmin } = useAuth();

  const [items,      setItems]      = useState<Contacto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [desdeCache, setDesdeCache] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [query,      setQuery]      = useState('');
  const [estado,     setEstado]     = useState('todos');

  // Filtro por asesor — solo super_admin
  const [asesores,         setAsesores]         = useState<AsesorBasico[]>([]);
  const [asesorFiltrado,   setAsesorFiltrado]   = useState<AsesorBasico | null>(null);
  const [modalAsesores,    setModalAsesores]    = useState(false);

  // Cargar lista de asesores una sola vez si es super_admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    getAsesores().then(setAsesores).catch(() => {});
  }, [isSuperAdmin]);

  const load = useCallback(async (opts?: { refreshing?: boolean }) => {
    if (opts?.refreshing) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);

    const pendientesCola = await getContactosPendientesSync();

    if (!online) {
      const cached = await getCacheContactos();
      const filtrados = cached.filter(c => {
        const matchEstado  = estado === 'todos' || c.estado_prospecto === estado;
        const matchQuery   = !query || c.nombre?.toLowerCase().includes(query.toLowerCase());
        const matchAsesor  = !asesorFiltrado || c.asesor_id === asesorFiltrado.id;
        return matchEstado && matchQuery && matchAsesor;
      });
      const pendientesNuevos = pendientesCola.filter(p =>
        !filtrados.some(c => c._local_id === p._local_id)
      );
      setItems([...pendientesNuevos, ...filtrados]);
      setDesdeCache(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res = await getContactos({
        q:          query  || undefined,
        estado:     estado !== 'todos' ? estado : undefined,
        asesor_id:  asesorFiltrado?.id,
      });
      const pendientesNuevos = pendientesCola.filter(p =>
        !res.data.some(c => c._local_id === p._local_id)
      );
      setItems([...pendientesNuevos, ...res.data]);
      setDesdeCache(false);
      if (!query && estado === 'todos' && !asesorFiltrado) {
        cacheContactos(res.data).catch(() => {});
      }
    } catch (e: unknown) {
      const cached = await getCacheContactos();
      const pendientesNuevos = pendientesCola.filter(p =>
        !cached.some(c => c._local_id === p._local_id)
      );
      if (cached.length > 0 || pendientesNuevos.length > 0) {
        setItems([...pendientesNuevos, ...cached]);
        setDesdeCache(true);
      } else {
        setErrorMsg(e instanceof Error ? e.message : 'Error de conexión');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [online, query, estado, asesorFiltrado]);

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
          <Ionicons name="search" size={20} color={Colors.dark[500]} style={styles.searchIcon} />
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
              <Ionicons name="close" size={18} color={Colors.dark[500]} style={styles.clearBtn} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtro por asesor — solo super_admin */}
        {isSuperAdmin && (
          <TouchableOpacity
            style={styles.asesorFiltro}
            onPress={() => setModalAsesores(true)}
          >
            <Ionicons name="person" size={20} color={Colors.dark[500]} style={styles.asesorFiltroIcon} />
            <Text style={styles.asesorFiltroText} numberOfLines={1}>
              {asesorFiltrado ? asesorFiltrado.name : 'Todos los asesores'}
            </Text>
            {asesorFiltrado && (
              <TouchableOpacity
                onPress={() => setAsesorFiltrado(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={Colors.dark[400]} />
              </TouchableOpacity>
            )}
            {!asesorFiltrado && <Ionicons name="chevron-down" size={16} color={Colors.dark[400]} style={styles.asesorFiltroChevron} />}
          </TouchableOpacity>
        )}

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

      {/* ── Aviso de cache offline ── */}
      {desdeCache && (
        <View style={styles.cacheBanner}>
          <Text style={styles.cacheText}>
            Datos guardados en el dispositivo
          </Text>
        </View>
      )}

      {/* ── Error ── */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="warning" size={16} color={Colors.dark[500]} /><Text style={[styles.errorText, { flexShrink: 1 }]}> {errorMsg}</Text></View>
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
              <Ionicons name="people" size={20} color={Colors.dark[500]} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>Sin prospectos</Text>
              <Text style={styles.emptyText}>
                Agrega tu primer prospecto con el botón Nuevo
              </Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={[styles.row, c._pendiente_sync && styles.rowPendiente]}
              onPress={() => c._pendiente_sync
                ? undefined  // no navegar a pendientes sin id
                : router.push(`/prospectos/${c.id}`)
              }
              activeOpacity={c._pendiente_sync ? 1 : 0.75}
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
                {c._pendiente_sync && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="hourglass" size={16} color={Colors.dark[500]} /><Text style={[styles.pendienteSyncText, { flexShrink: 1 }]}>Pendiente de sincronizar</Text></View>
                )}
              </View>
              {!c._pendiente_sync && (
                <Badge
                  label={c.estado_prospecto}
                  variant={ESTADO_PROSPECTO_BADGE[c.estado_prospecto] ?? 'gray'}
                  small
                />
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal selector de asesor */}
      <Modal visible={modalAsesores} animationType="slide" transparent onRequestClose={() => setModalAsesores(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalAsesores(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Filtrar por asesor</Text>
          <TouchableOpacity
            style={[styles.asesorItem, !asesorFiltrado && styles.asesorItemActive]}
            onPress={() => { setAsesorFiltrado(null); setModalAsesores(false); }}
          >
            <Text style={[styles.asesorItemText, !asesorFiltrado && styles.asesorItemTextActive]}>
              <Ionicons name="people" size={16} color={Colors.dark[500]} />{' '}Todos los asesores
            </Text>
            {!asesorFiltrado && <Ionicons name="checkmark" size={18} color={Colors.gold[400]} />}
          </TouchableOpacity>
          {asesores.map(a => (
            <TouchableOpacity
              key={a.id}
              style={[styles.asesorItem, asesorFiltrado?.id === a.id && styles.asesorItemActive]}
              onPress={() => { setAsesorFiltrado(a); setModalAsesores(false); }}
            >
              <Text style={[styles.asesorItemText, asesorFiltrado?.id === a.id && styles.asesorItemTextActive]}>
                <Ionicons name="person" size={16} color={Colors.dark[500]} />{' '}{a.name}
              </Text>
              {asesorFiltrado?.id === a.id && <Ionicons name="checkmark" size={18} color={Colors.gold[400]} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
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

  cacheBanner: {
    backgroundColor:   Colors.cream[100],
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.xs,
  },
  cacheText: { color: Colors.dark[500], fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold },

  listContent: { padding: Spacing.sm },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.cream[200], gap: Spacing.sm,
  },
  rowPendiente: {
    borderColor: Colors.gold[400],
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  pendienteSyncText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gold[600],
    marginTop: 2,
    fontStyle: 'italic',
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

  // Selector de asesor
  asesorFiltro: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.cream[100],
    borderRadius:      Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    marginBottom:      Spacing.sm,
    borderWidth:       1,
    borderColor:       Colors.cream[300],
    gap:               Spacing.sm,
  },
  asesorFiltroIcon:    { fontSize: 16 },
  asesorFiltroText:    { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold },
  asesorFiltroChevron: { fontSize: 12, color: Colors.dark[400] },

  // Modal asesor
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor:     Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius:20,
    padding:             Spacing.base,
    paddingBottom:       40,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.dark[300],
    alignSelf: 'center', marginBottom: Spacing.base,
  },
  modalTitle: {
    fontSize:     Typography.fontSize.lg,
    fontWeight:   Typography.fontWeight.bold,
    color:        Colors.dark[900],
    marginBottom: Spacing.md,
  },
  asesorItem: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius:    Radius.md,
    marginBottom:    Spacing.xs,
  },
  asesorItemActive:    { backgroundColor: Colors.gold[50] },
  asesorItemText:      { fontSize: Typography.fontSize.base, color: Colors.dark[800] },
  asesorItemTextActive: { color: Colors.gold[700], fontWeight: Typography.fontWeight.semibold },
});
