import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Radius } from '../../src/theme';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={[ic.wrap, focused && ic.active]}>
      <Text style={[ic.icon, focused && ic.iconActive]}>{icon}</Text>
    </View>
  );
}

const ic = StyleSheet.create({
  wrap:       { width: 36, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  active:     { backgroundColor: Colors.gold[50] },
  icon:       { fontSize: 18, opacity: 0.45 },
  iconActive: { opacity: 1 },
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;

  return (
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
          tabBarIcon: ({ focused }) => <TabIcon icon="⬡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="prospectos"
        options={{
          title:      'Prospectos',
          tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="expedientes"
        options={{
          title:      'Expedientes',
          tabBarIcon: ({ focused }) => <TabIcon icon="📁" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="comisiones"
        options={{
          title:      'Comisiones',
          tabBarIcon: ({ focused }) => <TabIcon icon="💰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title:      'Perfil',
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
