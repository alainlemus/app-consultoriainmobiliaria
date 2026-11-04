import { APP_VERSION } from '../../src/version';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, AppState,
  TouchableOpacity, RefreshControl, Linking, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getExpedienteAcreditado, logoutAcreditado } from '@/src/services/acreditadoApi';
import { useAcreditadoAuth } from '@/src/contexts/AcreditadoAuthContext';
import type { ExpedienteAcreditado } from '@/src/types';
import PrimerosPasos from '@/src/screens/primerosPasos/PrimerosPasos';
import {
  cargarProgreso, borrarProgreso, haySolicitudPendiente, NUMERO_PASO, NOMBRE_PASO, NOMBRE_CREDITO,
  type ProgresoPrimerosPasos,
} from '@/src/services/primerosPasos';

const ESTADO_COLOR: Record<string, string> = {
  en_revision: '#1d4ed8',
  en_proceso: '#1d4ed8',
  pausado:    '#b45309',
  aprobado:   '#15803d',
  firmado:    '#7e22ce',
  cerrado:    '#374151',
  cancelado:  '#dc2626',
};

const ESTADO_LABEL: Record<string, string> = {
  en_revision: 'En revisión',
  en_proceso: 'En proceso',
  pausado:    'Pausado',
  aprobado:   'Aprobado',
  firmado:    'Firmado',
  cerrado:    'Cerrado',
  cancelado:  'Cancelado',
};

