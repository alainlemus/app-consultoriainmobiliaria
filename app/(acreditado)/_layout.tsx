import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/theme';
import { AcreditadoAuthProvider } from '../../src/contexts/AcreditadoAuthContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IoniconsName; iconActive: IoniconsName }[] = [
  { name: 'index',       title: 'Mi Trámite',  icon: 'home-outline',          iconActive: 'home'          },
  { name: 'documentos',  title: 'Documentos',  icon: 'document-text-outline', iconActive: 'document-text' },
  { name: 'seguimiento', title: 'Seguimiento', icon: 'time-outline',          iconActive: 'time'          },
  { name: 'perfil',      title: 'Mi Cuenta',   icon: 'person-outline',        iconActive: 'person'        },
];

function AcreditadoTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      flexDirection:   'row',
      backgroundColor: Colors.dark[900],
      paddingBottom:   insets.bottom || Spacing.base,
      paddingTop:      Spacing.sm,
      borderTopWidth:  1,
      borderTopColor:  Colors.dark[700],
    }}>
      {state.routes.map((route: any, index: number) => {
        const tab     = TABS[index];
        const focused = state.index === index;
        const color   = focused ? Colors.gold[400] : Colors.dark[400];
        return (
          <TouchableOpacity
            key={route.key}
            style={{ flex: 1, alignItems: 'center', paddingVertical: Spacing.xs }}
            onPress={() => navigation.navigate(route.name)}
          >
            <Ionicons name={(focused ? tab.iconActive : tab.icon) as any} size={24} color={color} />
            <Text style={{ fontSize: 10, color, marginTop: 2 }}>{tab.title}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AcreditadoLayout() {
  return (
    <AcreditadoAuthProvider>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AcreditadoTabBar {...props} />}>
        {TABS.map(tab => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
        ))}
      </Tabs>
    </AcreditadoAuthProvider>
  );
}
