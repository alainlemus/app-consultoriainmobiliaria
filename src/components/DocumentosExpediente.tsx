/**
 * Documentos de un expediente: agregar (escanear o subir), y por cada uno
 * ver, reemplazar y eliminar.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { deleteDocumento, getDocumentosExpediente, getDocumentoUrl, rechazarDocumento, solicitarDocumentoFaltante, validarDocumento } from '../services/api';
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

/** ¿Todos los documentos validados y ninguno solicitado pendiente? Entonces ya se puede enviar la carpeta. */
export const expedienteCompleto = (docs: Documento[]) => {
  const conArchivo = docs.filter(d => d.tiene_archivo);
  return conArchivo.length > 0
    && conArchivo.every(d => d.validacion === 'validado')
    && !docs.some(d => d.solicitado_at && !d.tiene_archivo);
};

export default function DocumentosExpediente({ expedienteId, acreditadoEnApp = false, onDocs }: {
  expedienteId: number;
  /** El acreditado usa la app: el administrador puede pedirle el documento a él o al asesor. */
  acreditadoEnApp?: boolean;
  /** Avisa al padre cada vez que cambia la lista (para habilitar el envío de la carpeta). */
  onDocs?: (docs: Documento[]) => void;
}) {
  const router = useRouter();
  const { online, pendientes } = useSyncContext();
  const { isSuperAdmin } = useAuth();   // solo un administrador valida o rechaza
  const [docs, setDocs]         = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState<number | null>(null);
  const [aRechazar, setARechazar] = useState<Documento | null>(null);
  const [motivo, setMotivo]       = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [solicitando, setSolicitando] = useState(false);   // modal "solicitar documento faltante"
  const [notaFalta, setNotaFalta]     = useState('');
  const [paraQuien, setParaQuien]     = useState<'acreditado' | 'asesor'>('asesor');

  useEffect(() => { onDocs?.(docs); }, [docs]);   // eslint-disable-line react-hooks/exhaustive-deps

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

  const pendientesSolicitados = docs.filter(d => d.solicitado_at && !d.tiene_archivo);
  const docsConArchivo        = docs.filter(d => !(d.solicitado_at && !d.tiene_archivo));

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
      const actualizados = docs.map(d => (d.id === doc.id ? { ...d, ...nuevo, tiene_archivo: true } : d));
      setDocs(actualizados);
      if (actualizados.length > 0 && actualizados.every(d => d.validacion === 'validado')) {
        Alert.alert(
          'Expediente completo',
          'Validaste todos los documentos. Se avisó al asesor y el expediente ya no aparecerá en la app: lo encuentras en el panel. Si quieres, envía la carpeta a tu correo antes de salir.',
        );
      }
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

  const confirmarSolicitud = async () => {
    if (!notaFalta.trim()) return;
    setEnviando(true);
    try {
      await solicitarDocumentoFaltante(expedienteId, notaFalta.trim(), acreditadoEnApp ? paraQuien : 'asesor');
      setSolicitando(false);
      setNotaFalta('');
      Alert.alert('Documento solicitado', paraQuien === 'asesor' || !acreditadoEnApp
        ? 'Se avisó al asesor: le llegó una notificación y verá tu nota en el expediente.'
        : 'Se avisó al acreditado: verá tu nota en Mi Trámite y le llegó una notificación.');
      getDocumentosExpediente(expedienteId).then(setDocs).catch(() => {});
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo solicitar el documento');
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

      {/* Solo administradores: pedir al acreditado un documento que faltaba */}
      {isSuperAdmin && (
        <TouchableOpacity style={styles.solicitarBtn} activeOpacity={0.85} onPress={() => { setNotaFalta(''); setParaQuien(acreditadoEnApp ? 'acreditado' : 'asesor'); setSolicitando(true); }}>
          <Ionicons name="document-attach" size={22} color={Colors.gold[700]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.solicitarLabel}>Solicitar documento faltante</Text>
            <Text style={styles.solicitarSub}>Escribe cuál falta; se avisa al acreditado o al asesor</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Documentos faltantes que pidió un administrador y aún no se suben */}
      {pendientesSolicitados.map(d => (
        <View key={d.id} style={styles.avisoFalta}>
          <View style={styles.avisoFaltaCab}>
            <Ionicons name="alert-circle" size={22} color={Colors.gold[700]} />
            <Text style={styles.avisoFaltaTitulo}>
              {d.solicitado_a === 'acreditado' ? 'Esperando al acreditado: documento solicitado' : 'Te solicitaron un documento'}
            </Text>
          </View>
          <Text style={styles.avisoFaltaNota}>{d.solicitud_nota}</Text>
          <TouchableOpacity
            style={styles.avisoFaltaBtn}
            activeOpacity={0.85}
            onPress={() => router.push({
              pathname: '/expedientes/subir-documento',
              params: { expedienteId: String(expedienteId), reemplazarId: String(d.id), tipoLabel: d.tipo, solicitudNota: d.solicitud_nota ?? '' },
            })}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={Colors.dark[900]} />
            <Text style={styles.avisoFaltaBtnText}>Subir este documento</Text>
          </TouchableOpacity>
        </View>
      ))}

      {cargando ? (
        <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing.md }} />
      ) : docsConArchivo.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="folder-open-outline" size={44} color={Colors.dark[300]} />
          <Text style={styles.vacioTexto}>
            {online ? 'Aún no hay documentos cargados.' : 'Sin conexión: conéctate para ver los documentos cargados. Los que subas ahora se enviarán al recuperar señal.'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.contador}>{docsConArchivo.length} documento{docsConArchivo.length === 1 ? '' : 's'} cargado{docsConArchivo.length === 1 ? '' : 's'}</Text>
          {docsConArchivo.map(doc => (
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

      {/* Documento faltante (solo administradores) */}
      <Modal visible={solicitando} transparent animationType="fade" onRequestClose={() => setSolicitando(false)}>
        <View style={styles.modalFondo}>
          <View style={styles.modalCard}>
            <Ionicons name="document-attach" size={44} color={Colors.gold[500]} style={{ alignSelf: 'center' }} />
            <Text style={styles.modalTitulo}>Solicitar documento faltante</Text>
            <Text style={styles.modalTexto}>Explica cuál documento falta. Quien elijas recibe una notificación con tu nota.</Text>
            {acreditadoEnApp ? (
              <View style={styles.paraFila}>
                {(['acreditado', 'asesor'] as const).map(p => (
                  <TouchableOpacity key={p} style={[styles.paraChip, paraQuien === p && styles.paraChipActivo]} onPress={() => setParaQuien(p)}>
                    <Text style={[styles.paraChipText, paraQuien === p && styles.paraChipTextActivo]}>{p === 'acreditado' ? 'Al acreditado' : 'Al asesor'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.paraSolo}>Se le pedirá al asesor (el acreditado no usa la app).</Text>
            )}
            <TextInput
              style={styles.modalInput}
              value={notaFalta}
              onChangeText={setNotaFalta}
              placeholder="Ej: Falta el acta de matrimonio, en la escritura aparece como casado"
              placeholderTextColor={Colors.dark[400]}
              multiline
              maxLength={500}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: Colors.dark[900] }, (!notaFalta.trim() || enviando) && { opacity: 0.5 }]}
              onPress={confirmarSolicitud}
              disabled={!notaFalta.trim() || enviando}
            >
              {enviando ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalBtnText}>Solicitar y avisar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelar} onPress={() => setSolicitando(false)}>
              <Text style={styles.modalCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  solicitarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm,
    backgroundColor: Colors.gold[50], borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gold[400],
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.base,
  },
  solicitarLabel: { color: Colors.gold[700], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  solicitarSub:   { color: Colors.dark[500], fontSize: Typography.fontSize.xs, marginTop: 1 },
  paraFila: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  paraChip: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.dark[300], alignItems: 'center' },
  paraChipActivo: { backgroundColor: Colors.dark[900], borderColor: Colors.dark[900] },
  paraChipText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[700] },
  paraChipTextActivo: { color: Colors.gold[400] },
  paraSolo: { fontSize: Typography.fontSize.sm, color: Colors.dark[500], textAlign: 'center', marginBottom: Spacing.md },
  avisoFalta: { marginTop: Spacing.md, backgroundColor: Colors.gold[50], borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gold[400], padding: Spacing.base },
  avisoFaltaCab: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avisoFaltaTitulo: { flex: 1, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.gold[700] },
  avisoFaltaNota: { fontSize: Typography.fontSize.base, color: Colors.dark[800], lineHeight: 24, marginTop: Spacing.sm },
  avisoFaltaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.gold[400], borderRadius: Radius.md, paddingVertical: Spacing.sm, marginTop: Spacing.md },
  avisoFaltaBtnText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
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