export default function MiTramiteScreen() {
  const insets               = useSafeAreaInsets();
  const router               = useRouter();
  const { acreditado, clearAcreditado, refresh } = useAcreditadoAuth();
  const [expediente, setExpediente]   = useState<ExpedienteAcreditado | null>(null);
  const [loading,  setLoading]        = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  // Primeros pasos (acreditado sin expediente)
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [solicitudEnCola, setSolicitudEnCola]   = useState(false);
  const [progreso, setProgreso]                 = useState<ProgresoPrimerosPasos | null>(null);
  const [flujo, setFlujo]                       = useState<null | 'normal' | 'llamada'>(null);

  const cargarPrimerosPasos = useCallback(async () => {
    if (!acreditado) return;
    const [p, pendiente] = await Promise.all([cargarProgreso(acreditado.id), haySolicitudPendiente()]);
    setProgreso(p);
    setSolicitudEnCola(pendiente);
  }, [acreditado]);

  useEffect(() => { cargarPrimerosPasos(); }, [cargarPrimerosPasos]);

  const cargar = useCallback(async (forzar = false) => {
    try {
      // Optimización: si sabemos desde el perfil del usuario que no hay expediente,
      // evitamos la llamada extra y vamos directo a cargar los servicios disponibles.
      // Al jalar para recargar (forzar) siempre se consulta: el asesor pudo abrir el expediente después.
      const yaTenemosQueNoHayExpediente = !forzar && acreditado !== null && acreditado.tiene_expediente === false;

      const exp = yaTenemosQueNoHayExpediente ? null : await getExpedienteAcreditado();
      setExpediente(exp);
    } catch {
      // Sin señal: se queda lo que ya había en pantalla
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [acreditado]);

  useEffect(() => { cargar(); }, []);

  // Jalar hacia abajo: refresca el perfil (¿ya tiene expediente? ¿ya está registrado?) y el trámite.
  const recargar = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    await cargar(true);
  }, [refresh, cargar]);

  // Sin expediente: se revisa sola al volver a la app y cada 20 s, para que aparezca
  // en cuanto el asesor lo abre sin tener que jalar la pantalla.
  useEffect(() => {
    if (loading || expediente) return;
    const revisar = async () => {
      await refresh();
      await cargar(true);
    };
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') revisar(); });
    const t = setInterval(revisar, 20_000);
    return () => { sub.remove(); clearInterval(t); };
  }, [loading, expediente, refresh, cargar]);

  function terminarPrimerosPasos() {
    setFlujo(null);
    setSolicitudEnviada(true);
    if (acreditado) borrarProgreso(acreditado.id);
    setProgreso(null);
    refresh().then(() => cargarPrimerosPasos());
  }

  function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => {
          await logoutAcreditado();
          clearAcreditado();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  // ── Sin expediente ──────────────────────────────────────────────────────────
  if (!loading && !expediente) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Hola, {acreditado?.name?.split(' ')[0] ?? 'bienvenido'}</Text>
              <Text style={styles.headerSub}>Consultoría Inmobiliaria</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={16} color={Colors.dark[400]} />
              <Text style={styles.logoutText}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={recargar} tintColor={Colors.gold[400]} />}
          alwaysBounceVertical
          contentContainerStyle={styles.emptyContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {(solicitudEnviada || solicitudEnCola || acreditado?.solicitud_enviada) ? (
            // ── Estado post-solicitud ──────────────────────────────────────
            <>
              <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
              <Text style={styles.emptyTitle}>¡Ya estás registrado!</Text>
              <Text style={styles.emptySubtitle}>
                Recibimos tu solicitud y ya estás registrado con nosotros. Un asesor se pondrá en contacto contigo para iniciar tu trámite; cuando se abra tu expediente lo verás aquí.
              </Text>
              {solicitudEnCola && (
                <View style={[styles.card, styles.guiaCard, styles.ppCard]}>
                  <View style={styles.guiaHeader}>
                    <Ionicons name="cloud-offline-outline" size={20} color={Colors.gold[400]} />
                    <Text style={styles.guiaTitle}>Pendiente de envío</Text>
                  </View>
                  <Text style={styles.guiaText}>Tu solicitud está guardada en el teléfono y se envía sola cuando regrese la señal.</Text>
                </View>
              )}
            </>
          ) : (
            // ── Primeros pasos ─────────────────────────────────────────────
            <>
              <View style={[styles.card, styles.ppCard]}>
                <Text style={styles.sectionTitle}>PRIMEROS PASOS</Text>
                {progreso && progreso.historial.length > 0 ? (
                  <>
                    <Text style={styles.ppTitulo}>Continúa donde te quedaste</Text>
                    <Text style={styles.ppTexto}>
                      Paso {NUMERO_PASO[progreso.paso]} de 5 · {NOMBRE_PASO[progreso.paso]}
                      {progreso.datos.credito && progreso.datos.credito !== 'por_definir' ? ` ${NOMBRE_CREDITO[progreso.datos.credito]}` : ''}
                    </Text>
                    <View style={styles.ppSegmentos}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <View key={i} style={[styles.ppSegmento, i <= NUMERO_PASO[progreso.paso] && styles.ppSegmentoOn]} />
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.ppTitulo}>Averigua cuánto te prestan</Text>
                    <Text style={styles.ppTexto}>
                      En 5 pasos sabrás si te toca Infonavit o Fovissste, te ayudamos a registrarte y a precalificarte en el portal oficial.
                    </Text>
                  </>
                )}
                <TouchableOpacity style={styles.ppBtn} onPress={() => setFlujo('normal')}>
                  <Text style={styles.ppBtnText}>{progreso && progreso.historial.length > 0 ? 'Continuar' : 'Empezar'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.card, styles.ppLlamada]} onPress={() => setFlujo('llamada')}>
                <View style={styles.ppIcono}><Ionicons name="call-outline" size={22} color={Colors.gold[400]} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ppLlamadaTitulo}>¿Prefieres que te llamen?</Text>
                  <Text style={styles.ppLlamadaTexto}>Un asesor te ayuda con todo el proceso.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.dark[500]} />
              </TouchableOpacity>
            </>
          )}
          <Text style={styles.version}>v{APP_VERSION}</Text>
        </ScrollView>
        {acreditado && (
          <PrimerosPasos
            visible={flujo !== null}
            entrada={flujo ?? 'normal'}
            acreditadoId={acreditado.id}
            telefono={acreditado.telefono}
            onClose={() => { setFlujo(null); cargarPrimerosPasos(); }}
            onTerminado={terminarPrimerosPasos}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Hola, {acreditado?.name?.split(' ')[0] ?? ''}</Text>
            <Text style={styles.headerSub}>Consultoría Inmobiliaria</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={16} color={Colors.dark[400]} />
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={recargar} tintColor={Colors.gold[400]} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {expediente && (
          <>
            {/* Folio y estado */}
            <View style={styles.card}>
              <View style={styles.folioRow}>
                <Text style={styles.folio}>{expediente.folio}</Text>
                <View style={[styles.estadoBadge, { backgroundColor: ESTADO_COLOR[expediente.estado] ?? '#374151' }]}>
                  <Text style={styles.estadoText}>{ESTADO_LABEL[expediente.estado] ?? expediente.estado}</Text>
                </View>
              </View>
              {expediente.tipo_tramite && (
                <Text style={styles.tipoTramite}>{expediente.tipo_tramite}</Text>
              )}
            </View>

            {/* Guía del paso actual */}
            <View style={[styles.card, styles.guiaCard]}>
              <View style={styles.guiaHeader}>
                <Ionicons name="information-circle" size={20} color={Colors.gold[400]} />
                <Text style={styles.guiaTitle}>¿Qué está pasando?</Text>
              </View>
              <Text style={styles.guiaText}>{expediente.guia_paso_actual}</Text>
            </View>

            {/* Documento que un administrador pidió: la nota explica cuál falta */}
            {(expediente.documentos_solicitados ?? []).map(d => (
              <View key={d.id} style={[styles.card, styles.solicitadoCard]}>
                <View style={styles.guiaHeader}>
                  <Ionicons name="document-attach" size={20} color={Colors.gold[400]} />
                  <Text style={styles.guiaTitle}>Te falta un documento</Text>
                </View>
                <Text style={styles.guiaText}>{d.nota}</Text>
                <TouchableOpacity
                  style={styles.solicitadoBtn}
                  onPress={() => router.push({ pathname: '/subir-documento-acreditado', params: { tipoLabel: d.tipo } })}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color={Colors.dark[900]} />
                  <Text style={styles.solicitadoBtnText}>Subir este documento</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Documentos pendientes */}
            {expediente.documentos_pendientes > 0 && (
              <View style={[styles.card, styles.pendientesCard]}>
                <Ionicons name="warning-outline" size={20} color="#b45309" />
                <Text style={styles.pendientesText}>
                  Tienes <Text style={{ fontWeight: 'bold' }}>{expediente.documentos_pendientes} documento{expediente.documentos_pendientes !== 1 ? 's' : ''}</Text> pendiente{expediente.documentos_pendientes !== 1 ? 's' : ''} de entregar.
                  Ve a la pestaña Documentos para subirlos.
                </Text>
              </View>
            )}

            {/* Fechas importantes */}
            {(expediente.fecha_firma || expediente.fecha_esperada_pago) && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>FECHAS IMPORTANTES</Text>
                {expediente.fecha_firma && (
                  <View style={styles.fechaRow}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.gold[400]} />
                    <Text style={styles.fechaText}>Firma ante notario: <Text style={styles.fechaVal}>{expediente.fecha_firma}</Text></Text>
                  </View>
                )}
                {expediente.fecha_esperada_pago && (
                  <View style={styles.fechaRow}>
                    <Ionicons name="cash-outline" size={16} color={Colors.gold[400]} />
                    <Text style={styles.fechaText}>Fecha esperada de pago: <Text style={styles.fechaVal}>{expediente.fecha_esperada_pago}</Text></Text>
                  </View>
                )}
              </View>
            )}

            {/* Contacto del asesor */}
            {expediente.asesor && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>TU ASESOR</Text>
                <Text style={styles.asesorNombre}>{expediente.asesor.name}</Text>
                <View style={styles.asesorAcciones}>
                  {expediente.asesor.telefono && (
                    <TouchableOpacity
                      style={styles.asesorBtn}
                      onPress={() => Linking.openURL(`tel:${expediente.asesor!.telefono}`)}
                    >
                      <Ionicons name="call-outline" size={18} color={Colors.gold[400]} />
                      <Text style={styles.asesorBtnText}>Llamar</Text>
                    </TouchableOpacity>
                  )}
                  {expediente.asesor.telefono && (
                    <TouchableOpacity
                      style={styles.asesorBtn}
                      onPress={() => Linking.openURL(`https://wa.me/52${expediente.asesor!.telefono?.replace(/\D/g, '')}`)}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#25d366" />
                      <Text style={styles.asesorBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </>
        )}
        <Text style={styles.version}>v{APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900] },
  header:      { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.lg, backgroundColor: Colors.dark[900] },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  headerSub:   { fontSize: Typography.fontSize.sm, color: Colors.gold[400], marginTop: 2 },
  logoutBtn:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.md, backgroundColor: Colors.dark[800] },
  logoutText:  { fontSize: Typography.fontSize.xs, color: Colors.dark[400], fontWeight: Typography.fontWeight.medium },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing['3xl'] },

  card: { backgroundColor: Colors.dark[800], borderRadius: Radius.lg, padding: Spacing.xl },
  sectionTitle: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[400], letterSpacing: 1.5, marginBottom: Spacing.base },

  folioRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  folio:      { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  estadoBadge:{ paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  estadoText: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: '#fff' },
  tipoTramite:{ fontSize: Typography.fontSize.sm, color: Colors.dark[400], marginTop: Spacing.xs },


  guiaCard:   { borderLeftWidth: 3, borderLeftColor: Colors.gold[400] },
  guiaHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  guiaTitle:  { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.gold[400] },
  guiaText:   { fontSize: Typography.fontSize.sm, color: Colors.cream[300], lineHeight: Typography.fontSize.sm * 1.6 },

  solicitadoCard: { borderWidth: 1.5, borderColor: Colors.gold[400] },
  solicitadoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.gold[400], borderRadius: Radius.md, paddingVertical: Spacing.sm, marginTop: Spacing.md },
  solicitadoBtnText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  pendientesCard: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: '#431407', borderWidth: 1, borderColor: '#7c2d12' },
  pendientesText: { flex: 1, fontSize: Typography.fontSize.sm, color: '#fed7aa', lineHeight: Typography.fontSize.sm * 1.5 },

  fechaRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  fechaText: { fontSize: Typography.fontSize.sm, color: Colors.dark[400] },
  fechaVal:  { color: Colors.cream[200] },

  asesorNombre:  { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50], marginBottom: Spacing.base },
  asesorAcciones:{ flexDirection: 'row', gap: Spacing.sm },
  asesorBtn:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.dark[700], paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  asesorBtnText: { fontSize: Typography.fontSize.sm, color: Colors.cream[200] },

  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
    gap: Spacing.base,
    paddingBottom: Spacing['3xl'] * 2,
  },
  emptyTitle:    { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50], textAlign: 'center' },
  emptySubtitle: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', lineHeight: Typography.fontSize.sm * 1.6 },
  ppCard:          { width: '100%' },
  ppTitulo:        { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  ppTexto:         { fontSize: Typography.fontSize.sm, color: Colors.cream[300], lineHeight: Typography.fontSize.sm * 1.5, marginTop: Spacing.xs },
  ppSegmentos:     { flexDirection: 'row', gap: 6, marginTop: Spacing.md },
  ppSegmento:      { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.dark[700] },
  ppSegmentoOn:    { backgroundColor: Colors.gold[400] },
  ppBtn:           { backgroundColor: Colors.gold[400], borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg, minHeight: 48, justifyContent: 'center' },
  ppBtnText:       { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  ppLlamada:       { width: '100%', flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  ppIcono:         { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.dark[700], alignItems: 'center', justifyContent: 'center' },
  ppLlamadaTitulo: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50] },
  ppLlamadaTexto:  { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },

  version: { fontSize: Typography.fontSize.xs, color: Colors.dark[500], textAlign: 'center', marginTop: Spacing.xl },
});
