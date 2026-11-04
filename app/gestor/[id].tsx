/** Detalle de un encargo del gestor: revisión ✓/✗, espera, trámite y subidas. */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import {
  getEncargo, urlDocumento, enviarRevision, subidasPendientes, esErrorDeRed,
  type EncargoDetalle, type SubidaGestor,
} from '@/src/services/gestorApi';
import { Badge, BadgeEstadoEncargo, fechaCorta, venceInfo } from '@/src/components/gestor/encargoUi';

type Marca = { revision?: 'correcto' | 'incorrecto'; nota: string };

const EVENTOS: Record<string, string> = {
  enviado: 'Encargo recibido', revision_con_observaciones: 'Revisión enviada con observaciones',
  reenviado: 'La administración corrigió y te lo regresó', tramite_iniciado: 'Todo correcto: empezaste el trámite',
  documento_subido: 'Subiste un documento', documento_validado: 'Documento validado',
  documento_rechazado: 'Documento rechazado', terminado: 'Encargo terminado', cancelado: 'Encargo cancelado',
};

const VALIDACION: Record<string, [string, string, string]> = {
  en_revision: ['En revisión', '#dbeafe', '#1d4ed8'],
  validado:    ['Validado', '#dcfce7', '#15803d'],
  rechazado:   ['Rechazado', '#fee2e2', '#b91c1c'],
};

