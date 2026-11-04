/**
 * Primeros pasos — flujo guiado para el acreditado sin expediente.
 * Diseño: primeros-pasos-acreditado.pen (filas Infonavit / Fovissste / No sé y árboles del paso 2).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, Radius } from '@/src/theme';
import { comprimirFoto } from '@/src/utils/comprimirFoto';
import {
  CONTENIDO, NOMBRE_CREDITO, HORARIO_LABEL, NUMERO_PASO, PROGRESO_INICIAL,
  cargarProgreso, guardarProgreso, enviarSolicitud,
  type Paso, type ProgresoPrimerosPasos, type DatosPrimerosPasos, type Horario, type Credito,
} from '@/src/services/primerosPasos';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  visible:      boolean;
  acreditadoId: number;
  telefono?:    string;
  /** 'llamada' = viene de "¿Prefieres que te llamen?" */
  entrada?:     'normal' | 'llamada';
  onClose:      () => void;
  /** La solicitud quedó enviada (o en cola) y el usuario tocó "Ir a Mi Trámite" */
  onTerminado:  () => void;
}

export default function PrimerosPasos({ visible, acreditadoId, telefono, entrada = 'normal', onClose, onTerminado }: Props) {
  const insets = useSafeAreaInsets();
  const [prog, setProg]       = useState<ProgresoPrimerosPasos | null>(null);
  const [sel, setSel]         = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [encolada, setEncolada] = useState(false);
  const [verMensaje, setVerMensaje] = useState(false);
  const [telefonoExtra, setTelefonoExtra] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Cargar avance al abrir
  useEffect(() => {
    if (!visible) return;
    let vivo = true;
    (async () => {
      const guardado = await cargarProgreso(acreditadoId);
      let p = guardado && guardado.paso !== 'listo' ? guardado : PROGRESO_INICIAL;
      if (entrada === 'llamada' && p.paso !== 'llamada') {
        p = { paso: 'llamada', historial: [], datos: { ...p.datos, credito: p.datos.credito ?? 'por_definir' } };
      }
      if (vivo) { setProg(p); setSel(null); setEncolada(false); setVerMensaje(!!p.datos.mensaje); }
    })();
    return () => { vivo = false; };
  }, [visible, acreditadoId, entrada]);

  const actualizar = (p: ProgresoPrimerosPasos) => {
    setProg(p);
    guardarProgreso(acreditadoId, p);
  };

  if (!prog) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={[styles.flex, styles.center]}><ActivityIndicator color={Colors.gold[400]} /></View>
      </Modal>
    );
  }

  const { paso, datos } = prog;
  const credito = datos.credito === 'infonavit' || datos.credito === 'fovissste' ? datos.credito : null;
  const c = credito ? CONTENIDO[credito] : null;

  const ir = (siguiente: Paso, cambios: Partial<DatosPrimerosPasos> = {}) => {
    actualizar({ paso: siguiente, historial: [...prog.historial, paso], datos: { ...datos, ...cambios } });
    setSel(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const setDatos = (cambios: Partial<DatosPrimerosPasos>) => actualizar({ ...prog, datos: { ...datos, ...cambios } });

  const atras = () => {
    if (paso === 'listo') { onTerminado(); return; }
    const h = [...prog.historial];
    const anterior = h.pop();
    if (!anterior) { onClose(); return; }
    actualizar({ ...prog, paso: anterior, historial: h });
    setSel(null);
  };

  const abrir = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor:     Colors.gold[400],
        toolbarColor:      Colors.dark[900],
      });
    } catch {
      Alert.alert('Sin conexión', 'Para abrir el portal necesitas señal. Tu avance queda guardado.');
    }
  };

  const pasoDespuesDeResultado = (): Paso => (c && c.presentaciones.length > 0 ? 'presentaciones' : 'llamada');

  async function elegirCaptura() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Permite el acceso a tus fotos para adjuntar la captura.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (r.canceled || !r.assets?.[0]) return;
    try {
      const foto = await comprimirFoto(r.assets[0].uri, 'captura_precalificacion');
      setDatos({ capturaUri: foto.uri, noPudoPrecalificar: false });
    } catch {
      Alert.alert('Error', 'No se pudo guardar la captura. Intenta de nuevo.');
    }
  }

  async function pedirLlamada() {
    setEnviando(true);
    try {
      const tel = telefonoExtra.trim();
      const d = tel ? { ...datos, mensaje: [datos.mensaje?.trim(), `Teléfono: ${tel}`].filter(Boolean).join('\n') } : datos;
      const r = await enviarSolicitud(d);
      setEncolada(r === 'encolada');
      ir('listo');
    } catch (e: unknown) {
      Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  // ── Pantallas ────────────────────────────────────────────────────────────────

  let titulo = '';
  let subtitulo = '';
  let cuerpo: React.ReactNode = null;
  let pie: React.ReactNode = null;

  switch (paso) {
    case 'credito': {
      titulo = '¿Qué crédito quieres tramitar?';
      subtitulo = 'Elige según dónde trabajas. Si no estás seguro, te ayudamos a saberlo.';
      cuerpo = (
        <>
          <Opcion icon="business-outline" titulo="Infonavit" desc="Trabajas en una empresa privada y cotizas en el IMSS." on={sel === 'infonavit'} onPress={() => setSel('infonavit')} />
          <Opcion icon="library-outline" titulo="Fovissste" desc="Trabajas para el gobierno y cotizas en el ISSSTE." on={sel === 'fovissste'} onPress={() => setSel('fovissste')} />
          <Opcion icon="help-circle-outline" titulo="No sé cuál me toca" desc="Te hacemos una pregunta y lo resolvemos." on={sel === 'nose'} onPress={() => setSel('nose')} />
          <Aviso icon="shield-checkmark-outline" titulo="Es gratis" texto="Registrarte en Infonavit o Fovissste no tiene costo. Consultoría Inmobiliaria es una consultoría privada y no forma parte de esos institutos." />
        </>
      );
      pie = <Primario label="Continuar" disabled={!sel} onPress={() => sel === 'nose' ? ir('donde') : ir('cuenta', { credito: sel as Credito })} />;
      break;
    }

    case 'donde': {
      titulo = '¿Dónde trabajas?';
      subtitulo = 'Con esto sabemos qué instituto te da tu crédito.';
      const resultado = sel === 'privada' ? 'Te corresponde el crédito Infonavit.'
        : sel === 'gobierno' ? 'Te corresponde el crédito Fovissste.'
        : sel === 'propia' ? 'Un asesor te dirá qué opciones tienes.' : null;
      cuerpo = (
        <>
          <Opcion icon="storefront-outline" titulo="En una empresa privada" desc="Te descuentan IMSS en tu recibo de nómina." on={sel === 'privada'} onPress={() => setSel('privada')} />
          <Opcion icon="school-outline" titulo="En gobierno o escuela pública" desc="Dependencias federales o estatales. Te descuentan ISSSTE." on={sel === 'gobierno'} onPress={() => setSel('gobierno')} />
          <Opcion icon="person-outline" titulo="Trabajo por mi cuenta" desc="No cotizo en IMSS ni en ISSSTE." on={sel === 'propia'} onPress={() => setSel('propia')} />
          {resultado && (
            <View style={styles.resultadoRow}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.resultadoText}>{resultado}</Text>
            </View>
          )}
        </>
      );
      pie = (
        <Primario label="Continuar" disabled={!sel} onPress={() => {
          if (sel === 'privada') ir('cuenta', { credito: 'infonavit' });
          else if (sel === 'gobierno') ir('cuenta', { credito: 'fovissste' });
          else ir('llamada', { credito: 'por_definir' });
        }} />
      );
      break;
    }

    case 'cuenta': {
      if (!c) break;
      titulo = c.cuentaTitulo;
      subtitulo = c.cuentaSubtitulo;
      cuerpo = (
        <>
          <Opcion icon="checkmark-done-outline" titulo="Sí, ya tengo cuenta" desc="Vamos directo al simulador." on={sel === 'si'} onPress={() => setSel('si')} />
          <Opcion icon="person-add-outline" titulo="No, todavía no" desc="Te damos los pasos y la liga oficial." on={sel === 'no'} onPress={() => setSel('no')} />
          <Opcion icon="help-circle-outline" titulo="No estoy seguro" desc="Te mostramos cómo revisarlo." on={sel === 'no_se'} onPress={() => setSel('no_se')} />
        </>
      );
      pie = (
        <Primario label="Continuar" disabled={!sel} onPress={() => {
          if (sel === 'si') ir('simulador', { cuenta: 'si', registrado: true });
          else if (sel === 'no') ir('guia', { cuenta: 'no' });
          else ir('verificar', { cuenta: 'no_se' });
        }} />
      );
      break;
    }

    case 'verificar': {
      if (!c) break;
      titulo = '¿Cómo saber si ya tienes cuenta?';
      subtitulo = 'Lo revisas en un minuto en el portal oficial.';
      cuerpo = (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{c.verificarTitulo}</Text>
          <Numerados items={c.pasosVerificar} />
        </View>
      );
      pie = (
        <>
          <Secundario icon="open-outline" label={`Abrir ${c.portalNombre}`} onPress={() => abrir(c.portalUrl)} />
          <Primario label="Sí, tengo cuenta" onPress={() => ir('simulador', { registrado: true })} />
          <Enlace label="No, no tengo cuenta" onPress={() => ir('guia')} />
        </>
      );
      break;
    }

    case 'guia': {
      if (!c) break;
      titulo = c.guiaTitulo;
      subtitulo = c.guiaSubtitulo;
      cuerpo = (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>TEN A LA MANO</Text>
            {c.requisitos.map(r => (
              <View key={r.titulo} style={styles.reqRow}>
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.gold[400]} />
                <View style={styles.flex1}>
                  <Text style={styles.reqTitulo}>{r.titulo}</Text>
                  {r.detalle ? <Text style={styles.reqDetalle}>{r.detalle}</Text> : null}
                </View>
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>PASOS</Text>
            <Numerados items={c.pasosRegistro} />
          </View>
          <Aviso icon="cloud-offline-outline" titulo="Sin señal" texto="Esta guía se puede leer sin internet. Para abrir el portal sí necesitas señal." />
        </>
      );
      pie = (
        <>
          <Secundario icon="open-outline" label={`Abrir ${c.portalNombre}`} onPress={() => abrir(c.portalUrl)} />
          <Primario label="Ya me registré" onPress={() => ir('simulador', { registrado: true })} />
        </>
      );
      break;
    }

    case 'simulador': {
      if (!c) break;
      titulo = c.simuladorTitulo;
      subtitulo = 'El simulador oficial se abre dentro de la app. Cuando termines, ciérralo y regresas aquí.';
      cuerpo = (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{c.simuladorSeccion}</Text>
            <Numerados items={c.pasosSimulador} />
          </View>
          <Aviso icon="wifi-outline" titulo="Necesitas señal" texto={`El simulador es de ${c.nombre} y solo funciona con internet. Si se corta, tu avance aquí queda guardado.`} />
        </>
      );
      pie = (
        <>
          <Primario label="Abrir el simulador" onPress={async () => { await abrir(c.simuladorUrl); ir('resultado'); }} />
          <Enlace label="Ya lo hice, anotar mi resultado" onPress={() => ir('resultado')} />
          <Enlace label="Lo hago después" muted onPress={onClose} />
        </>
      );
      break;
    }

    case 'resultado': {
      if (!c) break;
      titulo = '¿Cuánto te salió?';
      subtitulo = 'Con esto tu asesor te llama sabiendo cuánto te prestan. Todo es opcional.';
      const extra = c.campoExtra;
      cuerpo = (
        <>
          <Campo label="Monto aproximado de crédito" prefijo="$" placeholder="485,000" value={datos.monto ?? ''} onChange={v => setDatos({ monto: v })} />
          <Campo label={extra.label} prefijo={extra.prefijo} placeholder={extra.placeholder} value={datos[extra.key] ?? ''} onChange={v => setDatos({ [extra.key]: v })} />
          <Text style={styles.campoLabel}>Captura del resultado</Text>
          {datos.capturaUri ? (
            <View style={styles.capturaCard}>
              <Image source={{ uri: datos.capturaUri }} style={styles.capturaImg} />
              <View style={styles.flex1}>
                <Text style={styles.reqTitulo}>captura_precalificacion.jpg</Text>
                <Text style={styles.reqDetalle}>Lista para enviar</Text>
                <TouchableOpacity onPress={elegirCaptura}><Text style={styles.enlaceInline}>Cambiar captura</Text></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setDatos({ capturaUri: undefined })} hitSlop={10}>
                <Ionicons name="close-circle" size={22} color={Colors.dark[500]} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.subirCaptura} onPress={elegirCaptura}>
              <Ionicons name="image-outline" size={22} color={Colors.gold[400]} />
              <Text style={styles.subirCapturaText}>Elegir captura de tu galería</Text>
            </TouchableOpacity>
          )}
        </>
      );
      pie = (
        <>
          <Primario label="Guardar y continuar" onPress={() => ir(pasoDespuesDeResultado(), { noPudoPrecalificar: false })} />
          <Enlace label="No pude terminar la precalificación" onPress={() => ir(pasoDespuesDeResultado(), { noPudoPrecalificar: true })} />
        </>
      );
      break;
    }

    case 'presentaciones': {
      if (!c) break;
      titulo = 'Conoce cómo funciona tu crédito';
      subtitulo = `Material sobre el crédito ${c.nombre} preparado por nuestros asesores.`;
      cuerpo = (
        <>
          {c.presentaciones.map(p => (
            <TouchableOpacity key={p.url} style={styles.opcion} onPress={() => abrir(p.url)}>
              <View style={styles.iconBox}><Ionicons name={p.tipo === 'pdf' ? 'document-text-outline' : 'play-circle-outline'} size={22} color={Colors.gold[400]} /></View>
              <View style={styles.flex1}>
                <Text style={styles.opcionTitulo}>{p.titulo}</Text>
                <Text style={styles.opcionDesc}>{p.detalle}</Text>
              </View>
              <Ionicons name="open-outline" size={20} color={Colors.dark[500]} />
            </TouchableOpacity>
          ))}
          <Aviso icon="cellular-outline" titulo="Señal débil" texto="Pesan varios MB (lo ves en cada uno). Ábrelos cuando tengas wifi o buena señal." />
        </>
      );
      pie = (
        <>
          <Primario label="Continuar" onPress={() => ir('llamada')} />
          <Enlace label="Omitir por ahora" muted onPress={() => ir('llamada')} />
        </>
      );
      break;
    }

    case 'llamada': {
      titulo = 'Un asesor te llama';
      subtitulo = 'Revisa tu resumen. Se lo enviamos a tu asesor para que te llame ya con todo listo.';
      const definido = datos.credito === 'infonavit' || datos.credito === 'fovissste';
      const precal = datos.noPudoPrecalificar ? 'No la pude terminar'
        : datos.monto ? `$ ${datos.monto}${datos.puntos ? ` · ${datos.puntos} puntos` : ''}` : 'Sin hacer';
      cuerpo = (
        <>
          <View style={styles.card}>
            <Fila k="Crédito" v={NOMBRE_CREDITO[datos.credito ?? 'por_definir']} />
            <Fila k="Cuenta en el portal" v={!definido ? 'No aplica' : datos.registrado ? 'Creada' : 'Sin crear'} />
            <Fila k="Precalificación" v={definido ? precal : 'Sin hacer'} />
            <Fila k="Captura" v={datos.capturaUri && !datos.noPudoPrecalificar ? 'Adjunta' : 'No'} />
            <Fila k="Teléfono" v={telefono || 'Sin teléfono'} ultima />
          </View>
          {!telefono && (
            <Campo label="¿A qué número te llamamos?" placeholder="10 dígitos" value={telefonoExtra} onChange={setTelefonoExtra} teclado="phone-pad" />
          )}
          <Text style={styles.sectionTitleSuelto}>¿A QUÉ HORA TE LLAMAMOS?</Text>
          <View style={styles.chips}>
            {(Object.keys(HORARIO_LABEL) as Horario[]).map(h => (
              <TouchableOpacity key={h} style={[styles.chip, datos.horario === h && styles.chipOn]} onPress={() => setDatos({ horario: h })}>
                <Text style={[styles.chipText, datos.horario === h && styles.chipTextOn]}>{HORARIO_LABEL[h]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.enlaceRow} onPress={() => setVerMensaje(v => !v)}>
            <Ionicons name={verMensaje ? 'chevron-up-outline' : 'chatbubble-ellipses-outline'} size={16} color={Colors.gold[400]} />
            <Text style={styles.enlaceInline}>{verMensaje ? 'Ocultar mensaje' : 'Agregar un mensaje (opcional)'}</Text>
          </TouchableOpacity>
          {verMensaje && (
            <TextInput
              style={styles.mensajeInput}
              placeholder="Cuéntanos más: municipio, tipo de vivienda…"
              placeholderTextColor={Colors.dark[500]}
              value={datos.mensaje ?? ''}
              onChangeText={v => setDatos({ mensaje: v })}
              multiline
              maxLength={500}
            />
          )}
        </>
      );
      const telInvalido = !telefono && telefonoExtra.replace(/\D/g, '').length < 10;
      pie = <Primario label="Quiero que me llamen" loading={enviando} disabled={telInvalido} onPress={pedirLlamada} />;
      break;
    }

    case 'listo': {
      titulo = '¡Ya estás registrado!';
      subtitulo = datos.credito && datos.credito !== 'por_definir'
        ? `Recibimos tu solicitud de crédito ${NOMBRE_CREDITO[datos.credito]}.`
        : 'Recibimos tu solicitud. Un asesor te dirá qué opciones tienes.';
      const cuando = datos.horario === 'manana' ? 'por la mañana' : datos.horario === 'tarde' ? 'por la tarde' : 'pronto';
      cuerpo = (
        <>
          <View style={[styles.card, styles.guiaCard]}>
            <View style={styles.listoRow}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
              <Text style={styles.listoText}>
                Un asesor te llamará {cuando} para {datos.credito === 'por_definir' ? 'revisar tus opciones de crédito' : 'iniciar tu trámite'}.
              </Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>QUÉ SIGUE</Text>
            <Numerados items={[
              datos.credito === 'por_definir' ? 'Tu asesor te llama y revisa tu situación.' : 'Tu asesor te llama y revisa tu precalificación.',
              'Abre tu expediente con tus datos.',
              'Lo verás aquí mismo, en Mi Trámite.',
            ]} />
          </View>
          {encolada && (
            <Aviso icon="cloud-offline-outline" titulo="Sin señal" texto="Tu solicitud se guardó en el teléfono y se envía sola cuando regrese la señal." />
          )}
        </>
      );
      pie = <Primario label="Ir a Mi Trámite" onPress={onTerminado} />;
      break;
    }
  }

  // Sin crédito definido en un paso que lo necesita (avance viejo/corrupto): reiniciar
  if (!cuerpo) {
    cuerpo = <Text style={styles.subtitulo}>Algo salió mal con tu avance.</Text>;
    pie = <Primario label="Empezar de nuevo" onPress={() => actualizar(PROGRESO_INICIAL)} />;
  }

  const numero = NUMERO_PASO[paso];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={atras}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.flex, { paddingTop: insets.top }]}>
          {/* Barra superior */}
          <View style={styles.topRow}>
            <TouchableOpacity onPress={atras} style={styles.backBtn} hitSlop={8} accessibilityLabel="Atrás">
              <Ionicons name={paso === 'listo' ? 'close' : 'arrow-back'} size={24} color={Colors.cream[50]} />
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Primeros pasos</Text>
            <View style={styles.backBtn} />
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.stepLabel}>{paso === 'listo' ? 'LISTO' : `PASO ${numero} DE 5`}</Text>
            <View style={styles.segmentos}>
              {[1, 2, 3, 4, 5].map(i => (
                <View key={i} style={[styles.segmento, (paso === 'listo' || i <= numero) && styles.segmentoOn]} />
              ))}
            </View>
            <Text style={styles.titulo}>{titulo}</Text>
            <Text style={styles.subtitulo}>{subtitulo}</Text>
            <View style={styles.cuerpo}>{cuerpo}</View>
          </ScrollView>

          <View style={[styles.pie, { paddingBottom: insets.bottom + Spacing.base }]}>{pie}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Piezas ─────────────────────────────────────────────────────────────────────

function Opcion({ icon, titulo, desc, on, onPress }: { icon: IconName; titulo: string; desc: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.opcion, on && styles.opcionOn]} onPress={onPress} activeOpacity={0.8} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <View style={[styles.iconBox, on && styles.iconBoxOn]}>
        <Ionicons name={icon} size={22} color={on ? Colors.dark[900] : Colors.gold[400]} />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.opcionTitulo}>{titulo}</Text>
        <Text style={styles.opcionDesc}>{desc}</Text>
      </View>
      <Ionicons name={on ? 'checkmark-circle' : 'chevron-forward'} size={on ? 22 : 20} color={on ? Colors.gold[400] : Colors.dark[500]} />
    </TouchableOpacity>
  );
}

