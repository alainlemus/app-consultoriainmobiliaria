/**
 * Campana con contador de no leídas. Va en la cabecera de las tres pantallas
 * de inicio (asesor/super admin, gestor y acreditado). Toca → bandeja.
 */
import React, { useCallback, useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Typography } from '../theme';
import { getNotificacionesNoLeidas } from '../services/api';
import { getNoLeidasAcreditado } from '../services/acreditadoApi';

export default function CampanaNotificaciones({ tipo, color = Colors.cream[50], size = 22 }: { tipo: 'staff' | 'acreditado'; color?: string; size?: number }) {
  const router = useRouter();
  const [noLeidas, setNoLeidas] = useState(0);

  useFocusEffect(useCallback(() => {
    let activo = true;
    (tipo === 'acreditado' ? getNoLeidasAcreditado() : getNotificacionesNoLeidas())
      .then(n => { if (activo) setNoLeidas(n); })
      .catch(() => {});
    return () => { activo = false; };
  }, [tipo]));

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => router.push({ pathname: '/notificaciones', params: { tipo } })}
      accessibilityLabel={`Notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ''}`}
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name={noLeidas > 0 ? 'notifications' : 'notifications-outline'} size={size} color={color} />
      {noLeidas > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{noLeidas > 99 ? '99+' : noLeidas}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge:     { position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.crimson[600], alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: Typography.fontWeight.bold },
});
