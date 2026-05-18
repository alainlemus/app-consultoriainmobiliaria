import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Badge, { ESTADO_EXPEDIENTE_BADGE } from '../../src/components/ui/Badge';
import { getExpedientes } from '../../src/services/api';
import type { Expediente } from '../../src/types';

const ESTADOS_EXP = ['todos', 'en_proceso', 'documentacion', 'autorizado', 'escrituracion', 'cerrado', 'cancelado'];

export default function ExpedientesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items,      setItems]      = useState<Expediente[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estado,     setEstado]     = useState('todos');

  const load = useCallback(async () => {
    try {
      const res = await getExpedientes({ estado: estado !== 'todos' ? estado : undefined });
      setItems(res.data);
    } catch {
      // offline
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [estado]);

  useEffect(() => { setLoading(true); load(); }, [estado]);

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>CRM</Text>
        <Text style={styles.headerTitle}>Expedientes</Text>
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
                {e === 'todos' ? 'Todos' : e.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

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
              <View style={styles.folioBox}>
                <Text style={styles.folioText}>{exp.folio}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.nombre}>
                  {exp.contacto ? `${exp.contacto.nombre} ${exp.contacto.apellido_paterno}` : `Exp. #${exp.id}`}
                </Text>
                <Text style={styles.tipo}>{exp.tipo_tramite?.nombre ?? '—'}</Text>
                {exp.monto_credito ? (
                  <Text style={styles.monto}>
                    ${exp.monto_credito.toLocaleString('es-MX')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.rowRight}>
                <Badge label={exp.estado} variant={ESTADO_EXPEDIENTE_BADGE[exp.estado] ?? 'gray'} small />
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

  header:     { backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, paddingTop: Spacing.md },
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
  folioBox: { width: 52, height: 52, borderRadius: Radius.sm, backgroundColor: Colors.dark[800], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.gold[700] },
  folioText:{ color: Colors.gold[400], fontSize: 9, fontWeight: Typography.fontWeight.bold, letterSpacing: 0.5, textAlign: 'center' },
  info:   { flex: 1 },
  nombre: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800] },
  tipo:   { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2 },
  monto:  { fontSize: Typography.fontSize.xs, color: Colors.gold[600], fontWeight: Typography.fontWeight.semibold, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  chevron:{ color: Colors.dark[400], fontSize: 20 },
  empty:  { textAlign: 'center', color: Colors.dark[400], marginTop: 40, fontSize: Typography.fontSize.sm },
});
