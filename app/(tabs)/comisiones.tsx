import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { getComisiones, getResumenComisiones } from '../../src/services/api';
import type { Comision, ResumenComisiones } from '../../src/types';

type FiltroEstado = 'todas' | 'pendiente' | 'pagada';

const FILTROS: { key: FiltroEstado; label: string }[] = [
  { key: 'todas',     label: 'Todas'     },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'pagada',    label: 'Pagadas'    },
];

function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style:    'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatFecha(fecha?: string): string {
  if (!fecha) return '—';
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

// ── Tarjeta de resumen ────────────────────────────────────────────────────────

function ResumenCards({ resumen }: { resumen: ResumenComisiones }) {
  return (
    <View style={s.cardsRow}>
      <View style={[s.card, s.cardPendiente]}>
        <Text style={s.cardLabel}>Por cobrar</Text>
        <Text style={s.cardMonto}>{formatMXN(resumen.total_pendiente)}</Text>
        <Text style={s.cardSub}>{resumen.cantidad_pendientes} comisión{resumen.cantidad_pendientes !== 1 ? 'es' : ''}</Text>
      </View>
      <View style={[s.card, s.cardPagada]}>
        <Text style={s.cardLabel}>Cobrado</Text>
        <Text style={s.cardMonto}>{formatMXN(resumen.total_pagado)}</Text>
        <Text style={s.cardSub}>{resumen.cantidad_pagadas} comisión{resumen.cantidad_pagadas !== 1 ? 'es' : ''}</Text>
      </View>
    </View>
  );
}

// ── Fila de comisión ──────────────────────────────────────────────────────────