function Aviso({ icon, titulo, texto }: { icon: IconName; titulo: string; texto: string }) {
  return (
    <View style={[styles.card, styles.guiaCard]}>
      <View style={styles.avisoHeader}>
        <Ionicons name={icon} size={18} color={Colors.gold[400]} />
        <Text style={styles.avisoTitulo}>{titulo}</Text>
      </View>
      <Text style={styles.avisoTexto}>{texto}</Text>
    </View>
  );
}

function Numerados({ items }: { items: string[] }) {
  return (
    <View style={{ gap: Spacing.md }}>
      {items.map((t, i) => (
        <View key={i} style={styles.numRow}>
          <View style={styles.numCirculo}><Text style={styles.numText}>{i + 1}</Text></View>
          <Text style={styles.numItem}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function Fila({ k, v, ultima }: { k: string; v: string; ultima?: boolean }) {
  return (
    <View style={[styles.fila, !ultima && styles.filaBorde]}>
      <Text style={styles.filaK}>{k}</Text>
      <Text style={styles.filaV}>{v}</Text>
    </View>
  );
}

function Campo({ label, value, onChange, placeholder, prefijo, teclado = 'number-pad' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; prefijo?: string;
  teclado?: 'number-pad' | 'phone-pad';
}) {
  const formatear = (v: string) => {
    if (teclado === 'phone-pad') return v.replace(/[^\d ]/g, '');
    const n = v.replace(/\D/g, '');
    return n ? Number(n).toLocaleString('es-MX') : '';
  };
  return (
    <View>
      <Text style={styles.campoLabel}>{label}</Text>
      <View style={styles.campo}>
        {prefijo ? <Text style={styles.campoPrefijo}>{prefijo}</Text> : null}
        <TextInput
          style={styles.campoInput}
          value={value}
          onChangeText={v => onChange(formatear(v))}
          placeholder={placeholder}
          placeholderTextColor={Colors.dark[500]}
          keyboardType={teclado}
          maxLength={teclado === 'phone-pad' ? 14 : 12}
        />
      </View>
    </View>
  );
}

function Primario({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <TouchableOpacity style={[styles.primario, (disabled || loading) && styles.deshabilitado]} onPress={onPress} disabled={disabled || loading} activeOpacity={0.85}>
      {loading ? <ActivityIndicator color={Colors.dark[900]} /> : <Text style={styles.primarioText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function Secundario({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.secundario} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name={icon} size={18} color={Colors.gold[400]} />
      <Text style={styles.secundarioText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Enlace({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  return (
    <TouchableOpacity style={styles.enlace} onPress={onPress} hitSlop={6}>
      <Text style={[styles.enlaceText, muted && { color: Colors.dark[400] }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: Colors.dark[900] },
  flex1:  { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50] },

  content:   { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
  stepLabel: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.gold[400], letterSpacing: 1.5, marginTop: Spacing.sm },
  segmentos: { flexDirection: 'row', gap: 6, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  segmento:  { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.dark[700] },
  segmentoOn:{ backgroundColor: Colors.gold[400] },
  titulo:    { fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  subtitulo: { fontSize: Typography.fontSize.sm, color: Colors.cream[300], lineHeight: Typography.fontSize.sm * 1.5, marginTop: Spacing.sm },
  cuerpo:    { marginTop: Spacing.xl, gap: Spacing.md },

  card:         { backgroundColor: Colors.dark[800], borderRadius: Radius.lg, padding: Spacing.xl },
  guiaCard:     { borderLeftWidth: 3, borderLeftColor: Colors.gold[400] },
  sectionTitle: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[400], letterSpacing: 1.5, marginBottom: Spacing.base },
  sectionTitleSuelto: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[400], letterSpacing: 1.5, marginTop: Spacing.sm },

  opcion:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.dark[800], borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1.5, borderColor: Colors.dark[800] },
  opcionOn:     { borderColor: Colors.gold[400] },
  iconBox:      { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.dark[700], alignItems: 'center', justifyContent: 'center' },
  iconBoxOn:    { backgroundColor: Colors.gold[400] },
  opcionTitulo: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50] },
  opcionDesc:   { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2, lineHeight: Typography.fontSize.xs * 1.4 },

  avisoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  avisoTitulo: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.gold[400] },
  avisoTexto:  { fontSize: Typography.fontSize.sm, color: Colors.cream[300], lineHeight: Typography.fontSize.sm * 1.5 },

  resultadoRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xs },
  resultadoText: { fontSize: Typography.fontSize.sm, color: Colors.cream[200], fontWeight: Typography.fontWeight.medium },

  reqRow:     { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  reqTitulo:  { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.cream[50] },
  reqDetalle: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },

  numRow:     { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  numCirculo: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.dark[700], alignItems: 'center', justifyContent: 'center' },
  numText:    { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.gold[400] },
  numItem:    { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.cream[300], lineHeight: Typography.fontSize.sm * 1.5 },

  campoLabel:   { fontSize: Typography.fontSize.sm, color: Colors.cream[300], marginBottom: Spacing.xs, marginTop: Spacing.xs },
  campo:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark[800], borderRadius: Radius.md, paddingHorizontal: Spacing.base, borderWidth: 1, borderColor: Colors.dark[700] },
  campoPrefijo: { fontSize: Typography.fontSize.lg, color: Colors.dark[400], marginRight: Spacing.xs },
  campoInput:   { flex: 1, fontSize: Typography.fontSize.lg, color: Colors.cream[50], paddingVertical: Spacing.md },

  capturaCard:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.dark[800], borderRadius: Radius.lg, padding: Spacing.md },
  capturaImg:       { width: 56, height: 72, borderRadius: Radius.md, backgroundColor: Colors.dark[700] },
  subirCaptura:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.dark[600], borderRadius: Radius.lg, paddingVertical: Spacing.xl },
  subirCapturaText: { fontSize: Typography.fontSize.sm, color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold },

  fila:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md, gap: Spacing.md },
  filaBorde: { borderBottomWidth: 1, borderBottomColor: Colors.dark[700] },
  filaK:     { fontSize: Typography.fontSize.sm, color: Colors.dark[400] },
  filaV:     { flexShrink: 1, textAlign: 'right', fontSize: Typography.fontSize.sm, color: Colors.cream[50], fontWeight: Typography.fontWeight.semibold },

  chips:      { flexDirection: 'row', gap: Spacing.sm },
  chip:       { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.dark[800], borderWidth: 1.5, borderColor: Colors.dark[800] },
  chipOn:     { borderColor: Colors.gold[400] },
  chipText:   { fontSize: Typography.fontSize.sm, color: Colors.cream[300] },
  chipTextOn: { color: Colors.gold[400], fontWeight: Typography.fontWeight.bold },

  enlaceRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  enlaceInline: { fontSize: Typography.fontSize.sm, color: Colors.gold[400], fontWeight: Typography.fontWeight.semibold, marginTop: 2 },
  mensajeInput: { backgroundColor: Colors.dark[800], borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.dark[700], color: Colors.cream[50], padding: Spacing.base, fontSize: Typography.fontSize.sm, minHeight: 96, textAlignVertical: 'top' },

  listoRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  listoText: { flex: 1, fontSize: Typography.fontSize.base, color: Colors.cream[50], lineHeight: Typography.fontSize.base * 1.4 },

  pie:            { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.dark[800], backgroundColor: Colors.dark[900] },
  primario:       { backgroundColor: Colors.gold[400], borderRadius: Radius.md, paddingVertical: Spacing.base, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  primarioText:   { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  deshabilitado:  { opacity: 0.45 },
  secundario:     { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.dark[800], borderWidth: 1.5, borderColor: Colors.gold[400], borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  secundarioText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.gold[400] },
  enlace:         { alignItems: 'center', paddingVertical: Spacing.sm },
  enlaceText:     { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.gold[400] },
});
