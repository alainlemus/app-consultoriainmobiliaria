/**
 * Registrados con mi QR — cuentas de la app que se ligaron a este asesor con
 * su código impreso (lona, tarjeta, volante) y en qué paso van:
 *   · Solo registrado: creó la cuenta pero no ha pedido asesoría → hay que contactarlo.
 *   · Pidió asesoría: ya es prospecto (abre su ficha).
 *   · Con expediente: ya está en trámite.
 * Llega aquí también desde la notificación «Se registró con tu código QR».
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getAcreditadosQr } from '@/src/services/api';
import type { AcreditadoQr, AcreditadosQrMeta } from '@/src/types';

type Filtro = 'todos' | 'sin_solicitud' | 'solicitud' | 'expediente';

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos',         label: 'Todos' },
  { value: 'sin_solicitud', label: 'Solo registrados' },
  { value: 'solicitud',     label: 'Pidieron asesoría' },
  { value: 'expediente',    label: 'Con expediente' },
];

const PASO_LABEL: Record<AcreditadoQr['paso'], { texto: string; color: string }> = {
  sin_solicitud: { texto: 'Solo registrado · contáctalo', color: '#b45309' },
  solicitud:     { texto: 'Pidió asesoría',               color: '#0e7490' },
  expediente:    { texto: 'Con expediente',               color: '#15803d' },
};

function fechaCorta(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export default function RegistradosQrScreen() {
  const router = useRouter();
  const [items,      setItems]      = useState<AcreditadoQr[]>([]);
  const [meta,       setMeta]       = useState<AcreditadosQrMeta | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [filtro,     setFiltro]     = useState<Filtro>('todos');

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setError(null);
    try {
      const res = await getAcreditadosQr();
      setItems(res.data);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la lista.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const visibles = filtro === 'todos' ? items : items.filter(i => i.paso === filtro);
  const tel = (t?: string | null) => (t ?? '').replace(/\D/g, '');

  return (
    <View style={styles.flex}>
      <Header title="Registrados con mi QR" subtitle="Cuentas creadas con tu código" onBack={() => router.back()} />

      {meta && (
        <View style={styles.resumen}>
          <Text style={styles.resumenTexto}>
            <Text style={styles.resumenNum}>{meta.total}</Text> registrados ·{' '}
            <Text style={[styles.resumenNum, meta.sin_solicitud > 0 && { color: '#b45309' }]}>{meta.sin_solicitud}</Text> sin pedir asesoría
          </Text>
        </View>
      )}

      <View style={styles.chips}>
        {FILTROS.map(f => (
          <TouchableOpacity key={f.value} style={[styles.chip, filtro === f.value && styles.chipOn]} onPress={() => setFiltro(f.value)}>
            <Text style={[styles.chipText, filtro === f.value && styles.chipTextOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} />
      ) : error ? (
        <View style={styles.vacio}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.dark[400]} />
          <Text style={styles.vacioTexto}>{error}</Text>
          <TouchableOpacity style={styles.reintentar} onPress={() => cargar()}><Text style={styles.reintentarTexto}>Reintentar</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(true); }} tintColor={Colors.gold[400]} />}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Ionicons name="qr-code-outline" size={40} color={Colors.dark[400]} />
              <Text style={styles.vacioTexto}>
                {items.length === 0
                  ? 'Nadie se ha registrado con tu código todavía. Pide tu QR en el panel e imprímelo en tu publicidad.'
                  : 'Nadie en este filtro.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const paso = PASO_LABEL[item.paso];
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nombre}>{item.nombre}</Text>
                    <Text style={[styles.paso, { color: paso.color }]}>{paso.texto}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.fecha}>{fechaCorta(item.registrado_en)}</Text>
                    {item.codigo ? <Text style={styles.codigo}>{item.codigo}</Text> : null}
                  </View>
                </View>
                <View style={styles.acciones}>
                  {item.telefono ? (
                    <>
                      <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(`tel:${item.telefono}`)}>
                        <Ionicons name="call-outline" size={16} color={Colors.gold[400]} />
                        <Text style={styles.btnText}>Llamar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(`https://wa.me/52${tel(item.telefono)}`)}>
                        <Ionicons name="logo-whatsapp" size={16} color="#25d366" />
                        <Text style={styles.btnText}>WhatsApp</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.sinTel}>Sin teléfono · {item.email ?? ''}</Text>
                  )}
                  {item.contacto_id ? (
                    <TouchableOpacity style={[styles.btn, styles.btnFicha]} onPress={() => router.push(`/prospectos/${item.contacto_id}`)}>
                      <Text style={styles.btnText}>Ver prospecto</Text>
                      <Ionicons name="chevron-forward" size={14} color={Colors.cream[200]} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:          { flex: 1, backgroundColor: Colors.cream[50] },
  resumen:       { paddingHorizontal: Spacing.base, paddingTop: Spacing.base },
  resumenTexto:  { fontSize: Typography.fontSize.sm, color: Colors.dark[600] },
  resumenNum:    { fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  chip:          { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300] },
  chipOn:        { backgroundColor: Colors.dark[900], borderColor: Colors.dark[900] },
  chipText:      { fontSize: Typography.fontSize.xs, color: Colors.dark[700] },
  chipTextOn:    { color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold },
  lista:         { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  card:          { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300], padding: Spacing.base },
  cardTop:       { flexDirection: 'row', gap: Spacing.sm },
  nombre:        { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  paso:          { fontSize: Typography.fontSize.xs, marginTop: 2, fontWeight: Typography.fontWeight.medium },
  fecha:         { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  codigo:        { fontSize: Typography.fontSize.xs, color: Colors.dark[400], fontFamily: 'monospace', marginTop: 2 },
  acciones:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.md, alignItems: 'center' },
  btn:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.md },
  btnFicha:      { marginLeft: 'auto', backgroundColor: Colors.dark[700] },
  btnText:       { fontSize: Typography.fontSize.xs, color: Colors.cream[200], fontWeight: Typography.fontWeight.medium },
  sinTel:        { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  vacio:         { alignItems: 'center', padding: Spacing['2xl'], gap: Spacing.sm },
  vacioTexto:    { textAlign: 'center', color: Colors.dark[500], fontSize: Typography.fontSize.sm, lineHeight: 20 },
  reintentar:    { marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.dark[900], borderRadius: Radius.md },
  reintentarTexto: { color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold },
});
