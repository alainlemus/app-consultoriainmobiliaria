/**
 * Super admin → detalle de un encargo a gestor: qué tramita, cómo revisó los
 * documentos, qué subió y el historial. Solo lectura.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import { Badge, BadgeEstadoEncargo, fechaCorta, venceInfo } from '@/src/components/gestor/encargoUi';
import { EVENTOS_ADMIN, getEncargoAdmin, urlDocumentoAdmin, type EncargoAdminDetalle } from '@/src/services/adminGestoresApi';

const VALIDACION: Record<string, [string, string, string]> = {
  en_revision: ['Por validar', '#dbeafe', '#1d4ed8'],
  validado:    ['Validado', '#dcfce7', '#15803d'],
  rechazado:   ['Rechazado', '#fee2e2', '#b91c1c'],
};

const fechaHora = (iso: string | null) => (iso ? `${fechaCorta(iso)} ${new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}` : '');

export default function AdminEncargoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const encargoId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [e, setE]             = useState<EncargoAdminDetalle | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [refrescando, setRef] = useState(false);
  const [abriendo, setAbriendo] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try { setE(await getEncargoAdmin(encargoId)); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar.'); }
    finally { setRef(false); }
  }, [encargoId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function abrir(docId: number) {
    setAbriendo(docId);
    try { await WebBrowser.openBrowserAsync(await urlDocumentoAdmin(encargoId, docId)); }
    catch { setError('No se pudo abrir el documento.'); }
    finally { setAbriendo(null); }
  }

  const header = (
    <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Atrás"><Ionicons name="arrow-back" size={22} color={Colors.cream[50]} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerSub} numberOfLines={1}>{e ? `${e.expediente.folio ?? '#' + e.expediente.id} · ${e.gestor?.nombre ?? 'GESTOR'}`.toUpperCase() : 'GESTOR'}</Text>
          {e ? <Text style={s.headerTitle} numberOfLines={1}>{e.expediente.acreditado ?? '—'}</Text> : null}
        </View>
      </View>
      {e ? <View style={{ marginTop: 6, alignSelf: 'flex-start' }}><BadgeEstadoEncargo estado={e.estado} label={e.estado_label} /></View> : null}
    </View>
  );

  if (!e) {
    return (
      <View style={s.flex}>
        {header}
        {error ? (
          <View style={s.center}><Text style={s.muted}>{error}</Text>
            <TouchableOpacity onPress={cargar} style={s.retry}><Text style={s.retryText}>Reintentar</Text></TouchableOpacity></View>
        ) : <ActivityIndicator style={{ marginTop: 60 }} color={Colors.gold[400]} />}
      </View>
    );
  }

  const vence = venceInfo(e.fecha_entrega, e.estado);
  const incorrectos = e.documentos.filter(d => d.revision === 'incorrecto').length;

  return (
    <View style={s.flex}>
      {header}
      <ScrollView contentContainerStyle={s.body} refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRef(true); cargar(); }} tintColor={Colors.gold[400]} />}>
        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.box}>
          <View style={s.boxHead}>
            <View style={s.row6}><Ionicons name="clipboard-outline" size={16} color={Colors.gold[700]} /><Text style={s.kicker}>ENCARGO</Text></View>
            {vence && <Badge texto={vence.texto} bg={vence.urgente ? '#fee2e2' : Colors.gold[100]} fg={vence.urgente ? '#b91c1c' : Colors.gold[700]} />}
          </View>
          <Text style={s.instr}>{e.instrucciones}</Text>
          <Text style={s.muted}>
            {e.enviado_por ? `Enviado por ${e.enviado_por}` : 'Enviado'}{e.enviado_at ? ` · ${fechaCorta(e.enviado_at)}` : ''}
            {e.expediente.tipo_tramite ? ` · ${e.expediente.tipo_tramite}` : ''}{e.vuelta > 1 ? ` · vuelta ${e.vuelta}` : ''}
          </Text>
        </View>

        {e.estado === 'con_observaciones' ? (
          <View style={[s.aviso, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
            <Ionicons name="alert-circle-outline" size={18} color="#b91c1c" />
            <Text style={[s.avisoText, { color: '#b91c1c' }]}>El gestor marcó {incorrectos} documento{incorrectos === 1 ? '' : 's'} como incorrecto{incorrectos === 1 ? '' : 's'}. Corrígelo{incorrectos === 1 ? '' : 's'} y reenvía desde el panel web.</Text>
          </View>
        ) : e.estado === 'por_validar' ? (
          <View style={[s.aviso, { backgroundColor: Colors.gold[50], borderColor: Colors.gold[100] }]}>
            <Ionicons name="hourglass-outline" size={18} color={Colors.gold[700]} />
            <Text style={[s.avisoText, { color: Colors.gold[700] }]}>El gestor avisó que terminó. Valida lo que subió en los documentos del expediente.</Text>
          </View>
        ) : null}

        <Text style={s.seccion}>DOCUMENTOS COMPARTIDOS · REVISIÓN DEL GESTOR</Text>
        <View style={s.box0}>
          {e.documentos.map((d, i) => (
            <View key={d.id} style={[s.docRow, i > 0 && s.sep, d.revision === 'incorrecto' && s.docMal]}>
              <View style={s.docTop}>
                <Ionicons name="document-text-outline" size={20} color={Colors.dark[500]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.docNombre} numberOfLines={2}>{d.nombre}</Text>
                  <TouchableOpacity onPress={() => abrir(d.id)} hitSlop={6} style={s.row6}>
                    {abriendo === d.id ? <ActivityIndicator size="small" color={Colors.gold[700]} /> : <Ionicons name="eye-outline" size={14} color={Colors.gold[700]} />}
                    <Text style={s.ver}>Ver{d.extension ? ` · ${d.extension.toUpperCase()}` : ''}</Text>
                  </TouchableOpacity>
                </View>
                {d.revision === 'correcto' ? <Badge texto="Correcto" bg="#dcfce7" fg="#15803d" />
                  : d.revision === 'incorrecto' ? <Badge texto="Incorrecto" bg="#fee2e2" fg="#b91c1c" />
                  : <Badge texto="Sin revisar" bg={Colors.cream[200]} fg={Colors.dark[600]} />}
              </View>
              {d.revision === 'incorrecto' && d.nota ? <Text style={s.notaMal}>Nota del gestor: “{d.nota}”</Text> : null}
            </View>
          ))}
          {e.documentos.length === 0 ? <View style={s.docRow}><Text style={s.muted}>No se compartieron documentos.</Text></View> : null}
        </View>

        <Text style={s.seccion}>LO QUE SUBIÓ EL GESTOR</Text>
        <View style={s.box0}>
          {e.subidos.map((d, i) => {
            const [t, bg, fg] = VALIDACION[d.validacion] ?? VALIDACION.en_revision;
            return (
              <View key={d.id} style={[s.docRow, i > 0 && s.sep]}>
                <View style={s.docTop}>
                  <Ionicons name="document-attach-outline" size={20} color={Colors.dark[500]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.docNombre}>{d.nombre}</Text>
                    <TouchableOpacity onPress={() => abrir(d.id)} hitSlop={6} style={s.row6}>
                      {abriendo === d.id ? <ActivityIndicator size="small" color={Colors.gold[700]} /> : <Ionicons name="eye-outline" size={14} color={Colors.gold[700]} />}
                      <Text style={s.ver}>Ver · {fechaCorta(d.subido_at)}</Text>
                    </TouchableOpacity>
                  </View>
                  <Badge texto={t} bg={bg} fg={fg} />
                </View>
                {d.notas ? <Text style={s.muted}>“{d.notas}”</Text> : null}
                {d.validacion === 'rechazado' && d.motivo_rechazo ? <Text style={s.notaMal}>Rechazado: “{d.motivo_rechazo}”</Text> : null}
              </View>
            );
          })}
          {e.subidos.length === 0 ? <View style={s.docRow}><Text style={s.muted}>Todavía no sube nada.</Text></View> : null}
        </View>

        {e.historial.length > 0 ? (
          <>
            <Text style={s.seccion}>HISTORIAL</Text>
            <View style={s.box0}>
              {[...e.historial].reverse().map((h, i) => (
                <View key={i} style={[s.hist, i > 0 && s.sep]}>
                  <Text style={s.histText}>{EVENTOS_ADMIN[h.tipo] ?? h.tipo}{h.detalle ? ` — ${h.detalle}` : ''}</Text>
                  <Text style={s.muted}>{[h.por, fechaHora(h.fecha)].filter(Boolean).join(' · ')}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <TouchableOpacity style={s.expBtn} onPress={() => router.push(`/expedientes/${e.expediente.id}`)}>
          <Ionicons name="folder-open-outline" size={18} color={Colors.dark[900]} />
          <Text style={s.expBtnText}>Abrir expediente</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.dark[700]} />
        </TouchableOpacity>
        <Text style={[s.muted, { textAlign: 'center' }]}>Para enviar, corregir o cancelar usa el panel web.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: Colors.cream[50] },
  center:      { alignItems: 'center', marginTop: 60, gap: Spacing.md, paddingHorizontal: Spacing.xl },
  retry:       { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.gold[400] },
  retryText:   { fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  header:      { backgroundColor: Colors.dark[900], paddingHorizontal: Spacing.base, paddingBottom: Spacing.md },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerSub:   { fontSize: Typography.fontSize.xs, color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold, letterSpacing: 2 },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.black, color: Colors.cream[50] },
  body:        { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  error:       { color: '#b91c1c', fontSize: Typography.fontSize.sm },
  box:         { backgroundColor: Colors.white, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cream[300], padding: Spacing.md, gap: Spacing.xs },
  box0:        { backgroundColor: Colors.white, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.cream[300] },
  boxHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row6:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker:      { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.extrabold, letterSpacing: 1.5, color: Colors.gold[700] },
  instr:       { fontSize: Typography.fontSize.sm, color: Colors.dark[800], lineHeight: Typography.fontSize.sm * 1.45 },
  muted:       { fontSize: Typography.fontSize.xs, color: Colors.dark[400] },
  seccion:     { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, letterSpacing: 1.5, color: Colors.dark[400], marginTop: Spacing.sm },
  docRow:      { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  sep:         { borderTopWidth: 1, borderTopColor: Colors.cream[200] },
  docMal:      { backgroundColor: '#fef2f2' },
  docTop:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  docNombre:   { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800], flexShrink: 1 },
  ver:         { fontSize: Typography.fontSize.xs, color: Colors.gold[700], fontWeight: Typography.fontWeight.semibold },
  notaMal:     { fontSize: Typography.fontSize.xs, color: '#b91c1c', lineHeight: Typography.fontSize.xs * 1.4 },
  hist:        { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 2 },
  histText:    { fontSize: Typography.fontSize.sm, color: Colors.dark[700] },
  aviso:       { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.md },
  avisoText:   { flex: 1, fontSize: Typography.fontSize.sm, lineHeight: Typography.fontSize.sm * 1.4 },
  expBtn:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.gold[400], borderRadius: Radius.sm, padding: Spacing.md, marginTop: Spacing.md },
  expBtnText:  { flex: 1, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], fontSize: Typography.fontSize.sm },
});
