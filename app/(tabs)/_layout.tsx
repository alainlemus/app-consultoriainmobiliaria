import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '../../src/theme';

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

const ic = StyleSheet.create({
  wrap:   { width: 36, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  active: { backgroundColor: Colors.gold[50] },
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
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="prospectos"
        options={{
          title:      'Prospectos',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} />,
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
  );
}
