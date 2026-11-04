/** Piezas compartidas de las pantallas del gestor. */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Radius } from '../../theme';
import type { EstadoEncargo } from '../../services/gestorApi';

const COLORES: Record<EstadoEncargo, [string, string]> = {
  por_revisar:       [Colors.gold[100], Colors.gold[700]],
  con_observaciones: ['#fee2e2', '#b91c1c'],
  en_tramite:        ['#dbeafe', '#1d4ed8'],
  terminado:         ['#dcfce7', '#15803d'],
  cancelado:         [Colors.cream[200], Colors.dark[600]],
};

export function BadgeEstadoEncargo({ estado, label }: { estado: EstadoEncargo; label: string }) {
  const [bg, fg] = COLORES[estado] ?? COLORES.cancelado;
  return <Badge texto={label} bg={bg} fg={fg} />;
}

export function Badge({ texto, bg, fg }: { texto: string; bg: string; fg: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{texto}</Text>
    </View>
  );
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "8 nov" a partir de "2026-11-08" o una fecha ISO */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${MESES[m - 1]}`;
}

/** Texto de la fecha de entrega ("Vence hoy", "Entrega 8 nov"…) para encargos abiertos */
export function venceInfo(fecha: string | null, estado: EstadoEncargo): { texto: string; urgente: boolean } | null {
  if (!fecha || estado === 'terminado' || estado === 'cancelado') return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  const f = new Date(y, m - 1, d);
  const dias = Math.round((f.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return { texto: `Venció el ${fechaCorta(fecha)}`, urgente: true };
  if (dias === 0) return { texto: 'Vence hoy', urgente: true };
  if (dias === 1) return { texto: 'Vence mañana', urgente: true };
  return { texto: `Entrega ${fechaCorta(fecha)}`, urgente: false };
}

const s = StyleSheet.create({
  badge:     { paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { fontSize: 11, fontWeight: Typography.fontWeight.bold },
});
