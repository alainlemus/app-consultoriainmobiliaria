/**
 * Bandeja de notificaciones (asesor, super admin, gestor y acreditado).
 * Historial completo con leídas / no leídas y el texto íntegro. Solo lectura:
 * se marcan como leídas al abrirlas, nunca se borran.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from '@/src/services/api';
import { getNotificacionesAcreditado, marcarLeidaAcreditado, marcarTodasLeidasAcreditado } from '@/src/services/acreditadoApi';
import { rutaParaNotificacion, esInicio, type DatosNotificacion } from '@/src/utils/rutaNotificacion';
import type { Notificacion } from '@/src/types';

function fechaTexto(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  const hora = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (mismoDia) return `Hoy · ${hora}`;
  const ayer = new Date(hoy.getTime() - 86400000);
  if (d.toDateString() === ayer.toDateString()) return `Ayer · ${hora}`;
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: d.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined })} · ${hora}`;
}

const COLOR_TIPO: Record<string, string> = { success: '#15803d', warning: '#b45309', danger: '#b91c1c', info: Colors.gold[600] ?? '#b8960c' };

export default function NotificacionesScreen() {
  const router = useRouter();
  const { tipo } = useLocalSearchParams<{ tipo?: 'staff' | 'acreditado' }>();
  const esAcreditado = tipo === 'acreditado';

  const [items, setItems]       = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [pagina, setPagina]     = useState(1);
  const [ultima, setUltima]     = useState(1);
  const [cargando, setCargando] = useState(true);
  const [masCargando, setMas]   = useState(false);
  const [refrescando, setRef]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [abierta, setAbierta]   = useState<string | null>(null);

  const cargar = useCallback(async (p = 1, agregar = false) => {
    try {
      const res = esAcreditado ? await getNotificacionesAcreditado(p) : await getNotificaciones(p);
      setItems(prev => agregar ? [...prev, ...res.data] : res.data);
      setNoLeidas(res.meta.no_leidas);
      setPagina(res.meta.pagina);
      setUltima(res.meta.ultima);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las notificaciones.');
    } finally {
      setCargando(false); setMas(false); setRef(false);
    }
  }, [esAcreditado]);

  useFocusEffect(useCallback(() => { cargar(1); }, [cargar]));

  async function abrir(n: Notificacion) {
    setAbierta(a => a === n.id ? null : n.id);
    if (!n.leida) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x));
      setNoLeidas(c => Math.max(0, c - 1));
      (esAcreditado ? marcarLeidaAcreditado(n.id) : marcarNotificacionLeida(n.id)).catch(() => {});
    }
  }

  function irA(n: Notificacion) {
    if (!n.ruta) return;
    const ruta = rutaParaNotificacion(n.ruta as DatosNotificacion, esAcreditado);
    if (esInicio(ruta)) router.navigate(ruta as never); else router.push(ruta as never);
  }

  async function todasLeidas() {
    setItems(prev => prev.map(x => ({ ...x, leida: true })));
    setNoLeidas(0);
    try { esAcreditado ? await marcarTodasLeidasAcreditado() : await marcarTodasLeidas(); } catch { /* se reintenta al recargar */ }
  }

  return (
    <View style={styles.flex}>
      <Header
        title="Notificaciones"
        subtitle={noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo leído'}
        onBack={() => router.back()}
        rightElement={noLeidas > 0 ? (
          <TouchableOpacity onPress={todasLeidas} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Marcar todas como leídas">
            <Ionicons name="checkmark-done-outline" size={22} color={Colors.gold[400]} />
          </TouchableOpacity>
        ) : undefined}
      />

      {cargando ? (
        <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} />
      ) : error && items.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.dark[400]} />
          <Text style={styles.vacioTexto}>{error}</Text>
          <TouchableOpacity style={styles.reintentar} onPress={() => { setCargando(true); cargar(1); }}><Text style={styles.reintentarTexto}>Reintentar</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRef(true); cargar(1); }} tintColor={Colors.gold[400]} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (!masCargando && pagina < ultima) { setMas(true); cargar(pagina + 1, true); } }}
          ListFooterComponent={masCargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginVertical: Spacing.lg }} /> : null}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Ionicons name="notifications-off-outline" size={40} color={Colors.dark[400]} />
              <Text style={styles.vacioTexto}>Aún no tienes notificaciones. Aquí verás los avisos de tu trámite, documentos y citas.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const expandida = abierta === item.id;
            const color = COLOR_TIPO[item.color] ?? COLOR_TIPO.info;
            return (
              <TouchableOpacity style={[styles.item, !item.leida && styles.itemNoLeida]} onPress={() => abrir(item)} activeOpacity={0.85}>
                <View style={[styles.barra, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.fila}>
                    <Text style={[styles.titulo, !item.leida && styles.tituloNoLeida]} numberOfLines={expandida ? undefined : 2}>{item.titulo}</Text>
                    {!item.leida && <View style={styles.punto} />}
                  </View>
                  <Text style={styles.cuerpo} numberOfLines={expandida ? undefined : 3}>{item.cuerpo}</Text>
                  <View style={styles.pie}>
                    <Text style={styles.fecha}>{fechaTexto(item.fecha)}</Text>
                    {item.ruta ? (
                      <TouchableOpacity style={styles.ir} onPress={() => irA(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Text style={styles.irTexto}>Abrir</Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.gold[600] ?? '#b8960c'} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:          { flex: 1, backgroundColor: Colors.cream[50] },
  lista:         { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  item:          { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300], padding: Spacing.md, overflow: 'hidden' },
  itemNoLeida:   { borderColor: Colors.gold[400], backgroundColor: '#fffdf7' },
  barra:         { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  fila:          { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  titulo:        { flex: 1, fontSize: Typography.fontSize.base, color: Colors.dark[900], fontWeight: Typography.fontWeight.medium },
  tituloNoLeida: { fontWeight: Typography.fontWeight.bold },
  punto:         { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.gold[400], marginTop: 6 },
  cuerpo:        { fontSize: Typography.fontSize.sm, color: Colors.dark[700], lineHeight: 20, marginTop: 4 },
  pie:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  fecha:         { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  ir:            { flexDirection: 'row', alignItems: 'center', gap: 2 },
  irTexto:       { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.gold[600] ?? '#b8960c' },
  vacio:         { alignItems: 'center', padding: Spacing['2xl'], gap: Spacing.sm },
  vacioTexto:    { textAlign: 'center', color: Colors.dark[500], fontSize: Typography.fontSize.sm, lineHeight: 20 },
  reintentar:    { marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.dark[900], borderRadius: Radius.md },
  reintentarTexto: { color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold },
});
