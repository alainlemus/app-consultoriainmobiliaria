/**
 * Pantallas del gestor (trámites en dependencias públicas). Misma sesión que
 * el asesor (token de /v1/auth/login) pero con su propia barra de pestañas.
 */
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { esGestor } from '@/src/utils/rolStaff';
import { sincronizarSubidasGestor } from '@/src/services/gestorApi';
import { AppState } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IoniconsName; iconActive: IoniconsName }[] = [
  { name: 'index',  title: 'Expedientes', icon: 'folder-outline', iconActive: 'folder' },
  { name: 'perfil', title: 'Perfil',      icon: 'person-outline', iconActive: 'person' },
];

function GestorTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.outer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={s.bar}>
        {state.routes.map((route, index) => {
          const cfg = TABS[index]!;
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              style={({ pressed }) => [s.item, pressed && { opacity: 0.75 }]}
              onPress={() => { if (!focused) navigation.navigate(route.name as never); }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
            >
              <View style={[s.iconWrap, focused && s.iconWrapActive]}>
                <Ionicons name={focused ? cfg.iconActive : cfg.icon} size={22} color={focused ? Colors.dark[900] : Colors.dark[400]} />
              </View>
              {focused && <Text style={s.label} numberOfLines={1}>{cfg.title}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function GestorLayout() {
  const router = useRouter();
  const { user, refresh } = useAuth();

  // AuthContext solo carga el perfil al abrir la app: si se llegó aquí desde
  // el login (sin reabrir), viene vacío y Perfil/Expedientes salían sin datos.
  useEffect(() => { refresh(); }, [refresh]);

  // Documentos subidos sin señal: se reintentan al abrir, al volver a la app y cada minuto
  useEffect(() => {
    sincronizarSubidasGestor().catch(() => {});
    const sub = AppState.addEventListener('change', st => { if (st === 'active') sincronizarSubidasGestor().catch(() => {}); });
    const t = setInterval(() => { sincronizarSubidasGestor().catch(() => {}); }, 60_000);
    return () => { sub.remove(); clearInterval(t); };
  }, []);

  // Si la sesión resulta no ser de gestor (perfil refrescado), regresar al inicio del asesor
  useEffect(() => {
    if (user && !esGestor(user)) router.replace('/(tabs)');
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark[900] }}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={props => <GestorTabBar {...props} />}>
        {TABS.map(t => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />)}
      </Tabs>
    </View>
  );
}

const s = StyleSheet.create({
  outer: { backgroundColor: Colors.cream[50], paddingHorizontal: 12, paddingTop: 8 },
  bar: {
    flexDirection: 'row', backgroundColor: Colors.dark[900], borderRadius: 28, paddingHorizontal: 6, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 14,
    borderWidth: 1, borderColor: Colors.dark[700],
  },
  item:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, minHeight: 52 },
  iconWrap:       { width: 46, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: Colors.gold[400] },
  label:          { fontSize: 9, fontWeight: '700', color: Colors.gold[400], marginTop: 4, letterSpacing: 0.6, textTransform: 'uppercase' },
});
