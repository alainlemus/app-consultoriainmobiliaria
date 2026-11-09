/**
 * Agendar cita. Elige oficina, tipo (oficina o domicilio), día y un hueco
 * libre. La cita nace «solicitada»; la administración la confirma.
 *  - Asesor: llega con ?contacto_id= o ?expediente_id=
 *  - Acreditado: ?tipo=acreditado (la cita es con su asesor)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getOficinasCitas, getDisponibilidadCitas, crearCita } from '@/src/services/api';
import { getOficinasCitasAcreditado, getDisponibilidadAcreditado, crearCitaAcreditado } from '@/src/services/acreditadoApi';
import { proximosDias, horaCorta, fechaLarga } from '@/src/utils/citas';
import type { OficinaCita, HuecoCita } from '@/src/types';

export default function NuevaCitaScreen() {
  const router = useRouter();
  const { tipo: modo, contacto_id, expediente_id, nombre } = useLocalSearchParams<{ tipo?: 'acreditado'; contacto_id?: string; expediente_id?: string; nombre?: string }>();
  const esAcreditado = modo === 'acreditado';

  const [oficinas, setOficinas] = useState<OficinaCita[]>([]);
  const [oficina, setOficina]   = useState<OficinaCita | null>(null);
  const [tipoCita, setTipoCita] = useState<'oficina' | 'domicilio'>('oficina');
  const [fecha, setFecha]       = useState<string | null>(null);
  const [huecos, setHuecos]     = useState<HuecoCita[]>([]);
  const [hueco, setHueco]       = useState<HuecoCita | null>(null);
  const [direccion, setDir]     = useState('');
  const [notas, setNotas]       = useState('');
  const [cargando, setCarg]     = useState(true);
  const [cargandoHuecos, setCH] = useState(false);
  const [enviando, setEnv]      = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    (esAcreditado ? getOficinasCitasAcreditado() : getOficinasCitas())
      .then(o => { setOficinas(o); if (o.length === 1) setOficina(o[0]); })
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudieron cargar las oficinas.'))
      .finally(() => setCarg(false));
  }, [esAcreditado]);

  const cargarHuecos = useCallback(async () => {
    if (!oficina || !fecha) return;
    setCH(true); setHueco(null);
    try {
      setHuecos(esAcreditado ? await getDisponibilidadAcreditado(oficina.id, fecha, tipoCita) : await getDisponibilidadCitas(oficina.id, fecha, tipoCita));
    } catch { setHuecos([]); } finally { setCH(false); }
  }, [oficina, fecha, tipoCita, esAcreditado]);

  useEffect(() => { cargarHuecos(); }, [cargarHuecos]);

  const dias = oficina ? proximosDias(oficina.dias, 14) : [];

  async function confirmar() {
    if (!oficina || !hueco) return;
    if (tipoCita === 'domicilio' && direccion.trim().length < 8) { Alert.alert('Falta la dirección', 'Escribe la dirección completa donde te visitaremos.'); return; }
    setEnv(true);
    try {
      const base = { cobertura_id: oficina.id, tipo: tipoCita, inicia_at: hueco.inicia, direccion: tipoCita === 'domicilio' ? direccion.trim() : undefined, notas: notas.trim() || undefined };
      const cita = esAcreditado
        ? await crearCitaAcreditado(base)
        : await crearCita({ ...base, contacto_id: contacto_id ? Number(contacto_id) : undefined, expediente_id: expediente_id ? Number(expediente_id) : undefined });
      Alert.alert('Cita solicitada', `${fechaLarga(cita.inicia_at)} a las ${horaCorta(cita.inicia_at)}. La administración la confirmará y te avisaremos.`, [
        { text: 'Ver cita', onPress: () => router.replace({ pathname: '/citas/[id]', params: { id: String(cita.id), tipo: esAcreditado ? 'acreditado' : 'staff' } }) },
      ]);
    } catch (e: unknown) {
      Alert.alert('No se pudo agendar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
      cargarHuecos();
    } finally { setEnv(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Agendar cita" subtitle={esAcreditado ? 'Con tu asesor' : (nombre ? `Para ${nombre}` : 'Para tu cliente')} onBack={() => router.back()} />
      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : oficinas.length === 0 ? (
        <Text style={styles.error}>Por ahora no hay oficinas con citas disponibles. Contacta a tu asesor.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>1. ¿En qué oficina?</Text>
          <View style={styles.chips}>
            {oficinas.map(o => (
              <TouchableOpacity key={o.id} style={[styles.chip, oficina?.id === o.id && styles.chipOn]} onPress={() => { setOficina(o); setFecha(null); setHueco(null); if (!o.permite_domicilio) setTipoCita('oficina'); }}>
                <Text style={[styles.chipText, oficina?.id === o.id && styles.chipTextOn]}>{o.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {oficina?.direccion ? <Text style={styles.ayuda}><Ionicons name="location-outline" size={12} /> {oficina.direccion} · {oficina.inicio} a {oficina.fin}</Text> : null}

          {oficina && (
            <>
              <Text style={styles.label}>2. ¿Dónde te atendemos?</Text>
              <View style={styles.chips}>
                <TouchableOpacity style={[styles.chip, tipoCita === 'oficina' && styles.chipOn]} onPress={() => setTipoCita('oficina')}>
                  <Text style={[styles.chipText, tipoCita === 'oficina' && styles.chipTextOn]}>En la oficina</Text>
                </TouchableOpacity>
                {oficina.permite_domicilio && (
                  <TouchableOpacity style={[styles.chip, tipoCita === 'domicilio' && styles.chipOn]} onPress={() => setTipoCita('domicilio')}>
                    <Text style={[styles.chipText, tipoCita === 'domicilio' && styles.chipTextOn]}>Visita a domicilio</Text>
                  </TouchableOpacity>
                )}
              </View>
              {tipoCita === 'domicilio' && (
                <TextInput style={styles.input} value={direccion} onChangeText={setDir} placeholder="Calle, número, colonia y municipio" placeholderTextColor={Colors.dark[400]} />
              )}

              <Text style={styles.label}>3. ¿Qué día?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dias}>
                {dias.map(d => (
                  <TouchableOpacity key={d.fecha} style={[styles.dia, fecha === d.fecha && styles.diaOn]} onPress={() => setFecha(d.fecha)}>
                    <Text style={[styles.diaTexto, fecha === d.fecha && styles.diaTextoOn]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {fecha && (
                <>
                  <Text style={styles.label}>4. ¿A qué hora?</Text>
                  {cargandoHuecos ? <ActivityIndicator color={Colors.gold[400]} /> : huecos.length === 0 ? (
                    <Text style={styles.ayuda}>Ese día no hay horarios. Prueba otro.</Text>
                  ) : (
                    <View style={styles.chips}>
                      {huecos.map(h => (
                        <TouchableOpacity key={h.inicia} disabled={!h.disponible} style={[styles.hora, !h.disponible && styles.horaOcupada, hueco?.inicia === h.inicia && styles.horaOn]} onPress={() => setHueco(h)}>
                          <Text style={[styles.horaTexto, !h.disponible && styles.horaTextoOcupada, hueco?.inicia === h.inicia && styles.horaTextoOn]}>{horaCorta(h.inicia)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}

              {hueco && (
                <>
                  <Text style={styles.label}>5. Algo que debamos saber (opcional)</Text>
                  <TextInput style={[styles.input, { minHeight: 70 }]} value={notas} onChangeText={setNotas} multiline placeholder="Ej. Llevo mi INE y talones de pago" placeholderTextColor={Colors.dark[400]} />

                  <View style={styles.resumen}>
                    <Ionicons name="calendar" size={20} color={Colors.gold[400]} />
                    <Text style={styles.resumenTexto}>{fechaLarga(hueco.inicia)} · {horaCorta(hueco.inicia)} a {horaCorta(hueco.termina)}{'\n'}{tipoCita === 'domicilio' ? 'Visita a domicilio' : `Oficina ${oficina.nombre}`}</Text>
                  </View>
                  <TouchableOpacity style={styles.btn} onPress={confirmar} disabled={enviando}>
                    {enviando ? <ActivityIndicator color={Colors.dark[900]} /> : <Text style={styles.btnTexto}>Solicitar cita</Text>}
                  </TouchableOpacity>
                  <Text style={styles.ayuda}>La administración confirma la cita y te avisamos por notificación.</Text>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: Colors.cream[50] },
  body:        { padding: Spacing.base, paddingBottom: Spacing['2xl'] * 2 },
  label:       { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], marginTop: Spacing.lg, marginBottom: Spacing.sm },
  ayuda:       { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: Spacing.xs, lineHeight: 18 },
  error:       { textAlign: 'center', color: Colors.dark[600], marginTop: Spacing['2xl'], paddingHorizontal: Spacing.xl, lineHeight: 20 },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:        { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300] },
  chipOn:      { backgroundColor: Colors.dark[900], borderColor: Colors.dark[900] },
  chipText:    { fontSize: Typography.fontSize.sm, color: Colors.dark[700] },
  chipTextOn:  { color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold },
  dias:        { gap: Spacing.xs, paddingVertical: 2 },
  dia:         { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300] },
  diaOn:       { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  diaTexto:    { fontSize: Typography.fontSize.sm, color: Colors.dark[700], textTransform: 'capitalize' },
  diaTextoOn:  { color: Colors.dark[900], fontWeight: Typography.fontWeight.bold },
  hora:        { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300], minWidth: 92, alignItems: 'center' },
  horaOn:      { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  horaOcupada: { backgroundColor: Colors.cream[100], borderColor: Colors.cream[200] },
  horaTexto:   { fontSize: Typography.fontSize.sm, color: Colors.dark[800] },
  horaTextoOn: { color: Colors.dark[900], fontWeight: Typography.fontWeight.bold },
  horaTextoOcupada: { color: Colors.dark[400], textDecorationLine: 'line-through' },
  input:       { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300], borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.fontSize.base, color: Colors.dark[900], marginTop: Spacing.sm },
  resumen:     { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', backgroundColor: Colors.dark[900], borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.lg },
  resumenTexto: { flex: 1, color: Colors.cream[50], fontSize: Typography.fontSize.sm, lineHeight: 20, textTransform: 'capitalize' },
  btn:         { backgroundColor: Colors.gold[400], borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.md },
  btnTexto:    { fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], fontSize: Typography.fontSize.base },
});
