/** ¿Cómo funciona? — instrucciones para el gestor (se abre sola la primera vez y desde el "?"). */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const PASOS: { icon: IoniconsName; titulo: string; texto: string }[] = [
  { icon: 'notifications-outline', titulo: 'Te llega un expediente', texto: 'Te avisamos con una notificación. Ábrelo y lee el encargo: qué tramitar, dónde y para cuándo.' },
  { icon: 'list-outline',          titulo: 'Revisa cada documento', texto: 'Ábrelos y marca ✓ si está bien o ✗ si está mal. Si está mal, escribe por qué (por ejemplo: “INE vencida”).' },
  { icon: 'send-outline',          titulo: 'Envía tu revisión',     texto: 'Si marcaste alguno mal, la administración lo cambia y te lo regresa. Solo revisas lo que cambió.' },
  { icon: 'checkmark-circle-outline', titulo: 'Todo correcto: empieza el trámite', texto: 'Cuando todos estén bien, toca “Empezar trámite”. Hasta entonces no puedes subir documentos.' },
  { icon: 'cloud-upload-outline',  titulo: 'Sube lo que obtengas',  texto: 'Escanéalo, tómale foto o sube el PDF o Word. Si te lo rechazan, verás el motivo y lo vuelves a subir.' },
  { icon: 'checkmark-done-outline', titulo: 'Avisa que terminaste',  texto: 'Cuando subas todo, toca “Ya terminé”. La administración valida y el encargo se cierra. Si olvidaste algo, puedes reabrirlo mientras tanto.' },
];

export default function AyudaGestorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={s.flex}>
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={24} color={Colors.cream[50]} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>¿Cómo funciona?</Text>
        </View>
        <Text style={s.headerSub}>Tu trabajo como gestor, en 6 pasos.</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {PASOS.map((p, i) => (
          <View key={p.titulo} style={s.paso}>
            <View style={s.pasoIcono}><Ionicons name={p.icon} size={18} color={Colors.gold[400]} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.pasoTitulo}>{i + 1}. {p.titulo}</Text>
              <Text style={s.pasoTexto}>{p.texto}</Text>
            </View>
          </View>
        ))}
        <View style={s.nota}>
          <Ionicons name="cloud-offline-outline" size={18} color={Colors.dark[600]} />
          <Text style={s.notaText}>Sin señal: lo que subas se guarda y se envía solo cuando regrese. Para abrir documentos y enviar tu revisión sí necesitas señal (tus marcas no se pierden).</Text>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + Spacing.base }]}>
        <TouchableOpacity style={s.btn} onPress={() => router.back()}>
          <Text style={s.btnText}>ENTENDIDO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: Colors.cream[50] },
  header:      { backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.base, paddingBottom: Spacing.base, gap: 4 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.black, color: Colors.cream[50] },
  headerSub:   { fontSize: Typography.fontSize.sm, color: Colors.dark[400], marginLeft: 24 + Spacing.md },
  content:     { padding: Spacing.base, gap: Spacing.base },
  paso:        { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  pasoIcono:   { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark[900], alignItems: 'center', justifyContent: 'center' },
  pasoTitulo:  { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  pasoTexto:   { fontSize: Typography.fontSize.sm, color: Colors.dark[600], lineHeight: Typography.fontSize.sm * 1.45, marginTop: 2 },
  nota:        { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.cream[100], borderRadius: Radius.sm, padding: Spacing.md },
  notaText:    { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[600], lineHeight: Typography.fontSize.sm * 1.4 },
  footer:      { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.cream[300] },
  btn:         { backgroundColor: Colors.gold[400], borderRadius: Radius.sm, paddingVertical: Spacing.base, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  btnText:     { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.extrabold, letterSpacing: 1, color: Colors.dark[900] },
});
