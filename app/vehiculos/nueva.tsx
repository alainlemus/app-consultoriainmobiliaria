/**
 * Solicitar un vehículo. Gana quien pide primero; si el horario ya está pedido
 * la solicitud queda en espera. El super admin la autoriza desde el panel.
 * Llega con ?vehiculo_id= cuando se toca «Solicitar» en un vehículo.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getVehiculos, getOcupacion, crearReserva } from '@/src/services/vehiculosApi';
import { getCitas } from '@/src/services/api';
import { proximosDias, horaCorta, fechaLarga, diaCorto } from '@/src/utils/citas';
import { agruparPorTipo, isoMexico, validarSolicitud } from '@/src/utils/vehiculos';
import { Aviso, Ayuda, Boton, Chip, Etiqueta, ui } from '@/src/components/vehiculos/ui';
import type { Cita } from '@/src/types';
import type { Ocupacion, Vehiculo } from '@/src/types/vehiculos';

const HORAS = Array.from({ length: 15 }, (_, i) => i + 7);   // 7:00 a 21:00
const etiquetaHora = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'am' : 'pm'}`;

export default function NuevaReservaScreen() {
  const router = useRouter();
  const { vehiculo_id } = useLocalSearchParams<{ vehiculo_id?: string }>();

  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [citas, setCitas]         = useState<Cita[]>([]);
  const [cargando, setCarg]       = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [vehiculoId, setVehiculoId] = useState<number | null>(vehiculo_id ? Number(vehiculo_id) : null);
  const [tipoId, setTipoId]         = useState<number | null>(null);         // «el que esté libre»
  const [todoElDia, setTodoElDia]   = useState(false);
  const [fecha, setFecha]           = useState<string | null>(null);
  const [horaInicio, setHI]         = useState<number | null>(null);
  const [horaFin, setHF]            = useState<number | null>(null);
  const [motivo, setMotivo]         = useState('');
  const [destino, setDestino]       = useState('');
  const [citaId, setCitaId]         = useState<number | null>(null);
  const [resguardo, setResguardo]   = useState(false);
  const [ocupacion, setOcupacion]   = useState<Ocupacion[]>([]);
  const [enviando, setEnv]          = useState(false);

  useEffect(() => {
    const hoy = new Date();
    const desde = hoy.toISOString().slice(0, 10);
    const hasta = new Date(hoy.getTime() + 14 * 86400000).toISOString().slice(0, 10);
    Promise.all([
      getVehiculos(),
      getCitas({ desde, hasta }).then(r => r.data).catch(() => [] as Cita[]),
    ]).then(([v, c]) => {
      const disponibles = v.data.filter(x => x.estado !== 'taller');
      setVehiculos(disponibles);
      setCitas(c.filter(x => x.estado === 'solicitada' || x.estado === 'confirmada'));
      if (!vehiculo_id && disponibles.length === 1) setVehiculoId(disponibles[0].id);
    }).catch(e => setError(e instanceof Error ? e.message : 'No se pudieron cargar los vehículos.'))
      .finally(() => setCarg(false));
  }, [vehiculo_id]);

  useEffect(() => {
    if (!vehiculoId || !fecha) { setOcupacion([]); return; }
    getOcupacion(vehiculoId, fecha).then(setOcupacion).catch(() => setOcupacion([]));
  }, [vehiculoId, fecha]);

  const grupos = useMemo(() => agruparPorTipo(vehiculos), [vehiculos]);
  const dias   = useMemo(() => proximosDias([1, 2, 3, 4, 5, 6, 7], 14), []);

  function elegirCita(c: Cita) {
    if (citaId === c.id) { setCitaId(null); return; }
    setCitaId(c.id);
    if (!motivo.trim()) setMotivo(`Cita con ${c.nombre}`);
    if (!destino.trim() && c.lugar) setDestino(c.lugar);
  }

  async function enviar() {
    const problema = validarSolicitud({ vehiculoId, tipoId, todoElDia, fecha, horaInicio, horaFin, motivo });
    if (problema) { Alert.alert('Falta un dato', problema); return; }
    setEnv(true);
    try {
      const cita = citas.find(c => c.id === citaId);
      const { message, data } = await crearReserva({
        vehiculo_id:    vehiculoId,
        tipo_id:        vehiculoId ? undefined : tipoId ?? undefined,
        todo_el_dia:    todoElDia,
        fecha:          todoElDia ? fecha! : undefined,
        inicio:         todoElDia ? undefined : isoMexico(fecha!, horaInicio!),
        fin:            todoElDia ? undefined : isoMexico(fecha!, horaFin!),
        resguardo_casa: resguardo,
        motivo:         motivo.trim(),
        destino:        destino.trim() || undefined,
        cita_id:        cita?.id,
        contacto_id:    cita?.contacto_id ?? undefined,
        expediente_id:  cita?.expediente_id ?? undefined,
      });
      Alert.alert(data.estado === 'en_espera' ? 'Quedaste en espera' : 'Solicitud enviada', message, [
        { text: 'Ver reserva', onPress: () => router.replace({ pathname: '/vehiculos/reserva/[id]', params: { id: String(data.id) } }) },
      ]);
    } catch (e: unknown) {
      Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally { setEnv(false); }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Solicitar vehículo" subtitle="La administración la autoriza" onBack={() => router.back()} />
      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : error ? (
        <Text style={s.error}>{error}</Text>
      ) : vehiculos.length === 0 ? (
        <Text style={s.error}>Ahora no hay vehículos disponibles para pedir.</Text>
      ) : (
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Etiqueta>1. ¿Qué vehículo?</Etiqueta>
          {grupos.map(g => (
            <View key={g.tipo.id} style={{ marginBottom: Spacing.sm }}>
              {grupos.length > 1 ? <Text style={s.grupo}>{g.tipo.nombre}</Text> : null}
              <View style={ui.chips}>
                {g.vehiculos.length > 1 && (
                  <Chip texto={`El que esté libre`} activo={!vehiculoId && tipoId === g.tipo.id} onPress={() => { setVehiculoId(null); setTipoId(g.tipo.id); }} />
                )}
                {g.vehiculos.map(v => (
                  <Chip key={v.id} texto={`${v.nombre}${v.placa ? ` · ${v.placa}` : ''}`} activo={vehiculoId === v.id} onPress={() => { setVehiculoId(v.id); setTipoId(null); }} />
                ))}
              </View>
            </View>
          ))}

          <Etiqueta>2. ¿Por cuánto tiempo?</Etiqueta>
          <View style={ui.seg}>
            {[[false, 'Por horas'], [true, 'Todo el día']].map(([v, t]) => (
              <TouchableOpacity key={String(v)} style={[ui.segItem, todoElDia === v && ui.segOn]} onPress={() => setTodoElDia(v as boolean)}>
                <Text style={[ui.segText, todoElDia === v && ui.segTextOn]}>{t as string}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Etiqueta>3. ¿Qué día?</Etiqueta>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dias}>
            {dias.map(d => (
              <TouchableOpacity key={d.fecha} style={[s.dia, fecha === d.fecha && s.diaOn]} onPress={() => setFecha(d.fecha)}>
                <Text style={[s.diaTexto, fecha === d.fecha && s.diaTextoOn]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {fecha && ocupacion.length > 0 && (
            <Aviso tono="info" texto={`Ese día ya está pedido:\n${ocupacion.map(o => `${horaCorta(o.inicio)} a ${horaCorta(o.fin)} · ${o.asesor.nombre}`).join('\n')}\nSi chocas con alguien, quedas en espera por orden de llegada.`} />
          )}

          {fecha && !todoElDia && (
            <>
              <Etiqueta>4. ¿A qué hora sales?</Etiqueta>
              <View style={ui.chips}>
                {HORAS.slice(0, -1).map(h => <Chip key={h} texto={etiquetaHora(h)} activo={horaInicio === h} onPress={() => { setHI(h); if (horaFin !== null && horaFin <= h) setHF(null); }} />)}
              </View>
              {horaInicio !== null && (
                <>
                  <Etiqueta>¿A qué hora regresas (aprox.)?</Etiqueta>
                  <View style={ui.chips}>
                    {HORAS.filter(h => h > horaInicio).map(h => <Chip key={h} texto={etiquetaHora(h)} activo={horaFin === h} onPress={() => setHF(h)} />)}
                  </View>
                </>
              )}
            </>
          )}
          {fecha && todoElDia ? <Ayuda>Todo el día: {fechaLarga(isoMexico(fecha, 12))}{resguardo ? ', y te lo llevas a casa hasta el día siguiente.' : '.'}</Ayuda> : null}

          <Etiqueta>5. ¿Para qué lo necesitas?</Etiqueta>
          {citas.length > 0 && (
            <>
              <Ayuda>Si es para una cita, tócala para ligarla (ayuda a la administración a decidir).</Ayuda>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.dias, { marginTop: Spacing.sm }]}>
                {citas.map(c => (
                  <Chip key={c.id} texto={`${diaCorto(c.inicia_at)} · ${c.nombre}`} activo={citaId === c.id} onPress={() => elegirCita(c)} />
                ))}
              </ScrollView>
            </>
          )}
          <TextInput style={s.input} value={motivo} onChangeText={setMotivo} placeholder="Ej. Visita a prospecto en Col. Centro" placeholderTextColor={Colors.dark[400]} maxLength={255} />
          <TextInput style={s.input} value={destino} onChangeText={setDestino} placeholder="Destino (opcional)" placeholderTextColor={Colors.dark[400]} maxLength={255} />

          <Etiqueta>6. ¿Dónde queda el vehículo al terminar?</Etiqueta>
          {([[false, 'Regresa a la oficina', 'Lo entrego al terminar'], [true, 'Me lo llevo a casa', 'Resguardo nocturno en mi domicilio']] as const).map(([v, t, d]) => (
            <TouchableOpacity key={String(v)} style={[s.radio, resguardo === v && s.radioOn]} onPress={() => setResguardo(v)} accessibilityState={{ selected: resguardo === v }}>
              <Ionicons name={resguardo === v ? 'radio-button-on' : 'radio-button-off'} size={20} color={resguardo === v ? Colors.gold[600] : Colors.dark[400]} />
              <View style={{ flex: 1 }}>
                <Text style={s.radioTitulo}>{t}</Text>
                <Text style={s.radioSub}>{d}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <Boton texto="Enviar solicitud" onPress={enviar} cargando={enviando} />
          <Ayuda>Te avisamos por notificación cuando la autoricen.</Ayuda>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: Colors.cream[50] },
  body:        { padding: Spacing.base, paddingBottom: Spacing['2xl'] * 2 },
  error:       { textAlign: 'center', color: Colors.dark[600], marginTop: Spacing['2xl'], paddingHorizontal: Spacing.xl, lineHeight: 20 },
  grupo:       { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  dias:        { gap: Spacing.xs, paddingVertical: 2 },
  dia:         { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300] },
  diaOn:       { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  diaTexto:    { fontSize: Typography.fontSize.sm, color: Colors.dark[700], textTransform: 'capitalize' },
  diaTextoOn:  { color: Colors.dark[900], fontWeight: Typography.fontWeight.bold },
  input:       { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300], borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.fontSize.base, color: Colors.dark[900], marginTop: Spacing.sm },
  radio:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.white, marginBottom: Spacing.sm },
  radioOn:     { borderColor: Colors.gold[400], backgroundColor: Colors.gold[50] },
  radioTitulo: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  radioSub:    { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  link:        { color: Colors.gold[700], fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.sm },
});
