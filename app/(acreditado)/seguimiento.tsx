import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../../src/theme';
import { getSeguimientoAcreditado } from '../../../src/services/acreditadoApi';
import type { SeguimientoAcreditado } from '../../../src/types';

const TIPO_ICON: Record<string, { icon: string; color: string }> = {
  cambio_etapa: { icon: 'arrow-forward-circle', color: '#1d4ed8' },
  documento:    { icon: 'document-text',         color: Colors.gold[400] },
  nota:         { icon: 'chatbubble',             color: '#15803d' },
  llamada:      { icon: 'call',                   color: '#7e22ce' },
  reunion:      { icon: 'people',                 color: '#0e7490' },
  pago:         { icon: 'cash',                   color: '#15803d' },
  alerta:       { icon: 'warning',                color: '#dc2626' },
};

export default function SeguimientoScreen() {
  const insets = useSafeAreaInsets();
  const [seguimientos, setSeguimientos] = useState<SeguimientoAcreditado[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await getSeguimientoAcreditado();
      setSeguimientos(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { cargar(); }, []);

  if (loading) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.gold[400]} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Seguimiento</Text>
        <Text style={styles.headerSub}>Historial de tu trámite</Text>
      </View>

      <FlatList
        data={seguimientos}
        keyExtractor={(_, i) => i.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={Colors.gold[400]} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={48} color={Colors.dark[600]} />
            <Text style={styles.emptyText}>Sin actividad registrada aún.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const cfg = TIPO_ICON[item.tipo] ?? { icon: 'ellipse', color: Colors.dark[500] };
          const isLast = index === seguimientos.length - 1;
          return (
            <View style={styles.itemRow}>
              {/* Línea vertical de la timeline */}
              <View style={styles.timelineCol}>
                <View style={[styles.timelineDot, { backgroundColor: cfg.color }]}>
                  <Ionicons name={cfg.icon as any} size={14} color="#fff" />
                </View>
                {!isLast && <View style={styles.timelineLine} />}
              </View>
              {/* Contenido */}
              <View style={[styles.itemCard, isLast && { marginBottom: Spacing['3xl'] }]}>
                <Text style={styles.itemDesc}>{item.descripcion}</Text>
                <Text style={styles.itemFecha}>{item.fecha}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: Colors.dark[900] },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.lg },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  headerSub:   { fontSize: Typography.fontSize.sm, color: Colors.dark[400], marginTop: 2 },
  list: { paddingHorizontal: Spacing['2xl'], paddingTop: Spacing.base },
  itemRow:      { flexDirection: 'row', gap: Spacing.base },
  timelineCol:  { alignItems: 'center', width: 28 },
  timelineDot:  { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, flex: 1, backgroundColor: Colors.dark[700], marginVertical: 2 },
  itemCard: { flex: 1, backgroundColor: Colors.dark[800], borderRadius: Radius.md, padding: Spacing.base, marginBottom: Spacing.sm },
  itemDesc:  { fontSize: Typography.fontSize.sm, color: Colors.cream[200], lineHeight: Typography.fontSize.sm * 1.5 },
  itemFecha: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: Spacing.xs },
  empty:    { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: Spacing.base },
  emptyText:{ fontSize: Typography.fontSize.base, color: Colors.cream[200] },
});
