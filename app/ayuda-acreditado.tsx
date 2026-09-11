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
    icono: '🏠',
    titulo: 'Mi Trámite',
    subtitulo: 'Consulta el estado de tu crédito',
    pasos: [
      { icono: '🙋', titulo: 'Sin trámite activo', desc: 'Si aún no tienes un trámite, elige el servicio que necesitas (FOVISSSTE, INFONAVIT, Avalúo, etc.) y toca "Solicitar asesoría". Un asesor se pondrá en contacto contigo.' },
      { icono: '📊', titulo: 'Progreso del trámite', desc: 'Una vez que tu trámite inicia, verás una barra con las etapas del proceso y en cuál vas actualmente.' },
      { icono: 'ℹ️', titulo: '¿Qué está pasando?', desc: 'Esta tarjeta te explica, en palabras simples, qué significa la etapa actual de tu trámite.' },
      { icono: '📞', titulo: 'Tu asesor', desc: 'Al final de la pantalla verás los datos de tu asesor asignado — puedes llamarle, escribirle por WhatsApp o enviarle un correo directamente desde ahí.' },
      { icono: '📅', titulo: 'Fechas importantes', desc: 'Cuando estén definidas, verás la fecha de firma ante notario y la fecha esperada de pago.' },
    ],
  },
  {
    id: 'documentos',
    icono: '📄',
    titulo: 'Documentos',
    subtitulo: 'Sube los documentos que te piden',
    pasos: [
      { icono: '📋', titulo: 'Ver tu checklist', desc: 'En la pestaña Documentos verás la lista de documentos requeridos y su estado: Pendiente, Recibido o Rechazado.' },
      { icono: '📤', titulo: 'Subir un documento', desc: 'Toca "Subir documento" y elige cómo obtenerlo: escanear (convierte varias fotos en un PDF automáticamente), tomar foto, o seleccionar un archivo PDF ya guardado.' },
      { icono: '🔁', titulo: 'Documento rechazado', desc: 'Si un documento aparece como "Rechazado", vuelve a subirlo — tu asesor te indicará qué corregir.' },
      { icono: '👁️', titulo: 'Ver un documento subido', desc: 'Toca cualquier documento de la lista para abrirlo y revisar que se vea bien.' },
    ],
  },
  {
    id: 'seguimiento',
    icono: '⏱️',
    titulo: 'Seguimiento',
    subtitulo: 'Historial de tu trámite',
    pasos: [
      { icono: '🕓', titulo: 'Línea de tiempo', desc: 'En la pestaña Seguimiento verás, en orden, cada cambio de etapa, llamada, nota o documento que tu asesor registra sobre tu trámite.' },
      { icono: '📭', titulo: 'Sin actividad', desc: 'Si aún no hay movimientos verás el mensaje "Sin actividad registrada aún" — es normal al inicio del proceso.' },
    ],
  },
  {
    id: 'cuenta',
    icono: '👤',
    titulo: 'Mi Cuenta',
    subtitulo: 'Gestiona tu información personal',
    pasos: [
      { icono: '✏️', titulo: 'Editar tus datos', desc: 'En Mi Cuenta toca "Editar" para actualizar tu nombre, teléfono, CURP o NSS. Toca "Guardar" cuando termines.' },
      { icono: '📸', titulo: 'Foto de perfil', desc: 'Toca tu foto y elige "Tomar foto" o "Elegir de galería" para actualizarla.' },
      { icono: '🔑', titulo: 'Cambiar contraseña', desc: 'Abre la sección "Contraseña" e ingresa tu contraseña actual y la nueva dos veces.' },
      { icono: '🔒', titulo: 'Face ID / huella', desc: 'Si activaste el acceso rápido con Face ID o huella, puedes eliminar esas credenciales en cualquier momento desde "Eliminar credenciales".' },
      { icono: '🗑️', titulo: 'Cancelar mi cuenta', desc: 'Al final de Mi Cuenta puedes solicitar la cancelación y eliminación de tus datos, según nuestra política de privacidad.' },
    ],
  },
  {
    id: 'offline',
    icono: '📶',
    titulo: 'Modo sin internet',
    subtitulo: 'Puedes seguir usando la app sin señal',
    pasos: [
      { icono: '📱', titulo: 'Consultar tu trámite', desc: 'Aunque no tengas señal, puedes ver el estado de tu trámite, tus documentos y tu seguimiento con la última información descargada.' },
      { icono: '📄', titulo: 'Subir documentos sin señal', desc: 'Puedes escanear o seleccionar documentos aunque no tengas internet — se guardan en tu dispositivo y se suben solos en cuanto recuperes la conexión.' },
      { icono: '📸', titulo: 'Foto de perfil protegida', desc: 'Si actualizas tu foto de perfil con señal débil, no se pierde: se sube sola en cuanto haya mejor conexión.' },
    ],
  },
];

export default function AyudaAcreditadoScreen() {
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
          <Text style={styles.footerText}>¿Necesitas más ayuda? Contacta a tu asesor.</Text>
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
