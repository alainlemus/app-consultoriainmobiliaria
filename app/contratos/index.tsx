/**
 * Pantalla: Contratos (hub)
 *
 * Tres acciones:
 *  - Sincronizar: trae la última versión del texto del contrato desde el
 *    backend y la cachea localmente (usa el sync general de la app).
 *  - Ver contrato: previsualiza la plantilla vigente (cacheada) sin datos
 *    de un cliente específico.
 *  - Registrar contrato: escanea/carga la INE de un cliente y genera el PDF.
 *
 * Debajo, el historial de contratos ya generados y guardados en el
 * dispositivo (persisten entre reinicios de la app).
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { useSyncContext } from '@/src/contexts/SyncContext';
import { getContratosGenerados, type ContratoGenerado } from '@/src/services/contratosGenerados';

export default function ContratosHubScreen() {
  const router = useRouter();
  const { sync, isSyncing, online } = useSyncContext();
  const [contratos, setContratos] = useState<ContratoGenerado[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [syncMsg,   setSyncMsg]   = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const lista = await getContratosGenerados();
    setContratos(lista);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function handleSincronizar() {
    setSyncMsg(null);
    const res = await sync();
    setSyncMsg(res.errores > 0 ? 'Sincronizado con algunos errores.' : 'Contrato actualizado ✓');
  }

  return (
    <View style={styles.flex}>
      <Header title="Contratos" subtitle="Prestación de servicios" onBack={() => router.back()} />

      <FlatList
        data={contratos}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={cargar} tintColor={Colors.gold[400]} />}
        ListHeaderComponent={
          <View style={{ gap: Spacing.sm }}>
            {!online && (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineBannerText}>📴 Sin conexión — puedes registrar contratos, pero sincronizar requiere internet.</Text>
              </View>
            )}

            <View style={styles.actionsGrid}>
              <ActionTile
                icon="sync-outline"
                label="Sincronizar"
                onPress={handleSincronizar}
                loading={isSyncing}
                disabled={!online}
              />
              <ActionTile
                icon="eye-outline"
                label="Ver contrato"
                onPress={() => router.push('/contratos/plantilla')}
              />
              <ActionTile
                icon="add-circle-outline"
                label="Registrar contrato"
                onPress={() => router.push('/contratos/registrar')}
                primary
              />
            </View>

            {syncMsg && <Text style={styles.syncMsg}>{syncMsg}</Text>}

            <Text style={styles.sectionLabel}>Contratos generados</Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={44} color={Colors.dark[600]} />
              <Text style={styles.emptyText}>Aún no has generado contratos.</Text>
              <Text style={styles.emptySubText}>Toca "Registrar contrato" para crear el primero.</Text>
            </View>
          ) : (
            <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing.xl }} />
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.contratoRow}
            onPress={() => router.push(`/contratos/${item.id}`)}
            activeOpacity={0.75}
          >
            <View style={styles.contratoIcon}>
              <Ionicons name="document-text" size={20} color={Colors.gold[400]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contratoNombre} numberOfLines={1}>{item.clienteNombre}</Text>
              <Text style={styles.contratoSub}>
                {item.folio ?? `Exp. #${item.expedienteId}`} · {new Date(item.createdAt).toLocaleDateString('es-MX')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.dark[500]} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function ActionTile({ icon, label, onPress, primary, loading, disabled }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  primary?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionTile, primary && styles.actionTilePrimary, disabled && styles.actionTileDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={primary ? Colors.dark[900] : Colors.gold[400]} size="small" />
        : <Ionicons name={icon} size={22} color={primary ? Colors.dark[900] : Colors.gold[400]} />
      }
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900] },
  list: { padding: Spacing.base, paddingBottom: Spacing['3xl'], gap: Spacing.sm },

  offlineBanner: { backgroundColor: Colors.dark[800], borderRadius: Radius.md, padding: Spacing.sm },
  offlineBannerText: { color: Colors.cream[200], fontSize: Typography.fontSize.xs },

  actionsGrid: { flexDirection: 'row', gap: Spacing.sm },
  actionTile: {
    flex: 1,
    backgroundColor: Colors.dark[800],
    borderRadius: Radius.lg,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionTilePrimary: { backgroundColor: Colors.gold[400] },
  actionTileDisabled: { opacity: 0.5 },
  actionLabel: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[100], textAlign: 'center' },
  actionLabelPrimary: { color: Colors.dark[900] },

  syncMsg: { fontSize: Typography.fontSize.xs, color: Colors.gold[400], textAlign: 'center' },

  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.dark[500],
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: Spacing.base,
  },

  contratoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    backgroundColor: Colors.dark[800],
    borderRadius: Radius.lg,
    padding: Spacing.base,
  },
  contratoIcon: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.dark[700], alignItems: 'center', justifyContent: 'center',
  },
  contratoNombre: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50] },
  contratoSub: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 40, gap: Spacing.sm, paddingHorizontal: Spacing['2xl'] },
  emptyText: { fontSize: Typography.fontSize.base, color: Colors.cream[200], fontWeight: Typography.fontWeight.semibold },
  emptySubText: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center' },
});
