/**
 * Resguardo nocturno (?reserva=&modo=guardar|retomar).
 *
 * Guardar en casa: foto del tablero (km + gasolina) y foto del vehículo estacionado.
 * Retomar: foto del tablero y km a la mañana siguiente (se sugiere el km con que se guardó).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Header from '@/src/components/ui/Header';
import { Colors, Spacing } from '@/src/theme';
import { getReserva, registrarResguardo, retomarVehiculo } from '@/src/services/vehiculosApi';
import { kmNumero, validarKm } from '@/src/utils/vehiculos';
import { tomarFoto, ubicacionSiHayPermiso } from '@/src/utils/camaraUbicacion';
import TableroKm from '@/src/components/vehiculos/TableroKm';
import { Aviso, Ayuda, Boton, CasillaFoto, Etiqueta, SelectorGasolina, ui } from '@/src/components/vehiculos/ui';
import type { FotoLocal, NivelGasolina, Reserva } from '@/src/types/vehiculos';

export default function CasaScreen() {
  const router = useRouter();
  const { reserva: reservaId, modo } = useLocalSearchParams<{ reserva: string; modo: 'guardar' | 'retomar' }>();
  const guardar = modo !== 'retomar';

  const [r, setR]               = useState<Reserva | null>(null);
  const [cargando, setCarg]     = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tablero, setTablero]   = useState<FotoLocal | undefined>();
  const [estacionada, setEst]   = useState<FotoLocal | undefined>();
  const [km, setKm]             = useState('');
  const [gasolina, setGasolina] = useState<NivelGasolina | null>(null);
  const [enviando, setEnv]      = useState(false);

  useEffect(() => {
    getReserva(Number(reservaId))
      .then(setR)
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar la reserva.'))
      .finally(() => setCarg(false));
  }, [reservaId]);

  const kmGuardado = r?.resguardo?.km ?? null;
  const kmActual   = r ? (guardar ? r.vehiculo.km_actual : kmGuardado ?? r.vehiculo.km_actual) : null;

  async function fotoEstacionada() {
    const f = await tomarFoto('vehiculo_estacionada');
    if (f) setEst(f);
  }

  function problema(): string | null {
    if (!tablero) return 'Toma la foto del tablero.';
    const kmMal = validarKm(km, kmActual);
    if (kmMal) return kmMal.replace('al de salida', 'al último registrado');
    if (guardar && gasolina === null) return 'Marca cuánta gasolina tiene.';
    if (guardar && !estacionada) return 'Toma una foto del vehículo estacionado.';
    return null;
  }

  async function enviar() {
    const p = problema();
    if (p) { Alert.alert('Falta un paso', p); return; }
    if (!r || !tablero) return;
    setEnv(true);
    try {
      const pos = await ubicacionSiHayPermiso();
      if (guardar) {
        await registrarResguardo(r.id, { km: kmNumero(km), gasolina: gasolina!, ...(pos ?? {}), fotos: { tablero, estacionada: estacionada! } });
        Alert.alert('Guardado en casa', 'Mañana toca «Retomar» antes de usarlo, o entrégalo si ya terminaste.', [{ text: 'Listo', onPress: () => router.back() }]);
      } else {
        await retomarVehiculo(r.id, { km: kmNumero(km), ...(pos ?? {}), fotos: { tablero } });
        Alert.alert('¡Buen día!', 'El vehículo vuelve a estar en uso.', [{ text: 'Listo', onPress: () => router.back() }]);
      }
    } catch (e: unknown) {
      Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Revisa tu conexión e inténtalo de nuevo. Tus fotos siguen aquí.');
    } finally { setEnv(false); }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={guardar ? 'Guardar en casa' : 'Retomar vehículo'} subtitle={r?.vehiculo.nombre} onBack={() => router.back()} />
      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : error || !r ? (
        <Text style={s.error}>{error ?? 'No encontramos esta reserva.'}</Text>
      ) : (
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {guardar
            ? <Aviso tono="info" texto="Registra cómo queda el vehículo para la noche. Queda guardada la ubicación si la app tiene permiso." />
            : <Aviso tono="info" texto={kmGuardado !== null ? `Lo guardaste con ${kmGuardado.toLocaleString('es-MX')} km. Si el tablero marca más, se le avisa a la administración.` : 'Toma la foto del tablero antes de salir.'} />}

          <Etiqueta>Foto del tablero</Etiqueta>
          <TableroKm foto={tablero} onFoto={setTablero} km={km} onKm={setKm} kmActual={kmActual} />
          {!guardar && kmGuardado !== null && !km ? (
            <Boton texto={`Usar ${kmGuardado.toLocaleString('es-MX')} km`} secundario onPress={() => setKm(String(kmGuardado))} />
          ) : null}

          {guardar && (
            <>
              <Etiqueta>Gasolina</Etiqueta>
              <SelectorGasolina valor={gasolina} onChange={setGasolina} />
              <Etiqueta>Vehículo estacionado</Etiqueta>
              <Ayuda>Una foto donde se vea dónde queda guardado.</Ayuda>
              <View style={[ui.fotos, { marginTop: Spacing.sm }]}>
                <CasillaFoto etiqueta="Estacionado" foto={estacionada} onTomar={fotoEstacionada} />
              </View>
            </>
          )}

          <Boton texto={guardar ? 'Confirmar: queda en casa' : 'Retomar vehículo'} icono={guardar ? 'home' : 'play'} onPress={enviar} cargando={enviando} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:  { flex: 1, backgroundColor: Colors.cream[50] },
  body:  { padding: Spacing.base, paddingBottom: Spacing['2xl'] * 2 },
  error: { textAlign: 'center', color: Colors.dark[600], marginTop: Spacing['2xl'], paddingHorizontal: Spacing.xl, lineHeight: 20 },
});
