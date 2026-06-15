import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
  Image, Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Badge, { ESTADO_EXPEDIENTE_BADGE } from '../../src/components/ui/Badge';
import { getExpediente, deleteDocumento, reemplazarDocumento, getDocumentoUrl } from '../../src/services/api';
import { getCacheExpediente } from '../../src/services/offline';
import { useSyncContext } from '../../src/contexts/SyncContext';
import type { Expediente, Documento } from '../../src/types';

const ESTADO_LABEL: Record<string, string> = {
  en_proceso:    'En proceso',
  documentacion: 'Documentación',
  autorizado:    'Autorizado',
  escrituracion: 'Escrituración',
  cerrado:       'Cerrado',
  cancelado:     'Cancelado',
};

const DOC_ESTADO_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  recibido:  { bg: '#f0fdf4', text: '#15803d', label: 'Recibido ✓' },
  no_aplica: { bg: '#f3f4f6', text: '#6b7280', label: 'No aplica' },
  pendiente: { bg: '#fefce8', text: '#a16207', label: 'Pendiente' },
};

const SECCION_LABEL: Record<string, string> = {
  acreditado: 'Acreditado (Comprador)',
  vendedor:   'Vendedor',
  vivienda:   'Vivienda / Propiedad',
  otros:      'Otros documentos',
};

const SECCION_ICON: Record<string, string> = {
  acreditado: '👤',
  vendedor:   '🏷️',
  vivienda:   '🏠',
  otros:      '📎',
};

