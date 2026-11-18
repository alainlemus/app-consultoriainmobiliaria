/**
 * Llaves de un vehículo.
 *  - Si las tengo yo: «Entregar llaves» muestra un código de 4 dígitos (dura 5 min)
 *    que escribe quien las recibe, o «Dejar en la oficina» con foto.
 *  - Si las tiene otra persona: «Recibir llaves» escribiendo su código.
 *  - Si están en la oficina: se toman al iniciar la salida (con foto).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getVehiculo, generarCodigoLlaves, recibirLlaves, dejarLlavesEnOficina } from '@/src/services/vehiculosApi';
import { llavesTexto, segundosRestantes } from '@/src/utils/vehiculos';
import { tomarFoto, ubicacionSiHayPermiso } from '@/src/utils/camaraUbicacion';
import { Aviso, Ayuda, Boton, Etiqueta, ui } from '@/src/components/vehiculos/ui';
import type { Vehiculo } from '@/src/types/vehiculos';

export default function LlavesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [v, setV]               = useState<Vehiculo | null>(null);
  const [cargando, setCarg]     = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [codigo, setCodigo]     = useState<{ codigo: string; expira_at: string } | null>(null);
  const [restan, setRestan]     = useState(0);
  const [entrada, setEntrada]   = useState('');
  const [trabajando, setTrab]   = useState(false);

  const cargar = useCallback(async () => {
    try {
      setV(await getVehiculo(Number(id))); setError(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se pudo cargar.'); }
    finally { setCarg(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // Cuenta regresiva del código; al vencer, revisamos si ya las recibieron.
  useEffect(() => {
    if (!codigo) return;
    const tick = () => {
      const s = segundosRestantes(codigo.expira_at);
      setRestan(s);
      if (s === 0) { setCodigo(null); cargar(); }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [codigo, cargar]);

  async function generar() {
    setTrab(true);
    try { setCodigo(await generarCodigoLlaves(Number(id))); }
    catch (e: unknown) { Alert.alert('No se pudo generar el código', e instanceof Error ? e.message : 'Inténtalo de nuevo.'); }
    finally { setTrab(false); }
  }

  async function recibir() {
    if (!/^\d{4}$/.test(entrada)) { Alert.alert('Código incompleto', 'Escribe los 4 dígitos.'); return; }
    setTrab(true);
    try { setV(await recibirLlaves(Number(id), entrada)); setEntrada(''); Alert.alert('Llaves recibidas', 'Quedó registrado que ahora las tienes tú.'); }
    catch (e: unknown) { Alert.alert('No se pudo', e instanceof Error ? e.message : 'Revisa el código.'); }
    finally { setTrab(false); }
  }

  async function dejarEnOficina() {
    const foto = await tomarFoto('llaves_oficina');
    if (!foto) return;
    setTrab(true);
    try {
      const pos = await ubicacionSiHayPermiso();
      setV(await dejarLlavesEnOficina(Number(id), foto, pos)); setCodigo(null);
      Alert.alert('Listo', 'Las llaves quedaron registradas en la oficina.');
    } catch (e: unknown) { Alert.alert('No se pudo', e instanceof Error ? e.message : 'Inténtalo de nuevo.'); }
    finally { setTrab(false); }
  }

  const mmss = `${Math.floor(restan / 60)}:${String(restan % 60).padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Llaves" subtitle={v ? `${v.nombre}${v.placa ? ` · ${v.placa}` : ''}` : undefined} onBack={() => router.back()} />
      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : error || !v ? (
        <Text style={s.error}>{error ?? 'No se pudo cargar.'}</Text>
      ) : (
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={ui.card}>
            <Text style={s.sub}>Dónde están ahora</Text>
            <Text style={s.fuerte}>{llavesTexto(v)}</Text>
          </View>

          {v.llaves.soy_yo ? (
            <>
              <Etiqueta>Entregar llaves a otra persona</Etiqueta>
              <Ayuda>Muéstrale este código a quien recibe las llaves (el dueño u otro asesor). Lo escribe en su app y queda registrado.</Ayuda>
              {codigo ? (
                <View style={s.codigoBox}>
                  <Text style={s.codigo} accessibilityLabel={`Código ${codigo.codigo.split('').join(' ')}`}>{codigo.codigo}</Text>
                  <Text style={s.sub}>Vence en {mmss}</Text>
                </View>
              ) : null}
              <Boton texto={codigo ? 'Generar otro código' : 'Mostrar código'} icono="key-outline" onPress={generar} cargando={trabajando && !codigo} />
              {codigo ? <Boton texto="Ya las recibieron" secundario onPress={() => { setCodigo(null); cargar(); }} /> : null}

              <Etiqueta>O déjalas en la oficina</Etiqueta>
              <Boton texto="Dejar en la oficina (con foto)" icono="camera-outline" secundario onPress={dejarEnOficina} cargando={trabajando && !!codigo} />
            </>
          ) : v.llaves.en === 'usuario' ? (
            <>
              <Etiqueta>Recibir llaves</Etiqueta>
              <Ayuda>Pide a {v.llaves.usuario?.nombre ?? 'quien las tiene'} que abra «Entregar llaves» y te diga el código.</Ayuda>
              <TextInput
                style={s.input} value={entrada} onChangeText={t => setEntrada(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad" maxLength={4} placeholder="····" placeholderTextColor={Colors.dark[300]} accessibilityLabel="Código de llaves"
              />
              <Boton texto="Recibir llaves" onPress={recibir} cargando={trabajando} />
            </>
          ) : (
            <Aviso tono="info" texto="Las llaves están en la oficina. Las tomas al iniciar tu salida: la app te pide una foto de las llaves." />
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: Colors.cream[50] },
  body:      { padding: Spacing.base, paddingBottom: Spacing['2xl'] * 2 },
  error:     { textAlign: 'center', color: Colors.dark[600], marginTop: Spacing['2xl'], paddingHorizontal: Spacing.xl, lineHeight: 20 },
  sub:       { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  fuerte:    { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  codigoBox: { alignItems: 'center', gap: 6, marginTop: Spacing.lg, padding: Spacing.lg, backgroundColor: Colors.dark[900], borderRadius: Radius.lg },
  codigo:    { fontSize: 48, letterSpacing: 16, fontWeight: Typography.fontWeight.bold, color: Colors.gold[400] },
  input:     { marginTop: Spacing.md, alignSelf: 'center', width: 200, textAlign: 'center', fontSize: 40, letterSpacing: 14, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300], borderRadius: Radius.lg, paddingVertical: Spacing.md },
});
