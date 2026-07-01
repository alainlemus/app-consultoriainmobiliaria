import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, Image, Modal, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Badge, { ESTADO_EXPEDIENTE_BADGE } from '../../src/components/ui/Badge';
import type { BadgeVariant } from '../../src/components/ui/Badge';
import { getExpedientes, getAsesores, type AsesorBasico } from '../../src/services/api';
import { cacheExpedientes, getCacheExpedientes, getExpedientesPendientesSync } from '../../src/services/offline';
import { useSyncContext } from '../../src/contexts/SyncContext';
import { useAuth } from '../../src/contexts/AuthContext';
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
  const { isSuperAdmin } = useAuth();

  const [items,      setItems]      = useState<Expediente[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [desdeCache, setDesdeCache] = useState(false);
  const [etapa,      setEtapa]      = useState('todos');

  // Filtro por asesor — solo super_admin
  const [asesores,       setAsesores]       = useState<AsesorBasico[]>([]);
  const [asesorFiltrado, setAsesorFiltrado] = useState<AsesorBasico | null>(null);
  const [modalAsesores,  setModalAsesores]  = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    getAsesores().then(setAsesores).catch(() => {});
  }, [isSuperAdmin]);

  const load = useCallback(async (opts?: { refreshing?: boolean }) => {
    if (opts?.refreshing) setRefreshing(true);

    const pendientesCola = await getExpedientesPendientesSync();

    if (!online) {
      const cached = await getCacheExpedientes();
      const filtrados = etapa === 'todos'
        ? cached
        : cached.filter(e => e.etapa?.nombre === etapa);
      const filtradosPorAsesor = asesorFiltrado
        ? filtrados.filter(e => e.asesor_id === asesorFiltrado.id)
        : filtrados;
      const pendientesNuevos = pendientesCola.filter(p =>
        !filtradosPorAsesor.some(e => e._local_id === p._local_id)
      );
      setItems([...pendientesNuevos, ...filtradosPorAsesor]);
      setDesdeCache(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res = await getExpedientes({
        etapa:     etapa !== 'todos' ? etapa : undefined,
        asesor_id: asesorFiltrado?.id,
      });
      const pendientesNuevos = pendientesCola.filter(p =>
        !res.data.some(e => e._local_id === p._local_id)
      );
      setItems([...pendientesNuevos, ...res.data]);
      setDesdeCache(false);
      if (etapa === 'todos' && !asesorFiltrado) {
        cacheExpedientes(res.data).catch(() => {});
      }
    } catch {
      const cached = await getCacheExpedientes();
      const pendientesNuevos = pendientesCola.filter(p =>
        !cached.some(e => e._local_id === p._local_id)
      );
      if (cached.length > 0 || pendientesNuevos.length > 0) {
        setItems([...pendientesNuevos, ...cached]);
        setDesdeCache(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [online, etapa, asesorFiltrado]);

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

        {/* Filtro por asesor — solo super_admin */}
        {isSuperAdmin && (
          <TouchableOpacity
            style={styles.asesorFiltro}
            onPress={() => setModalAsesores(true)}
          >
            <Text style={styles.asesorFiltroIcon}>👤</Text>
            <Text style={styles.asesorFiltroText} numberOfLines={1}>
              {asesorFiltrado ? asesorFiltrado.name : 'Todos los asesores'}
            </Text>
            {asesorFiltrado && (
              <TouchableOpacity
                onPress={() => setAsesorFiltrado(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            )}
            {!asesorFiltrado && <Text style={styles.asesorFiltroChevron}>▾</Text>}
          </TouchableOpacity>
        )}

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
              style={[styles.row, exp._pendiente_sync && styles.rowPendiente]}
              onPress={() => exp._pendiente_sync
                ? undefined
                : router.push(`/expedientes/${exp.id}`)
              }
              activeOpacity={exp._pendiente_sync ? 1 : 0.8}
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
                {/* Fila superior: badge + chevron */}
                {!exp._pendiente_sync && (
                  <View style={styles.badgeRow}>
                    <Badge
                      label={exp.etapa?.nombre ?? exp.estado}
                      variant={ETAPA_BADGE[exp.etapa?.nombre ?? ''] ?? ESTADO_EXPEDIENTE_BADGE[exp.estado] ?? 'gray'}
                      small
                    />
                    <Text style={styles.chevron}>›</Text>
                  </View>
                )}
                <Text style={styles.nombre}>
                  {exp.contacto?.nombre ?? `Expediente #${exp.id}`}
                </Text>
                <Text style={styles.folio}>
                  {exp.folio ?? (exp._pendiente_sync ? 'Pendiente de asignar folio' : `#${exp.id}`)}
                </Text>
                <Text style={styles.tipo}>
                  {exp.tipo_tramite?.nombre ?? '—'}
                </Text>
                {exp._pendiente_sync && (
                  <Text style={styles.pendienteSyncText}>⏳ Pendiente de sincronizar</Text>
                )}
              </View>
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
              👥 Todos los asesores
            </Text>
            {!asesorFiltrado && <Text style={{ color: Colors.gold[400] }}>✓</Text>}
          </TouchableOpacity>
          {asesores.map(a => (
            <TouchableOpacity
              key={a.id}
              style={[styles.asesorItem, asesorFiltrado?.id === a.id && styles.asesorItemActive]}
              onPress={() => { setAsesorFiltrado(a); setModalAsesores(false); }}
            >
              <Text style={[styles.asesorItemText, asesorFiltrado?.id === a.id && styles.asesorItemTextActive]}>
                👤 {a.name}
              </Text>
              {asesorFiltrado?.id === a.id && <Text style={{ color: Colors.gold[400] }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
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
  row:    { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.white, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.xs, borderWidth: 1, borderColor: Colors.cream[300], gap: Spacing.sm },
  rowPendiente: { borderColor: Colors.gold[400], borderStyle: 'dashed', opacity: 0.85 },
  pendienteSyncText: { fontSize: Typography.fontSize.xs, color: Colors.gold[600], marginTop: 2, fontStyle: 'italic' },
  avatar:        { width: 48, height: 48, borderRadius: 24 },
  avatarFallback:{ width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.dark[800], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.gold[700] },
  avatarLetter:  { color: Colors.gold[400], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  info:   { flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  nombre: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800] },
  folio:  { fontSize: Typography.fontSize.xs, color: Colors.gold[600], fontWeight: Typography.fontWeight.semibold, marginTop: 1 },
  tipo:   { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  chevron:{ color: Colors.dark[400], fontSize: 20 },
  empty:  { textAlign: 'center', color: Colors.dark[400], marginTop: 40, fontSize: Typography.fontSize.sm },

  cacheBanner: {
    backgroundColor:  Colors.dark[800],
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.md,
    borderLeftWidth:   4,
    borderLeftColor:   Colors.gold[400],
  },
  cacheText: { color: Colors.white, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, lineHeight: Typography.fontSize.sm * 1.4 },

  // Selector de asesor (sobre fondo oscuro del header)
  asesorFiltro: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   'rgba(255,255,255,0.1)',
    borderRadius:      Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    marginTop:         Spacing.sm,
    gap:               Spacing.sm,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.2)',
  },
  asesorFiltroIcon:    { fontSize: 15 },
  asesorFiltroText:    { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.cream[100], fontWeight: Typography.fontWeight.semibold },
  asesorFiltroChevron: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },

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
  asesorItemActive:     { backgroundColor: Colors.gold[50] },
  asesorItemText:       { fontSize: Typography.fontSize.base, color: Colors.dark[800] },
  asesorItemTextActive: { color: Colors.gold[700], fontWeight: Typography.fontWeight.semibold },
});
