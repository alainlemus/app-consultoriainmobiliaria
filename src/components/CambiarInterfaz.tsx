/**
 * Botón «Cambiar a Gestor / Asesor» para el encabezado oscuro del inicio.
 * Solo aparece si el usuario tiene ambas interfaces (ver rolStaff.ts).
 * Hace lo mismo que el botón de Perfil: guarda la elección y cambia de pantallas.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { guardarInterfaz, tieneAmbasInterfaces, type Interfaz } from '../utils/rolStaff';
import type { User } from '../types';

interface Props {
  user: Pick<User, 'roles'> | null | undefined;
  /** Interfaz a la que lleva el botón. */
  hacia: Interfaz;
  style?: StyleProp<ViewStyle>;
}

export default function CambiarInterfaz({ user, hacia, style }: Props) {
  const router = useRouter();
  if (!tieneAmbasInterfaces(user)) return null;

  async function cambiar() {
    await guardarInterfaz(hacia);
    router.replace(hacia === 'gestor' ? '/(gestor)' : '/(tabs)');
  }

  return (
    <TouchableOpacity style={[s.btn, style]} onPress={cambiar} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityRole="button">
      <Ionicons name="swap-horizontal-outline" size={16} color={Colors.gold[400]} />
      <Text style={s.text}>Cambiar a {hacia === 'gestor' ? 'Gestor' : 'Asesor'}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: Colors.gold[400], borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginTop: Spacing.md,
  },
  text: { color: Colors.gold[400], fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },
});
