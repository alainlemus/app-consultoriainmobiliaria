/**
 * Seguimiento fijo del trámite (7 pasos). Lo ven igual el acreditado y el
 * asesor: el paso actual resaltado, los anteriores completos y el mensaje
 * del paso (editable en el panel).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';
import type { Seguimiento } from '../types';

export default function SeguimientoTramite({ seguimiento, dark = false, mostrarMensaje = true }: { seguimiento: Seguimiento; dark?: boolean; mostrarMensaje?: boolean }) {
  const actual = seguimiento.orden;
  const texto  = dark ? Colors.cream[50] : Colors.dark[900];
  const tenue  = dark ? Colors.dark[400] : Colors.dark[500];

  return (
    <View style={[styles.card, dark ? styles.cardDark : styles.cardLight]}>
      <View style={styles.encabezado}>
        <Text style={[styles.label, { color: Colors.gold[400] }]}>SEGUIMIENTO · PASO {actual} DE {seguimiento.total}</Text>
        <Text style={[styles.actual, { color: texto }]}>{seguimiento.nombre}</Text>
      </View>

      <View style={styles.pasos}>
        {seguimiento.pasos.map((p, i) => {
          const hecho = p.orden < actual;
          const esActual = p.orden === actual;
          return (
            <View key={p.paso} style={styles.pasoFila}>
              <View style={styles.pasoIzq}>
                <View style={[styles.punto, hecho && styles.puntoHecho, esActual && styles.puntoActual, !hecho && !esActual && (dark ? styles.puntoPendienteDark : styles.puntoPendiente)]}>
                  {hecho
                    ? <Ionicons name="checkmark" size={12} color={Colors.dark[900]} />
                    : <Text style={[styles.puntoNum, esActual ? { color: Colors.dark[900] } : { color: tenue }]}>{p.orden}</Text>}
                </View>
                {i < seguimiento.pasos.length - 1 && <View style={[styles.linea, hecho ? styles.lineaHecha : (dark ? styles.lineaDark : styles.lineaLight)]} />}
              </View>
              <Text style={[styles.pasoTexto, { color: esActual ? texto : tenue }, esActual && styles.pasoTextoActual]} numberOfLines={2}>{p.nombre}</Text>
            </View>
          );
        })}
      </View>

      {mostrarMensaje && !!seguimiento.mensaje && (
        <View style={[styles.mensaje, dark ? styles.mensajeDark : styles.mensajeLight]}>
          <Ionicons name="information-circle" size={18} color={Colors.gold[400]} />
          <Text style={[styles.mensajeTexto, { color: dark ? Colors.cream[200] : Colors.dark[700] }]}>{seguimiento.mensaje}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card:        { borderRadius: Radius.lg, padding: Spacing.lg },
  cardDark:    { backgroundColor: Colors.dark[800] },
  cardLight:   { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[200] },
  encabezado:  { marginBottom: Spacing.md },
  label:       { fontSize: Typography.fontSize.xs, letterSpacing: 1.2, fontWeight: Typography.fontWeight.bold },
  actual:      { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, marginTop: 2 },
  pasos:       { gap: 0 },
  pasoFila:    { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, minHeight: 34 },
  pasoIzq:     { alignItems: 'center', width: 22 },
  punto:       { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  puntoHecho:  { backgroundColor: Colors.gold[400] },
  puntoActual: { backgroundColor: Colors.gold[400], transform: [{ scale: 1.15 }] },
  puntoPendiente:     { backgroundColor: Colors.cream[200] },
  puntoPendienteDark: { backgroundColor: Colors.dark[700] },
  puntoNum:    { fontSize: 11, fontWeight: Typography.fontWeight.bold },
  linea:       { width: 2, flex: 1, minHeight: 12, marginVertical: 2 },
  lineaHecha:  { backgroundColor: Colors.gold[400] },
  lineaLight:  { backgroundColor: Colors.cream[200] },
  lineaDark:   { backgroundColor: Colors.dark[700] },
  pasoTexto:   { flex: 1, fontSize: Typography.fontSize.sm, paddingTop: 2 },
  pasoTextoActual: { fontWeight: Typography.fontWeight.bold },
  mensaje:     { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
  mensajeDark:  { backgroundColor: Colors.dark[700] },
  mensajeLight: { backgroundColor: Colors.cream[50] },
  mensajeTexto: { flex: 1, fontSize: Typography.fontSize.sm, lineHeight: 20 },
});
