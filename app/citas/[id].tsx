/**
 * Detalle de una cita y sus acciones según quién la ve:
 *  - Super admin: confirmar, reagendar (elige otro hueco), cancelar, asistió / no asistió.
 *  - Asesor y acreditado: ver, llamar, WhatsApp, abrir mapa, cancelar.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Modal, Platform } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getCita, getCitas, confirmarCita, reagendarCita, cancelarCita, marcarCita, getDisponibilidadCitas } from '@/src/services/api';
import { getCitasAcreditado, cancelarCitaAcreditado } from '@/src/services/acreditadoApi';
import { useAuth } from '@/src/contexts/AuthContext';
import { fechaLarga, horaCorta, proximosDias, ESTADO_CITA_COLOR } from '@/src/utils/citas';
import type { Cita, HuecoCita } from '@/src/types';

export default function CitaDetalleScreen() {
  const router = useRouter();
  const { id, tipo } = useLocalSearchParams<{ id: string; tipo?: 'acreditado' | 'staff' }>();
  const esAcreditado = tipo === 'acreditado';
  const { isSuperAdmin } = useAuth();

  const [cita, setCita]       = useState<Cita | null>(null);
  const [cargando, setCarg]   = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [trabajando, setTrab] = useState(false);
  const [reagendando, setReag] = useState(false);
  const [fecha, setFecha]     = useState<string | null>(null);
  const [huecos, setHuecos]   = useState<HuecoCita[]>([]);

  const cargar = useCallback(async () => {
    try {
      if (esAcreditado) {
        const mias = await getCitasAcreditado();
        const c = mias.find(x => x.id === Number(id));
        if (!c) throw new Error('No encontramos esta cita.');
        setCita(c);
      } else {
        setCita(await getCita(Number(id)));
      }
      setError(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se pudo cargar la cita.'); }
    finally { setCarg(false); }
  }, [id, esAcreditado]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  useEffect(() => {
    if (!reagendando || !fecha || !cita?.oficina) return;
    getDisponibilidadCitas(cita.oficina.id, fecha, cita.tipo).then(setHuecos).catch(() => setHuecos([]));
  }, [reagendando, fecha, cita]);

  async function accion(fn: () => Promise<Cita>, ok: string) {
    setTrab(true);
    try { setCita(await fn()); Alert.alert(ok); }
    catch (e: unknown) { Alert.alert('No se pudo', e instanceof Error ? e.message : 'Inténtalo de nuevo.'); }
    finally { setTrab(false); }
  }

  function cancelar() {
    const hacer = (motivo?: string) => accion(() => esAcreditado ? cancelarCitaAcreditado(Number(id), motivo) : cancelarCita(Number(id), motivo), 'Cita cancelada.');
    if (Platform.OS === 'ios') {
      Alert.prompt('Cancelar cita', 'Motivo (le llega a los demás):', [
        { text: 'Volver', style: 'cancel' },
        { text: 'Cancelar cita', style: 'destructive', onPress: (motivo?: string) => hacer(motivo) },
      ], 'plain-text');
    } else {
      Alert.alert('Cancelar cita', '¿Seguro que quieres cancelarla?', [
        { text: 'Volver', style: 'cancel' },
        { text: 'Cancelar cita', style: 'destructive', onPress: () => hacer() },
      ]);
    }
  }

  const tel = (cita?.telefono ?? '').replace(/\D/g, '');
  const telAsesor = (cita?.asesor?.telefono ?? '').replace(/\D/g, '');
  const activa = cita?.estado === 'solicitada' || cita?.estado === 'confirmada';
  const yaPaso = cita ? new Date(cita.termina_at).getTime() < Date.now() : false;

  return (
    <View style={styles.flex}>
      <Header title="Cita" subtitle={cita?.estado_label} onBack={() => router.back()} />
      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : !cita ? <Text style={styles.error}>{error}</Text> : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <View style={[styles.estado, { backgroundColor: ESTADO_CITA_COLOR[cita.estado] ?? Colors.dark[500] }]}><Text style={styles.estadoTexto}>{cita.estado_label}</Text></View>
            <Text style={styles.fecha}>{fechaLarga(cita.inicia_at)}</Text>
            <Text style={styles.hora}>{horaCorta(cita.inicia_at)} a {horaCorta(cita.termina_at)}</Text>
            <View style={styles.fila}><Ionicons name={cita.tipo === 'domicilio' ? 'home-outline' : 'business-outline'} size={18} color={Colors.dark[600]} /><Text style={styles.dato}>{cita.lugar}</Text></View>
            {cita.direccion ? (
              <TouchableOpacity style={styles.fila} onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(cita.direccion!)}`)}>
                <Ionicons name="map-outline" size={18} color={Colors.gold[600] ?? '#b8960c'} /><Text style={[styles.dato, styles.link]}>Abrir en el mapa</Text>
              </TouchableOpacity>
            ) : null}
            {cita.notas ? <View style={styles.fila}><Ionicons name="chatbox-ellipses-outline" size={18} color={Colors.dark[600]} /><Text style={styles.dato}>{cita.notas}</Text></View> : null}
            {cita.motivo_cancelacion ? <View style={styles.fila}><Ionicons name="close-circle-outline" size={18} color="#b91c1c" /><Text style={styles.dato}>Motivo: {cita.motivo_cancelacion}</Text></View> : null}
          </View>

          {/* Con quién */}
          <View style={styles.card}>
            {esAcreditado ? (
              <>
                <Text style={styles.label}>TU ASESOR</Text>
                <Text style={styles.nombre}>{cita.asesor?.nombre ?? 'Por asignar'}</Text>
                {telAsesor ? (
                  <View style={styles.acciones}>
                    <TouchableOpacity style={styles.btnSec} onPress={() => Linking.openURL(`tel:${telAsesor}`)}><Ionicons name="call-outline" size={16} color={Colors.gold[400]} /><Text style={styles.btnSecTexto}>Llamar</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.btnSec} onPress={() => Linking.openURL(`https://wa.me/52${telAsesor}`)}><Ionicons name="logo-whatsapp" size={16} color="#25d366" /><Text style={styles.btnSecTexto}>WhatsApp</Text></TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.label}>CLIENTE</Text>
                <Text style={styles.nombre}>{cita.nombre}</Text>
                {cita.asesor ? <Text style={styles.sub}>Asesor: {cita.asesor.nombre}</Text> : null}
                {cita.folio ? <Text style={styles.sub}>Expediente {cita.folio}</Text> : null}
                <View style={styles.acciones}>
                  {tel ? <TouchableOpacity style={styles.btnSec} onPress={() => Linking.openURL(`tel:${tel}`)}><Ionicons name="call-outline" size={16} color={Colors.gold[400]} /><Text style={styles.btnSecTexto}>Llamar</Text></TouchableOpacity> : null}
                  {tel ? <TouchableOpacity style={styles.btnSec} onPress={() => Linking.openURL(`https://wa.me/52${tel}`)}><Ionicons name="logo-whatsapp" size={16} color="#25d366" /><Text style={styles.btnSecTexto}>WhatsApp</Text></TouchableOpacity> : null}
                  {cita.contacto_id ? <TouchableOpacity style={styles.btnSec} onPress={() => router.push(`/prospectos/${cita.contacto_id}`)}><Text style={styles.btnSecTexto}>Ver prospecto</Text><Ionicons name="chevron-forward" size={14} color={Colors.cream[200]} /></TouchableOpacity> : null}
                  {cita.expediente_id ? <TouchableOpacity style={styles.btnSec} onPress={() => router.push(`/expedientes/${cita.expediente_id}`)}><Text style={styles.btnSecTexto}>Ver expediente</Text><Ionicons name="chevron-forward" size={14} color={Colors.cream[200]} /></TouchableOpacity> : null}
                </View>
              </>
            )}
          </View>

          {/* Acciones */}
          {activa && (
            <View style={styles.card}>
              <Text style={styles.label}>ACCIONES</Text>
              {isSuperAdmin && !esAcreditado && cita.estado === 'solicitada' && (
                <TouchableOpacity style={styles.btnOk} disabled={trabajando} onPress={() => accion(() => confirmarCita(cita.id), 'Cita confirmada. Avisamos al cliente y al asesor.')}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.white} /><Text style={styles.btnOkTexto}>Confirmar cita</Text>
                </TouchableOpacity>
              )}
              {isSuperAdmin && !esAcreditado && (
                <TouchableOpacity style={styles.btnNeutro} disabled={trabajando} onPress={() => { setFecha(null); setHuecos([]); setReag(true); }}>
                  <Ionicons name="calendar-outline" size={18} color={Colors.dark[900]} /><Text style={styles.btnNeutroTexto}>Reagendar</Text>
                </TouchableOpacity>
              )}
              {isSuperAdmin && !esAcreditado && cita.estado === 'confirmada' && yaPaso && (
                <View style={styles.acciones}>
                  <TouchableOpacity style={styles.btnSec} disabled={trabajando} onPress={() => accion(() => marcarCita(cita.id, true), 'Marcada como realizada.')}><Ionicons name="thumbs-up-outline" size={16} color={Colors.gold[400]} /><Text style={styles.btnSecTexto}>Asistió</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnSec} disabled={trabajando} onPress={() => accion(() => marcarCita(cita.id, false), 'Marcada como no asistió.')}><Ionicons name="thumbs-down-outline" size={16} color="#fca5a5" /><Text style={styles.btnSecTexto}>No asistió</Text></TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={styles.btnPeligro} disabled={trabajando} onPress={cancelar}>
                <Ionicons name="close-circle-outline" size={18} color="#b91c1c" /><Text style={styles.btnPeligroTexto}>Cancelar cita</Text>
              </TouchableOpacity>
            </View>
          )}
          {trabajando && <ActivityIndicator color={Colors.gold[400]} />}
        </ScrollView>
      )}

      {/* Reagendar: elegir otro día y hueco */}
      <Modal visible={reagendando} animationType="slide" onRequestClose={() => setReag(false)}>
        <View style={styles.flex}>
          <Header title="Reagendar" subtitle={cita?.oficina?.nombre} onBack={() => setReag(false)} />
          {cita?.oficina ? (
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.label}>Nuevo día</Text>
              <View style={styles.chips}>
                {proximosDias([1, 2, 3, 4, 5, 6, 7], 14).map(d => (
                  <TouchableOpacity key={d.fecha} style={[styles.chip, fecha === d.fecha && styles.chipOn]} onPress={() => setFecha(d.fecha)}>
                    <Text style={[styles.chipText, fecha === d.fecha && styles.chipTextOn]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {fecha && (
                <>
                  <Text style={styles.label}>Nueva hora</Text>
                  {huecos.length === 0 ? <Text style={styles.sub}>Ese día no hay horarios.</Text> : (
                    <View style={styles.chips}>
                      {huecos.map(h => (
                        <TouchableOpacity key={h.inicia} disabled={!h.disponible} style={[styles.chip, !h.disponible && { opacity: 0.4 }]}
                          onPress={() => { setReag(false); accion(() => reagendarCita(cita.id, h.inicia), 'Cita reagendada. Avisamos al cliente y al asesor.'); }}>
                          <Text style={styles.chipText}>{horaCorta(h.inicia)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          ) : <Text style={styles.error}>Esta cita no tiene oficina asignada.</Text>}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex:         { flex: 1, backgroundColor: Colors.cream[50] },
  body:         { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  error:        { textAlign: 'center', color: Colors.dark[600], marginTop: Spacing['2xl'], paddingHorizontal: Spacing.xl },
  card:         { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300], padding: Spacing.lg, gap: Spacing.sm },
  estado:       { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  estadoTexto:  { color: Colors.white, fontSize: 11, fontWeight: Typography.fontWeight.bold },
  fecha:        { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], textTransform: 'capitalize' },
  hora:         { fontSize: Typography.fontSize.base, color: Colors.dark[700] },
  fila:         { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  dato:         { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[700], lineHeight: 20 },
  link:         { color: Colors.gold[600] ?? '#b8960c', fontWeight: Typography.fontWeight.semibold },
  label:        { fontSize: Typography.fontSize.xs, letterSpacing: 1.2, color: Colors.dark[500], fontWeight: Typography.fontWeight.bold },
  nombre:       { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  sub:          { fontSize: Typography.fontSize.sm, color: Colors.dark[600] },
  acciones:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  btnSec:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md },
  btnSecTexto:  { fontSize: Typography.fontSize.xs, color: Colors.cream[200], fontWeight: Typography.fontWeight.medium },
  btnOk:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#15803d', borderRadius: Radius.md, padding: Spacing.md },
  btnOkTexto:   { color: Colors.white, fontWeight: Typography.fontWeight.bold },
  btnNeutro:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold[400], borderRadius: Radius.md, padding: Spacing.md },
  btnNeutroTexto: { color: Colors.dark[900], fontWeight: Typography.fontWeight.bold },
  btnPeligro:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#fca5a5', borderRadius: Radius.md, padding: Spacing.md },
  btnPeligroTexto: { color: '#b91c1c', fontWeight: Typography.fontWeight.semibold },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:         { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300] },
  chipOn:       { backgroundColor: Colors.dark[900], borderColor: Colors.dark[900] },
  chipText:     { fontSize: Typography.fontSize.sm, color: Colors.dark[700], textTransform: 'capitalize' },
  chipTextOn:   { color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold },
});
