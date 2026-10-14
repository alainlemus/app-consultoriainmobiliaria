/**
 * Aviso al registrar un contrato: explica que los datos se pueden subir con
 * foto de la INE o capturarse a mano, que no se debe fotografiar una copia, y
 * cómo encuadrar la credencial (con un ejemplo dibujado).
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const PUNTOS: { icono: IconName; texto: string }[] = [
  { icono: 'camera',        texto: 'Con foto: la app lee el nombre, CURP y domicilio de la INE. Después podrás revisar y corregir los datos.' },
  { icono: 'create',        texto: 'A mano: si prefieres, o si la foto no sale bien, toca "Capturar datos manualmente".' },
  { icono: 'copy',          texto: 'Usa la credencial original. No tomes foto a una fotocopia: sale gris y borrosa y la app no podrá leerla.' },
];

const CONSEJOS = [
  'Pon la INE sobre una mesa lisa y con buena luz.',
  'Centra la credencial dentro del cuadro de la cámara, completa y derecha.',
  'Acércate hasta que llene el cuadro, sin cortar las orillas.',
  'Evita reflejos y sombras sobre el nombre y el CURP.',
];

/** Credencial dibujada: foto, líneas de texto y chip. */
function MiniIne({ gris }: { gris?: boolean }) {
  const bg = gris ? '#D4D4D4' : '#F4EEDD';
  const linea = gris ? '#B5B5B5' : '#C9B98A';
  return (
    <View style={[s.ine, { backgroundColor: bg }]}>
      <View style={[s.ineFoto, { backgroundColor: linea }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={[s.ineLinea, { backgroundColor: linea, width: '90%' }]} />
        <View style={[s.ineLinea, { backgroundColor: linea, width: '70%' }]} />
        <View style={[s.ineLinea, { backgroundColor: linea, width: '80%' }]} />
      </View>
    </View>
  );
}

function Ejemplo({ ok, titulo, children }: { ok: boolean; titulo: string; children: React.ReactNode }) {
  return (
    <View style={s.ejemplo}>
      <View style={[s.marco, { borderColor: ok ? '#2E9E5B' : '#D64545' }]}>{children}</View>
      <View style={s.ejemploPie}>
        <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={16} color={ok ? '#2E9E5B' : '#D64545'} />
        <Text style={s.ejemploTxt}>{titulo}</Text>
      </View>
    </View>
  );
}

export default function AvisoCapturaIne({ visible, onCerrar }: { visible: boolean; onCerrar: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={s.fondo}>
        <View style={s.card}>
          <Text style={s.titulo}>Cómo capturar la INE</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={s.scroll}>
            <View style={s.lista}>
              {PUNTOS.map((p, i) => (
                <View key={i} style={s.fila}>
                  <View style={s.filaIcono}><Ionicons name={p.icono} size={20} color={Colors.gold[600]} /></View>
                  <Text style={s.texto}>{p.texto}</Text>
                </View>
              ))}
            </View>

            <Text style={s.subtitulo}>Así debe quedar la foto</Text>
            <View style={s.ejemplos}>
              <Ejemplo ok titulo="Original, centrada y completa">
                <MiniIne />
              </Ejemplo>
              <Ejemplo ok={false} titulo="Fotocopia o torcida">
                <View style={{ transform: [{ rotate: '-12deg' }, { scale: 0.7 }] }}><MiniIne gris /></View>
              </Ejemplo>
            </View>

            {CONSEJOS.map((c, i) => (
              <View key={i} style={s.consejo}>
                <Ionicons name="checkmark" size={16} color={Colors.gold[600]} />
                <Text style={s.consejoTxt}>{c}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable style={s.btn} onPress={onCerrar}>
            <Text style={s.btnTxt}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  card:  { width: '100%', maxHeight: '92%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.xl },
  titulo:{ fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black, color: Colors.dark[900], textAlign: 'center', marginBottom: Spacing.md },
  scroll: { flexGrow: 0, flexShrink: 1 },
  lista: { gap: Spacing.md, backgroundColor: Colors.cream[100], borderRadius: Radius.md, padding: Spacing.md },
  fila:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  filaIcono: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.gold[50], alignItems: 'center', justifyContent: 'center' },
  texto: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[800], lineHeight: 21, fontWeight: Typography.fontWeight.medium },
  subtitulo: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], marginTop: Spacing.lg, marginBottom: Spacing.sm },
  ejemplos: { flexDirection: 'row', gap: Spacing.sm },
  ejemplo: { flex: 1, alignItems: 'center', gap: 6 },
  marco: { width: '100%', height: 110, borderWidth: 2, borderStyle: 'dashed', borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark[900] + '0D', padding: 6 },
  ejemploPie: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  ejemploTxt: { flexShrink: 1, fontSize: Typography.fontSize.xs, color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold },
  ine: { width: '100%', aspectRatio: 1.58, borderRadius: 6, padding: 6, flexDirection: 'row', gap: 6, alignItems: 'center' },
  ineFoto: { width: '30%', height: '75%', borderRadius: 3 },
  ineLinea: { height: 5, borderRadius: 2 },
  consejo: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: Spacing.sm },
  consejoTxt: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[700], lineHeight: 20 },
  btn: { backgroundColor: Colors.dark[900], borderRadius: Radius.md, paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.lg },
  btnTxt: { color: Colors.gold[400], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
});
