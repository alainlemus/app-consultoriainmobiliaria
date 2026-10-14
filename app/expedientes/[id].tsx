/**
 * Detalle del expediente de un cliente: sus datos básicos y sus documentos
 * (escanear o subir, ver, eliminar). Sin etapas ni estados: eso se lleva en el panel.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../../src/theme';
import { enviarCarpetaExpediente, getExpediente } from '../../src/services/api';
import type { Documento } from '../../src/types';
import { useAuth } from '../../src/contexts/AuthContext';
import { getCacheExpediente } from '../../src/services/offline';
import DocumentosExpediente, { expedienteCompleto } from '../../src/components/DocumentosExpediente';
import type { Expediente } from '../../src/types';

export default function DetalleExpedienteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isSuperAdmin, user } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [docsListos, setDocsListos] = useState<boolean | null>(null);   // lo calcula la lista de documentos
  const [exp, setExp]         = useState<Expediente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getExpediente(Number(id))
      .then(setExp)
      .catch(async e => {
        // Sin conexión: se usa la copia guardada en el dispositivo
        const guardado = await getCacheExpediente(Number(id));
        if (guardado) setExp(guardado);
        else setError(e instanceof Error ? e.message : 'No se pudo cargar el expediente');
      })
      .finally(() => setCargando(false));
  }, [id]);

  const contacto = exp?.contacto;
  // La carpeta solo se envía con todos los documentos validados; al inicio se usa lo que dice el servidor
  const carpetaLista = docsListos ?? !!(exp as { completo?: boolean } | null)?.completo;

  // Solo administradores: la carpeta con todos los documentos llega a su correo (enlace de 72 h)
  const enviarCarpeta = () => {
    if (!exp) return;
    if (!carpetaLista) {
      Alert.alert('Aún no se puede enviar', 'Valida todos los documentos del expediente (y espera los que solicitaste) para poder enviar la carpeta a tu correo.');
      return;
    }
    Alert.alert(
      'Enviar carpeta a mi correo',
      `Te enviaremos${user?.email ? ` a ${user.email}` : ''} un enlace, válido 72 horas, para descargar en tu computadora la carpeta con todos los documentos de este expediente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            setEnviando(true);
            try {
              const r = await enviarCarpetaExpediente(exp.id);
              Alert.alert('Carpeta enviada', r.message);
            } catch (e) {
              Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
            } finally {
              setEnviando(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.dark[700]} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Expediente</Text>
        <View style={{ width: 40 }} />
      </View>

      {cargando ? (
        <ActivityIndicator style={styles.center} color={Colors.gold[400]} />
      ) : error || !exp ? (
        <Text style={styles.error}>{error ?? 'Expediente no encontrado'}</Text>
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          {/* Cliente */}
          <View style={styles.card}>
            <View style={styles.avatarFallback}>
              <Ionicons name="folder-open" size={28} color={Colors.gold[400]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre} numberOfLines={2}>{contacto?.nombre ?? `Expediente #${exp.id}`}</Text>
              <Text style={styles.sub}>{exp.folio ?? `#${exp.id}`}{exp.tipo_tramite?.nombre ? ` · ${exp.tipo_tramite.nombre}` : ''}</Text>
            </View>
          </View>
          {(contacto?.telefono || contacto?.email || contacto?.curp) ? (
            <View style={styles.datos}>
              {contacto?.telefono ? <View style={styles.datoRow}><Ionicons name="call-outline" size={20} color={Colors.dark[500]} /><Text style={styles.dato}>{contacto.telefono}</Text></View> : null}
              {contacto?.email    ? <View style={styles.datoRow}><Ionicons name="mail-outline" size={20} color={Colors.dark[500]} /><Text style={styles.dato}>{contacto.email}</Text></View> : null}
              {contacto?.curp     ? <View style={styles.datoRow}><Ionicons name="id-card-outline" size={20} color={Colors.dark[500]} /><Text style={styles.dato}>{contacto.curp}</Text></View> : null}
            </View>
          ) : null}

          {isSuperAdmin ? (
            <TouchableOpacity style={[styles.carpetaBtn, !carpetaLista && styles.carpetaBtnOff]} onPress={enviarCarpeta} disabled={enviando} activeOpacity={0.85}>
              {enviando
                ? <ActivityIndicator color={Colors.dark[900]} />
                : <Ionicons name="mail" size={22} color={Colors.dark[900]} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.carpetaTitulo}>Enviar carpeta a mi correo</Text>
                <Text style={styles.carpetaSub}>{carpetaLista ? 'ZIP con todos los documentos para tu computadora' : 'Disponible cuando valides todos los documentos'}</Text>
              </View>
              <Ionicons name="paper-plane" size={20} color={Colors.dark[900]} />
            </TouchableOpacity>
          ) : null}

          <Text style={styles.sectionLabel}>Documentos</Text>
          <DocumentosExpediente
            expedienteId={exp.id}
            acreditadoEnApp={!!(exp as { acreditado_en_app?: boolean }).acreditado_en_app}
            onDocs={docs => { if (docs.length > 0) setDocsListos(expedienteCompleto(docs)); }}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: Colors.cream[50] },
  center: { marginTop: Spacing.xl * 2 },
  error:  { textAlign: 'center', color: Colors.crimson[600], marginTop: Spacing.xl * 2, paddingHorizontal: Spacing.xl },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.cream[200],
  },
  backBtn:  { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.dark[700] },
  topTitle: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  body:     { padding: Spacing.base },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[200],
    padding: Spacing.md,
  },
  avatar:         { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.dark[900], alignItems: 'center', justifyContent: 'center' },
  nombre:  { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  sub:     { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2 },
  datos:   { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[200], padding: Spacing.md, marginTop: Spacing.xs, gap: 6 },
  carpetaBtnOff: { opacity: 0.45 },
  carpetaBtn:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.gold[400], borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
  carpetaTitulo: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  carpetaSub:    { fontSize: Typography.fontSize.xs, color: Colors.dark[800], marginTop: 1 },
  datoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dato:    { fontSize: Typography.fontSize.sm, color: Colors.dark[700] },
  sectionLabel: {
    fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[500],
    letterSpacing: 1, textTransform: 'uppercase', marginTop: Spacing.lg, marginBottom: Spacing.xs,
  },
});
