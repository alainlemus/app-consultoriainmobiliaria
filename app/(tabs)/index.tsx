import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  TouchableOpacity, RefreshControl, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../src/theme';
import Badge, { ESTADO_PROSPECTO_BADGE } from '../../src/components/ui/Badge';
import { getContactos, getExpedientes, getMe, logout } from '../../src/services/api';
import { useOfflineSync } from '../../src/hooks/useOfflineSync';
import type { User, Contacto } from '../../src/types';

interface Stats {
  totalProspectos:  number;
  totalExpedientes: number;
  enTramite:        number;
  cerrados:         number;
}

export default function DashboardScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const [user,       setUser]       = useState<User | null>(null);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [recientes,  setRecientes]  = useState<Contacto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { online, pendientes, sincronizar } = useOfflineSync();

  async function load() {
    try {
      const [me, prospectos, expedientes] = await Promise.all([
        getMe(),
        getContactos({ page: 1 }),
        getExpedientes(),
      ]);
      setUser(me);
      setStats({
        totalProspectos:  prospectos.meta.total,
        totalExpedientes: expedientes.meta.total,
        enTramite: expedientes.data.filter(e =>
          ['en_proceso','documentacion','autorizado','escrituracion'].includes(e.estado)
        ).length,
        cerrados: expedientes.data.filter(e => e.estado === 'cerrado').length,
      });
      setRecientes(prospectos.data.slice(0, 5));
    } catch {
      // offline
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const showBanner = !online || pendientes > 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Banner offline — se pinta sobre el header, respeta el notch */}
      {showBanner && (
        <TouchableOpacity
          style={[
            styles.banner,
            !online ? styles.bannerOffline : styles.bannerPendiente,
            { paddingTop: insets.top },   // ← debajo del status bar
          ]}
          onPress={online ? () => sincronizar() : undefined}
          activeOpacity={online ? 0.85 : 1}
        >
          <Text style={styles.bannerText}>
            {!online
              ? '⚠️  Sin conexión — los cambios se guardarán localmente'
              : `🔄  ${pendientes} pendiente${pendientes !== 1 ? 's' : ''} — Toca para sincronizar`}
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.gold[400]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[
          styles.headerBg,
          { paddingTop: showBanner ? Spacing.base : insets.top + Spacing.base },
        ]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerGreeting}>Bienvenido</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {user?.name ?? '…'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={async () => { await logout(); router.replace('/(auth)/login'); }}
            >
              <Text style={styles.logoutText}>Salir</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.goldBar} />
        </View>

        <View style={styles.body}>
          {/* ── KPI cards ── */}
          <View style={styles.kpiGrid}>
            <KpiCard label="Prospectos"  value={stats?.totalProspectos  ?? '—'} icon="👥" accent={Colors.gold[400]}    />
            <KpiCard label="Expedientes" value={stats?.totalExpedientes ?? '—'} icon="📁" accent={Colors.dark[500]}    />
            <KpiCard label="En trámite"  value={stats?.enTramite        ?? '—'} icon="⚙️" accent={Colors.crimson[500]} />
            <KpiCard label="Cerrados"    value={stats?.cerrados         ?? '—'} icon="✅" accent={Colors.success}      />
          </View>

          {/* ── Acciones rápidas ── */}
          <SectionHeader title="Acciones rápidas" />
          <View style={styles.actionsGrid}>
            <ActionTile icon="➕" label="Nuevo prospecto" onPress={() => router.push('/prospectos/nuevo')} primary />
            <ActionTile icon="👥" label="Prospectos"      onPress={() => router.push('/(tabs)/prospectos')} />
            <ActionTile icon="📁" label="Expedientes"     onPress={() => router.push('/(tabs)/expedientes')} />
            <ActionTile icon="🗺️" label="Mapa"            onPress={() => router.push('/mapa')} />
          </View>

          {/* ── Prospectos recientes ── */}
          <SectionHeader title="Recientes" action={{ label: 'Ver todos', onPress: () => router.push('/(tabs)/prospectos') }} />
          <View style={styles.card}>
            {recientes.length === 0 ? (
              <Text style={styles.empty}>Sin prospectos aún.</Text>
            ) : recientes.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.recentRow, i < recientes.length - 1 && styles.divider]}
                onPress={() => router.push(`/prospectos/${c.id}`)}
                activeOpacity={0.75}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>{(c.nombre?.[0] ?? '?').toUpperCase()}</Text>
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentNombre}>{c.nombre}</Text>
                  <Text style={styles.recentSub}>{c.email ?? c.telefono ?? '—'}</Text>
                </View>
                <Badge
                  label={c.estado_prospecto}
                  variant={ESTADO_PROSPECTO_BADGE[c.estado_prospecto] ?? 'gray'}
                  small
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={sh.link}>{action.label} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm, marginTop: Spacing.base },
  title: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[500], letterSpacing: 1.2, textTransform: 'uppercase' },
  link:  { fontSize: Typography.fontSize.xs, color: Colors.gold[500], fontWeight: Typography.fontWeight.semibold },
});

