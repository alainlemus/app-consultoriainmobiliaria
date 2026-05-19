import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, StatusBar, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../src/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Paso {
  icono: string;
  titulo: string;
  desc: string;
}

interface Seccion {
  id: string;
  icono: string;
  titulo: string;
  subtitulo: string;
  pasos: Paso[];
}

const SECCIONES: Seccion[] = [
  {
    id: 'inicio',
    icono: '🚀',
    titulo: 'Primeros pasos',
    subtitulo: 'Cómo empezar a usar la app',
    pasos: [
      { icono: '🔐', titulo: 'Inicia sesión', desc: 'Usa el correo y contraseña que te dio tu administrador. Si olvidaste tu contraseña, contacta al admin para restablecerla.' },
      { icono: '👤', titulo: 'Completa tu perfil', desc: 'Ve a la pestaña Perfil y llena tu información: teléfono, banco y CLABE interbancaria. Estos datos son necesarios para recibir comisiones.' },
      { icono: '📸', titulo: 'Sube tu foto', desc: 'En Perfil toca tu foto y selecciona "Tomar selfie". La cámara frontal se abrirá automáticamente.' },
    ],
  },
  {
    id: 'prospectos',
    icono: '🤝',
    titulo: 'Prospectos',
    subtitulo: 'Registra y da seguimiento a clientes',
    pasos: [
      { icono: '➕', titulo: 'Agregar prospecto', desc: 'En Inicio toca "+ Nuevo Prospecto". Llena nombre, teléfono, correo y el tipo de crédito (FOVISSSTE o INFONAVIT).' },
      { icono: '🧮', titulo: 'Simular precalificación', desc: 'Antes de registrar, usa el Simulador en el menú. Ingresa salario, edad y tipo de crédito para calcular si el cliente califica.' },
      { icono: '🔄', titulo: 'Actualizar estado', desc: 'Avanza el estado del prospecto: Nuevo → Contactado → Calificado → Convertido. Mantén el seguimiento actualizado.' },
      { icono: '📁', titulo: 'Abrir expediente', desc: 'Cuando el prospecto esté listo, toca "Abrir Expediente" en su tarjeta. Quedará convertido en expediente activo.' },
    ],
  },
  {
    id: 'expedientes',
    icono: '📁',
    titulo: 'Expedientes',
    subtitulo: 'Gestión de trámites de crédito',
    pasos: [
      { icono: '📋', titulo: 'Ver mis expedientes', desc: 'En la pestaña Expedientes verás solo los asignados a ti. Filtra por estado o busca por nombre del cliente.' },
      { icono: '📄', titulo: 'Subir documentos', desc: 'Entra al expediente → Documentos → selecciona el tipo (INE, CURP, comprobante, etc.) y toma la foto o elige de galería.' },
      { icono: '👁️', titulo: 'Ver documentos', desc: 'Toca cualquier documento para abrirlo en tu navegador. Los PDFs se muestran en línea sin necesidad de descargarlos.' },
      { icono: '🔄', titulo: 'Estado del trámite', desc: 'El admin actualiza el estado: En proceso → Documentación → Autorizado → Escrituración → Cerrado. Al cerrarse, verás tu comisión.' },
    ],
  },
  {
    id: 'mapa',
    icono: '🗺️',
    titulo: 'Mapa de Visitas',
    subtitulo: 'Documenta tu actividad en campo',
    pasos: [
      { icono: '📍', titulo: 'Registrar visita', desc: 'En la pestaña Mapa toca "+ Registrar Visita". La app detecta tu ubicación automáticamente. Agrega nota y fotos.' },
      { icono: '🏠', titulo: 'Tipo de visita', desc: 'Selecciona "Cliente" (visita a prospecto) o "Propiedad" (visita a un inmueble en evaluación).' },
      { icono: '📌', titulo: 'Vincular prospecto', desc: 'Puedes asociar la visita a un prospecto existente para que el admin vea el historial del cliente.' },
      { icono: '📶', titulo: 'Funciona offline', desc: 'Las fotos y visitas se guardan aunque no tengas señal. Se sincronizan automáticamente cuando recuperes internet.' },
    ],
  },
  {
    id: 'comisiones',
    icono: '💰',
    titulo: 'Comisiones',
    subtitulo: 'Consulta tus ingresos',
    pasos: [
      { icono: '💵', titulo: '¿Cuándo aparece?', desc: 'Las comisiones aparecen cuando el admin las registra al cerrar un expediente. Verás monto, fecha y expediente asociado.' },
      { icono: '🔄', titulo: 'Estados', desc: 'Pendiente → generada. Aprobada → lista para pago. Pagada → ya depositada. Las rechazadas no aparecen en tu app.' },
      { icono: '🏦', titulo: 'Recibir el pago', desc: 'El pago se hace vía transferencia a la CLABE de tu perfil. Verifica que esté correcta antes de tu primer expediente cerrado.' },
      { icono: '📊', titulo: 'Resumen mensual', desc: 'Al inicio de Comisiones verás: total pendiente, total pagado y número de expedientes cerrados en el mes.' },
    ],
  },
  {
    id: 'perfil',
    icono: '👤',
    titulo: 'Mi Perfil',
    subtitulo: 'Gestiona tu información personal',
    pasos: [
      { icono: '✏️', titulo: 'Editar datos', desc: 'Toca cualquier campo en Perfil para editarlo: nombre, teléfono, banco y CLABE.' },
      { icono: '📸', titulo: 'Foto de perfil', desc: 'Toca tu foto → "Tomar selfie". La cámara frontal se activa para actualizar tu foto.' },
      { icono: '🚪', titulo: 'Cerrar sesión', desc: 'Al final de la pantalla Perfil encontrarás el botón "Cerrar sesión".' },
    ],
  },
];

