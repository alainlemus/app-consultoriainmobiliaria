import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  TouchableOpacity, FlatList, StatusBar,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../src/theme';

const { width, height } = Dimensions.get('window');

export const ONBOARDING_KEY = 'onboarding_visto_v1';

interface Slide {
  id: string;
  emoji: string;
  titulo: string;
  descripcion: string;
  detalle: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    emoji: '👋',
    titulo: 'Bienvenido a\nConsultoría Inmobiliaria',
    descripcion: 'La plataforma que te ayuda a gestionar tus clientes, expedientes y comisiones desde tu celular.',
    detalle: 'Todo en un solo lugar, disponible 24/7.',
  },
  {
    id: '2',
    emoji: '🤝',
    titulo: 'Registra tus\nProspectos',
    descripcion: 'Agrega nuevos clientes interesados en créditos FOVISSSTE o INFONAVIT y haz seguimiento de cada uno.',
    detalle: 'Usa el simulador de precalificación para saber si califican antes de iniciar el trámite.',
  },
  {
    id: '3',
    emoji: '📁',
    titulo: 'Gestiona\nExpedientes',
    descripcion: 'Sube documentos directamente desde tu cámara. Consulta el estado de cada trámite en tiempo real.',
    detalle: 'INE, CURP, comprobantes de ingresos y más — todo organizado por cliente.',
  },
  {
    id: '4',
    emoji: '🗺️',
    titulo: 'Registra tus\nVisitas en Campo',
    descripcion: 'Documenta cada visita con ubicación y fotos. La app funciona offline — sincroniza cuando tengas señal.',
    detalle: 'Tu actividad queda registrada y el admin puede ver tu trabajo en el mapa.',
  },
  {
    id: '5',
    emoji: '💰',
    titulo: 'Consulta tus\nComisiones',
    descripcion: 'Ve el estado de cada comisión: pendiente, aprobada o pagada. Revisa tu resumen mensual de ingresos.',
    detalle: 'Asegúrate de tener tu CLABE correcta en tu perfil para recibir pagos sin problema.',
  },
  {
    id: '6',
    emoji: '🎉',
    titulo: '¡Todo listo!',
    descripcion: 'Ya conoces lo esencial. Empieza registrando tu primer prospecto o completando tu perfil.',
    detalle: 'Puedes volver a ver este tutorial desde la sección Perfil → Ayuda.',
  },
];

export default function OnboardingScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const flatRef  = useRef<FlatList>(null);
  const [indice, setIndice] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const esUltimo = indice === SLIDES.length - 1;

  const siguiente = () => {
    if (esUltimo) {
      terminar();
    } else {
      const next = indice + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setIndice(next);
    }
  };

  const terminar = async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
    router.replace('/(tabs)');
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width }]}>
      <View style={styles.emojiContainer}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>
      <Text style={styles.titulo}>{item.titulo}</Text>
      <Text style={styles.descripcion}>{item.descripcion}</Text>
      <View style={styles.detallePill}>
        <Text style={styles.detalle}>{item.detalle}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark[900]} />

      {/* Skip */}
      {!esUltimo && (
        <TouchableOpacity style={styles.skipBtn} onPress={terminar}>
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatRef as any}
        data={SLIDES}
        keyExtractor={i => i.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndice(idx);
        }}
        renderItem={renderSlide}
      />

      {/* Dots */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width: dotWidth, opacity }]}
            />
          );
        })}
      </View>

      {/* Botón siguiente / empezar */}
      <TouchableOpacity
        style={[styles.btnSiguiente, esUltimo && styles.btnEmpezar]}
        onPress={siguiente}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>
          {esUltimo ? 'Empezar ahora' : 'Siguiente →'}
        </Text>
      </TouchableOpacity>

      {/* Indicador de paso */}
      <Text style={styles.indicador}>
        {indice + 1} / {SLIDES.length}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark[900],
    alignItems: 'center',
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  skipText: {
    color: Colors.dark[400],
    fontSize: Typography.fontSize.sm,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.xl,
  },
  emojiContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark[800],
    borderWidth: 2,
    borderColor: Colors.gold[400] + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing["2xl"],
    shadowColor: Colors.gold[400],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  emoji: {
    fontSize: 52,
  },
  titulo: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: Spacing.base,
    lineHeight: Typography.fontSize['2xl'] * 1.3,
  },
  descripcion: {
    fontSize: Typography.fontSize.base,
    color: Colors.dark[300],
    textAlign: 'center',
    lineHeight: Typography.fontSize.base * 1.6,
    marginBottom: Spacing.lg,
  },
  detallePill: {
    backgroundColor: Colors.gold[400] + '15',
    borderWidth: 1,
    borderColor: Colors.gold[400] + '30',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  detalle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gold[300],
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold[400],
  },
  btnSiguiente: {
    backgroundColor: Colors.dark[800],
    borderWidth: 1,
    borderColor: Colors.dark[600],
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.base,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
    minWidth: 220,
    alignItems: 'center',
  },
  btnEmpezar: {
    backgroundColor: Colors.gold[400],
    borderColor: Colors.gold[400],
  },
  btnText: {
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
    color: '#ffffff',
  },
  indicador: {
    fontSize: Typography.fontSize.xs,
    color: Colors.dark[500],
    marginBottom: Spacing.base,
  },
});
