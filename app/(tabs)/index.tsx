import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  TouchableOpacity, RefreshControl, StatusBar, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../src/theme';
import Badge, { ESTADO_PROSPECTO_BADGE } from '../../src/components/ui/Badge';
import { getContactos, getExpedientes, getMe, logout } from '../../src/services/api';
import { useOfflineSync } from '../../src/hooks/useOfflineSync';
import { useAuth } from '../../src/contexts/AuthContext';
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
  const { user: authUser, isSuperAdmin, refresh: refreshAuth, clearUser } = useAuth();

  const [user,       setUser]       = useState<User | null>(null);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [recientes,  setRecientes]  = useState<Contacto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { online, pendientes, sincronizar } = useOfflineSync();

  // Usar el user del AuthContext si está disponible (evita llamar getMe() de nuevo)
  useEffect(() => {
    if (authUser) setUser(authUser);
  }, [authUser]);

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
          ['en_proceso','documentacion','en_catastro','pre_avaluo','cuv_generada','avaluo_cerrado','en_notaria'].includes(e.estado)
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
          {/* Fila superior: logo+nombre | botón salir */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={styles.headerTexts}>
                <Text style={styles.headerGreeting}>Bienvenido</Text>
                <Text style={styles.headerName} numberOfLines={2}>
                  {user?.name ?? '…'}
                </Text>
              </View>
            </View>
            {/* Botón salir: posición absoluta para nunca encimarse */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={async () => {
                await logout();
                clearUser();
                router.replace('/(auth)/login');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.logoutText}>Salir</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.goldBar} />
        </View>

        <View style={styles.body}>
          {/* Banner super_admin */}
          {isSuperAdmin && (
            <View style={styles.superAdminBanner}>
              <Text style={styles.superAdminBannerText}>
                👑 Vista de administrador — mostrando datos de todos los asesores
              </Text>
            </View>
          )}
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
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                     <Text style={styles.recentNombre}>{c.nombre}</Text>
                     {c.estado_prospecto === 'en_tramite' && (
                       <Text style={{ fontSize: 14 }}>📂</Text>
                     )}
                   </View>
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
  title: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[500], letterSpacing: 1, textTransform: 'uppercase' },
  link:  { fontSize: Typography.fontSize.sm, color: Colors.gold[500], fontWeight: Typography.fontWeight.semibold },
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

  // Banner offline — más visible y más grande
  banner: {
    paddingHorizontal: Spacing.base,
    paddingBottom:     Spacing.md,
  },
  bannerOffline:   { backgroundColor: Colors.crimson[500] },
  bannerPendiente: { backgroundColor: Colors.gold[500] },
  bannerText: {
    color:      Colors.white,
    fontSize:   Typography.fontSize.sm,   // antes xs — más legible
    fontWeight: Typography.fontWeight.semibold,
    textAlign:  'center',
    paddingTop: Spacing.sm,
    lineHeight: Typography.fontSize.sm * 1.4,
  },

  // Header — layout mejorado para evitar encimamiento
  headerBg: {
    backgroundColor:   Colors.dark[900],
    paddingHorizontal: Spacing.base,
    paddingBottom:     Spacing.xl,
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',  // align top para que el botón no se mueva con nombres de 2 líneas
    justifyContent: 'space-between',
    gap:            Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
    flex:          1,              // ocupa todo el espacio disponible
    marginRight:   Spacing.sm,    // deja espacio para el botón salir
  },
  headerTexts: {
    flex: 1,                       // el texto se comprime antes de encimarse con el botón
  },
  headerLogo:     { width: 44, height: 44, borderRadius: Radius.sm, flexShrink: 0 },
  headerGreeting: { fontSize: Typography.fontSize.xs, color: Colors.gold[400], letterSpacing: 2, fontWeight: Typography.fontWeight.semibold, textTransform: 'uppercase' },
  headerName:     { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.black, color: Colors.cream[50], marginTop: 2 },
  goldBar:        { width: 28, height: 2, backgroundColor: Colors.gold[400], marginTop: Spacing.sm },
  logoutBtn: {
    borderWidth:       1,
    borderColor:       Colors.dark[600],
    borderRadius:      Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    marginTop:         Spacing.xs,
    flexShrink:        0,          // nunca se comprime
    minWidth:          52,
    alignItems:        'center',
  },
  logoutText: { color: Colors.dark[400], fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },

  body: { padding: Spacing.base },

  // KPIs — texto de etiqueta más legible
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
  kpiIcon:  { fontSize: Typography.fontSize.lg, marginBottom: 2 },
  kpiValue: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.black, marginBottom: 2 },
  kpiLabel: { fontSize: Typography.fontSize.xs, color: Colors.dark[500], textAlign: 'center', letterSpacing: 0.3, textTransform: 'uppercase' },

  // Acciones — tiles más altas para área táctil cómoda
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
  actionTile: {
    width:           '47.5%',
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    paddingVertical: Spacing.xl,   // antes lg — más espacio vertical
    alignItems:      'center',
    gap:             Spacing.sm,   // antes xs
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    ...Shadows.sm,
    minHeight:       90,           // área táctil mínima cómoda
  },
  actionTilePrimary: {
    backgroundColor: Colors.dark[900],
    borderColor:     Colors.dark[900],
  },
  actionIcon:         { fontSize: Typography.fontSize['2xl'] },
  actionIconPrimary:  { fontSize: Typography.fontSize['2xl'] },
  actionLabel:        { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[700], textAlign: 'center' },
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

  // Recientes — filas más altas y texto más grande
  recentRow:    { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.sm, minHeight: 64 },
  divider:      { borderBottomWidth: 1, borderBottomColor: Colors.cream[200] },
  avatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.dark[800], alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarLetter: { color: Colors.gold[400], fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.lg },
  recentInfo:   { flex: 1 },
  recentNombre: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  recentSub:    { fontSize: Typography.fontSize.sm, color: Colors.dark[400], marginTop: 2 },

  empty: { color: Colors.dark[400], fontSize: Typography.fontSize.base, textAlign: 'center', padding: Spacing.xl },

  // Banner super_admin
  superAdminBanner: {
    backgroundColor: Colors.gold[50],
    borderWidth:     1,
    borderColor:     Colors.gold[300],
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    marginBottom:    Spacing.sm,
    flexDirection:   'row',
    alignItems:      'center',
  },
  superAdminBannerText: {
    fontSize:   Typography.fontSize.sm,
    color:      Colors.gold[700],
    fontWeight: Typography.fontWeight.semibold,
    flex:       1,
  },
});
