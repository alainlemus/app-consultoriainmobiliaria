/**
 * Super admin → Gestores: todos los encargos a gestores, con filtros.
 * Solo lectura (enviar, corregir y cancelar se hacen en el panel web).
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import { Badge, BadgeEstadoEncargo, fechaCorta, venceInfo } from '@/src/components/gestor/encargoUi';
import { getEncargosAdmin, type EncargoAdmin, type FiltroAdmin, type MetaEncargosAdmin } from '@/src/services/adminGestoresApi';

const FILTROS: [FiltroAdmin, string][] = [['abiertos', 'Abiertos'], ['vencidos', 'Vencidos'], ['terminados', 'Terminados'], ['todos', 'Todos']];

/** "hace 3 h", "hace 2 días"… */
function hace(iso: string | null): string {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

export default function AdminGestoresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filtro, setFiltro]       = useState<FiltroAdmin>('abiertos');
  const [gestorId, setGestorId]   = useState<number | null>(null);
  const [items, setItems]         = useState<EncargoAdmin[]>([]);
  const [meta, setMeta]           = useState<MetaEncargosAdmin | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refrescando, setRef]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const cargar = useCallback(async (f: FiltroAdmin, g: number | null) => {
    try {
      const r = await getEncargosAdmin({ filtro: f, gestorId: g });
      setItems(r.data); setMeta(r.meta); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.');
    } finally {
      setLoading(false); setRef(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(filtro, gestorId); }, [cargar, filtro, gestorId]));

  const cambiar = (f: FiltroAdmin, g: number | null) => {
    if (f === filtro && g === gestorId) return;
    setFiltro(f); setGestorId(g); setLoading(true);
  };

  return (
    <View style={s.flex}>
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Atrás"><Ionicons name="arrow-back" size={22} color={Colors.cream[50]} /></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerSub}>ADMINISTRACIÓN</Text>
            <Text style={s.headerTitle}>Gestores</Text>
          </View>
        </View>
        <View style={s.chips}>
          {FILTROS.map(([f, l]) => (
            <TouchableOpacity key={f} style={[s.chip, filtro === f && s.chipOn]} onPress={() => cambiar(f, gestorId)}>
              <Text style={[s.chipText, filtro === f && s.chipTextOn]}>
                {l}{f === 'vencidos' && meta?.vencidos ? ` · ${meta.vencidos}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {meta && meta.gestores.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gestores}>
            {[{ id: 0, nombre: 'Todos los gestores' }, ...meta.gestores].map(g => {
              const on = (gestorId ?? 0) === g.id;
              return (
                <TouchableOpacity key={g.id} style={[s.gestor, on && s.gestorOn]} onPress={() => cambiar(filtro, g.id || null)}>
                  <Text style={[s.gestorText, on && s.gestorTextOn]} numberOfLines={1}>{g.nombre}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.gold[400]} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRef(true); cargar(filtro, gestorId); }} tintColor={Colors.gold[400]} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name={error ? 'alert-circle-outline' : 'briefcase-outline'} size={36} color={Colors.gold[700]} />
              <Text style={s.emptyTitle}>{error ? 'No se pudo cargar' : filtro === 'vencidos' ? 'Nada vencido' : 'Sin encargos'}</Text>
              <Text style={s.emptyText}>{error ?? 'Los expedientes se envían a un gestor desde el panel web, en la pestaña «Gestores» del expediente.'}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const vence = venceInfo(item.fecha_entrega, item.estado);
            return (
              <TouchableOpacity style={[s.row, item.vencido && s.rowVencido]} onPress={() => router.push(`/admin-gestores/${item.id}`)}>
                <View style={s.rowTop}>
                  <Text style={s.folio}>{item.expediente.folio ?? `#${item.expediente.id}`}</Text>
                  <BadgeEstadoEncargo estado={item.estado} label={item.estado_label} />
                </View>
                <Text style={s.nombre} numberOfLines={1}>{item.expediente.acreditado ?? '—'}</Text>
                <View style={s.linea}>
                  <Ionicons name="person-outline" size={14} color={Colors.dark[500]} />
                  <Text style={s.lineaText} numberOfLines={1}>{item.gestor?.nombre ?? 'Sin gestor'}</Text>
                </View>
                <Text style={s.instr} numberOfLines={2}>{item.instrucciones}</Text>
                <View style={s.rowBottom}>
                  {vence ? <Badge texto={vence.texto} bg={vence.urgente ? '#fee2e2' : Colors.gold[100]} fg={vence.urgente ? '#b91c1c' : Colors.gold[700]} /> : <View />}
                  <Text style={s.muted}>{item.subidos_count} subido{item.subidos_count === 1 ? '' : 's'} · {hace(item.updated_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: Colors.cream[50] },
  header:      { backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.base, paddingBottom: Spacing.md },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerSub:   { fontSize: Typography.fontSize.xs, color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold, letterSpacing: 2 },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.black, color: Colors.cream[50] },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.md },
  chip:        { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.dark[600] },
  chipOn:      { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  chipText:    { fontSize: Typography.fontSize.sm, color: Colors.cream[100], fontWeight: Typography.fontWeight.semibold },
  chipTextOn:  { color: Colors.dark[900] },
  gestores:    { gap: Spacing.xs, marginTop: Spacing.sm, paddingRight: Spacing.base },
  gestor:      { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, backgroundColor: Colors.dark[800], maxWidth: 180 },
  gestorOn:    { backgroundColor: Colors.cream[50] },
  gestorText:  { fontSize: Typography.fontSize.xs, color: Colors.cream[200] },
  gestorTextOn:{ color: Colors.dark[900], fontWeight: Typography.fontWeight.bold },

  list:        { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  row:         { backgroundColor: Colors.white, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cream[300], padding: Spacing.md, gap: 4 },
  rowVencido:  { borderColor: '#fca5a5' },
  rowTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  rowBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, gap: Spacing.sm },
  folio:       { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.gold[700], letterSpacing: 1 },
  nombre:      { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  linea:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lineaText:   { fontSize: Typography.fontSize.sm, color: Colors.dark[700], flexShrink: 1 },
  instr:       { fontSize: Typography.fontSize.sm, color: Colors.dark[500] },
  muted:       { fontSize: Typography.fontSize.xs, color: Colors.dark[400] },
  empty:       { alignItems: 'center', marginTop: 60, gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyTitle:  { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.extrabold, color: Colors.dark[900] },
  emptyText:   { fontSize: Typography.fontSize.sm, color: Colors.dark[500], textAlign: 'center' },
});
