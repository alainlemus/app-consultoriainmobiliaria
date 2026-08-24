import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Typography } from '../../src/theme';
import { useSyncContext } from '../../src/contexts/SyncContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Configuración de tabs ───────────────────────────────────────────────────

const TAB_CONFIG: {
  name:       string;
  title:      string;
  icon:       IoniconsName;
  iconActive: IoniconsName;
}[] = [
  { name: 'index',       title: 'Inicio',      icon: 'home-outline',    iconActive: 'home'    },
  { name: 'prospectos',  title: 'Prospectos',  icon: 'people-outline',  iconActive: 'people'  },
  { name: 'expedientes', title: 'Expedientes', icon: 'folder-outline',  iconActive: 'folder'  },
  { name: 'comisiones',  title: 'Comisiones',  icon: 'cash-outline',    iconActive: 'cash'    },
  { name: 'perfil',      title: 'Perfil',      icon: 'person-outline',  iconActive: 'person'  },
];

// ── Barra de estado de sincronización ──────────────────────────────────────

function SyncStatusBar() {
  const { online, pendientes, isSyncing, sync } = useSyncContext();
  const insets = useSafeAreaInsets();

  if (online && pendientes === 0 && !isSyncing) return null;

  let bg:    string;
  let icono: IoniconsName;
  let msg:   string;

  if (!online && pendientes > 0) {
    bg = Colors.dark[700]; icono = 'cloud-offline-outline';
    msg = `Sin internet · ${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`;
  } else if (!online) {
    bg = Colors.dark[700]; icono = 'cloud-offline-outline';
    msg = 'Sin internet · Modo offline';
  } else if (isSyncing) {
    bg = '#1a4a7a'; icono = 'sync-outline';
    msg = pendientes > 0
      ? `Sincronizando ${pendientes} elemento${pendientes !== 1 ? 's' : ''}…`
      : 'Sincronizando…';
  } else {
    // Estado idle: hay pendientes pero no se está sincronizando activamente
    // (nadie ha tocado la barra todavía). "Enviando…" aquí era engañoso —
    // parecía que se había quedado pegada mandando algo para siempre.
    bg = '#1a5c2a'; icono = 'cloud-upload-outline';
    msg = `${pendientes} pendiente${pendientes !== 1 ? 's' : ''} por sincronizar`;
  }

  return (
    <Pressable
      style={[bar.container, {
        paddingTop:  insets.top > 0 ? insets.top : Spacing.xs,
        backgroundColor: bg,
      }]}
      onPress={() => { if (online && !isSyncing) sync(); }}
      accessibilityLabel="Estado de sincronización"
    >
      {isSyncing
        ? <ActivityIndicator size={12} color="#fff" style={{ marginRight: 6 }} />
        : <Ionicons name={icono} size={14} color="#fff" style={{ marginRight: 6 }} />
      }
      <Text style={bar.text}>{msg}</Text>
      {online && !isSyncing && pendientes > 0 && (
        <Text style={bar.tap}>Tocar para sincronizar</Text>
      )}
    </Pressable>
  );
}

const bar = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingBottom: 6, paddingHorizontal: Spacing.base,
  },
  text: { color: '#fff', fontSize: 11, fontWeight: '600', flex: 1 },
  tap:  { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginLeft: 4 },
});

// ── Floating Tab Bar ────────────────────────────────────────────────────────

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets     = useSafeAreaInsets();
  const { pendientes } = useSyncContext();

  return (
    <View style={[ftb.outer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={ftb.bar}>
        {state.routes.map((route, index) => {
          const cfg     = TAB_CONFIG[index]!;
          const focused = state.index === index;
          const hasBadge = cfg.name === 'prospectos' && pendientes > 0;

          return (
            <Pressable
              key={route.key}
              style={({ pressed }) => [ftb.item, pressed && ftb.itemPressed]}
              onPress={() => {
                const event = navigation.emit({
                  type:             'tabPress',
                  target:           route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name as never);
                }
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
            >
              {/* Ícono con pill dorado cuando activo */}
              <View style={[ftb.iconWrap, focused && ftb.iconWrapActive]}>
                <Ionicons
                  name={focused ? cfg.iconActive : cfg.icon}
                  size={22}
                  color={focused ? Colors.dark[900] : Colors.dark[400]}
                />
                {/* Badge de pendientes */}
                {hasBadge && (
                  <View style={[ftb.badge, focused && ftb.badgeOnGold]}>
                    <Text style={[ftb.badgeText, focused && ftb.badgeTextOnGold]}>
                      {pendientes > 9 ? '9+' : String(pendientes)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Etiqueta — solo en tab activo */}
              {focused && (
                <Text style={ftb.label} numberOfLines={1}>{cfg.title}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const ftb = StyleSheet.create({
  outer: {
    backgroundColor: Colors.cream[50],
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  bar: {
    flexDirection:  'row',
    backgroundColor: Colors.dark[900],
    borderRadius:   28,
    paddingHorizontal: 6,
    paddingVertical:   6,
    // Sombra
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.25,
    shadowRadius:   12,
    elevation:      14,
    // Borde sutil
    borderWidth:    1,
    borderColor:    Colors.dark[700],
  },
  item: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight:      52,
  },
  itemPressed: {
    opacity: 0.75,
  },
  iconWrap: {
    width:          46,
    height:         34,
    borderRadius:   17,
    alignItems:     'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: Colors.gold[400],
    // Sombra interior dorada
    shadowColor:    Colors.gold[400],
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.4,
    shadowRadius:   6,
    elevation:      4,
  },
  label: {
    fontSize:      9,
    fontWeight:    '700',
    color:         Colors.gold[400],
    marginTop:     4,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Badge de pendientes (sobre tab inactivo)
  badge: {
    position:        'absolute',
    top:             -4,
    right:           -5,
    minWidth:        16,
    height:          16,
    borderRadius:    8,
    backgroundColor: Colors.gold[400],
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
    borderWidth:     1.5,
    borderColor:     Colors.dark[900],
  },
  // Badge cuando el tab ACTIVO ya tiene fondo dorado
  badgeOnGold: {
    backgroundColor: Colors.dark[900],
    borderColor:     Colors.gold[400],
  },
  badgeText: {
    fontSize:   8,
    fontWeight: '700',
    color:      Colors.dark[900],
  },
  badgeTextOnGold: {
    color: Colors.gold[400],
  },
});

// ── Layout principal ────────────────────────────────────────────────────────

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark[900] }}>
      <SyncStatusBar />
      <Tabs
        tabBar={props => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index"       options={{ title: 'Inicio'      }} />
        <Tabs.Screen name="prospectos"  options={{ title: 'Prospectos'  }} />
        <Tabs.Screen name="expedientes" options={{ title: 'Expedientes' }} />
        <Tabs.Screen name="comisiones"  options={{ title: 'Comisiones'  }} />
        <Tabs.Screen name="perfil"      options={{ title: 'Perfil'      }} />
      </Tabs>
    </View>
  );
}