export default function AyudaScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAbiertos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark[900]} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Centro de Ayuda</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerEmoji}>❓</Text>
          <View style={styles.bannerTexto}>
            <Text style={styles.bannerTitulo}>Guía de uso</Text>
            <Text style={styles.bannerSub}>Toca cada sección para ver los pasos detallados.</Text>
          </View>
        </View>

        {/* Secciones */}
        {SECCIONES.map(s => (
          <View key={s.id} style={styles.seccion}>
            <TouchableOpacity
              style={styles.seccionHeader}
              onPress={() => toggle(s.id)}
              activeOpacity={0.7}
            >
              <View style={styles.seccionLeft}>
                <Text style={styles.seccionEmoji}>{s.icono}</Text>
                <View>
                  <Text style={styles.seccionTitulo}>{s.titulo}</Text>
                  <Text style={styles.seccionSub}>{s.subtitulo}</Text>
                </View>
              </View>
              <Text style={[styles.chevron, abiertos[s.id] && styles.chevronAbierto]}>›</Text>
            </TouchableOpacity>

            {abiertos[s.id] && (
              <View style={styles.pasos}>
                {s.pasos.map((p, i) => (
                  <View key={i} style={styles.paso}>
                    <View style={styles.pasoBadge}>
                      <Text style={styles.pasoEmoji}>{p.icono}</Text>
                    </View>
                    <View style={styles.pasoTexto}>
                      <View style={styles.pasoTituloRow}>
                        <View style={styles.pasoNumPill}>
                          <Text style={styles.pasoNum}>{i + 1}</Text>
                        </View>
                        <Text style={styles.pasoTitulo}>{p.titulo}</Text>
                      </View>
                      <Text style={styles.pasoDesc}>{p.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Necesitas más ayuda? Contacta a tu administrador.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark[900],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark[800],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: Colors.gold[400],
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.gold[400] + '15',
    borderWidth: 1,
    borderColor: Colors.gold[400] + '30',
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
  },
  bannerEmoji: { fontSize: 28 },
  bannerTexto: { flex: 1 },
  bannerTitulo: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.gold[300],
  },
  bannerSub: {
    fontSize: Typography.fontSize.sm,
    color: Colors.dark[400],
    marginTop: 2,
  },
  seccion: {
    backgroundColor: Colors.dark[800],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark[700],
    overflow: 'hidden',
  },
  seccionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
  },
  seccionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  seccionEmoji: { fontSize: 24 },
  seccionTitulo: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
  },
  seccionSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.dark[400],
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: Colors.dark[500],
    transform: [{ rotate: '0deg' }],
  },
  chevronAbierto: {
    transform: [{ rotate: '90deg' }],
    color: Colors.gold[400],
  },
  pasos: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark[700],
    padding: Spacing.base,
    gap: Spacing.base,
  },
  paso: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pasoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gold[400] + '20',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pasoEmoji: { fontSize: 18 },
  pasoTexto: { flex: 1 },
  pasoTituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  pasoNumPill: {
    backgroundColor: Colors.gold[400] + '20',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  pasoNum: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gold[400],
  },
  pasoTitulo: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
  },
  pasoDesc: {
    fontSize: Typography.fontSize.sm,
    color: Colors.dark[300],
    lineHeight: Typography.fontSize.sm * 1.6,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.base,
  },
  footerText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.dark[500],
    textAlign: 'center',
  },
});
