/**
 * Aviso antes de activar la Ruta: explica qué pasará con la ubicación del asesor.
 * Entra con un resorte, el icono late y cada punto aparece uno tras otro.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const PUNTOS: { icono: IconName; texto: string }[] = [
  { icono: 'navigate',      texto: 'Guardaremos tu recorrido con tu ubicación mientras trabajas, aunque la app esté en segundo plano.' },
  { icono: 'eye',           texto: 'Tu administrador podrá ver tu ruta del día en el mapa.' },
  { icono: 'battery-half',  texto: 'Puede gastar un poco más de batería.' },
  { icono: 'cloud-offline', texto: 'Sin internet los puntos se guardan y se envían solos al volver la señal.' },
  { icono: 'power',         texto: 'Puedes apagarla cuando quieras con el mismo interruptor.' },
];

export default function AvisoRuta({ visible, onActivar, onCancelar }: {
  visible: boolean; onActivar: () => void; onCancelar: () => void;
}) {
  const entrada = useRef(new Animated.Value(0)).current;
  const latido  = useRef(new Animated.Value(1)).current;
  const items   = useRef(PUNTOS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;
    entrada.setValue(0);
    items.forEach(v => v.setValue(0));
    Animated.spring(entrada, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    Animated.stagger(
      130,
      items.map(v => Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
    ).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(latido, { toValue: 1.15, duration: 700, useNativeDriver: true }),
      Animated.timing(latido, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, entrada, latido, items]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={s.fondo}>
        <Animated.View style={[s.card, { opacity: entrada, transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
          <Animated.View style={[s.icono, { transform: [{ scale: latido }] }]}>
            <Ionicons name="navigate" size={40} color={Colors.gold[400]} />
          </Animated.View>
          <Text style={s.titulo}>Activar tu ruta</Text>
          <Text style={s.intro}>Esto es lo que va a pasar:</Text>

          <View style={s.lista}>
            {PUNTOS.map((p, i) => (
              <Animated.View
                key={i}
                style={[s.fila, { opacity: items[i], transform: [{ translateX: items[i].interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}
              >
                <View style={s.filaIcono}><Ionicons name={p.icono} size={20} color={Colors.gold[600]} /></View>
                <Text style={s.texto}>{p.texto}</Text>
              </Animated.View>
            ))}
          </View>
          <Text style={s.permiso}>Tu teléfono te pedirá permiso para usar la ubicación: elige «Permitir siempre» para que la ruta no se corte.</Text>

          <Pressable style={s.btnActivar} onPress={onActivar}>
            <Ionicons name="play-circle" size={22} color={Colors.gold[400]} />
            <Text style={s.btnActivarText}>Activar ruta</Text>
          </Pressable>
          <Pressable style={s.btnCancelar} onPress={onCancelar}>
            <Text style={s.btnCancelarText}>Ahora no</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  card:  { width: '100%', maxHeight: '92%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.xl },
  icono: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.dark[900], alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  titulo:{ fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black, color: Colors.dark[900], textAlign: 'center' },
  intro: { fontSize: Typography.fontSize.base, color: Colors.dark[500], textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.md },
  lista: { gap: Spacing.md, backgroundColor: Colors.cream[100], borderRadius: Radius.md, padding: Spacing.md },
  fila:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  filaIcono: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.gold[50], alignItems: 'center', justifyContent: 'center' },
  texto: { flex: 1, fontSize: Typography.fontSize.base, color: Colors.dark[800], lineHeight: 23, fontWeight: Typography.fontWeight.medium },
  permiso: { fontSize: Typography.fontSize.sm, color: Colors.dark[500], textAlign: 'center', lineHeight: 20, marginTop: Spacing.md, marginBottom: Spacing.lg },
  btnActivar:     { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.dark[900], borderRadius: Radius.md, paddingVertical: Spacing.base, alignItems: 'center', justifyContent: 'center' },
  btnActivarText: { color: Colors.gold[400], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  btnCancelar:     { paddingVertical: Spacing.md, alignItems: 'center' },
  btnCancelarText: { color: Colors.dark[600], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
});
