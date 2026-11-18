/**
 * Checklist de salida o de entrega (?reserva=&vehiculo=&tipo=salida|entrega).
 *
 * Salida:  llaves → tablero (km + gasolina) → fotos del vehículo → checklist y daños → enviar
 * Entrega: tablero → fotos del vehículo → checklist y daños → llaves (oficina o conmigo) → enviar
 *
 * Las fotos solo se toman con la cámara. Las fotos y el checklist que pide
 * cada tipo de vehículo los configura la administración en el panel.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getReserva, registrarSalida, registrarEntrega } from '@/src/services/vehiculosApi';
import TableroKm from '@/src/components/vehiculos/TableroKm';
import { fotosFaltantes, fotosObligatorias, kmNumero, validarKm } from '@/src/utils/vehiculos';
import { tomarFoto, ubicacionSiHayPermiso } from '@/src/utils/camaraUbicacion';
import { Aviso, Ayuda, Boton, CasillaFoto, Etiqueta, SelectorGasolina, ui } from '@/src/components/vehiculos/ui';
import type { FotoLocal, NivelGasolina, Reserva, Vehiculo } from '@/src/types/vehiculos';

type Paso = 'llaves' | 'tablero' | 'fotos' | 'revision' | 'llaves_destino';

export default function ChecklistScreen() {
  const router = useRouter();
  const { reserva: reservaId, vehiculo: vehiculoId, tipo } = useLocalSearchParams<{ reserva: string; vehiculo: string; tipo: 'salida' | 'entrega' }>();
  const esSalida = tipo !== 'entrega';

  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [reserva, setReserva]   = useState<Reserva | null>(null);
  const [cargando, setCarg]     = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [indice, setIndice]     = useState(0);

  const [codigo, setCodigo]       = useState('');
  const [km, setKm]               = useState('');
  const [gasolina, setGasolina]   = useState<NivelGasolina | null>(null);
  const [fotos, setFotos]         = useState<Record<string, FotoLocal>>({});
  const [fotosDanos, setFD]       = useState<FotoLocal[]>([]);
  const [marcados, setMarcados]   = useState<string[]>([]);
  const [hayDanos, setHayDanos]   = useState<boolean | null>(null);
  const [notasDanos, setNotas]    = useState('');
  const [destinoLlaves, setDL]    = useState<'oficina' | 'conmigo' | null>(null);
  const [enviando, setEnv]        = useState(false);

  useEffect(() => {
    // La reserva ya trae el vehículo completo (tipo, fotos, checklist y llaves).
    getReserva(Number(reservaId))
      .then(r => { setVehiculo(r.vehiculo); setReserva(r); })
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar el checklist.'))
      .finally(() => setCarg(false));
  }, [reservaId, vehiculoId, esSalida]);

  // En la salida: ¿cómo se toman las llaves?
  const modoLlaves: 'ya' | 'oficina' | 'codigo' = !vehiculo || vehiculo.llaves.soy_yo ? 'ya' : vehiculo.llaves.en === 'oficina' ? 'oficina' : 'codigo';

  const pasos: Paso[] = useMemo(() => esSalida
    ? [...(modoLlaves === 'ya' ? [] : ['llaves' as Paso]), 'tablero', 'fotos', 'revision']
    : ['tablero', 'fotos', 'revision', 'llaves_destino'], [esSalida, modoLlaves]);
  const paso = pasos[Math.min(indice, pasos.length - 1)];
  const ultimo = indice >= pasos.length - 1;

  // En la entrega no puede ser menor que la salida ni que lo último registrado (resguardo, retomar, cargas).
  const kmMinimo = !esSalida && reserva?.salida ? Math.max(reserva.salida.km, vehiculo?.km_actual ?? 0) : null;

  async function foto(clave: string, etiqueta: string) {
    const f = await tomarFoto(`vehiculo_${clave}`);
    if (f) setFotos(prev => ({ ...prev, [clave]: f }));
    else if (!fotos[clave]) Alert.alert('Sin foto', `No se tomó la foto «${etiqueta}».`);
  }

  async function fotoDano() {
    const f = await tomarFoto('vehiculo_dano');
    if (f) setFD(prev => [...prev, f].slice(0, 6));
  }

  /** Revisa el paso actual; devuelve el problema o null. */
  function problemaDelPaso(p: Paso): string | null {
    if (!vehiculo) return 'Cargando…';
    if (p === 'llaves') {
      if (modoLlaves === 'codigo' && !/^\d{4}$/.test(codigo)) return 'Escribe el código de 4 dígitos que te muestra quien te da las llaves.';
      if (modoLlaves === 'oficina' && !fotos.llaves) return 'Toma una foto de las llaves que estás tomando de la oficina.';
    }
    if (p === 'tablero') {
      if (!fotos.tablero) return 'Toma la foto del tablero (que se vea el kilometraje y la gasolina).';
      const kmMal = validarKm(km, kmMinimo);
      if (kmMal) return kmMal;
      if (gasolina === null) return 'Marca cuánta gasolina tiene.';
    }
    if (p === 'fotos') {
      const faltan = fotosFaltantes(vehiculo.tipo.fotos_requeridas.map(f => f.clave), fotos);
      if (faltan.length) {
        const nombres = vehiculo.tipo.fotos_requeridas.filter(f => faltan.includes(f.clave)).map(f => f.etiqueta);
        return `Faltan fotos: ${nombres.join(', ')}.`;
      }
    }
    if (p === 'revision') {
      if (hayDanos === null) return 'Indica si tiene algún daño.';
      if (hayDanos && !notasDanos.trim() && fotosDanos.length === 0) return 'Describe el daño o toma una foto.';
    }
    if (p === 'llaves_destino') {
      if (!destinoLlaves) return 'Indica dónde quedan las llaves.';
      if (destinoLlaves === 'oficina' && !fotos.llaves) return 'Toma una foto de las llaves en su lugar de la oficina.';
    }
    return null;
  }

  function siguiente() {
    const p = problemaDelPaso(paso);
    if (p) { Alert.alert('Falta un paso', p); return; }
    if (ultimo) enviar(); else setIndice(i => i + 1);
  }

  async function enviar() {
    if (!vehiculo || !reserva) return;
    const conLlaves = esSalida ? modoLlaves === 'oficina' : destinoLlaves === 'oficina';
    const obligatorias = fotosObligatorias(vehiculo.tipo, conLlaves);
    const faltan = fotosFaltantes(obligatorias, fotos);
    if (faltan.length) { Alert.alert('Faltan fotos', 'Revisa los pasos anteriores.'); return; }

    // Solo mandamos las fotos que tocan (p. ej. si cambió de idea sobre las llaves).
    const envioFotos = Object.fromEntries(Object.entries(fotos).filter(([k]) => obligatorias.includes(k)));
    setEnv(true);
    try {
      const pos = await ubicacionSiHayPermiso();
      const datos = {
        km: kmNumero(km), gasolina: gasolina!, ...(pos ?? {}),
        notas_danos: hayDanos ? notasDanos.trim() || undefined : undefined,
        checklist: marcados, fotos: envioFotos, fotos_danos: hayDanos ? fotosDanos : [],
        ...(esSalida ? { llaves_codigo: modoLlaves === 'codigo' ? codigo : undefined } : { llaves_destino: destinoLlaves! }),
      };
      await (esSalida ? registrarSalida(reserva.id, datos) : registrarEntrega(reserva.id, datos));
      Alert.alert(esSalida ? '¡Buen viaje!' : 'Vehículo entregado',
        esSalida ? 'Registramos la salida. Recuerda entregarlo con el mismo checklist.' : destinoLlaves === 'conmigo' ? 'Las llaves siguen contigo hasta que se las entregues a alguien con el código.' : 'Gracias. Las llaves quedaron registradas en la oficina.',
        [{ text: 'Listo', onPress: () => router.back() }]);
    } catch (e: unknown) {
      Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Revisa tu conexión e inténtalo de nuevo. Tus fotos siguen aquí.');
    } finally { setEnv(false); }
  }

  const titulo = esSalida ? 'Salida' : 'Entrega';

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={`${titulo}${vehiculo ? ` · ${vehiculo.nombre}` : ''}`} subtitle={`Paso ${Math.min(indice, pasos.length - 1) + 1} de ${pasos.length}`} onBack={() => (indice > 0 ? setIndice(i => i - 1) : router.back())} />
      <View style={s.stepper}>{pasos.map((p, i) => <View key={p} style={[s.step, i <= indice && s.stepOn]} />)}</View>

      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : error || !vehiculo ? (
        <Text style={s.error}>{error ?? 'No se pudo cargar.'}</Text>
      ) : (
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {paso === 'llaves' && (
            modoLlaves === 'codigo' ? (
              <>
                <Etiqueta>Recibe las llaves</Etiqueta>
                <View style={ui.card}><Text style={s.sub}>Las llaves las tiene</Text><Text style={s.fuerte}>{vehiculo.llaves.usuario?.nombre ?? 'otra persona'}</Text></View>
                <Ayuda>Pídele que abra «Entregar llaves» en su app (o en el panel) y te diga el código de 4 dígitos.</Ayuda>
                <TextInput
                  style={s.codigo} value={codigo} onChangeText={t => setCodigo(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad" maxLength={4} placeholder="····" placeholderTextColor={Colors.dark[300]} accessibilityLabel="Código de llaves"
                />
              </>
            ) : (
              <>
                <Etiqueta>Toma las llaves de la oficina</Etiqueta>
                <Ayuda>Toma una foto de las llaves al tomarlas. Así queda registrado quién se las llevó.</Ayuda>
                <View style={[ui.fotos, { marginTop: Spacing.md }]}>
                  <CasillaFoto etiqueta="Llaves" foto={fotos.llaves} onTomar={() => foto('llaves', 'Llaves')} />
                </View>
              </>
            )
          )}

          {paso === 'tablero' && (
            <>
              <Etiqueta>Foto del tablero</Etiqueta>
              <TableroKm
                foto={fotos.tablero} onFoto={f => setFotos(prev => ({ ...prev, tablero: f }))}
                km={km} onKm={setKm} kmActual={kmMinimo ?? vehiculo.km_actual}
              />
              {kmMinimo !== null ? <Ayuda>Último registro: {kmMinimo.toLocaleString('es-MX')} km (no puede ser menor).</Ayuda> : null}
              {esSalida && km && vehiculo.km_actual && kmNumero(km) !== vehiculo.km_actual ? (
                <Aviso texto={`El último registro fue de ${vehiculo.km_actual.toLocaleString('es-MX')} km. Si el tablero marca otra cosa, está bien: escribe lo que ves y se le avisa a la administración.`} />
              ) : null}
              <Etiqueta>Gasolina</Etiqueta>
              <SelectorGasolina valor={gasolina} onChange={setGasolina} />
            </>
          )}

          {paso === 'fotos' && (
            <>
              <Etiqueta>Fotos del vehículo</Etiqueta>
              <Ayuda>Siempre los mismos ángulos, para comparar la salida con la entrega.</Ayuda>
              <View style={[ui.fotos, { marginTop: Spacing.sm }]}>
                {vehiculo.tipo.fotos_requeridas.map(f => (
                  <CasillaFoto key={f.clave} etiqueta={f.etiqueta} foto={fotos[f.clave]} onTomar={() => foto(f.clave, f.etiqueta)} />
                ))}
              </View>
              {vehiculo.tipo.fotos_requeridas.length === 0 ? <Ayuda>Este tipo de vehículo no pide fotos extra.</Ayuda> : null}
            </>
          )}

          {paso === 'revision' && (
            <>
              {vehiculo.tipo.checklist.length > 0 && (
                <>
                  <Etiqueta>{esSalida ? 'Llevo conmigo' : 'Entrego'}</Etiqueta>
                  {vehiculo.tipo.checklist.map(c => {
                    const on = marcados.includes(c);
                    return (
                      <TouchableOpacity key={c} style={s.check} onPress={() => setMarcados(m => on ? m.filter(x => x !== c) : [...m, c])} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? Colors.gold[600] : Colors.dark[400]} />
                        <Text style={s.checkText}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
              <Etiqueta>¿Tiene algún daño?</Etiqueta>
              <View style={ui.seg}>
                {([[false, 'No'], [true, 'Sí']] as const).map(([v, t]) => (
                  <TouchableOpacity key={t} style={[ui.segItem, hayDanos === v && ui.segOn]} onPress={() => setHayDanos(v)}>
                    <Text style={[ui.segText, hayDanos === v && ui.segTextOn]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {hayDanos && (
                <>
                  <TextInput style={[s.input, { minHeight: 70 }]} value={notasDanos} onChangeText={setNotas} multiline placeholder="Ej. Rayón en la salpicadera izquierda" placeholderTextColor={Colors.dark[400]} />
                  <View style={[ui.fotos, { marginTop: Spacing.sm }]}>
                    {fotosDanos.map((f, i) => <CasillaFoto key={f.uri} etiqueta={`Daño ${i + 1}`} foto={f} onTomar={() => setFD(prev => prev.filter(x => x.uri !== f.uri))} />)}
                    {fotosDanos.length < 6 && <CasillaFoto etiqueta="Agregar foto del daño" onTomar={fotoDano} />}
                  </View>
                  {fotosDanos.length ? <Ayuda>Toca una foto de daño para quitarla.</Ayuda> : null}
                </>
              )}
            </>
          )}

          {paso === 'llaves_destino' && (
            <>
              <Etiqueta>¿Dónde quedan las llaves?</Etiqueta>
              {([['oficina', 'Las dejo en la oficina', 'Tomas foto de las llaves en su lugar'], ['conmigo', 'Se quedan conmigo por ahora', 'Se las das después al dueño o a otro asesor con el código']] as const).map(([v, t, d]) => (
                <TouchableOpacity key={v} style={[s.radio, destinoLlaves === v && s.radioOn]} onPress={() => setDL(v)} accessibilityState={{ selected: destinoLlaves === v }}>
                  <Ionicons name={destinoLlaves === v ? 'radio-button-on' : 'radio-button-off'} size={20} color={destinoLlaves === v ? Colors.gold[600] : Colors.dark[400]} />
                  <View style={{ flex: 1 }}><Text style={s.fuerte}>{t}</Text><Text style={s.sub}>{d}</Text></View>
                </TouchableOpacity>
              ))}
              {destinoLlaves === 'oficina' && (
                <View style={[ui.fotos, { marginTop: Spacing.sm }]}>
                  <CasillaFoto etiqueta="Llaves" foto={fotos.llaves} onTomar={() => foto('llaves', 'Llaves')} />
                </View>
              )}
            </>
          )}

          <Boton texto={ultimo ? (esSalida ? 'Confirmar salida' : 'Confirmar entrega') : 'Siguiente'} onPress={siguiente} cargando={enviando} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:     { flex: 1, backgroundColor: Colors.cream[50] },
  body:     { padding: Spacing.base, paddingBottom: Spacing['2xl'] * 2 },
  error:    { textAlign: 'center', color: Colors.dark[600], marginTop: Spacing['2xl'], paddingHorizontal: Spacing.xl, lineHeight: 20 },
  stepper:  { flexDirection: 'row', gap: 4, paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  step:     { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.cream[300] },
  stepOn:   { backgroundColor: Colors.gold[400] },
  sub:      { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  fuerte:   { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  codigo:   { marginTop: Spacing.lg, alignSelf: 'center', width: 200, textAlign: 'center', fontSize: 40, letterSpacing: 14, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300], borderRadius: Radius.lg, paddingVertical: Spacing.md },
  input:    { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300], borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.fontSize.lg, color: Colors.dark[900], marginTop: Spacing.sm },
  check:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  checkText:{ fontSize: Typography.fontSize.base, color: Colors.dark[800] },
  radio:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.white, marginBottom: Spacing.sm },
  radioOn:  { borderColor: Colors.gold[400], backgroundColor: Colors.gold[50] },
});
