/**
 * Detalle de una reserva de vehículo: estado, horario, salida y entrega con
 * sus fotos. Las acciones (iniciar salida, entregar, cancelar) dependen de `puede`.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, TouchableOpacity, Modal, Pressable, Platform } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getReserva, cancelarReserva, cambiarVehiculo } from '@/src/services/vehiculosApi';
import { fechaLarga, horaCorta, diaCorto } from '@/src/utils/citas';
import { ESTADO_RESERVA_COLOR, ESTADO_RESERVA_TEXTO, pesos } from '@/src/utils/vehiculos';
import { Aviso, Boton, Pildora, ui } from '@/src/components/vehiculos/ui';
import type { AlternativaVehiculo, Carga, Movimiento, Reserva } from '@/src/types/vehiculos';

export default function ReservaDetalleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [r, setR]             = useState<Reserva | null>(null);
  const [cargando, setCarg]   = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [trabajando, setTrab] = useState(false);
  const [verFoto, setVerFoto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { setR(await getReserva(Number(id))); setError(null); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se pudo cargar la reserva.'); }
    finally { setCarg(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  function cancelar() {
    const hacer = async (motivo?: string) => {
      setTrab(true);
      try { setR(await cancelarReserva(Number(id), motivo)); Alert.alert('Reserva cancelada'); }
      catch (e: unknown) { Alert.alert('No se pudo cancelar', e instanceof Error ? e.message : 'Inténtalo de nuevo.'); }
      finally { setTrab(false); }
    };
    if (Platform.OS === 'ios') {
      Alert.prompt('Cancelar reserva', 'Motivo (opcional):', [
        { text: 'Volver', style: 'cancel' },
        { text: 'Cancelar reserva', style: 'destructive', onPress: (m?: string) => hacer(m || undefined) },
      ], 'plain-text');
    } else {
      Alert.alert('Cancelar reserva', '¿Seguro que quieres cancelarla?', [
        { text: 'Volver', style: 'cancel' },
        { text: 'Cancelar reserva', style: 'destructive', onPress: () => hacer() },
      ]);
    }
  }

  const irChecklist = (tipo: 'salida' | 'entrega') =>
    router.push({ pathname: '/vehiculos/checklist', params: { reserva: String(id), vehiculo: String(r?.vehiculo.id ?? ''), tipo } });

  function tomarAlternativa(a: AlternativaVehiculo) {
    Alert.alert(`¿Tomar ${a.nombre}?`, `Tu reserva pasa a ${a.nombre}${a.placa ? ` (${a.placa})` : ''} en el mismo horario.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: `Tomar ${a.nombre}`, onPress: async () => {
          setTrab(true);
          try { setR(await cambiarVehiculo(Number(id), a.id)); Alert.alert('Listo', `Tu reserva ahora es con ${a.nombre}.`); }
          catch (e: unknown) { Alert.alert('No se pudo cambiar', e instanceof Error ? e.message : 'Inténtalo de nuevo.'); }
          finally { setTrab(false); }
        },
      },
    ]);
  }

  return (
    <View style={s.flex}>
      <Header title={r ? r.vehiculo.nombre : 'Reserva'} subtitle={r ? `${r.vehiculo.tipo_nombre}${r.vehiculo.placa ? ` · ${r.vehiculo.placa}` : ''}` : undefined} onBack={() => router.back()} />
      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : error || !r ? (
        <Text style={s.error}>{error ?? 'No encontramos esta reserva.'}</Text>
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          <View style={[ui.card, { gap: Spacing.sm }]}>
            <Pildora texto={r.estado === 'en_espera' && r.posicion_fila ? `En espera · lugar #${r.posicion_fila}` : r.estado_label || ESTADO_RESERVA_TEXTO[r.estado]} color={ESTADO_RESERVA_COLOR[r.estado] ?? Colors.dark[500]} />
            <Fila icono="calendar-outline" texto={r.todo_el_dia ? `${fechaLarga(r.inicio)} · todo el día` : `${fechaLarga(r.inicio)} · ${horaCorta(r.inicio)} a ${horaCorta(r.fin)}`} />
            {r.todo_el_dia || r.resguardo_casa ? <Fila icono="time-outline" texto={`Hasta ${diaCorto(r.fin)} ${horaCorta(r.fin)}`} /> : null}
            <Fila icono={r.resguardo_casa ? 'home-outline' : 'business-outline'} texto={r.resguardo_casa ? 'Se lo lleva a casa (resguardo nocturno)' : 'Regresa a la oficina'} />
            <Fila icono="chatbox-ellipses-outline" texto={r.motivo} />
            {r.destino ? <Fila icono="location-outline" texto={r.destino} /> : null}
            {r.km_recorridos !== null ? <Fila icono="speedometer-outline" texto={`${r.km_recorridos.toLocaleString('es-MX')} km recorridos`} /> : null}
          </View>

          {r.desplazada ? (
            <Aviso texto={`La administración le dio prioridad a otra visita${r.desplazada.motivo ? `: ${r.desplazada.motivo}` : '.'}${r.desplazada.por ? ` (${r.desplazada.por.nombre})` : ''}`}>
              {r.alternativas?.length ? <Text style={s.sub}>Hay otro vehículo libre en tu horario:</Text> : <Text style={s.sub}>Si se libera un vehículo, subes en la fila y te avisamos.</Text>}
            </Aviso>
          ) : r.estado === 'en_espera' ? (
            <Aviso tono="info" texto="Alguien pidió este horario antes que tú. Si se libera o la administración te da prioridad, te avisamos." />
          ) : null}
          {r.puede.cambiar_vehiculo && r.alternativas?.map(a => (
            <Boton key={a.id} texto={`Tomar ${a.nombre}${a.placa ? ` · ${a.placa}` : ''}`} icono="swap-horizontal" secundario onPress={() => tomarAlternativa(a)} cargando={trabajando} />
          ))}
          {r.estado === 'no_presento' ? <Aviso texto="No se inició la salida a tiempo y el vehículo se liberó para el siguiente en la fila." /> : null}
          {r.estado === 'resguardo' ? <Aviso tono="info" texto="El vehículo está guardado en tu casa. Toca «Retomar» antes de usarlo, o entrégalo si ya terminaste." /> : null}
          {r.alertas?.length ? (
            <View style={s.alertas}>
              {r.alertas.map(a => <Text key={a} style={s.alertaText}>• {a}</Text>)}
            </View>
          ) : null}
          {r.estado === 'solicitada' ? <Aviso tono="info" texto="Tu solicitud está esperando autorización. Te avisamos por notificación." /> : null}
          {r.motivo_decision ? <Aviso texto={`Nota de la administración: ${r.motivo_decision}`} /> : null}

          {r.puede.salida && <Boton texto="Iniciar salida" icono="play" onPress={() => irChecklist('salida')} />}
          {r.puede.retomar && <Boton texto="Retomar vehículo" icono="play" onPress={() => router.push({ pathname: '/vehiculos/casa', params: { reserva: String(r.id), modo: 'retomar' } })} />}
          {r.puede.carga && <Boton texto="Registrar carga de gasolina" icono="water-outline" secundario onPress={() => router.push({ pathname: '/vehiculos/carga', params: { reserva: String(r.id) } })} />}
          {r.puede.resguardo && <Boton texto="Guardar en casa" icono="home-outline" secundario onPress={() => router.push({ pathname: '/vehiculos/casa', params: { reserva: String(r.id), modo: 'guardar' } })} />}
          {r.puede.entrega && <Boton texto="Entregar vehículo" icono="flag" onPress={() => irChecklist('entrega')} />}
          {(r.estado === 'en_uso' || r.estado === 'autorizada' || r.estado === 'resguardo') && (
            <Boton texto="Llaves" icono="key-outline" secundario onPress={() => router.push({ pathname: '/vehiculos/llaves/[id]', params: { id: String(r.vehiculo.id) } })} />
          )}

          {r.salida ? <BloqueMovimiento titulo="Salida" m={r.salida} onFoto={setVerFoto} /> : null}
          {r.resguardo ? <BloqueMovimiento titulo="Guardado en casa" m={r.resguardo} onFoto={setVerFoto} /> : null}
          {r.cargas?.length ? <BloqueCargas cargas={r.cargas} onFoto={setVerFoto} /> : null}
          {r.entrega ? <BloqueMovimiento titulo="Entrega" m={r.entrega} onFoto={setVerFoto} /> : null}

          {r.puede.cancelar && <Boton texto="Cancelar reserva" peligro onPress={cancelar} cargando={trabajando} />}
        </ScrollView>
      )}

      <Modal visible={!!verFoto} transparent animationType="fade" onRequestClose={() => setVerFoto(null)}>
        <Pressable style={s.modal} onPress={() => setVerFoto(null)} accessibilityLabel="Cerrar foto">
          {verFoto ? <Image source={{ uri: verFoto }} style={s.modalImg} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function Fila({ icono, texto }: { icono: React.ComponentProps<typeof Ionicons>['name']; texto: string }) {
  return (
    <View style={s.fila}>
      <Ionicons name={icono} size={16} color={Colors.dark[500]} />
      <Text style={s.filaTexto}>{texto}</Text>
    </View>
  );
}

function BloqueMovimiento({ titulo, m, onFoto }: { titulo: string; m: Movimiento; onFoto: (u: string) => void }) {
  const llaves = m.llaves_modo === 'oficina' ? 'Llaves en la oficina (con foto)'
    : m.llaves_modo === 'codigo' ? `Llaves con código${m.llaves_de ? ` · de ${m.llaves_de.nombre}` : ''}`
    : m.llaves_modo === 'ya_las_tenia' ? 'Ya tenía las llaves' : null;
  return (
    <View style={[ui.card, { marginTop: Spacing.md, gap: Spacing.sm }]}>
      <Text style={s.bloqueTitulo}>{titulo} · {diaCorto(m.creado_at)} {horaCorta(m.creado_at)}</Text>
      <Fila icono="speedometer-outline" texto={`${m.km.toLocaleString('es-MX')} km · gasolina ${m.gasolina_label}`} />
      {llaves ? <Fila icono="key-outline" texto={llaves} /> : null}
      {m.checklist.length ? <Fila icono="checkbox-outline" texto={m.checklist.join(' · ')} /> : null}
      {m.notas_danos ? <Fila icono="warning-outline" texto={`Daños: ${m.notas_danos}`} /> : null}
      {m.fotos.length > 0 && (
        <View style={s.fotos}>
          {m.fotos.map(f => (
            <TouchableOpacity key={f.id} style={s.fotoBox} onPress={() => onFoto(f.url)} accessibilityLabel={`Ver foto: ${f.etiqueta}`}>
              <Image source={{ uri: f.thumb_url ?? f.url }} style={s.foto} />
              <Text style={s.fotoEtq} numberOfLines={1}>{f.etiqueta}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function BloqueCargas({ cargas, onFoto }: { cargas: Carga[]; onFoto: (u: string) => void }) {
  return (
    <View style={[ui.card, { marginTop: Spacing.md, gap: Spacing.sm }]}>
      <Text style={s.bloqueTitulo}>Cargas de gasolina</Text>
      {cargas.map(c => (
        <View key={c.id} style={{ gap: 4 }}>
          <Fila
            icono="water-outline"
            texto={`${diaCorto(c.creado_at)} ${horaCorta(c.creado_at)} · ${pesos(c.monto)} · ${c.litros} L · ${c.km.toLocaleString('es-MX')} km · ${c.pago_label}${c.reembolso ? ` (${c.reembolso === 'pagado' ? 'reembolso pagado' : 'reembolso pendiente'})` : ''}`}
          />
          {c.fotos.length > 0 && (
            <View style={s.fotos}>
              {c.fotos.map(f => (
                <TouchableOpacity key={f.id} style={s.fotoBox} onPress={() => onFoto(f.url)} accessibilityLabel={`Ver foto: ${f.etiqueta}`}>
                  <Image source={{ uri: f.thumb_url ?? f.url }} style={s.foto} />
                  <Text style={s.fotoEtq} numberOfLines={1}>{f.etiqueta}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  sub:          { fontSize: Typography.fontSize.xs, color: Colors.dark[600] },
  alertas:      { backgroundColor: Colors.cream[100], borderRadius: Radius.md, padding: Spacing.md, gap: 4, marginTop: Spacing.sm },
  alertaText:   { fontSize: Typography.fontSize.xs, color: Colors.dark[700], lineHeight: 18 },
  flex:         { flex: 1, backgroundColor: Colors.cream[50] },
  body:         { padding: Spacing.base, paddingBottom: Spacing['2xl'] * 2 },
  error:        { textAlign: 'center', color: Colors.dark[600], marginTop: Spacing['2xl'], paddingHorizontal: Spacing.xl, lineHeight: 20 },
  fila:         { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  filaTexto:    { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[800], lineHeight: 20 },
  link:         { color: Colors.gold[700], fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.sm },
  bloqueTitulo: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], textTransform: 'capitalize' },
  fotos:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  fotoBox:      { width: '31%' },
  foto:         { width: '100%', aspectRatio: 1, borderRadius: Radius.md, backgroundColor: Colors.cream[100] },
  fotoEtq:      { fontSize: 10, color: Colors.dark[600], marginTop: 2 },
  modal:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  modalImg:     { width: '100%', height: '80%' },
});
