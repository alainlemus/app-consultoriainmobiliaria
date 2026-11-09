/**
 * Detalle del expediente de un cliente: sus datos básicos y sus documentos
 * (escanear o subir, ver, eliminar). Sin etapas ni estados: eso se lleva en el panel.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking, Modal, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../../src/theme';
import { enviarCarpetaExpediente, getExpediente, avanzarSeguimiento, registrarCuv } from '../../src/services/api';
import SeguimientoTramite from '../../src/components/SeguimientoTramite';
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

  // CUV (super admin): 16 dígitos + foto opcional
  const [cuvModal, setCuvModal] = useState(false);
  const [cuv, setCuv]           = useState('');
  const [cuvFoto, setCuvFoto]   = useState<{ uri: string; mimeType: string; nombre: string } | null>(null);
  const [guardandoCuv, setGuardandoCuv] = useState(false);

  async function elegirFotoCuv() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets[0]) setCuvFoto({ uri: r.assets[0].uri, mimeType: r.assets[0].mimeType ?? 'image/jpeg', nombre: r.assets[0].fileName ?? 'cuv.jpg' });
  }

  async function guardarCuv() {
    if (!/^\d{16}$/.test(cuv)) { Alert.alert('CUV incompleta', 'La CUV son 16 dígitos.'); return; }
    if (!exp) return;
    setGuardandoCuv(true);
    try {
      const r = await registrarCuv(exp.id, cuv, cuvFoto ?? undefined);
      setExp({ ...exp, cuv_info: r.cuv_info, seguimiento: r.seguimiento });
      setCuvModal(false); setCuv(''); setCuvFoto(null);
      Alert.alert('CUV registrada', 'El acreditado y el asesor ya fueron avisados. El seguimiento pasó a «Recurso en gestión».');
    } catch (e: unknown) {
      Alert.alert('No se pudo registrar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally { setGuardandoCuv(false); }
  }

  function marcarPaso(paso: 'en_unidad_valuacion' | 'firma', titulo: string) {
    Alert.alert(titulo, 'El acreditado y el asesor recibirán el aviso de este paso.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Marcar', onPress: async () => {
        try { const s = await avanzarSeguimiento(exp!.id, paso); setExp(e => e ? { ...e, seguimiento: s } : e); }
        catch (e: unknown) { Alert.alert('No se pudo', e instanceof Error ? e.message : 'Inténtalo de nuevo.'); }
      } },
    ]);
  }

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

          {/* Contacto con el cliente + agendar cita */}
          <View style={styles.contactoAcciones}>
            {contacto?.telefono ? (
              <>
                <TouchableOpacity style={styles.contactoBtn} onPress={() => Linking.openURL(`tel:${contacto.telefono}`)}>
                  <Ionicons name="call-outline" size={18} color={Colors.gold[400]} /><Text style={styles.contactoBtnText}>Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactoBtn} onPress={() => Linking.openURL(`https://wa.me/52${(contacto.telefono ?? '').replace(/\D/g, '')}`)}>
                  <Ionicons name="logo-whatsapp" size={18} color="#25d366" /><Text style={styles.contactoBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={[styles.contactoBtn, styles.contactoBtnOro]} onPress={() => router.push({ pathname: '/citas/nueva', params: { expediente_id: String(exp.id), nombre: contacto?.nombre ?? '' } })}>
              <Ionicons name="calendar-outline" size={18} color={Colors.dark[900]} /><Text style={[styles.contactoBtnText, { color: Colors.dark[900] }]}>Agendar cita</Text>
            </TouchableOpacity>
          </View>

          {/* Seguimiento del trámite (igual que lo ve el acreditado) */}
          {exp.seguimiento ? <View style={{ marginTop: Spacing.md }}><SeguimientoTramite seguimiento={exp.seguimiento} /></View> : null}

          {/* CUV: el asesor la ve; el super admin la registra cuando el expediente está en la unidad de valuación */}
          {(exp.cuv_info || (isSuperAdmin && exp.seguimiento?.paso === 'en_unidad_valuacion')) ? (
            <View style={styles.cuvCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cuvLabel}>CUV · CLAVE ÚNICA DE VIVIENDA</Text>
                {exp.cuv_info ? (
                  <>
                    <Text style={styles.cuvValor}>{exp.cuv_info.valor}</Text>
                    <Text style={styles.cuvSub}>Registrada{exp.cuv_info.por ? ` por ${exp.cuv_info.por}` : ''}{exp.cuv_info.fecha ? ` · ${new Date(exp.cuv_info.fecha).toLocaleDateString('es-MX')}` : ''}</Text>
                  </>
                ) : <Text style={styles.cuvSub}>Aún no se registra. La entrega la unidad de valuación.</Text>}
              </View>
              {isSuperAdmin ? (
                <TouchableOpacity style={styles.cuvBtn} onPress={() => { setCuv(exp.cuv_info?.valor ?? ''); setCuvModal(true); }} disabled={!isSuperAdmin}>
                  <Ionicons name="home-outline" size={16} color={Colors.dark[900]} /><Text style={styles.cuvBtnText}>{exp.cuv_info ? 'Corregir' : 'Registrar'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Pasos que marca el super admin (no tienen evento en el sistema) */}
          {isSuperAdmin && exp.seguimiento ? (
            <View style={styles.pasosManuales}>
              {(exp.seguimiento.paso === 'tramites_gestionados' || exp.seguimiento.paso === 'tramites_en_gestion') ? (
                <TouchableOpacity style={styles.pasoBtn} onPress={() => marcarPaso('en_unidad_valuacion', 'Enviado a unidad de valuación')}>
                  <Ionicons name="business-outline" size={16} color={Colors.dark[900]} /><Text style={styles.pasoBtnText}>Enviado a unidad de valuación</Text>
                </TouchableOpacity>
              ) : null}
              {exp.seguimiento.paso === 'recurso_en_gestion' ? (
                <TouchableOpacity style={styles.pasoBtn} onPress={() => marcarPaso('firma', 'Marcar firma')}>
                  <Ionicons name="create-outline" size={16} color={Colors.dark[900]} /><Text style={styles.pasoBtnText}>Marcar firma</Text>
                </TouchableOpacity>
              ) : null}
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

      {/* Registrar CUV */}
      <Modal visible={cuvModal} transparent animationType="fade" onRequestClose={() => setCuvModal(false)}>
        <View style={styles.modalFondo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Registrar CUV</Text>
            <Text style={styles.cuvSub}>Clave Única de Vivienda, 16 dígitos, tal como la entrega la unidad de valuación.</Text>
            <TextInput style={styles.modalInput} value={cuv} onChangeText={v => setCuv(v.replace(/\D/g, '').slice(0, 16))} keyboardType="number-pad" maxLength={16} placeholder="0000000000000000" placeholderTextColor={Colors.dark[400]} />
            <Text style={styles.cuvSub}>{cuv.length}/16</Text>
            <TouchableOpacity style={styles.modalFoto} onPress={elegirFotoCuv}>
              <Ionicons name={cuvFoto ? 'checkmark-circle' : 'camera-outline'} size={18} color={cuvFoto ? '#15803d' : Colors.dark[700]} />
              <Text style={styles.modalFotoText}>{cuvFoto ? 'Foto adjunta' : 'Adjuntar foto (opcional)'}</Text>
            </TouchableOpacity>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCuvModal(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalOk} onPress={guardarCuv} disabled={guardandoCuv}>
                {guardandoCuv ? <ActivityIndicator color={Colors.dark[900]} /> : <Text style={styles.modalOkText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  contactoAcciones: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  contactoBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md },
  contactoBtnOro:   { backgroundColor: Colors.gold[400] },
  contactoBtnText:  { fontSize: Typography.fontSize.xs, color: Colors.cream[200], fontWeight: Typography.fontWeight.semibold },
  cuvCard:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[200], padding: Spacing.md, marginTop: Spacing.md },
  cuvLabel:    { fontSize: Typography.fontSize.xs, letterSpacing: 1, color: Colors.dark[500], fontWeight: Typography.fontWeight.bold },
  cuvValor:    { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], letterSpacing: 2, fontFamily: 'monospace', marginTop: 2 },
  cuvSub:      { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2 },
  cuvBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.gold[400], paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md },
  cuvBtnText:  { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  pasosManuales: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.md },
  pasoBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.cream[100], borderWidth: 1, borderColor: Colors.gold[400], paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md },
  pasoBtnText: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  modalFondo:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: Spacing.xl },
  modalCard:   { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.sm },
  modalTitulo: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  modalInput:  { borderWidth: 1, borderColor: Colors.cream[300], borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.fontSize.xl, letterSpacing: 3, fontFamily: 'monospace', color: Colors.dark[900], textAlign: 'center' },
  modalFoto:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: Spacing.sm },
  modalFotoText: { fontSize: Typography.fontSize.sm, color: Colors.dark[700] },
  modalBtns:   { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalCancel: { flex: 1, padding: Spacing.md, alignItems: 'center', borderRadius: Radius.md, backgroundColor: Colors.cream[100] },
  modalCancelText: { color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold },
  modalOk:     { flex: 1, padding: Spacing.md, alignItems: 'center', borderRadius: Radius.md, backgroundColor: Colors.gold[400] },
  modalOkText: { color: Colors.dark[900], fontWeight: Typography.fontWeight.bold },
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
