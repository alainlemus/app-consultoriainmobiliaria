/**
 * Documentos de un expediente: agregar (escanear o subir), y por cada uno
 * ver, reemplazar y eliminar.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { deleteDocumento, getDocumentosExpediente, getDocumentoUrl, rechazarDocumento, validarDocumento } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSyncContext } from '../contexts/SyncContext';
import type { Documento } from '../types';

const esPdf = (doc: Documento) => (doc.ruta_archivo ?? '').toLowerCase().endsWith('.pdf');

// Los documentos viejos se guardaron con el nombre del archivo (doc_123.jpg): se muestran como "Documento".
const nombreLegible = (doc: Documento) => {
  const nombre = doc.nombre ?? doc.tipo ?? '';
  return /^doc_\d+|\.(jpe?g|png|pdf|heic|webp)$/i.test(nombre) ? 'Documento' : nombre;
};

const fechaCorta = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function DocumentosExpediente({ expedienteId }: { expedienteId: number }) {
  const router = useRouter();
  const { online, pendientes } = useSyncContext();
  const { isSuperAdmin } = useAuth();   // solo un administrador valida o rechaza
  const [docs, setDocs]         = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState<number | null>(null);
  const [aRechazar, setARechazar] = useState<Documento | null>(null);
  const [motivo, setMotivo]       = useState('');
  const [enviando, setEnviando]   = useState(false);

  // Se recarga al volver de subir/reemplazar y cuando la cola offline se vacía.
  useFocusEffect(
    useCallback(() => {
      if (!online) { setCargando(false); return; }
      getDocumentosExpediente(expedienteId)
        .then(setDocs)
        .catch(() => {})
        .finally(() => setCargando(false));
    }, [expedienteId, online, pendientes]),
  );

  const ver = async (doc: Documento) => {
    if (!doc.id) return;
    setAbriendo(doc.id);
    try {
      Linking.openURL(await getDocumentoUrl(expedienteId, doc.id));
    } catch {
      Alert.alert('Error', 'No se pudo abrir el documento. Inténtalo de nuevo.');
    } finally {
      setAbriendo(null);
    }
  };

  const reemplazar = (doc: Documento) => {
    if (!online) {
      Alert.alert('Sin conexión', 'Para reemplazar un documento necesitas internet.');
      return;
    }
    router.push({
      pathname: '/expedientes/subir-documento',
      params: { expedienteId: String(expedienteId), reemplazarId: String(doc.id), tipoLabel: nombreLegible(doc) },
    });
  };

  const validar = async (doc: Documento) => {
    if (!doc.id) return;
    try {
      const nuevo = await validarDocumento(expedienteId, doc.id);
      setDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, ...nuevo, tiene_archivo: true } : d)));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo validar');
    }
  };

  const confirmarRechazo = async () => {
    if (!aRechazar?.id || !motivo.trim()) return;
    setEnviando(true);
    try {
      const nuevo = await rechazarDocumento(expedienteId, aRechazar.id, motivo.trim());
      setDocs(prev => prev.map(d => (d.id === aRechazar.id ? { ...d, ...nuevo, tiene_archivo: true } : d)));
      setARechazar(null);
      setMotivo('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo rechazar');
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = (doc: Documento) => {
    if (!doc.id) return;
    Alert.alert('Eliminar documento', `¿Eliminar "${nombreLegible(doc)}"? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDocumento(expedienteId, doc.id as number);
            setDocs(prev => prev.filter(d => d.id !== doc.id));
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.addBtn}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/expedientes/subir-documento', params: { expedienteId: String(expedienteId) } })}
      >
        <Ionicons name="scan" size={28} color={Colors.gold[400]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.addLabel}>Escanear o subir documento</Text>
          <Text style={styles.addSub}>Te diremos qué revisar antes de subirlo</Text>
        </View>
        <Ionicons name="add-circle" size={30} color={Colors.gold[400]} />
      </TouchableOpacity>

      {cargando ? (
        <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing.md }} />
      ) : docs.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="folder-open-outline" size={44} color={Colors.dark[300]} />
          <Text style={styles.vacioTexto}>
            {online ? 'Aún no hay documentos cargados.' : 'Sin conexión: conéctate para ver los documentos cargados. Los que subas ahora se enviarán al recuperar señal.'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.contador}>{docs.length} documento{docs.length === 1 ? '' : 's'} cargado{docs.length === 1 ? '' : 's'}</Text>
          {docs.map(doc => (
            <View key={doc.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.tile, esPdf(doc) ? styles.tilePdf : styles.tileFoto]}>
                  <Ionicons name={esPdf(doc) ? 'document-text' : 'image'} size={22} color={esPdf(doc) ? '#dc2626' : '#2563eb'} />
                  <Text style={styles.tileText}>{esPdf(doc) ? 'PDF' : 'FOTO'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.titulo} numberOfLines={2}>{nombreLegible(doc)}</Text>
                  <Insignia validacion={doc.validacion ?? 'en_revision'} />
                  <Text style={styles.sub}>Subido el {fechaCorta(doc.created_at)}</Text>
                  {doc.notas ? (
                    <View style={styles.notaFila}>
                      <Ionicons name="pricetag" size={15} color={Colors.gold[600]} />
                      <Text style={styles.notas} numberOfLines={2}>{doc.notas}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {doc.validacion === 'rechazado' && doc.motivo_rechazo ? (
                <View style={styles.rechazoBox}>
                  <Ionicons name="close-circle" size={20} color={Colors.crimson[600]} />
                  <Text style={styles.rechazoTexto}>{doc.motivo_rechazo}</Text>
                </View>
              ) : null}

              <View style={styles.acciones}>
                <TouchableOpacity style={[styles.accion, styles.accionVer]} onPress={() => ver(doc)} activeOpacity={0.8}>
                  {abriendo === doc.id
                    ? <ActivityIndicator size="small" color={Colors.dark[900]} />
                    : <View style={styles.accionFila}><Ionicons name="eye" size={16} color={Colors.dark[900]} /><Text style={styles.accionVerText}>Ver</Text></View>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.accion} onPress={() => reemplazar(doc)} activeOpacity={0.8}>
                  <View style={styles.accionFila}><Ionicons name="swap-horizontal" size={16} color={Colors.dark[700]} /><Text style={styles.accionText}>Reemplazar</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.accion} onPress={() => eliminar(doc)} activeOpacity={0.8}>
                  <View style={styles.accionFila}><Ionicons name="trash-outline" size={16} color={Colors.crimson[600]} /><Text style={[styles.accionText, styles.accionEliminar]}>Eliminar</Text></View>
                </TouchableOpacity>
              </View>

              {isSuperAdmin ? (
                <View style={[styles.acciones, { marginTop: Spacing.xs }]}>
                  {doc.validacion !== 'validado' ? (
                    <TouchableOpacity style={[styles.accion, styles.accionValidar]} onPress={() => validar(doc)} activeOpacity={0.8}>
                      <View style={styles.accionFila}>
                        <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                        <Text style={styles.accionValidarText}>Validar</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                  {doc.validacion !== 'rechazado' ? (
                    <TouchableOpacity style={styles.accion} onPress={() => { setMotivo(''); setARechazar(doc); }} activeOpacity={0.8}>
                      <View style={styles.accionFila}>
                        <Ionicons name="close-circle-outline" size={16} color={Colors.crimson[600]} />
                        <Text style={[styles.accionText, styles.accionEliminar]}>Rechazar</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </>
      )}

      {/* Motivo del rechazo (solo administradores) */}
      <Modal visible={!!aRechazar} transparent animationType="fade" onRequestClose={() => setARechazar(null)}>
        <View style={styles.modalFondo}>
          <View style={styles.modalCard}>
            <Ionicons name="close-circle" size={44} color={Colors.crimson[600]} style={{ alignSelf: 'center' }} />
            <Text style={styles.modalTitulo}>Rechazar documento</Text>
            <Text style={styles.modalTexto}>Escribe qué debe corregirse. Se guarda con el documento.</Text>
            <TextInput
              style={styles.modalInput}
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ej: El estado de cuenta tiene más de 3 meses"
              placeholderTextColor={Colors.dark[400]}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalBtn, (!motivo.trim() || enviando) && { opacity: 0.5 }]}
              onPress={confirmarRechazo}
              disabled={!motivo.trim() || enviando}
            >
              {enviando ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalBtnText}>Rechazar documento</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelar} onPress={() => setARechazar(null)}>
              <Text style={styles.modalCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const INSIGNIAS = {
  en_revision: { texto: 'En revisión', icono: 'time',             fondo: '#fffbeb', color: '#b45309' },
  validado:    { texto: 'Validado',    icono: 'checkmark-circle', fondo: '#f0fdf4', color: '#15803d' },
  rechazado:   { texto: 'Rechazado',   icono: 'close-circle',     fondo: '#fef2f2', color: '#b91c1c' },
} as const;

/** Estado de validación: lo decide un administrador. */
function Insignia({ validacion }: { validacion: keyof typeof INSIGNIAS }) {
  const i = INSIGNIAS[validacion];
  return (
    <View style={[styles.insignia, { backgroundColor: i.fondo }]}>
      <Ionicons name={i.icono} size={15} color={i.color} />
      <Text style={[styles.insigniaTexto, { color: i.color }]}>{i.texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  insignia:      { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, marginTop: 4 },
  insigniaTexto: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },
  rechazoBox:    { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginTop: Spacing.sm, backgroundColor: '#fef2f2', borderRadius: Radius.md, padding: Spacing.sm },
  rechazoTexto:  { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.crimson[700], lineHeight: 20, fontWeight: Typography.fontWeight.medium },
  accionValidar:     { backgroundColor: Colors.success, borderColor: Colors.success },
  accionValidarText: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.white },
  modalFondo:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  modalCard:    { width: '100%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.xl },
  modalTitulo:  { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], textAlign: 'center', marginTop: Spacing.sm },
  modalTexto:   { fontSize: Typography.fontSize.sm, color: Colors.dark[500], textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.md },
  modalInput:   { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.dark[300], borderRadius: Radius.md, padding: Spacing.md, minHeight: 90, fontSize: Typography.fontSize.base, color: Colors.dark[900], textAlignVertical: 'top' },
  modalBtn:     { marginTop: Spacing.md, backgroundColor: Colors.crimson[600], borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  modalBtnText: { color: Colors.white, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  modalCancelar:     { paddingVertical: Spacing.md, alignItems: 'center' },
  modalCancelarText: { color: Colors.dark[500], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.dark[900], borderRadius: Radius.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.base,
  },
  addIcon:  { fontSize: 22 },
  addLabel: { color: Colors.white, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  addSub:   { color: Colors.cream[300], fontSize: Typography.fontSize.xs, marginTop: 1 },
  addPlus:  { color: Colors.gold[400], fontSize: 24, fontWeight: '700' },

  vacio:      { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.xs },
  vacioIcono: { fontSize: 34 },
  vacioTexto: { color: Colors.dark[400], fontSize: Typography.fontSize.sm, textAlign: 'center', paddingHorizontal: Spacing.base },

  contador: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: Spacing.md, marginBottom: Spacing.xs, fontWeight: Typography.fontWeight.semibold },
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[200],
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  cardTop: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  tile:    { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', gap: 1 },
  tilePdf:  { backgroundColor: '#fef2f2' },
  tileFoto: { backgroundColor: '#eff6ff' },
  tileText: { fontSize: 11, fontWeight: Typography.fontWeight.bold, color: Colors.dark[700] },
  titulo:   { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  sub:      { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },
  // La nota identifica rápido el documento (ej. "INE del dueño de la casa")
  notaFila: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, backgroundColor: Colors.gold[50], borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' },
  notas:    { flexShrink: 1, fontSize: Typography.fontSize.sm, color: Colors.gold[700], fontWeight: Typography.fontWeight.semibold },

  acciones: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.md },
  accion: {
    flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.dark[300], backgroundColor: Colors.white,
  },
  accionFila:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  accionVer:      { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  accionVerText:  { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  accionText:     { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[700] },
  accionEliminar: { color: Colors.crimson[600] },
});
