import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';

export type BadgeVariant = 'gold' | 'dark' | 'success' | 'warning' | 'danger' | 'info' | 'gray';

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  gold:    { bg: Colors.gold[50],   text: Colors.gold[700],    border: Colors.gold[200] },
  dark:    { bg: Colors.dark[800],  text: Colors.cream[50],    border: Colors.dark[600] },
  success: { bg: '#f0fdf4',         text: '#15803d',           border: '#bbf7d0' },
  warning: { bg: '#fffbeb',         text: '#92400e',           border: '#fde68a' },
  danger:  { bg: '#fef2f2',         text: Colors.crimson[600], border: '#fecaca' },
  info:    { bg: '#eff6ff',         text: '#1d4ed8',           border: '#bfdbfe' },
  gray:    { bg: Colors.cream[100], text: Colors.dark[600],    border: Colors.cream[300] },
};

// Mapea estados del CRM a variantes de badge
export const ESTADO_PROSPECTO_BADGE: Record<string, BadgeVariant> = {
  nuevo:          'info',
  contactado:     'gold',
  precalificado:  'warning',
  en_tramite:     'dark',
  cerrado:        'success',
  no_interesado:  'gray',
};

export const ESTADO_EXPEDIENTE_BADGE: Record<string, BadgeVariant> = {
  en_proceso:   'info',
  documentacion:'warning',
  autorizado:   'gold',
  escrituracion:'dark',
  cerrado:      'success',
  cancelado:    'danger',
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  small?: boolean;
}

export default function Badge({ label, variant = 'gray', small = false }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <View style={[
      styles.badge,
      small && styles.small,
      { backgroundColor: v.bg, borderColor: v.border },
    ]}>
      <Text style={[styles.text, small && styles.textSmall, { color: v.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf:       'flex-start',
    borderRadius:    Radius.full,
    borderWidth:     1,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
  },
  small: {
    paddingHorizontal: Spacing.xs,
    paddingVertical:   1,
  },
  text: {
    fontSize:      Typography.fontSize.xs,
    fontWeight:    Typography.fontWeight.semibold,
    letterSpacing: Typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  textSmall: {
    fontSize: 10,
  },
});
