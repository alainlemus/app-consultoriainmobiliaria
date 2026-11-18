/**
 * Sección «Gestores» del expediente para el super admin: a qué gestores se envió
 * y en qué estado va cada uno. Toca uno para ver revisión, subidas e historial.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import { BadgeEstadoEncargo, fechaCorta } from './encargoUi';
import { getEncargosAdmin, type EncargoAdmin } from '../../services/adminGestoresApi';

export default function GestoresExpediente({ expedienteId }: { expedienteId: number }) {
  const router = useRouter();
  const [items, setItems] = useState<EncargoAdmin[] | null>(null);

  useEffect(() => {
    getEncargosAdmin({ expedienteId, filtro: 'todos' }).then(r => setItems(r.data)).catch(() => setItems([]));
  }, [expedienteId]);

  if (!items || items.length === 0) return null;   // sin envíos a gestor no se muestra nada

  return (
    <>
      <Text style={s.label}>Gestores</Text>
      <View style={s.box}>
        {items.map((e, i) => (
          <TouchableOpacity key={e.id} style={[s.row, i > 0 && s.sep]} onPress={() => router.push(`/admin-gestores/${e.id}`)}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.nombre} numberOfLines={1}>{e.gestor?.nombre ?? 'Gestor'}</Text>
              <Text style={s.instr} numberOfLines={1}>{e.instrucciones}</Text>
              {e.fecha_entrega ? <Text style={[s.muted, e.vencido && s.vencido]}>{e.vencido ? 'Venció' : 'Entrega'} {fechaCorta(e.fecha_entrega)}</Text> : null}
            </View>
            <BadgeEstadoEncargo estado={e.estado} label={e.estado_label} />
            <Ionicons name="chevron-forward" size={16} color={Colors.dark[400]} />
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  label:   { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, letterSpacing: 1.5, color: Colors.dark[400], textTransform: 'uppercase', marginTop: Spacing.lg, marginBottom: Spacing.sm },
  box:     { backgroundColor: Colors.white, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cream[300] },
  row:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  sep:     { borderTopWidth: 1, borderTopColor: Colors.cream[200] },
  nombre:  { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  instr:   { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  muted:   { fontSize: Typography.fontSize.xs, color: Colors.dark[400] },
  vencido: { color: '#b91c1c', fontWeight: Typography.fontWeight.semibold },
});
