/** Mis expedientes (gestor): los encargos que le envió la administración. */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, AppState } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { getEncargos, type EncargoResumen, type FiltroEncargos } from '@/src/services/gestorApi';
import { BadgeEstadoEncargo, fechaCorta, venceInfo } from '@/src/components/gestor/encargoUi';

const AYUDA_VISTA_KEY = 'gestor_ayuda_vista_v1';

export default function GestorExpedientesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [filtro, setFiltro]         = useState<FiltroEncargos>('activos');
  const [items, setItems]           = useState<EncargoResumen[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [desdeCache, setDesdeCache] = useState(false);
  const [error, setError]           = useState('');

  // La primera vez que entra, mostrarle cómo funciona
  useEffect(() => {
    AsyncStorage.getItem(AYUDA_VISTA_KEY).then(v => {
      if (!v) {
        AsyncStorage.setItem(AYUDA_VISTA_KEY, '1').catch(() => {});
        router.push('/ayuda-gestor');
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cargar = useCallback(async (f: FiltroEncargos = filtro) => {
    try {
      const r = await getEncargos(f);
      setItems(r.data);
      setDesdeCache(r.desdeCache);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar tus expedientes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtro]);

  // Al entrar a la pestaña (y al regresar de un detalle) y al volver a la app
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') cargar(); });
    return () => sub.remove();
  }, [cargar]);

  const cambiarFiltro = (f: FiltroEncargos) => {
    if (f === filtro) return;
    setFiltro(f);
    setLoading(true);
    cargar(f);
  };

  const nombre = user?.name?.split(' ')[0]?.toUpperCase();

  return (
    <View style={s.flex}>
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerSub}>GESTOR{nombre ? ` · HOLA, ${nombre}` : ''}</Text>
            <Text style={s.headerTitle}>Expedientes</Text>
          </View>
          <TouchableOpacity style={s.ayudaBtn} onPress={() => router.push('/ayuda-gestor')} accessibilityLabel="¿Cómo funciona?">
            <Ionicons name="help-circle-outline" size={22} color={Colors.cream[50]} />
          </TouchableOpacity>
        </View>
        <View style={s.goldLine} />
        <View style={s.chips}>
          {([['activos', 'Por hacer'], ['terminados', 'Terminados']] as const).map(([f, l]) => (
            <TouchableOpacity key={f} style={[s.chip, filtro === f && s.chipOn]} onPress={() => cambiarFiltro(f)}>
              <Text style={[s.chipText, filtro === f && s.chipTextOn]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {desdeCache && (
        <View style={s.cache}>
          <Ionicons name="cloud-offline-outline" size={14} color={Colors.dark[500]} />
          <Text style={s.cacheText}>Sin señal · mostrando lo último descargado</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.gold[400]} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={Colors.gold[400]} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name={error ? 'alert-circle-outline' : 'folder-open-outline'} size={36} color={Colors.gold[700]} /></View>
              <Text style={s.emptyTitle}>{error ? 'No se pudo cargar' : filtro === 'activos' ? 'Aún no tienes expedientes' : 'Sin expedientes terminados'}</Text>
              <Text style={s.emptyText}>
                {error || (filtro === 'activos'
                  ? 'Cuando la administración te envíe uno, te llegará una notificación y aparecerá aquí con lo que tienes que tramitar.'
                  : 'Aquí verás los encargos que la administración ya cerró.')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const vence = venceInfo(item.fecha_entrega, item.estado);
            const inicial = (item.expediente.acreditado ?? '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
            const accion = item.estado === 'por_revisar';
            return (
              <TouchableOpacity style={[s.row, accion && s.rowAccion]} onPress={() => router.push(`/gestor/${item.id}`)}>
                <View style={s.avatar}><Text style={s.avatarText}>{inicial}</Text></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={s.rowTop}>
                    <Text style={s.folio}>{item.expediente.folio ?? `#${item.expediente.id}`}</Text>
                    <BadgeEstadoEncargo estado={item.estado} label={item.estado_label} />
                  </View>
                  <Text style={s.nombre} numberOfLines={1}>{item.expediente.acreditado ?? '—'}</Text>
                  <View style={s.encargo}>
                    <Ionicons name="business-outline" size={14} color={Colors.dark[500]} />
                    <Text style={s.encargoText} numberOfLines={2}>{item.instrucciones}</Text>
                  </View>
                  <View style={s.meta}>
                    <Text style={s.metaText}>📎 {item.documentos_count} documentos</Text>
                    {vence && <Text style={[s.metaText, vence.urgente && s.metaUrgente]}>{vence.texto}</Text>}
                    {!vence && item.enviado_at && <Text style={s.metaText}>Enviado {fechaCorta(item.enviado_at)}</Text>}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.dark[400]} />
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
  header:      { backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  headerRow:   { flexDirection: 'row', alignItems: 'flex-end' },
  headerSub:   { fontSize: Typography.fontSize.xs, color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold, letterSpacing: Typography.letterSpacing.widest },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black, color: Colors.cream[50] },
  ayudaBtn:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  goldLine:    { width: 32, height: 2, backgroundColor: Colors.gold[400], marginVertical: Spacing.sm },
  chips:       { flexDirection: 'row', gap: Spacing.xs },
  chip:        { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.dark[600] },
  chipOn:      { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  chipText:    { color: Colors.dark[400], fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold },
  chipTextOn:  { color: Colors.dark[900] },
  cache:       { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: Colors.cream[100], paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs },
  cacheText:   { color: Colors.dark[500], fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold },
  list:        { padding: Spacing.sm, paddingBottom: 120, flexGrow: 1 },
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.white, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.xs, borderWidth: 1, borderColor: Colors.cream[300] },
  rowAccion:   { borderColor: Colors.gold[400], borderWidth: 1.5 },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark[800], borderWidth: 1, borderColor: Colors.gold[700], alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: Colors.gold[400], fontWeight: Typography.fontWeight.bold },
  rowTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  folio:       { fontSize: Typography.fontSize.xs, color: Colors.gold[700], fontWeight: Typography.fontWeight.bold },
  nombre:      { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800] },
  encargo:     { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  encargoText: { flex: 1, fontSize: Typography.fontSize.xs, color: Colors.dark[500], lineHeight: Typography.fontSize.xs * 1.35 },
  meta:        { flexDirection: 'row', gap: Spacing.md, marginTop: 2, flexWrap: 'wrap' },
  metaText:    { fontSize: Typography.fontSize.xs, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold },
  metaUrgente: { color: Colors.error },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing['3xl'], gap: Spacing.md },
  emptyIcon:   { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.gold[100], alignItems: 'center', justifyContent: 'center' },
  emptyTitle:  { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.dark[800], textAlign: 'center' },
  emptyText:   { fontSize: Typography.fontSize.sm, color: Colors.dark[500], textAlign: 'center', lineHeight: Typography.fontSize.sm * 1.5 },
});
