import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { logout } from '@/src/services/api';
import { APP_VERSION } from '@/src/version';

export default function GestorPerfilScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, clearUser } = useAuth();

  function cerrarSesion() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => {
          await logout();
          clearUser();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const inicial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';

  return (
    <View style={s.flex}>
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={s.headerSub}>GESTOR</Text>
        <Text style={s.headerTitle}>Perfil</Text>
        <View style={s.goldLine} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.card}>
          <View style={s.avatar}><Text style={s.avatarLetter}>{inicial}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.nombre}>{user?.name ?? '—'}</Text>
            <Text style={s.email}>{user?.email ?? ''}</Text>
          </View>
        </View>

        <TouchableOpacity style={s.row} onPress={() => router.push('/ayuda-gestor')}>
          <Ionicons name="book-outline" size={20} color={Colors.gold[700]} />
          <Text style={s.rowText}>¿Cómo funciona?</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.dark[400]} />
        </TouchableOpacity>

        <TouchableOpacity style={[s.row, s.logout]} onPress={cerrarSesion}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={[s.rowText, { color: Colors.error }]}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={s.version}>v{APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: Colors.cream[50] },
  header:      { backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  headerSub:   { fontSize: Typography.fontSize.xs, color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold, letterSpacing: Typography.letterSpacing.widest },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black, color: Colors.cream[50] },
  goldLine:    { width: 32, height: 2, backgroundColor: Colors.gold[400], marginVertical: Spacing.sm },

  content:     { padding: Spacing.base, gap: Spacing.sm },
  card:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cream[300], padding: Spacing.base },
  avatar:      { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.dark[800], borderWidth: 1, borderColor: Colors.gold[700], alignItems: 'center', justifyContent: 'center' },
  avatarLetter:{ color: Colors.gold[400], fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold },
  nombre:      { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800] },
  email:       { fontSize: Typography.fontSize.sm, color: Colors.dark[500], marginTop: 2 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cream[300], padding: Spacing.base, minHeight: 52 },
  rowText:     { flex: 1, fontSize: Typography.fontSize.base, color: Colors.dark[800], fontWeight: Typography.fontWeight.medium },
  logout:      { marginTop: Spacing.lg },
  version:     { fontSize: Typography.fontSize.xs, color: Colors.dark[400], textAlign: 'center', marginTop: Spacing.xl },
});
