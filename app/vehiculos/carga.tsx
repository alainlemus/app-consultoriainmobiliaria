/**
 * Carga de gasolina durante una reserva (?reserva=). La paga la empresa:
 * con su tarjeta, con su efectivo o el asesor paga y se le reembolsa.
 * Pide foto del ticket y del tablero.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getReserva, registrarCarga } from '@/src/services/vehiculosApi';
import { FORMAS_PAGO, kmNumero, numeroDecimal, validarCarga } from '@/src/utils/vehiculos';
import { tomarFoto } from '@/src/utils/camaraUbicacion';
import TableroKm from '@/src/components/vehiculos/TableroKm';
import { Ayuda, Boton, CasillaFoto, Etiqueta, ui } from '@/src/components/vehiculos/ui';
import type { FormaPago, FotoLocal, Reserva } from '@/src/types/vehiculos';

export default function CargaScreen() {
  const router = useRouter();
  const { reserva: reservaId } = useLocalSearchParams<{ reserva: string }>();

  const [r, setR]             = useState<Reserva | null>(null);
  const [cargando, setCarg]   = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [ticket, setTicket]   = useState<FotoLocal | undefined>();
  const [tablero, setTablero] = useState<FotoLocal | undefined>();
  const [km, setKm]           = useState('');
  const [litros, setLitros]   = useState('');
  const [monto, setMonto]     = useState('');
  const [pago, setPago]       = useState<FormaPago | null>(null);
  const [enviando, setEnv]    = useState(false);

  useEffect(() => {
    getReserva(Number(reservaId))
      .then(setR)
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar la reserva.'))
      .finally(() => setCarg(false));
  }, [reservaId]);

  const kmActual = r?.vehiculo.km_actual ?? null;

  async function fotoTicket() {
    const f = await tomarFoto('vehiculo_ticket');
    if (f) setTicket(f);
  }

  async function enviar() {
    const p = validarCarga({ km, litros, monto, pago, fotos: { ticket, tablero }, kmMinimo: kmActual });
    if (p) { Alert.alert('Falta un dato', p.replace('al de salida', 'al último registrado')); return; }
    if (!r || !ticket || !tablero || !pago) return;
    setEnv(true);
    try {
      await registrarCarga(r.id, { km: kmNumero(km), litros: numeroDecimal(litros), monto: numeroDecimal(monto), pago, fotos: { ticket, tablero } });
      Alert.alert('Carga registrada', pago === 'reembolso' ? 'Quedó como reembolso pendiente. Te avisamos cuando te lo paguen.' : 'Gracias, quedó registrada.',
        [{ text: 'Listo', onPress: () => router.back() }]);
    } catch (e: unknown) {
      Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Revisa tu conexión e inténtalo de nuevo. Tus fotos siguen aquí.');
    } finally { setEnv(false); }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Carga de gasolina" subtitle={r?.vehiculo.nombre} onBack={() => router.back()} />
      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : error || !r ? (
        <Text style={s.error}>{error ?? 'No encontramos esta reserva.'}</Text>
      ) : (
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Etiqueta>Ticket</Etiqueta>
          <Ayuda>Que se lean el monto y los litros.</Ayuda>
          <View style={[ui.fotos, { marginTop: Spacing.sm }]}>
            <CasillaFoto etiqueta="Ticket" foto={ticket} onTomar={fotoTicket} />
          </View>

          <Etiqueta>Foto del tablero</Etiqueta>
          <TableroKm foto={tablero} onFoto={setTablero} km={km} onKm={setKm} kmActual={kmActual} ayuda="Después de cargar, que se vea el kilometraje." />

          <View style={s.fila}>
            <View style={{ flex: 1 }}>
              <Etiqueta>Litros</Etiqueta>
              <TextInput style={s.input} value={litros} onChangeText={t => setLitros(t.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="10.5" placeholderTextColor={Colors.dark[400]} accessibilityLabel="Litros" />
            </View>
            <View style={{ flex: 1 }}>
              <Etiqueta>Monto</Etiqueta>
              <TextInput style={s.input} value={monto} onChangeText={t => setMonto(t.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="$250.00" placeholderTextColor={Colors.dark[400]} accessibilityLabel="Monto pagado" />
            </View>
          </View>

          <Etiqueta>¿Cómo se pagó?</Etiqueta>
          {FORMAS_PAGO.map(f => (
            <TouchableOpacity key={f.valor} style={[s.radio, pago === f.valor && s.radioOn]} onPress={() => setPago(f.valor)} accessibilityState={{ selected: pago === f.valor }}>
              <Ionicons name={pago === f.valor ? 'radio-button-on' : 'radio-button-off'} size={20} color={pago === f.valor ? Colors.gold[600] : Colors.dark[400]} />
              <View style={{ flex: 1 }}><Text style={s.fuerte}>{f.texto}</Text><Text style={s.sub}>{f.ayuda}</Text></View>
            </TouchableOpacity>
          ))}

          <Boton texto="Guardar carga" icono="checkmark" onPress={enviar} cargando={enviando} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: Colors.cream[50] },
  body:    { padding: Spacing.base, paddingBottom: Spacing['2xl'] * 2 },
  error:   { textAlign: 'center', color: Colors.dark[600], marginTop: Spacing['2xl'], paddingHorizontal: Spacing.xl, lineHeight: 20 },
  fila:    { flexDirection: 'row', gap: Spacing.md },
  input:   { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300], borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.fontSize.lg, color: Colors.dark[900] },
  sub:     { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  fuerte:  { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  radio:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.white, marginBottom: Spacing.sm },
  radioOn: { borderColor: Colors.gold[400], backgroundColor: Colors.gold[50] },
});
