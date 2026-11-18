/**
 * Vehículos de la empresa (motos, coches…): su estado, dónde están las llaves
 * y las reservas del asesor. Desde aquí se solicita uno.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getVehiculos, getReservas } from '@/src/services/vehiculosApi';
import { diaCorto, horaCorta } from '@/src/utils/citas';
import { agruparPorTipo, ESTADO_RESERVA_COLOR, ESTADO_VEHICULO, gasolinaTexto, llavesTexto, reservaActiva } from '@/src/utils/vehiculos';
import { Aviso, Pildora, ui } from '@/src/components/vehiculos/ui';
import type { Reserva, Vehiculo } from '@/src/types/vehiculos';

export default function VehiculosScreen() {
  const router = useRouter();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [reservas, setReservas]   = useState<Reserva[]>([]);
  const [cargando, setCarg]       = useState(true);
  const [refrescando, setRef]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [verHistorial, setHist]   = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [v, r] = await Promise.all([getVehiculos(), getReservas()]);
      setVehiculos(v.data); setReservas(r); setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los vehículos.');
    } finally { setCarg(false); setRef(false); }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const activas   = reservas.filter(reservaActiva);
  const historial = reservas.filter(r => !reservaActiva(r));
  const grupos    = agruparPorTipo(vehiculos);

  return (
    <View style={s.flex}>
      <Header
        title="Vehículos"
        subtitle="Préstamo para visitas"
        onBack={() => router.back()}
        rightElement={vehiculos.length ? (
          <TouchableOpacity onPress={() => router.push('/vehiculos/nueva')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Solicitar vehículo">
            <Ionicons name="add-circle" size={26} color={Colors.gold[400]} />
          </TouchableOpacity>
        ) : undefined}
      />

      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRef(true); cargar(); }} tintColor={Colors.gold[400]} />}
        >
          {error ? <Text style={s.vacio}>{error}</Text> : null}

          {/* ── Mis reservas ── */}
          <Text style={s.seccion}>Mis reservas</Text>
          {activas.length === 0 ? (
            <Text style={s.ayuda}>No tienes reservas activas.</Text>
          ) : activas.map(r => <TarjetaReserva key={r.id} r={r} onPress={() => router.push({ pathname: '/vehiculos/reserva/[id]', params: { id: String(r.id) } })} />)}

          {historial.length > 0 && (
            <TouchableOpacity onPress={() => setHist(h => !h)} style={s.historialBtn}>
              <Text style={s.link}>{verHistorial ? 'Ocultar historial' : `Ver historial (${historial.length})`}</Text>
            </TouchableOpacity>
          )}
          {verHistorial && historial.map(r => <TarjetaReserva key={r.id} r={r} onPress={() => router.push({ pathname: '/vehiculos/reserva/[id]', params: { id: String(r.id) } })} />)}

          <TouchableOpacity style={[ui.card, s.cardRow]} onPress={() => router.push('/vehiculos/reembolsos')} accessibilityLabel="Mis reembolsos de gasolina">
            <Ionicons name="receipt-outline" size={20} color={Colors.gold[700]} />
            <Text style={[s.nombre, { flex: 1 }]}>Mis reembolsos de gasolina</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.dark[400]} />
          </TouchableOpacity>

          {/* ── Vehículos por tipo ── */}
          {grupos.length === 0 && !error ? (
            <View style={s.vacioBox}>
              <Ionicons name="car-outline" size={40} color={Colors.dark[400]} />
              <Text style={s.vacio}>Todavía no hay vehículos dados de alta. La administración los agrega desde el panel.</Text>
            </View>
          ) : grupos.map(g => (
            <View key={g.tipo.id}>
              <Text style={s.seccion}>{g.tipo.nombre} · {g.vehiculos.length}</Text>
              {g.vehiculos.map(v => (
                <TarjetaVehiculo
                  key={v.id} v={v}
                  onSolicitar={() => router.push({ pathname: '/vehiculos/nueva', params: { vehiculo_id: String(v.id) } })}
                  onLlaves={() => router.push({ pathname: '/vehiculos/llaves/[id]', params: { id: String(v.id) } })}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function TarjetaReserva({ r, onPress }: { r: Reserva; onPress: () => void }) {
  const horario = r.todo_el_dia ? 'Todo el día' : `${horaCorta(r.inicio)} a ${horaCorta(r.fin)}`;
  return (
    <TouchableOpacity style={[ui.card, s.cardRow]} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cuando}>
        <Text style={s.dia}>{diaCorto(r.inicio)}</Text>
        <Text style={s.hora} numberOfLines={1}>{r.todo_el_dia ? 'Día' : horaCorta(r.inicio)}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.nombre} numberOfLines={1}>{r.vehiculo.nombre}{r.vehiculo.placa ? ` · ${r.vehiculo.placa}` : ''}</Text>
        <Text style={s.sub} numberOfLines={1}>{horario} · {r.resguardo_casa ? 'se queda en casa' : 'regresa a oficina'}</Text>
        <Text style={s.sub} numberOfLines={1}>{r.motivo}</Text>
        {r.desplazada ? <Text style={[s.sub, { color: Colors.gold[700] }]} numberOfLines={1}>Se priorizó otra visita{r.alternativas?.length ? ' · hay otro vehículo libre' : ''}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Pildora texto={r.estado === 'en_espera' && r.posicion_fila ? `En espera #${r.posicion_fila}` : r.estado_label} color={ESTADO_RESERVA_COLOR[r.estado] ?? Colors.dark[500]} />
      </View>
    </TouchableOpacity>
  );
}

function TarjetaVehiculo({ v, onSolicitar, onLlaves }: { v: Vehiculo; onSolicitar: () => void; onLlaves: () => void }) {
  const est = ESTADO_VEHICULO[v.estado] ?? ESTADO_VEHICULO.disponible;
  return (
    <View style={[ui.card, { marginBottom: Spacing.sm }]}>
      <View style={s.vehHead}>
        <Text style={s.nombre} numberOfLines={1}>{v.nombre}{v.placa ? ` · ${v.placa}` : ''}</Text>
        <View style={s.estado}><View style={[s.punto, { backgroundColor: est.color }]} /><Text style={[s.estadoText, { color: est.color }]}>{est.texto}</Text></View>
      </View>
      {(v.marca || v.modelo) ? <Text style={s.sub}>{[v.marca, v.modelo, v.color].filter(Boolean).join(' · ')}</Text> : null}
      <Text style={s.sub}>{v.km_actual.toLocaleString('es-MX')} km · {gasolinaTexto(v.gasolina_actual)}</Text>
      {v.en_uso_por ? <Text style={s.sub}>Lo usa {v.en_uso_por.nombre}{v.regreso_previsto ? ` · regresa ${diaCorto(v.regreso_previsto)} ${horaCorta(v.regreso_previsto)}` : ''}</Text> : null}
      <Text style={[s.sub, v.llaves.soy_yo && { color: Colors.gold[700], fontWeight: Typography.fontWeight.semibold }]}>
        <Ionicons name="key-outline" size={12} /> Llaves: {llavesTexto(v)}
      </Text>
      <View style={s.acciones}>
        {v.estado !== 'taller' && (
          <TouchableOpacity style={s.accionPri} onPress={onSolicitar}><Text style={s.accionPriText}>Solicitar</Text></TouchableOpacity>
        )}
        <TouchableOpacity style={s.accionSec} onPress={onLlaves}><Text style={s.accionSecText}>{v.llaves.soy_yo ? 'Entregar llaves' : 'Llaves'}</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex:         { flex: 1, backgroundColor: Colors.cream[50] },
  body:         { padding: Spacing.base, paddingBottom: Spacing['2xl'] * 2, gap: Spacing.sm },
  seccion:      { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], marginTop: Spacing.lg, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  ayuda:        { fontSize: Typography.fontSize.sm, color: Colors.dark[500] },
  link:         { color: Colors.gold[700], fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.sm },
  historialBtn: { paddingVertical: Spacing.xs },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cuando:       { width: 72, alignItems: 'center', paddingVertical: 4, borderRadius: Radius.sm, backgroundColor: Colors.cream[50] },
  dia:          { fontSize: Typography.fontSize.xs, color: Colors.dark[600], textTransform: 'capitalize' },
  hora:         { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  nombre:       { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900], flexShrink: 1 },
  sub:          { fontSize: Typography.fontSize.xs, color: Colors.dark[600] },
  vehHead:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  estado:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punto:        { width: 8, height: 8, borderRadius: 4 },
  estadoText:   { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },
  acciones:     { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  accionPri:    { flex: 1, backgroundColor: Colors.gold[400], borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  accionPriText:{ fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  accionSec:    { flex: 1, borderWidth: 1, borderColor: Colors.cream[300], borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center', backgroundColor: Colors.white },
  accionSecText:{ fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800] },
  vacioBox:     { alignItems: 'center', padding: Spacing['2xl'], gap: Spacing.sm },
  vacio:        { textAlign: 'center', color: Colors.dark[500], fontSize: Typography.fontSize.sm, lineHeight: 20 },
});