function KpiCard({ label, value, icon, accent }: { label: string; value: number | string; icon: string; accent: string }) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: accent }]}>
      <Text style={styles.kpiIcon}>{icon}</Text>
      <Text style={[styles.kpiValue, { color: accent }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function ActionTile({ icon, label, onPress, primary }: { icon: string; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.actionTile, primary && styles.actionTilePrimary]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.actionIcon, primary && styles.actionIconPrimary]}>{icon}</Text>
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.cream[50] },
  scroll: { flex: 1 },

  // Banner offline
  banner: {
    paddingHorizontal: Spacing.base,
    paddingBottom:     Spacing.sm,
  },
  bannerOffline:   { backgroundColor: Colors.crimson[500] },
  bannerPendiente: { backgroundColor: Colors.gold[500] },
  bannerText: {
    color:         Colors.white,
    fontSize:      Typography.fontSize.xs,
    fontWeight:    Typography.fontWeight.semibold,
    textAlign:     'center',
    paddingTop:    Spacing.sm,
  },

  // Header
  headerBg: {
    backgroundColor:   Colors.dark[900],
    paddingHorizontal: Spacing.base,
    paddingBottom:     Spacing.xl,
  },
  headerRow:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerGreeting:{ fontSize: Typography.fontSize.xs, color: Colors.gold[400], letterSpacing: 2, fontWeight: Typography.fontWeight.semibold, textTransform: 'uppercase' },
  headerName:    { fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black, color: Colors.cream[50], marginTop: 2 },
  goldBar:       { width: 28, height: 2, backgroundColor: Colors.gold[400], marginTop: Spacing.sm },
  logoutBtn:     { borderWidth: 1, borderColor: Colors.dark[600], borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 5, marginTop: 4 },
  logoutText:    { color: Colors.dark[400], fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold },

  body: { padding: Spacing.base },

  // KPIs
  kpiGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  kpiCard: {
    flex:            1,
    backgroundColor: Colors.white,
    borderRadius:    Radius.base,
    padding:         Spacing.sm,
    alignItems:      'center',
    borderTopWidth:  3,
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    ...Shadows.sm,
  },
  kpiIcon:  { fontSize: 18, marginBottom: 2 },
  kpiValue: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.black, marginBottom: 1 },
  kpiLabel: { fontSize: 9, color: Colors.dark[500], textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Acciones
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
  actionTile: {
    width:           '47.5%',
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    paddingVertical: Spacing.lg,
    alignItems:      'center',
    gap:             Spacing.xs,
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    ...Shadows.sm,
  },
  actionTilePrimary: {
    backgroundColor: Colors.dark[900],
    borderColor:     Colors.dark[900],
  },
  actionIcon:       { fontSize: 26 },
  actionIconPrimary:{ fontSize: 26 },
  actionLabel:      { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[700], textAlign: 'center' },
  actionLabelPrimary: { color: Colors.gold[400] },

  // Card genérica
  card: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    overflow:        'hidden',
    ...Shadows.sm,
  },

  // Recientes
  recentRow:  { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  divider:    { borderBottomWidth: 1, borderBottomColor: Colors.cream[200] },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark[800], alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: Colors.gold[400], fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.base },
  recentInfo: { flex: 1 },
  recentNombre: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  recentSub:    { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 1 },

  empty: { color: Colors.dark[400], fontSize: Typography.fontSize.sm, textAlign: 'center', padding: Spacing.xl },
});
