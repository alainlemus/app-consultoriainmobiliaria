/**
 * Foto del tablero + kilometraje. Al tomar la foto intenta leer el km con el
 * OCR del teléfono y lo propone; el asesor siempre puede corregirlo.
 * Se usa en salida, entrega, guardar en casa, retomar y carga de gasolina.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { leerKmTablero, tomarFoto } from '@/src/utils/camaraUbicacion';
import { kmNumero } from '@/src/utils/vehiculos';
import { Ayuda, CasillaFoto, ui } from './ui';
import type { FotoLocal } from '@/src/types/vehiculos';

export default function TableroKm({ foto, onFoto, km, onKm, kmActual, ayuda }: {
  foto?: FotoLocal;
  onFoto: (f: FotoLocal) => void;
  km: string;
  onKm: (km: string) => void;
  /** Último km registrado del vehículo: ayuda a elegir bien el número leído. */
  kmActual: number | null;
  ayuda?: string;
}) {
  const [leyendo, setLeyendo] = useState(false);
  const [leido, setLeido]     = useState<number | null>(null);

  async function tomar() {
    const f = await tomarFoto('vehiculo_tablero');
    if (!f) { if (!foto) Alert.alert('Sin foto', 'No se tomó la foto del tablero.'); return; }
    onFoto(f);

    // Solo proponemos si el campo está vacío o tiene lo que leímos antes.
    if (km && kmNumero(km) !== leido) return;
    setLeyendo(true);
    const propuesto = await leerKmTablero(f.uri, kmActual);
    setLeyendo(false);
    setLeido(propuesto);
    if (propuesto !== null) onKm(String(propuesto));
  }

  const esLeido = leido !== null && km !== '' && kmNumero(km) === leido;

  return (
    <>
      <Ayuda>{ayuda ?? 'Que se vean el kilometraje y la aguja de la gasolina.'}</Ayuda>
      <View style={[ui.fotos, { marginTop: Spacing.sm }]}>
        <CasillaFoto etiqueta="Tablero" foto={foto} onTomar={tomar} />
      </View>
      <Text style={ui.label}>Kilometraje</Text>
      <TextInput
        style={s.input}
        value={km}
        onChangeText={t => onKm(t.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        placeholder={kmActual ? `Último registro: ${kmActual.toLocaleString('es-MX')}` : 'Ej. 12430'}
        placeholderTextColor={Colors.dark[400]}
        accessibilityLabel="Kilometraje"
      />
      {leyendo ? (
        <View style={s.leyendo}><ActivityIndicator size="small" color={Colors.gold[500]} /><Text style={s.leidoText}>Leyendo el km de la foto…</Text></View>
      ) : esLeido ? (
        <Text style={s.leidoText}>Leído de la foto · corrígelo si no coincide</Text>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  input:     { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300], borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.fontSize.lg, color: Colors.dark[900] },
  leyendo:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  leidoText: { fontSize: Typography.fontSize.xs, color: Colors.success, marginTop: Spacing.xs },
});
