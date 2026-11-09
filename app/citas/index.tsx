/**
 * Agenda de citas.
 *  - Super admin: todas (su itinerario), con filtros Hoy / Próximas / Por confirmar.
 *  - Asesor: las de sus clientes.
 *  - Acreditado (?tipo=acreditado): las suyas.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getCitas } from '@/src/services/api';
import { getCitasAcreditado } from '@/src/services/acreditadoApi';
import { useAuth } from '@/src/contexts/AuthContext';
import { diaCorto, horaCorta, esHoy, ESTADO_CITA_COLOR } from '@/src/utils/citas';
import type { Cita } from '@/src/types';

type Filtro = 'proximas' | 'hoy' | 'solicitadas' | 'todas';

export default function CitasScreen() {
  const router = useRouter();
  const { tipo } = useLocalSearchParams<{ tipo?: 'acreditado' }>();
  const esAcreditado = tipo === 'acreditado';
  const { isSuperAdmin } = useAuth();

  const [items, setItems]     = useState<Cita[]>([]);
  const [cargando, setCarg]   = useState(true);
  const [refrescando, setRef] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [filtro, setFiltro]   = useState<Filtro>('proximas');

  const cargar = useCallback(async () => {
    try {
      if (esAcreditado) {
        setItems(await getCitasAcreditado());
      } else {
        const hoy = new Date();
        const desde = new Date(hoy.getTime() - 30 * 86400000).toISOString().slice(0, 10);
        const hasta = new Date(hoy.getTime() + 90 * 86400000).toISOString().slice(0, 10);
        setItems((await getCitas({ desde, hasta })).data);
      }
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las citas.');
    } finally { setCarg(false); setRef(false); }
  }, [esAcreditado]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const ahora = Date.now();
  const visibles = items.filter(c => {
    if (filtro === 'hoy')         return esHoy(c.inicia_at) && (c.estado === 'solicitada' || c.estado === 'confirmada');
    if (filtro === 'solicitadas') return c.estado === 'solicitada';
    if (filtro === 'proximas')    return new Date(c.termina_at).getTime() >= ahora && c.estado !== 'cancelada';
    return true;
  }).sort((a, b) => filtro === 'todas'
    ? new Date(b.inicia_at).getTime() - new Date(a.inicia_at).getTime()
    : new Date(a.inicia_at).getTime() - new Date(b.inicia_at).getTime());

  const solicitadas = items.filter(c => c.estado === 'solicitada').length;

  return (
    <View style={styles.flex}>
      <Header
        title={isSuperAdmin && !esAcreditado ? 'Mi agenda' : 'Citas'}
        subtitle={esAcreditado ? 'Con tu asesor' : isSuperAdmin ? `${solicitadas} por confirmar` : 'De mis clientes'}
        onBack={() => router.back()}
        rightElement={esAcreditado ? (
          <TouchableOpacity onPress={() => router.push({ pathname: '/citas/nueva', params: { tipo: 'acreditado' } })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Agendar cita">
            <Ionicons name="add-circle" size={26} color={Colors.gold[400]} />
          </TouchableOpacity>
        ) : undefined}
      />

      <View style={styles.chips}>
        {([['proximas', 'Próximas'], ['hoy', 'Hoy'], ...(isSuperAdmin && !esAcreditado ? [['solicitadas', 'Por confirmar']] : []), ['todas', 'Historial']] as [Filtro, string][]).map(([f, l]) => (
          <TouchableOpacity key={f} style={[styles.chip, filtro === f && styles.chipOn]} onPress={() => setFiltro(f)}>
            <Text style={[styles.chipText, filtro === f && styles.chipTextOn]}>{l}{f === 'solicitadas' && solicitadas ? ` (${solicitadas})` : ''}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : (
        <FlatList
          data={visibles}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRef(true); cargar(); }} tintColor={Colors.gold[400]} />}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Ionicons name="calendar-outline" size={40} color={Colors.dark[400]} />
              <Text style={styles.vacioTexto}>{error ?? (esAcreditado ? 'No tienes citas. Agenda una con tu asesor con el botón +.' : 'Sin citas en este filtro.')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: '/citas/[id]', params: { id: String(item.id), tipo: esAcreditado ? 'acreditado' : 'staff' } })} activeOpacity={0.85}>
              <View style={styles.cuando}>
                <Text style={styles.dia}>{diaCorto(item.inicia_at)}</Text>
                <Text style={styles.hora}>{horaCorta(item.inicia_at)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre} numberOfLines={1}>{esAcreditado ? (item.asesor?.nombre ?? 'Tu asesor') : item.nombre}</Text>
                <Text style={styles.lugar} numberOfLines={2}>
                  <Ionicons name={item.tipo === 'domicilio' ? 'home-outline' : 'business-outline'} size={12} color={Colors.dark[500]} /> {item.lugar}
                </Text>
                {!esAcreditado && item.asesor ? <Text style={styles.asesor}>Asesor: {item.asesor.nombre}</Text> : null}
              </View>
              <View style={[styles.estado, { backgroundColor: ESTADO_CITA_COLOR[item.estado] ?? Colors.dark[500] }]}>
                <Text style={styles.estadoTexto}>{item.estado_label}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: Colors.cream[50] },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  chip:        { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300] },
  chipOn:      { backgroundColor: Colors.dark[900], borderColor: Colors.dark[900] },
  chipText:    { fontSize: Typography.fontSize.xs, color: Colors.dark[700] },
  chipTextOn:  { color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold },
  lista:       { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  card:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300], padding: Spacing.md },
  cuando:      { width: 72, alignItems: 'center', paddingVertical: 4, borderRadius: Radius.sm, backgroundColor: Colors.cream[50] },
  dia:         { fontSize: Typography.fontSize.xs, color: Colors.dark[600], textTransform: 'capitalize' },
  hora:        { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  nombre:      { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  lugar:       { fontSize: Typography.fontSize.xs, color: Colors.dark[600], marginTop: 2 },
  asesor:      { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2 },
  estado:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  estadoTexto: { color: Colors.white, fontSize: 10, fontWeight: Typography.fontWeight.bold },
  vacio:       { alignItems: 'center', padding: Spacing['2xl'], gap: Spacing.sm },
  vacioTexto:  { textAlign: 'center', color: Colors.dark[500], fontSize: Typography.fontSize.sm, lineHeight: 20 },
});
