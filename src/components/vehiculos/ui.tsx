/** Piezas compartidas de las pantallas de vehículos. */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { GASOLINA } from '../../utils/vehiculos';
import type { FotoLocal, NivelGasolina } from '../../types/vehiculos';

export function Chip({ texto, activo, onPress, disabled }: { texto: string; activo: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[ui.chip, activo && ui.chipOn, disabled && ui.chipOff]} onPress={onPress} disabled={disabled} accessibilityState={{ selected: activo, disabled }}>
      <Text style={[ui.chipText, activo && ui.chipTextOn, disabled && ui.chipTextOff]}>{texto}</Text>
    </TouchableOpacity>
  );
}

export function Etiqueta({ children }: { children: React.ReactNode }) {
  return <Text style={ui.label}>{children}</Text>;
}

export function Ayuda({ children }: { children: React.ReactNode }) {
  return <Text style={ui.ayuda}>{children}</Text>;
}

export function Boton({ texto, onPress, cargando, secundario, peligro, disabled, icono }: {
  texto: string; onPress: () => void; cargando?: boolean; secundario?: boolean; peligro?: boolean; disabled?: boolean;
  icono?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const color = secundario || peligro ? (peligro ? Colors.error : Colors.dark[900]) : Colors.dark[900];
  return (
    <TouchableOpacity
      style={[ui.btn, secundario && ui.btnSec, peligro && ui.btnPeligro, (disabled || cargando) && { opacity: 0.6 }]}
      onPress={onPress} disabled={disabled || cargando} accessibilityRole="button"
    >
      {cargando ? <ActivityIndicator color={color} /> : (
        <View style={ui.btnRow}>
          {icono ? <Ionicons name={icono} size={18} color={color} /> : null}
          <Text style={[ui.btnText, { color }]}>{texto}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function SelectorGasolina({ valor, onChange }: { valor: NivelGasolina | null; onChange: (n: NivelGasolina) => void }) {
  return (
    <View style={ui.seg}>
      {GASOLINA.map(g => (
        <TouchableOpacity key={g.valor} style={[ui.segItem, valor === g.valor && ui.segOn]} onPress={() => onChange(g.valor)} accessibilityLabel={g.largo} accessibilityState={{ selected: valor === g.valor }}>
          <Text style={[ui.segText, valor === g.valor && ui.segTextOn]}>{g.corto}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Casilla de foto: vacía invita a tomarla; llena muestra la miniatura y permite repetirla. */
export function CasillaFoto({ etiqueta, foto, onTomar }: { etiqueta: string; foto?: FotoLocal; onTomar: () => void }) {
  return (
    <TouchableOpacity style={[ui.foto, foto && ui.fotoLista]} onPress={onTomar} accessibilityLabel={foto ? `Repetir foto: ${etiqueta}` : `Tomar foto: ${etiqueta}`}>
      {foto ? <Image source={{ uri: foto.uri }} style={ui.fotoImg} /> : <Ionicons name="camera-outline" size={26} color={Colors.dark[400]} />}
      <Text style={[ui.fotoText, foto && { color: Colors.white, backgroundColor: 'rgba(0,0,0,0.6)' }]} numberOfLines={1}>{foto ? `${etiqueta} ✓` : etiqueta}</Text>
    </TouchableOpacity>
  );
}

export function Pildora({ texto, color }: { texto: string; color: string }) {
  return (
    <View style={[ui.pill, { backgroundColor: color }]}>
      <Text style={ui.pillText}>{texto}</Text>
    </View>
  );
}

export function Aviso({ texto, tono = 'aviso', children }: { texto: string; tono?: 'aviso' | 'info'; children?: React.ReactNode }) {
  return (
    <View style={[ui.aviso, tono === 'info' && ui.avisoInfo]}>
      <Ionicons name={tono === 'info' ? 'information-circle' : 'alert-circle'} size={18} color={tono === 'info' ? Colors.dark[700] : Colors.gold[700]} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={ui.avisoText}>{texto}</Text>
        {children}
      </View>
    </View>
  );
}

export const ui = StyleSheet.create({
  chip:        { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300] },
  chipOn:      { backgroundColor: Colors.dark[900], borderColor: Colors.dark[900] },
  chipOff:     { backgroundColor: Colors.cream[100], borderColor: Colors.cream[200] },
  chipText:    { fontSize: Typography.fontSize.sm, color: Colors.dark[700] },
  chipTextOn:  { color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold },
  chipTextOff: { color: Colors.dark[400] },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  label:       { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], marginTop: Spacing.lg, marginBottom: Spacing.sm },
  ayuda:       { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: Spacing.xs, lineHeight: 18 },
  btn:         { backgroundColor: Colors.gold[400], borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.md },
  btnSec:      { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[300] },
  btnPeligro:  { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.error },
  btnRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:     { fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.base },
  seg:         { flexDirection: 'row', gap: 4 },
  segItem:     { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.white, alignItems: 'center' },
  segOn:       { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  segText:     { fontSize: Typography.fontSize.sm, color: Colors.dark[600] },
  segTextOn:   { color: Colors.dark[900], fontWeight: Typography.fontWeight.bold },
  fotos:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  foto:        { width: '47%', aspectRatio: 1, borderRadius: Radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.cream[300], backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
  fotoLista:   { borderStyle: 'solid', borderColor: Colors.success },
  fotoImg:     { ...StyleSheet.absoluteFillObject },
  fotoText:    { fontSize: Typography.fontSize.xs, color: Colors.dark[600], fontWeight: Typography.fontWeight.semibold, backgroundColor: 'rgba(0,0,0,0)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  pill:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillText:    { color: Colors.white, fontSize: 10, fontWeight: Typography.fontWeight.bold },
  aviso:       { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.gold[50], borderWidth: 1, borderColor: Colors.gold[200], borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
  avisoInfo:   { backgroundColor: Colors.white, borderColor: Colors.cream[300] },
  avisoText:   { fontSize: Typography.fontSize.sm, color: Colors.dark[800], lineHeight: 20 },
  card:        { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300], padding: Spacing.md, gap: 6 },
});
