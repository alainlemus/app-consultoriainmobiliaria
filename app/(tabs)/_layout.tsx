import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../src/theme';
import { useSyncContext } from '../../src/contexts/SyncContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return (
    <View style={[ic.wrap, focused && ic.active]}>
      <Ionicons
        name={name}
        size={22}
        color={focused ? Colors.gold[400] : Colors.dark[500]}
      />
    </View>
  );
}

/**
 * Barra de estado de sincronización visible en la parte superior de cada tab.
 *
 * Estados:
 *  Sin conexión + pendientes → rojo  "Sin internet · X pendiente(s) de sincronizar"
 *  Sin conexión + sin pend.  → amarillo "Sin internet · Modo offline"
 *  Con conexión + sincronizando → azul "Sincronizando…"
 *  Con conexión + pendientes → verde "Conectado · Sincronizando X elemento(s)…"
 *  Normal (online, 0 pendientes) → oculta
 */
function SyncStatusBar() {
  const { online, pendientes, isSyncing, sync } = useSyncContext();
  const insets = useSafeAreaInsets();

  // No mostrar cuando todo está bien
  if (online && pendientes === 0 && !isSyncing) return null;

  let bg:    string;
  let icono: IoniconsName;
  let msg:   string;

  if (!online && pendientes > 0) {
    bg    = Colors.dark[700];
    icono = 'cloud-offline-outline';
    msg   = `Sin internet · ${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`;
  } else if (!online) {
    bg    = Colors.dark[700];
    icono = 'cloud-offline-outline';
    msg   = 'Sin internet · Modo offline';
  } else if (isSyncing) {
    bg    = '#1a4a7a';
    icono = 'sync-outline';
    msg   = pendientes > 0
      ? `Sincronizando ${pendientes} elemento${pendientes !== 1 ? 's' : ''}…`
      : 'Sincronizando…';
  } else {
    // online + pendientes > 0 pero no sincronizando aún (p.ej. justo al recuperar red)
    bg    = '#1a5c2a';
    icono = 'cloud-upload-outline';
    msg   = `Enviando ${pendientes} elemento${pendientes !== 1 ? 's' : ''}…`;
  }

  return (
    <Pressable
      style={[bar.container, { paddingTop: insets.top > 0 ? insets.top : Spacing.xs, backgroundColor: bg }]}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
    paddingHorizontal: Spacing.base,
  },
  text:  { color: '#fff', fontSize: 11, fontWeight: '600', flex: 1 },
  tap:   { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginLeft: 4 },
});

const ic = StyleSheet.create({
  wrap:   { width: 36, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  active: { backgroundColor: Colors.gold[50] },
});

export default function TabsLayout() {
  const insets            = useSafeAreaInsets();
  const bottomInset       = Platform.OS === 'android' ? insets.bottom : 0;
  const { pendientes }    = useSyncContext();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark[900] }}>
      {/* Barra de estado de sync — visible en todos los tabs */}
      <SyncStatusBar />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor:   Colors.dark[900],
            borderTopColor:    'transparent',
            borderTopWidth:    0,
            elevation:         0,
            shadowOpacity:     0,
            height:            Platform.OS === 'ios' ? 80 : 62 + bottomInset,
            paddingTop:        8,
            paddingBottom:     Platform.OS === 'android' ? bottomInset : 0,
          },
          tabBarActiveTintColor:   Colors.gold[400],
          tabBarInactiveTintColor: Colors.dark[500],
          tabBarLabelStyle: {
            fontSize:      9,
            fontWeight:    '600',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom:  Platform.OS === 'ios' ? 12 : 6,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title:      'Inicio',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="prospectos"
          options={{
            title: 'Prospectos',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} />,
            // Badge con número de pendientes en el tab de prospectos
            tabBarBadge: pendientes > 0 ? pendientes : undefined,
            tabBarBadgeStyle: { backgroundColor: Colors.gold[400], color: Colors.dark[900], fontSize: 9, minWidth: 16, height: 16 },
          }}
        />
        <Tabs.Screen
          name="expedientes"
          options={{
            title:      'Expedientes',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'folder' : 'folder-outline'} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="comisiones"
          options={{
            title:      'Comisiones',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'cash' : 'cash-outline'} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title:      'Perfil',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />,
          }}
        />
      </Tabs>
    </View>
  );
}