function ComisionRow({ item }: { item: Comision }) {
  const esPagada   = item.estado === 'pagada';
  const esAprobada = item.estado === 'aprobada';

  return (
    <View style={s.row}>
      {/* Badge estado */}
      <View style={[s.badge, esPagada ? s.badgePagada : esAprobada ? s.badgeAprobada : s.badgePendiente]}>
        <Text style={[s.badgeText, esPagada ? s.badgePagadaText : esAprobada ? s.badgeAprobadaText : s.badgePendienteText]}>
          {esPagada ? 'Pagada' : esAprobada ? 'Aprobada' : 'Pendiente'}
        </Text>
      </View>

      {/* Info principal */}
      <View style={s.rowBody}>
        <Text style={s.rowNombre} numberOfLines={1}>
          {item.acreditado ?? `Expediente #${item.expediente_id}`}
        </Text>
        <Text style={s.rowSub}>
          {item.porcentaje_comision}% de {formatMXN(item.monto_base)}
        </Text>
        {esPagada && item.fecha_pago ? (
          <Text style={s.rowFecha}>Pagado el {formatFecha(item.fecha_pago)}</Text>
        ) : (
          <Text style={s.rowFecha}>Generada el {formatFecha(item.fecha_generacion)}</Text>
        )}
        {item.notas ? (
          <Text style={s.rowNotas} numberOfLines={2}>{item.notas}</Text>
        ) : null}
      </View>

      {/* Monto */}
      <Text style={[s.rowMonto, esPagada && s.rowMontoPagado]}>
        {formatMXN(item.monto_comision)}
      </Text>
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function ComisionesScreen() {
  const insets = useSafeAreaInsets();

  const [filtro,     setFiltro]     = useState<FiltroEstado>('todas');
  const [items,      setItems]      = useState<Comision[]>([]);
  const [resumen,    setResumen]    = useState<ResumenComisiones | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,       setPage]       = useState(1);
  const [lastPage,   setLastPage]   = useState(1);

  const currentFiltro = useRef(filtro);
  currentFiltro.current = filtro;

  const cargar = useCallback(async (nuevoFiltro: FiltroEstado, nuevaPagina: number, append = false) => {
    try {
      const params: { estado?: 'pagada' | 'pendiente'; page?: number } = { page: nuevaPagina };
      if (nuevoFiltro !== 'todas') params.estado = nuevoFiltro;

      const [res, resumenData] = await Promise.all([
        getComisiones(params),
        nuevaPagina === 1 ? getResumenComisiones() : Promise.resolve(null),
      ]);

      setItems(prev => append ? [...prev, ...res.data] : res.data);
      setPage(res.current_page);
      setLastPage(res.last_page);
      if (resumenData) setResumen(resumenData);
    } catch {
      // Silencioso — muestra lista vacía
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    setLoading(true);
    cargar(filtro, 1, false).finally(() => setLoading(false));
  }, []);

  // Cambio de filtro
  async function handleFiltro(f: FiltroEstado) {
    if (f === filtro) return;
    setFiltro(f);
    setLoading(true);
    setItems([]);
    await cargar(f, 1, false);
    setLoading(false);
  }

  // Pull to refresh
  async function handleRefresh() {
    setRefreshing(true);
    await cargar(filtro, 1, false);
    setRefreshing(false);
  }

  // Infinite scroll
  async function handleEndReached() {
    if (loadingMore || page >= lastPage) return;
    setLoadingMore(true);
    await cargar(filtro, page + 1, true);
    setLoadingMore(false);
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={s.headerTitle}>Mis Comisiones</Text>
        <Text style={s.headerSub}>Solo de expedientes cerrados</Text>
      </View>

      {/* Tarjetas resumen */}
      {resumen && <ResumenCards resumen={resumen} />}

      {/* Filtros */}
      <View style={s.filtros}>
        {FILTROS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filtroBtn, filtro === f.key && s.filtroBtnActive]}
            onPress={() => handleFiltro(f.key)}
          >
            <Text style={[s.filtroBtnText, filtro === f.key && s.filtroBtnTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.gold[400]} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <ComisionRow item={item} />}
          contentContainerStyle={[
            s.listContent,
            items.length === 0 && s.listEmpty,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.gold[400]} />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>💰</Text>
              <Text style={s.emptyTitle}>Sin comisiones</Text>
              <Text style={s.emptySub}>
                {filtro === 'pendiente'
                  ? 'No tienes comisiones pendientes de expedientes cerrados.'
                  : filtro === 'pagada'
                  ? 'Aún no tienes comisiones pagadas.'
                  : 'Cuando un expediente cierre, sus comisiones aparecerán aquí.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={Colors.gold[400]} style={{ marginVertical: 16 }} />
            ) : null
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream[50] },

  // Header
  header:     { backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.base, paddingBottom: Spacing.lg },
  headerTitle:{ fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black, color: Colors.cream[50] },
  headerSub:  { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },

  // Tarjetas resumen
  cardsRow:       { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.base, backgroundColor: Colors.dark[900] },
  card:           { flex: 1, borderRadius: Radius.base, padding: Spacing.md },
  cardPendiente:  { backgroundColor: Colors.dark[800], borderWidth: 1, borderColor: Colors.gold[700] },
  cardPagada:     { backgroundColor: Colors.gold[500] },
  cardLabel:      { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.white, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  cardMonto:      { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.black, color: Colors.white },
  cardSub:        { fontSize: 10, color: Colors.white, marginTop: 2 },

  // Filtros
  filtros:            { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, backgroundColor: Colors.cream[100], borderBottomWidth: 1, borderBottomColor: Colors.cream[200] },
  filtroBtn:          { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: Colors.cream[200] },
  filtroBtnActive:    { backgroundColor: Colors.dark[900] },
  filtroBtnText:      { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[500] },
  filtroBtnTextActive:{ color: Colors.gold[400] },

  // Lista
  listContent: { paddingTop: Spacing.sm, paddingHorizontal: Spacing.base },
  listEmpty:   { flex: 1, justifyContent: 'center' },
  separator:   { height: 1, backgroundColor: Colors.cream[200], marginVertical: 2 },

  // Fila
  row:       { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.md, gap: Spacing.sm },
  rowBody:   { flex: 1 },
  rowNombre: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  rowSub:    { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 1 },
  rowFecha:  { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },
  rowNotas:  { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 4, fontStyle: 'italic' },
  rowMonto:       { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.black, color: Colors.dark[700], textAlign: 'right', minWidth: 90 },
  rowMontoPagado: { color: Colors.gold[600] },

  // Badge
  badge:             { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, alignSelf: 'flex-start', marginTop: 2 },
  badgePendiente:    { backgroundColor: Colors.cream[200] },
  badgeAprobada:     { backgroundColor: '#e0f2fe' },
  badgePagada:       { backgroundColor: '#d1fae5' },
  badgeText:         { fontSize: 9, fontWeight: Typography.fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
  badgePendienteText:{ color: Colors.dark[600] },
  badgeAprobadaText: { color: '#0369a1' },
  badgePagadaText:   { color: '#065f46' },

  // Empty
  emptyWrap:  { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyIcon:  { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.dark[700], marginBottom: Spacing.sm },
  emptySub:   { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', lineHeight: 20 },

  // Loader
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
