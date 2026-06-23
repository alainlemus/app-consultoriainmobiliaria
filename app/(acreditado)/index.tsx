import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { getExpedienteAcreditado, solicitarAsesoria, getServiciosDisponibles } from '@/src/services/acreditadoApi';
import { useAcreditadoAuth } from '@/src/contexts/AcreditadoAuthContext';
import type { ExpedienteAcreditado, ServicioTramite } from '@/src/types';

const ESTADO_COLOR: Record<string, string> = {
  en_proceso: '#1d4ed8',
  pausado:    '#b45309',
  aprobado:   '#15803d',
  firmado:    '#7e22ce',
  cerrado:    '#374151',
  cancelado:  '#dc2626',
};

const ESTADO_LABEL: Record<string, string> = {
  en_proceso: 'En proceso',
  pausado:    'Pausado',
  aprobado:   'Aprobado',
  firmado:    'Firmado',
  cerrado:    'Cerrado',
  cancelado:  'Cancelado',
};

export default function MiTramiteScreen() {
  const insets               = useSafeAreaInsets();
  const { acreditado }       = useAcreditadoAuth();
  const [expediente, setExpediente]   = useState<ExpedienteAcreditado | null>(null);
  const [servicios, setServicios]     = useState<ServicioTramite[]>([]);
  const [loading,  setLoading]        = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [exp, svcs] = await Promise.all([
        getExpedienteAcreditado(),
        getServiciosDisponibles(),
      ]);
      setExpediente(exp);
      setServicios(svcs);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { cargar(); }, []);

  async function handleSolicitarAsesoria(tipoId: number) {
    try {
      await solicitarAsesoria({ tipo_tramite_id: tipoId });
      await cargar();
    } catch {}
  }

  // ── Sin expediente ──────────────────────────────────────────────────────────
  if (!loading && !expediente) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Hola, {acreditado?.name?.split(' ')[0] ?? 'bienvenido'} 👋</Text>
          <Text style={styles.headerSub}>Consultoría Inmobiliaria</Text>
        </View>
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <Ionicons name="home-outline" size={64} color={Colors.dark[600]} />
          <Text style={styles.emptyTitle}>Aún no tienes un trámite activo</Text>
          <Text style={styles.emptySubtitle}>
            Solicita una asesoría para iniciar tu proceso de crédito. Un asesor te contactará pronto.
          </Text>
          {servicios.map(s => (
            <TouchableOpacity
              key={s.id}
              style={styles.servicioBtn}
              onPress={() => handleSolicitarAsesoria(s.id)}
            >
              <Text style={styles.servicioBtnText}>{s.nombre}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  const etapaOrden = expediente?.etapa.orden ?? 0;
  const etapaTotal = expediente?.etapa.total ?? 7;

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hola, {acreditado?.name?.split(' ')[0] ?? ''} 👋</Text>
        <Text style={styles.headerSub}>Consultoría Inmobiliaria</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={Colors.gold[400]} />}
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

            {/* Stepper de progreso */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>PROGRESO DEL TRÁMITE</Text>
              <View style={styles.stepperRow}>
                {Array.from({ length: etapaTotal }).map((_, i) => {
                  const n = i + 1;
                  const done    = n < etapaOrden;
                  const current = n === etapaOrden;
                  return (
                    <React.Fragment key={n}>
                      <View style={[
                        styles.stepDot,
                        done    && styles.stepDotDone,
                        current && styles.stepDotCurrent,
                      ]}>
                        {done
                          ? <Ionicons name="checkmark" size={10} color="#fff" />
                          : <Text style={[styles.stepNum, current && styles.stepNumCurrent]}>{n}</Text>
                        }
                      </View>
                      {n < etapaTotal && (
                        <View style={[styles.stepLine, done && styles.stepLineDone]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
              <Text style={styles.etapaNombre}>{expediente.etapa.nombre}</Text>
            </View>

            {/* Guía del paso actual */}
            <View style={[styles.card, styles.guiaCard]}>
              <View style={styles.guiaHeader}>
                <Ionicons name="information-circle" size={20} color={Colors.gold[400]} />
                <Text style={styles.guiaTitle}>¿Qué está pasando?</Text>
              </View>
              <Text style={styles.guiaText}>{expediente.guia_paso_actual}</Text>
            </View>

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
                  {expediente.asesor.email && (
                    <TouchableOpacity
                      style={styles.asesorBtn}
                      onPress={() => Linking.openURL(`mailto:${expediente.asesor!.email}`)}
                    >
                      <Ionicons name="mail-outline" size={18} color={Colors.gold[400]} />
                      <Text style={styles.asesorBtnText}>Email</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900] },
  header: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.lg, backgroundColor: Colors.dark[900] },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  headerSub:   { fontSize: Typography.fontSize.sm, color: Colors.gold[400], marginTop: 2 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing['3xl'] },

  card: { backgroundColor: Colors.dark[800], borderRadius: Radius.lg, padding: Spacing.xl },
  sectionTitle: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[400], letterSpacing: 1.5, marginBottom: Spacing.base },

  folioRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  folio:      { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  estadoBadge:{ paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  estadoText: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: '#fff' },
  tipoTramite:{ fontSize: Typography.fontSize.sm, color: Colors.dark[400], marginTop: Spacing.xs },

  stepperRow:    { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.base },
  stepDot:       { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.dark[600], alignItems: 'center', justifyContent: 'center' },
  stepDotDone:   { backgroundColor: Colors.gold[400] },
  stepDotCurrent:{ backgroundColor: '#1d4ed8', borderWidth: 2, borderColor: '#93c5fd' },
  stepNum:       { fontSize: 10, color: Colors.dark[400] },
  stepNumCurrent:{ color: '#fff', fontWeight: 'bold' },
  stepLine:      { flex: 1, height: 2, backgroundColor: Colors.dark[600] },
  stepLineDone:  { backgroundColor: Colors.gold[400] },
  etapaNombre:   { fontSize: Typography.fontSize.sm, color: Colors.cream[200], fontWeight: Typography.fontWeight.semibold, textAlign: 'center' },

  guiaCard:   { borderLeftWidth: 3, borderLeftColor: Colors.gold[400] },
  guiaHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  guiaTitle:  { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.gold[400] },
  guiaText:   { fontSize: Typography.fontSize.sm, color: Colors.cream[300], lineHeight: Typography.fontSize.sm * 1.6 },

  pendientesCard: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: '#431407', borderWidth: 1, borderColor: '#7c2d12' },
  pendientesText: { flex: 1, fontSize: Typography.fontSize.sm, color: '#fed7aa', lineHeight: Typography.fontSize.sm * 1.5 },

  fechaRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  fechaText: { fontSize: Typography.fontSize.sm, color: Colors.dark[400] },
  fechaVal:  { color: Colors.cream[200] },

  asesorNombre:  { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50], marginBottom: Spacing.base },
  asesorAcciones:{ flexDirection: 'row', gap: Spacing.sm },
  asesorBtn:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.dark[700], paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  asesorBtnText: { fontSize: Typography.fontSize.sm, color: Colors.cream[200] },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['3xl'], gap: Spacing.base },
  emptyTitle:    { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50], textAlign: 'center' },
  emptySubtitle: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', lineHeight: Typography.fontSize.sm * 1.6 },
  servicioBtn:   { width: '100%', backgroundColor: Colors.dark[800], borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.gold[400] },
  servicioBtnText:{ fontSize: Typography.fontSize.base, color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold },
});
