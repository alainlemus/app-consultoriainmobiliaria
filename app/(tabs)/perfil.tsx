import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Card from '../../src/components/ui/Card';
import { getMe, logout } from '../../src/services/api';
import type { User } from '../../src/types';

export default function PerfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
  }, []);

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
        {user?.roles?.map(r => (
          <View key={r} style={styles.roleBadge}>
            <Text style={styles.roleText}>{r.replace('_', ' ').toUpperCase()}</Text>
          </View>
        ))}
        <View style={styles.goldLine} />
      </View>

      <View style={styles.body}>
        {/* Info */}
        <Card title="Información de cuenta" subtitle="Perfil" style={styles.card}>
          <InfoRow label="Nombre"   value={user?.name    ?? '—'} />
          <InfoRow label="Correo"   value={user?.email   ?? '—'} />
          <InfoRow label="Teléfono" value={user?.telefono ?? '—'} />
          <InfoRow label="Banco"    value={user?.banco   ?? '—'} />
          <InfoRow label="CLABE"    value={user?.clabe   ?? '—'} last />
        </Card>

        {/* Acciones */}
        <Card title="Sesión" subtitle="Cuenta" style={styles.card}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </Card>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg:   { flex: 1, backgroundColor: Colors.cream[50] },
  header: { backgroundColor: Colors.dark[900], alignItems: 'center', paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.dark[700], borderWidth: 3, borderColor: Colors.gold[400], alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  avatarLetter: { color: Colors.gold[400], fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black },
  name:  { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  email: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], marginTop: 2, marginBottom: Spacing.sm },
  roleBadge: { paddingHorizontal: Spacing.md, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gold[600], marginBottom: Spacing.sm },
  roleText:  { color: Colors.gold[400], fontSize: 10, fontWeight: Typography.fontWeight.bold, letterSpacing: 1 },
  goldLine:  { width: 32, height: 2, backgroundColor: Colors.gold[400], marginTop: Spacing.sm },

  body: { padding: Spacing.base },
  card: { marginBottom: Spacing.base },

  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.cream[200] },
  infoLabel:     { fontSize: Typography.fontSize.sm, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold },
  infoValue:     { fontSize: Typography.fontSize.sm, color: Colors.dark[800], flex: 1, textAlign: 'right' },

  logoutBtn:  { backgroundColor: Colors.crimson[600], borderRadius: Radius.sm, padding: Spacing.md, alignItems: 'center' },
  logoutText: { color: Colors.white, fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.sm, letterSpacing: Typography.letterSpacing.wider },
});