export default function EncargoGestorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const encargoId = Number(id);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [e, setE]                   = useState<EncargoDetalle | null>(null);
  const [pendientes, setPendientes] = useState<SubidaGestor[]>([]);
  const [desdeCache, setDesdeCache] = useState(false);
  const [error, setError]           = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [marcas, setMarcas]         = useState<Record<number, Marca>>({});
  const [enviando, setEnviando]     = useState(false);
  const [verDatos, setVerDatos]     = useState(true);
  const [abriendo, setAbriendo]     = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await getEncargo(encargoId);
      setE(r.data);
      setDesdeCache(r.desdeCache);
      setError('');
      setPendientes(await subidasPendientes(encargoId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el expediente.');
    } finally {
      setRefreshing(false);
    }
  }, [encargoId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const porRevisar = useMemo(() => (e?.documentos ?? []).filter(d => d.revision === 'pendiente'), [e]);
  const listos = porRevisar.every(d => {
    const m = marcas[d.id];
    return m?.revision === 'correcto' || (m?.revision === 'incorrecto' && m.nota.trim().length > 0);
  });
  const hayIncorrectos = porRevisar.some(d => marcas[d.id]?.revision === 'incorrecto');
  const marcados = porRevisar.filter(d => marcas[d.id]?.revision).length;

  const marcar = (docId: number, revision: 'correcto' | 'incorrecto') =>
    setMarcas(m => ({ ...m, [docId]: { nota: m[docId]?.nota ?? '', revision: m[docId]?.revision === revision ? undefined : revision } }));

  async function abrir(docId: number) {
    setAbriendo(docId);
    try {
      const url = await urlDocumento(encargoId, docId);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      Alert.alert(esErrorDeRed(err) ? 'Sin conexión' : 'No se pudo abrir', esErrorDeRed(err) ? 'Para ver el documento necesitas señal.' : (err instanceof Error ? err.message : ''));
    } finally {
      setAbriendo(null);
    }
  }

  async function enviar() {
    if (!e) return;
    setEnviando(true);
    try {
      const nuevo = await enviarRevision(encargoId, porRevisar.map(d => ({
        documento_id: d.id,
        revision: marcas[d.id]!.revision!,
        nota: marcas[d.id]?.revision === 'incorrecto' ? marcas[d.id]!.nota.trim() : undefined,
      })));
      setE(nuevo);
      setMarcas({});
      Alert.alert(
        nuevo.estado === 'en_tramite' ? '¡Listo para tramitar!' : 'Revisión enviada',
        nuevo.estado === 'en_tramite'
          ? 'Avisamos a la administración. Ya puedes subir los documentos que obtengas.'
          : 'Avisamos a la administración. Cuando corrija los documentos te llegará una notificación.',
      );
    } catch (err) {
      Alert.alert(esErrorDeRed(err) ? 'Sin conexión' : 'No se pudo enviar', esErrorDeRed(err) ? 'Para enviar tu revisión necesitas señal. Tus marcas siguen aquí.' : (err instanceof Error ? err.message : ''));
    } finally {
      setEnviando(false);
    }
  }

  const irASubir = (extra: Record<string, string> = {}) =>
    router.push({ pathname: '/gestor/subir', params: { encargoId: String(encargoId), folio: e?.expediente.folio ?? '', ...extra } });

  if (!e) {
    return (
      <View style={[s.flex, { paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} sub="EXPEDIENTE" title="" />
        {error ? (
          <View style={s.center}><Text style={s.muted}>{error}</Text>
            <TouchableOpacity onPress={cargar} style={s.retry}><Text style={s.retryText}>Reintentar</Text></TouchableOpacity></View>
        ) : <ActivityIndicator style={{ marginTop: 60 }} color={Colors.gold[400]} />}
      </View>
    );
  }

  const vence = venceInfo(e.fecha_entrega, e.estado);
  const cambiados = e.documentos.filter(d => d.nuevo && d.revision === 'pendiente').length;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.flex, { paddingTop: insets.top }]}>
        <Header
          onBack={() => router.back()}
          sub={`${e.expediente.folio ?? '#' + e.expediente.id}${e.vuelta > 1 && e.estado === 'por_revisar' ? ` · VUELTA ${e.vuelta}` : ''}`}
          title={e.expediente.acreditado ?? '—'}
          badge={<BadgeEstadoEncargo estado={e.estado} label={e.estado_label} />}
        />

        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={Colors.gold[400]} />}
        >
          {desdeCache && <Aviso icon="cloud-offline-outline" texto="Sin señal · mostrando lo último descargado." tipo="neutro" />}

          {/* Encargo */}
          <View style={s.box}>
            <View style={s.boxHead}>
              <View style={s.row6}><Ionicons name="clipboard-outline" size={16} color={Colors.gold[700]} /><Text style={s.kicker}>ENCARGO</Text></View>
              {vence && <Badge texto={vence.texto} bg={vence.urgente ? '#fee2e2' : Colors.gold[100]} fg={vence.urgente ? '#b91c1c' : Colors.gold[700]} />}
            </View>
            <Text style={s.instr}>{e.instrucciones}</Text>
            <Text style={s.muted}>
              {e.enviado_por ? `Enviado por ${e.enviado_por}` : 'Enviado'}{e.enviado_at ? ` · ${fechaCorta(e.enviado_at)}` : ''}
              {e.expediente.tipo_tramite ? ` · ${e.expediente.tipo_tramite}` : ''}
            </Text>
          </View>

          {/* Aviso según el estado */}
          {e.estado === 'por_revisar' && (
            <Aviso icon={e.vuelta > 1 ? 'refresh' : 'information-circle-outline'} tipo="oro"
              texto={e.vuelta > 1
                ? `La administración cambió ${cambiados || 'algún'} documento${cambiados === 1 ? '' : 's'}. Revísalo${cambiados === 1 ? '' : 's'} para continuar.`
                : 'Antes de tramitar, revisa cada documento: ábrelo y márcalo como correcto o incorrecto. Podrás subir tus documentos cuando todos estén bien.'} />
          )}
          {e.estado === 'con_observaciones' && (
            <View style={[s.box, s.centerBox]}>
              <Ionicons name="hourglass-outline" size={30} color={Colors.gold[700]} />
              <Text style={s.waitTitle}>Le avisamos a la administración</Text>
              <Text style={[s.muted, { textAlign: 'center' }]}>Cuando cambie los documentos te llegará una notificación para que los revises otra vez.</Text>
            </View>
          )}
          {e.estado === 'en_tramite' && <Aviso icon="checkmark-circle" tipo="ok" texto="Todos los documentos están correctos. Ya puedes tramitar y subir lo que obtengas." />}
          {e.estado === 'terminado' && <Aviso icon="trophy-outline" tipo="ok" texto="Encargo terminado: la administración validó todo lo que subiste. ¡Gracias!" />}
          {e.estado === 'cancelado' && <Aviso icon="close-circle-outline" tipo="neutro" texto="La administración canceló este encargo. Ya no tienes que tramitarlo." />}

          {/* Documentos del expediente */}
          <Text style={s.seccion}>
            {e.estado === 'por_revisar' ? `REVISA LOS DOCUMENTOS · ${marcados} DE ${porRevisar.length}` : 'DOCUMENTOS DEL EXPEDIENTE'}
          </Text>
          <View style={s.box0}>
            {e.documentos.map((d, i) => {
              const revisando = e.estado === 'por_revisar' && d.revision === 'pendiente';
              const m = marcas[d.id];
              return (
                <View key={d.id} style={[s.docRow, i > 0 && s.sep, m?.revision === 'incorrecto' && s.docMal, d.nuevo && revisando && s.docNuevo]}>
                  <View style={s.docTop}>
                    <Ionicons name="document-text-outline" size={20} color={Colors.dark[500]} />
                    <View style={{ flex: 1 }}>
                      <View style={s.row6}>
                        <Text style={s.docNombre} numberOfLines={2}>{d.nombre}</Text>
                        {d.nuevo && revisando && <Badge texto="Nuevo" bg={Colors.gold[400]} fg={Colors.dark[900]} />}
                      </View>
                      <TouchableOpacity onPress={() => abrir(d.id)} hitSlop={6} style={s.row6}>
                        {abriendo === d.id ? <ActivityIndicator size="small" color={Colors.gold[700]} /> : <Ionicons name="eye-outline" size={14} color={Colors.gold[700]} />}
                        <Text style={s.ver}>Ver{d.extension ? ` · ${d.extension.toUpperCase()}` : ''}</Text>
                      </TouchableOpacity>
                    </View>
                    {revisando ? (
                      <View style={s.row6}>
                        <TouchableOpacity style={[s.circ, m?.revision === 'correcto' && s.circOk]} onPress={() => marcar(d.id, 'correcto')} accessibilityLabel={`${d.nombre} correcto`}>
                          <Ionicons name="checkmark" size={20} color={m?.revision === 'correcto' ? Colors.white : Colors.dark[400]} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.circ, m?.revision === 'incorrecto' && s.circMal]} onPress={() => marcar(d.id, 'incorrecto')} accessibilityLabel={`${d.nombre} incorrecto`}>
                          <Ionicons name="close" size={20} color={m?.revision === 'incorrecto' ? Colors.white : Colors.dark[400]} />
                        </TouchableOpacity>
                      </View>
                    ) : d.revision === 'correcto' ? (
                      <Badge texto={e.estado === 'por_revisar' ? `Aprobado (vuelta ${d.vuelta})` : 'Correcto'} bg="#dcfce7" fg="#15803d" />
                    ) : d.revision === 'incorrecto' ? (
                      <Badge texto="Incorrecto" bg="#fee2e2" fg="#b91c1c" />
                    ) : null}
                  </View>
                  {revisando && m?.revision === 'incorrecto' && (
                    <TextInput
                      style={s.nota}
                      placeholder="¿Qué está mal? Ej: la INE está vencida"
                      placeholderTextColor={Colors.dark[400]}
                      value={m.nota}
                      onChangeText={t => setMarcas(x => ({ ...x, [d.id]: { ...x[d.id]!, nota: t } }))}
                      multiline
                      maxLength={500}
                    />
                  )}
                  {!revisando && d.revision === 'incorrecto' && d.nota && (
                    <Text style={s.notaMal}>Tu nota: “{d.nota}”</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Lo que subió */}
          {(e.estado === 'en_tramite' || e.estado === 'terminado' || e.subidos.length > 0 || pendientes.length > 0) && (
            <>
              <Text style={s.seccion}>LO QUE HAS SUBIDO</Text>
              <View style={s.box0}>
                {pendientes.map((p, i) => (
                  <View key={`p${i}`} style={[s.docRow, i > 0 && s.sep]}>
                    <View style={s.docTop}>
                      <Ionicons name="cloud-upload-outline" size={20} color={Colors.dark[500]} />
                      <View style={{ flex: 1 }}><Text style={s.docNombre}>{p.tipo}</Text><Text style={s.muted}>Sin señal · se sube solo</Text></View>
                      <Badge texto="Pendiente" bg={Colors.cream[200]} fg={Colors.dark[600]} />
                    </View>
                  </View>
                ))}
                {e.subidos.map((d, i) => {
                  const [t, bg, fg] = VALIDACION[d.validacion] ?? VALIDACION.en_revision;
                  return (
                    <View key={d.id} style={[s.docRow, (i > 0 || pendientes.length > 0) && s.sep]}>
                      <View style={s.docTop}>
                        <Ionicons name={d.extension.startsWith('doc') ? 'document-outline' : 'document-attach-outline'} size={20} color={Colors.dark[500]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.docNombre}>{d.nombre}</Text>
                          <TouchableOpacity onPress={() => abrir(d.id)} hitSlop={6} style={s.row6}>
                            <Ionicons name="eye-outline" size={14} color={Colors.gold[700]} />
                            <Text style={s.ver}>Ver · {fechaCorta(d.subido_at)}</Text>
                          </TouchableOpacity>
                        </View>
                        <Badge texto={t} bg={bg} fg={fg} />
                      </View>
                      {d.validacion === 'rechazado' && (
                        <View style={s.rechazo}>
                          <Text style={s.notaMal}>Administración: “{d.motivo_rechazo}”</Text>
                          {e.estado === 'en_tramite' && (
                            <TouchableOpacity style={s.resubir} onPress={() => irASubir({ reemplazaId: String(d.id), tipo: d.nombre })}>
                              <Ionicons name="refresh" size={14} color={Colors.gold[700]} />
                              <Text style={s.ver}>Volver a subir</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
                {e.subidos.length === 0 && pendientes.length === 0 && (
                  <View style={s.docRow}><Text style={s.muted}>Todavía no subes nada.</Text></View>
                )}
              </View>
            </>
          )}

          {/* Datos del expediente */}
          {e.datos.length > 0 && (
            <>
              <TouchableOpacity style={s.seccionRow} onPress={() => setVerDatos(v => !v)}>
                <Text style={s.seccion}>DATOS DEL EXPEDIENTE</Text>
                <Ionicons name={verDatos ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.dark[400]} />
              </TouchableOpacity>
              {verDatos && e.datos.map(sec => (
                <View key={sec.clave} style={[s.box, { gap: 6 }]}>
                  <Text style={s.kicker}>{sec.titulo.toUpperCase()}</Text>
                  {sec.campos.length === 0 ? <Text style={s.muted}>Sin datos capturados.</Text> : sec.campos.map(c => (
                    <View key={c.label} style={s.campo}>
                      <Text style={s.campoLabel}>{c.label}</Text>
                      <Text style={s.campoValor} selectable>{c.valor}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}

          {/* Historial */}
          {e.historial.length > 0 && (
            <>
              <Text style={s.seccion}>HISTORIAL</Text>
              <View style={s.box0}>
                {e.historial.map((h, i) => (
                  <View key={i} style={[s.hist, i > 0 && s.sep]}>
                    <Text style={s.histText}>{EVENTOS[h.tipo] ?? h.tipo}{h.detalle ? ` — ${h.detalle}` : ''}</Text>
                    <Text style={s.muted}>{fechaCorta(h.fecha)}{h.fecha ? ` ${h.fecha.slice(11, 16)}` : ''}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {/* Pie */}
        <View style={[s.footer, { paddingBottom: insets.bottom + Spacing.sm }]}>
          {e.estado === 'por_revisar' && (
            <>
              <Text style={s.footHint}>
                {!listos ? 'Marca todos los documentos (y escribe por qué si alguno está mal)'
                  : hayIncorrectos ? 'Se avisará a la administración para que lo corrija' : 'Todos correctos'}
              </Text>
              <Boton
                label={hayIncorrectos || !listos ? 'ENVIAR REVISIÓN' : 'TODO CORRECTO · EMPEZAR TRÁMITE'}
                icon={hayIncorrectos || !listos ? 'send' : 'checkmark-circle'}
                disabled={!listos} loading={enviando} onPress={enviar}
              />
            </>
          )}
          {e.estado === 'con_observaciones' && (
            <>
              <Text style={s.footHint}>Podrás subir cuando todos los documentos estén correctos</Text>
              <Boton label="SUBIR DOCUMENTO" icon="lock-closed" disabled onPress={() => {}} />
            </>
          )}
          {e.estado === 'en_tramite' && <Boton label="SUBIR DOCUMENTO" icon="cloud-upload" onPress={() => irASubir()} />}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Header({ onBack, sub, title, badge }: { onBack: () => void; sub: string; title: string; badge?: React.ReactNode }) {
  return (
    <View style={s.header}>
      <View style={s.headerRow}>
        <TouchableOpacity onPress={onBack} hitSlop={10} accessibilityLabel="Atrás"><Ionicons name="arrow-back" size={22} color={Colors.cream[50]} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerSub} numberOfLines={1}>{sub}</Text>
          {!!title && <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>}
        </View>
      </View>
      {badge ? <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>{badge}</View> : null}
    </View>
  );
}

function Aviso({ icon, texto, tipo }: { icon: React.ComponentProps<typeof Ionicons>['name']; texto: string; tipo: 'oro' | 'ok' | 'neutro' }) {
  const [bg, fg, bd] = tipo === 'oro' ? [Colors.gold[50], Colors.gold[700], Colors.gold[100]] : tipo === 'ok' ? ['#dcfce7', '#15803d', '#bbf7d0'] : [Colors.cream[100], Colors.dark[600], Colors.cream[200]];
  return (
    <View style={[s.aviso, { backgroundColor: bg, borderColor: bd }]}>
      <Ionicons name={icon} size={18} color={fg} />
      <Text style={[s.avisoText, { color: fg }]}>{texto}</Text>
    </View>
  );
}

function Boton({ label, icon, onPress, disabled, loading }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <TouchableOpacity style={[s.btn, (disabled || loading) && s.btnOff]} onPress={onPress} disabled={disabled || loading} activeOpacity={0.85}>
      {loading ? <ActivityIndicator color={Colors.dark[900]} /> : (
        <><Ionicons name={icon} size={18} color={disabled ? Colors.dark[400] : Colors.dark[900]} />
          <Text style={[s.btnText, disabled && { color: Colors.dark[400] }]}>{label}</Text></>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: Colors.cream[50] },
  center:     { alignItems: 'center', marginTop: 60, gap: Spacing.md, paddingHorizontal: Spacing.xl },
  header:     { backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerSub:  { fontSize: Typography.fontSize.xs, color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold, letterSpacing: 2 },
  headerTitle:{ fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.black, color: Colors.cream[50] },

  body:       { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  box:        { backgroundColor: Colors.white, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cream[300], padding: Spacing.md, gap: Spacing.xs },
  box0:       { backgroundColor: Colors.white, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cream[300] },
  boxHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  centerBox:  { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  row6:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker:     { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.extrabold, letterSpacing: 1.5, color: Colors.gold[700] },
  instr:      { fontSize: Typography.fontSize.sm, color: Colors.dark[800], lineHeight: Typography.fontSize.sm * 1.45 },
  muted:      { fontSize: Typography.fontSize.xs, color: Colors.dark[400] },
  waitTitle:  { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.extrabold, color: Colors.dark[900] },
  seccion:    { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, letterSpacing: 1.5, color: Colors.dark[400], marginTop: Spacing.sm },
  seccionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  docRow:     { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  sep:        { borderTopWidth: 1, borderTopColor: Colors.cream[200] },
  docMal:     { backgroundColor: '#fef2f2' },
  docNuevo:   { backgroundColor: Colors.gold[50] },
  docTop:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  docNombre:  { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800], flexShrink: 1 },
  ver:        { fontSize: Typography.fontSize.xs, color: Colors.gold[700], fontWeight: Typography.fontWeight.semibold },
  circ:       { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  circOk:     { backgroundColor: Colors.success, borderColor: Colors.success },
  circMal:    { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  nota:       { borderWidth: 1, borderColor: '#fca5a5', backgroundColor: Colors.white, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: Typography.fontSize.sm, color: Colors.dark[800], minHeight: 56, textAlignVertical: 'top' },
  notaMal:    { fontSize: Typography.fontSize.xs, color: '#b91c1c', lineHeight: Typography.fontSize.xs * 1.4 },
  rechazo:    { backgroundColor: '#fef2f2', borderRadius: Radius.sm, padding: Spacing.sm, gap: 6 },
  resubir:    { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },

  campo:      { gap: 1 },
  campoLabel: { fontSize: Typography.fontSize.xs, color: Colors.dark[400] },
  campoValor: { fontSize: Typography.fontSize.sm, color: Colors.dark[800] },
  hist:       { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 2 },
  histText:   { fontSize: Typography.fontSize.sm, color: Colors.dark[700] },

  aviso:      { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.md },
  avisoText:  { flex: 1, fontSize: Typography.fontSize.sm, lineHeight: Typography.fontSize.sm * 1.4 },

  footer:     { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: 6, borderTopWidth: 1, borderTopColor: Colors.cream[300], backgroundColor: Colors.cream[50] },
  footHint:   { fontSize: Typography.fontSize.xs, color: Colors.dark[500], textAlign: 'center' },
  btn:        { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.gold[400], borderRadius: Radius.sm, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  btnOff:     { backgroundColor: Colors.cream[200] },
  btnText:    { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.extrabold, letterSpacing: 0.5, color: Colors.dark[900] },
  retry:      { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.dark[800] },
  retryText:  { color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold },
});