export default function DetalleExpedienteScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { online } = useSyncContext();

  const [exp,        setExp]        = useState<Expediente | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [desdeCache, setDesdeCache] = useState(false);

  const cargar = async (numId: number) => {
    if (!online) {
      const cached = await getCacheExpediente(numId);
      if (cached) {
        setExp(cached);
        setDesdeCache(true);
      } else {
        setError(true);
      }
      setLoading(false);
      return;
    }
    try {
      const data = await getExpediente(numId);
      setExp(data);
      setDesdeCache(false);
    } catch {
      // Fallo de red: intentar desde cache
      const cached = await getCacheExpediente(numId);
      if (cached) {
        setExp(cached);
        setDesdeCache(true);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    cargar(Number(id));
  }, [id, online]);

  useFocusEffect(
    useCallback(() => {
      if (!id || !online) return;
      getExpediente(Number(id))
        .then(data => { setExp(data); setDesdeCache(false); })
        .catch(() => {});
    }, [id, online])
  );

  if (loading) return (
    <View style={styles.flex}>
      <TopBar title="Cargando…" onBack={() => router.back()} insetTop={insets.top} />
      <View style={styles.center}>
        <ActivityIndicator color={Colors.gold[400]} size="large" />
      </View>
    </View>
  );

  if (error || !exp) return (
    <View style={styles.flex}>
      <TopBar title="No encontrado" onBack={() => router.back()} insetTop={insets.top} />
      <Text style={styles.notFound}>No se encontró el expediente.</Text>
    </View>
  );

  const clienteNombre = exp.contacto?.nombre ?? `Expediente #${exp.id}`;
  const docsAll       = exp.documentos ?? [];

  // En la app solo mostramos los obligatorios — los opcionales se gestionan desde el CRM
  const docs = docsAll.filter(d => d.obligatorio !== false);

  // Totales recalculados sobre docs obligatorios
  const totalRequeridos = docs.length;
  const totalSubidos    = docs.filter(d => d.tiene_archivo).length;
  const totalPendientes = docs.filter(d => !d.tiene_archivo).length;

  // Agrupar por sección
  const secciones: Record<string, Documento[]> = {};
  for (const doc of docs) {
    const sec = doc.seccion ?? 'otros';
    if (!secciones[sec]) secciones[sec] = [];
    secciones[sec].push(doc);
  }
  const seccionOrder = ['acreditado', 'vendedor', 'vivienda', 'otros'];
  const seccionesOrdenadas = seccionOrder.filter(s => secciones[s]?.length > 0);

  const handleEliminar = (doc: Documento) => {
    if (!doc.id) return;
    Alert.alert(
      'Eliminar documento',
      `¿Eliminar "${doc.tipo_documento ?? doc.tipo}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocumento(exp!.id, doc.id as number);
              const updated = await getExpediente(exp!.id);
              setExp(updated);
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar');
            }
          },
        },
      ],
    );
  };

  const handleReemplazar = async (doc: Documento) => {
    if (!doc.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el acceso a la galería en Configuración.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    try {
      await reemplazarDocumento(exp!.id, doc.id as number, result.assets[0].uri);
      const updated = await getExpediente(exp!.id);
      setExp(updated);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo reemplazar');
    }
  };

  const handleVer = async (doc: Documento) => {
    if (!doc.id) return;
    try {
      const url = await getDocumentoUrl(exp!.id, doc.id as number);
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch {
      Alert.alert('Error', 'No se pudo abrir el documento. Inténtalo de nuevo.');
    }
  };

  return (
    <View style={styles.flex}>
      <TopBar
        title={exp.folio ?? `Exp. #${exp.id}`}
        subtitle="Expediente"
        onBack={() => router.back()}
        insetTop={insets.top}
        rightElement={
          <Badge
            label={ESTADO_LABEL[exp.estado] ?? exp.estado}
            variant={ESTADO_EXPEDIENTE_BADGE[exp.estado] ?? 'gray'}
            small
          />
        }
      />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner offline */}
        {desdeCache && (
          <View style={styles.cacheBanner}>
            <Text style={styles.cacheText}>📴 Sin conexión — mostrando datos guardados. No puedes subir documentos.</Text>
          </View>
        )}
        {/* ── Datos generales ── */}
        <SectionLabel>Información del trámite</SectionLabel>
        <View style={styles.card}>
          <InfoRow label="Cliente"   value={clienteNombre} />
          <InfoRow label="Trámite"   value={exp.tipo_tramite?.nombre ?? '—'} />
          <InfoRow label="Etapa"     value={(exp.etapa ?? exp.etapa_tramite)?.nombre ?? '—'} />
          {exp.monto_credito ? (
            <InfoRow label="Monto"   value={`$${Number(exp.monto_credito).toLocaleString('es-MX')}`} />
          ) : null}
          <InfoRow label="Estado"    value={ESTADO_LABEL[exp.estado] ?? exp.estado} last />
        </View>

        {/* ── Progreso de documentos ── */}
        <View style={styles.docHeader}>
          <SectionLabel>Documentos</SectionLabel>
          <View style={styles.docStats}>
            <Text style={styles.docStatText}>
              <Text style={{ color: '#15803d', fontWeight: '700' }}>{totalSubidos}</Text>
              /{totalRequeridos} subidos
            </Text>
            {totalPendientes > 0 && (
              <View style={styles.pendienteBadge}>
                <Text style={styles.pendienteBadgeText}>{totalPendientes} pendientes</Text>
              </View>
            )}
          </View>
        </View>

        {/* Barra de progreso */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${totalRequeridos > 0 ? (totalSubidos / totalRequeridos) * 100 : 0}%` as any }]} />
        </View>

        {/* ── Documentos agrupados por sección ── */}
        {seccionesOrdenadas.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyDocs}>Sin documentos en el checklist.</Text>
          </View>
        ) : (
          seccionesOrdenadas.map(seccion => (
            <View key={seccion} style={{ marginTop: Spacing.sm }}>
              {/* Cabecera de sección */}
              <View style={styles.seccionHeader}>
                <Text style={styles.seccionIcon}>{SECCION_ICON[seccion] ?? '📎'}</Text>
                <Text style={styles.seccionTitle}>{SECCION_LABEL[seccion] ?? seccion}</Text>
                <Text style={styles.seccionCount}>
                  {secciones[seccion].filter(d => d.tiene_archivo).length}/{secciones[seccion].length}
                </Text>
              </View>

              <View style={styles.card}>
                {secciones[seccion].map((doc, i) => {
                  const tieneArchivo = doc.tiene_archivo;
                  const esPendiente  = doc.estado === 'pendiente';
                  const estado       = DOC_ESTADO_COLOR[doc.estado] ?? DOC_ESTADO_COLOR['pendiente'];
                  const label        = doc.tipo_documento ?? doc.tipo ?? '—';

                  return (
                    <View key={`${doc.id ?? doc.tipo}-${i}`} style={[styles.docRow, i > 0 && styles.docBorder]}>
                      {/* Icono */}
                      <View style={[styles.docIconWrap, !tieneArchivo && styles.docIconWrapEmpty]}>
                        <Text style={styles.docIcon}>{tieneArchivo ? '📄' : '📋'}</Text>
                      </View>

                      <View style={styles.docInfo}>
                        <View style={styles.docNombreRow}>
                          <Text style={styles.docNombre} numberOfLines={2}>{label}</Text>
                          {doc.obligatorio === false && (
                            <Text style={styles.opcionalTag}>Opcional</Text>
                          )}
                        </View>

                        {doc.descripcion ? (
                          <Text style={styles.docDescripcion} numberOfLines={2}>{doc.descripcion}</Text>
                        ) : null}

                        {/* Estado visual */}
                        {tieneArchivo ? (
                          <View style={[styles.docEstadoPill, { backgroundColor: estado.bg, alignSelf: 'flex-start', marginTop: 3 }]}>
                            <Text style={[styles.docEstadoText, { color: estado.text }]}>{estado.label}</Text>
                          </View>
                        ) : (
                          <Text style={styles.docSinArchivo}>Sin archivo — pendiente de subir</Text>
                        )}

                        {/* Acciones */}
                        <View style={styles.docActions}>
                          {tieneArchivo && (
                            <TouchableOpacity style={styles.docActionBtn} onPress={() => handleVer(doc)}>
                              <Text style={styles.docActionText}>👁 Ver</Text>
                            </TouchableOpacity>
                          )}
                          {!tieneArchivo && (
                            <TouchableOpacity
                              style={[styles.docActionBtn, styles.docActionPrimary]}
                              onPress={() => router.push(`/expedientes/documentos/subir?expedienteId=${exp.id}&tipo=${encodeURIComponent(doc.tipo)}&seccion=${encodeURIComponent(doc.seccion ?? 'otros')}`)}
                            >
                              <Text style={[styles.docActionText, styles.docActionPrimaryText]}>↑ Subir</Text>
                            </TouchableOpacity>
                          )}
                          {/* Reemplazar: disponible siempre que haya archivo (backend lo permite en cualquier estado) */}
                          {tieneArchivo && (
                            <TouchableOpacity style={styles.docActionBtn} onPress={() => handleReemplazar(doc)}>
                              <Text style={styles.docActionText}>🔄 Reemplazar</Text>
                            </TouchableOpacity>
                          )}
                          {/* Eliminar: solo mientras el asesor no lo haya enviado a revisión (estado pendiente) */}
                          {tieneArchivo && esPendiente && (
                            <TouchableOpacity
                              style={[styles.docActionBtn, styles.docActionDanger]}
                              onPress={() => handleEliminar(doc)}
                            >
                              <Text style={[styles.docActionText, styles.docActionDangerText]}>🗑 Eliminar</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        {/* Botón agregar documento adicional */}
        <TouchableOpacity
          style={styles.addDocBtn}
          onPress={() => router.push(`/expedientes/documentos/subir?expedienteId=${exp.id}`)}
          activeOpacity={0.75}
        >
          <Text style={styles.addDocText}>＋ Agregar documento adicional</Text>
        </TouchableOpacity>

        {/* ── Prospecto relacionado ── */}
        {exp.contacto && (
          <>
            <SectionLabel>Prospecto</SectionLabel>

            {/* Encabezado: foto + nombre + link */}
            <TouchableOpacity
              style={styles.prospectoCard}
              onPress={() => router.push(`/prospectos/${exp.contacto!.id}`)}
              activeOpacity={0.75}
            >
              {exp.contacto.foto_url ? (
                <Image source={{ uri: exp.contacto.foto_url }} style={styles.prospectoFoto} />
              ) : (
                <View style={styles.prospectoAvatar}>
                  <Text style={styles.avatarLetter}>
                    {(exp.contacto.nombre?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.prospectoInfo}>
                <Text style={styles.prospectoNombre}>{clienteNombre}</Text>
                <Text style={styles.prospectoSub}>Ver ficha completa →</Text>
              </View>
            </TouchableOpacity>

            {/* Datos de contacto */}
            <View style={styles.card}>
              {exp.contacto.telefono ? (
                <InfoRow label="Teléfono" value={exp.contacto.telefono} />
              ) : null}
              {exp.contacto.email ? (
                <InfoRow label="Correo" value={exp.contacto.email} />
              ) : null}
              {exp.contacto.curp ? (
                <InfoRow label="CURP" value={exp.contacto.curp} />
              ) : null}
              {exp.contacto.nss ? (
                <InfoRow label="NSS" value={exp.contacto.nss} />
              ) : null}
              {exp.contacto.servicio ? (
                <InfoRow label="Servicio" value={exp.contacto.servicio} last />
              ) : (
                <InfoRow label="Servicio" value="—" last />
              )}
            </View>

            {/* Precalificación FOVISSSTE */}
            {exp.contacto.servicio === 'FOVISSSTE' && (
              exp.contacto.estado_uso_credito || exp.contacto.estado_residencia ||
              exp.contacto.regimen_pensionario || exp.contacto.tiene_discapacidad
            ) ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: Spacing.sm }]}>Precalificación FOVISSSTE</Text>
                <View style={styles.card}>
                  {exp.contacto.estado_uso_credito ? (
                    <InfoRow label="Estado (crédito)" value={exp.contacto.estado_uso_credito} />
                  ) : null}
                  {exp.contacto.municipio_uso_credito ? (
                    <InfoRow label="Municipio (crédito)" value={exp.contacto.municipio_uso_credito} />
                  ) : null}
                  {exp.contacto.estado_residencia ? (
                    <InfoRow label="Estado (residencia)" value={exp.contacto.estado_residencia} />
                  ) : null}
                  {exp.contacto.regimen_pensionario ? (
                    <InfoRow
                      label="Régimen"
                      value={exp.contacto.regimen_pensionario === 'decimo_transitorio' ? 'Décimo Transitorio' : 'Cuenta Individual'}
                    />
                  ) : null}
                  <InfoRow
                    label="Discapacidad"
                    value={exp.contacto.tiene_discapacidad ? 'Sí' : 'No'}
                    last
                  />
                </View>
              </>
            ) : null}

            {/* Precalificación INFONAVIT */}
            {exp.contacto.servicio === 'INFONAVIT' && (
              exp.contacto.estado_uso_credito || exp.contacto.municipio_uso_credito
            ) ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: Spacing.sm }]}>Precalificación INFONAVIT</Text>
                <View style={styles.card}>
                  {exp.contacto.estado_uso_credito ? (
                    <InfoRow label="Estado (crédito)" value={exp.contacto.estado_uso_credito} />
                  ) : null}
                  {exp.contacto.municipio_uso_credito ? (
                    <InfoRow label="Municipio (crédito)" value={exp.contacto.municipio_uso_credito} last />
                  ) : null}
                </View>
              </>
            ) : null}

            {/* Captura del simulador / portal */}
            {exp.contacto.simulador_screenshot_url ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: Spacing.sm }]}>
                  {exp.contacto.servicio === 'INFONAVIT' ? 'Captura Mi Cuenta INFONAVIT' : 'Captura del simulador'}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => Linking.openURL(exp.contacto!.simulador_screenshot_url!)}
                  style={styles.screenshotContainer}
                >
                  <Image
                    source={{ uri: exp.contacto.simulador_screenshot_url }}
                    style={styles.screenshotThumb}
                    resizeMode="cover"
                  />
                  <Text style={styles.screenshotHint}>Toca para ver la captura completa</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        )}

        {/* ── Fechas ── */}
        <SectionLabel>Fechas</SectionLabel>
        <View style={styles.card}>
          <InfoRow label="Creado"      value={new Date(exp.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} />
          <InfoRow label="Actualizado" value={new Date(exp.updated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} last />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function TopBar({ title, subtitle, onBack, insetTop, rightElement }: {
  title: string; subtitle?: string; onBack: () => void;
  insetTop: number; rightElement?: React.ReactNode;
}) {
  return (
    <View style={[tb.wrap, { paddingTop: insetTop + 8 }]}>
      <TouchableOpacity style={tb.back} onPress={onBack}>
        <Text style={tb.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={tb.mid}>
        {subtitle ? <Text style={tb.sub}>{subtitle}</Text> : null}
        <Text style={tb.title} numberOfLines={1}>{title}</Text>
      </View>
      <View style={tb.right}>{rightElement ?? <View style={{ width: 60 }} />}</View>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const tb = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.cream[300] },
  back:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.dark[700] },
  mid:      { flex: 1, alignItems: 'center' },
  sub:      { fontSize: 10, color: Colors.dark[400], letterSpacing: 1, textTransform: 'uppercase' },
  title:    { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  right:    { minWidth: 60, alignItems: 'flex-end' },
});

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: Colors.cream[50] },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound:{ textAlign: 'center', color: Colors.dark[400], marginTop: 40 },
  body:    { padding: Spacing.base },

  sectionLabel: {
    fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold,
    color: Colors.dark[500], letterSpacing: 1, textTransform: 'uppercase',
    marginTop: Spacing.base, marginBottom: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.cream[200], overflow: 'hidden',
  },

  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.cream[200] },
  infoLabel:     { fontSize: Typography.fontSize.sm, color: Colors.dark[500], fontWeight: '600', flex: 1 },
  infoValue:     { fontSize: Typography.fontSize.sm, color: Colors.dark[800], flex: 2, textAlign: 'right' },

  // Progreso
  docHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.base, marginBottom: 4 },
  docStats:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  docStatText:{ fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  pendienteBadge:     { backgroundColor: '#fefce8', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  pendienteBadgeText: { fontSize: Typography.fontSize.xs, color: '#a16207', fontWeight: '700' },
  progressBar:  { height: 4, backgroundColor: Colors.cream[200], borderRadius: 2, marginBottom: Spacing.sm },
  progressFill: { height: 4, backgroundColor: '#15803d', borderRadius: 2 },

  // Sección
  seccionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginTop: 4 },
  seccionIcon:   { fontSize: 14 },
  seccionTitle:  { flex: 1, fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark[700], textTransform: 'uppercase', letterSpacing: 0.5 },
  seccionCount:  { fontSize: Typography.fontSize.xs, color: Colors.dark[400], fontWeight: '600' },

  // Documentos
  docRow:    { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  docBorder: { borderTopWidth: 1, borderTopColor: Colors.cream[200] },
  docIconWrap:      { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.cream[100], alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  docIconWrapEmpty: { backgroundColor: Colors.cream[100], borderWidth: 1, borderColor: Colors.cream[300], borderStyle: 'dashed' },
  docIcon:   { fontSize: 16 },
  docInfo:   { flex: 1 },
  docNombreRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' },
  docNombre: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark[800], flex: 1 },
  opcionalTag: { fontSize: 9, color: Colors.dark[400], backgroundColor: Colors.cream[100], paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, fontWeight: '600', marginTop: 2 },
  docDescripcion: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2, fontStyle: 'italic' },
  docEstadoPill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  docEstadoText: { fontSize: Typography.fontSize.xs, fontWeight: '700' },
  docSinArchivo: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2, fontStyle: 'italic' },
  docActions:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  docActionBtn:        { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm, backgroundColor: Colors.cream[100], borderWidth: 1, borderColor: Colors.cream[300] },
  docActionText:       { fontSize: 10, color: Colors.dark[600], fontWeight: '600' },
  docActionPrimary:    { backgroundColor: Colors.gold[50] ?? '#fefce8', borderColor: Colors.gold[400] },
  docActionPrimaryText:{ color: Colors.gold[600] },
  docActionDanger:     { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  docActionDangerText: { color: '#dc2626' },

  emptyDocs: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md },

  addDocBtn:  { marginTop: Spacing.md, backgroundColor: Colors.cream[50], borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.cream[300], borderStyle: 'dashed' },
  addDocText: { color: Colors.gold[600], fontWeight: '700', fontSize: Typography.fontSize.sm },

  prospectoCard:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[200], padding: Spacing.md },
  prospectoFoto:   { width: 44, height: 44, borderRadius: 22 },
  prospectoAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark[800], alignItems: 'center', justifyContent: 'center' },
  avatarLetter:    { color: Colors.gold[400], fontWeight: '700', fontSize: Typography.fontSize.base },
  prospectoInfo:   { flex: 1 },
  prospectoNombre: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark[800] },
  prospectoSub:    { fontSize: Typography.fontSize.xs, color: Colors.gold[600], marginTop: 2 },

  screenshotContainer: { borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cream[200] },
  screenshotThumb:     { width: '100%', height: 180 },
  screenshotHint:      { fontSize: Typography.fontSize.xs, color: Colors.dark[400], textAlign: 'center', paddingVertical: Spacing.xs },

  cacheBanner: {
    backgroundColor:  Colors.dark[800],
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.md,
    marginBottom:      Spacing.sm,
    borderRadius:      Radius.sm,
    borderLeftWidth:   4,
    borderLeftColor:   Colors.gold[400],
  },
  cacheText: { color: Colors.white, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, lineHeight: Typography.fontSize.sm * 1.4 },
});
