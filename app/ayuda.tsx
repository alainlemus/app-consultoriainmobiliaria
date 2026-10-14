import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, StatusBar, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../src/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Paso {
  icono: string;
  titulo: string;
  desc: string;
}

interface Seccion {
  id: string;
  icono: string;
  titulo: string;
  subtitulo: string;
  pasos: Paso[];
}

const SECCIONES: Seccion[] = [
  {
    id: 'novedades',
    icono: 'sparkles',
    titulo: 'Novedades',
    subtitulo: 'Lo nuevo y lo que ya no está',
    pasos: [
      { icono: 'folder', titulo: 'Nuevo: Expedientes con documentos', desc: 'Cuando un prospecto se vuelve cliente abres su expediente y ahí escaneas o subes sus documentos. La pestaña Expedientes muestra cuántos documentos tiene cada cliente.' },
      { icono: 'alert-circle', titulo: 'Nuevo: Requisitos antes de subir', desc: 'Al elegir el tipo de documento ves qué debe cumplir (vigencia, últimos 3 talones, no mayor a 3 meses…) y, antes de subirlo, te pedimos confirmar que lo revisaste.' },
      { icono: 'shield-checkmark', titulo: 'Nuevo: Validación de documentos', desc: 'Cada documento aparece En revisión, Validado o Rechazado (con el motivo). Solo un administrador valida o rechaza.' },
      { icono: 'notifications', titulo: 'Nuevo: Avisos de validación', desc: 'Cuando un administrador valida (o rechaza) un documento, el asesor recibe una notificación con el documento y el expediente. Si valida todos los documentos del expediente, llega otro aviso: "Expediente completo".' },
      { icono: 'mail', titulo: 'Nuevo: Carpeta por correo (administrador)', desc: 'En un expediente, el administrador toca "Enviar carpeta a mi correo" y recibe un enlace de 72 horas para descargar en su computadora el ZIP con todos los documentos.' },
      { icono: 'eye-off', titulo: 'Nuevo: Expedientes completos', desc: 'Cuando todos los documentos de un expediente están validados, deja de aparecer en la app. Se sigue consultando en el panel.' },
      { icono: 'pricetag', titulo: 'Nuevo: Varios del mismo tipo', desc: 'Puedes subir más de un documento del mismo tipo (por ejemplo la INE del acreditado y la del dueño de la casa). La nota que escribas los identifica rápido.' },
      { icono: 'navigate', titulo: 'Nuevo: Ruta', desc: 'El rastreo ahora se llama Ruta: al activarla te explicamos qué va a pasar. La pantalla Mi ruta se renovó con resumen, mapa y línea de tiempo del recorrido.' },
      { icono: 'checkmark-circle', titulo: 'Nuevo: Aviso al guardar', desc: 'Al guardar un prospecto aparece un aviso que te dice si se guardó en el servidor o en tu teléfono (si no tienes internet).' },
      { icono: 'document-text', titulo: 'Nuevo: Contratos para todos', desc: 'Ahora todos los asesores pueden generar contratos desde Inicio → Contratos. Ven su propio historial; el administrador ve todos.' },
      { icono: 'close-circle', titulo: 'Ya no está: Comisiones', desc: 'Se quitó la pestaña Comisiones y sus avisos. En Perfil ya no se piden banco ni CLABE.' },
      { icono: 'close-circle', titulo: 'Ya no está: Estado y etapas', desc: 'Los expedientes ya no tienen estado, etapas ni lista de documentos obligatorios por sección: solo los documentos que subes.' },
      { icono: 'close-circle', titulo: 'Ya no está: Foto y escuela', desc: 'Al registrar un prospecto ya no se pide foto ni escuela, y los expedientes no llevan foto.' },
    ],
  },
  {
    id: 'inicio',
    icono: 'rocket',
    titulo: 'Primeros pasos',
    subtitulo: 'Cómo moverte en la app',
    pasos: [
      { icono: 'lock-closed', titulo: 'Inicia sesión', desc: 'Usa el correo y contraseña que te dio tu administrador. Si la olvidaste, pídele que la restablezca.' },
      { icono: 'apps', titulo: 'Las 4 pestañas', desc: 'Inicio (resumen y acciones), Prospectos (personas que estás evaluando), Expedientes (clientes con sus documentos) y Perfil.' },
      { icono: 'home', titulo: 'Inicio', desc: 'Muestra cuántos prospectos y expedientes tienes (tócalos para abrirlos), el botón Nuevo prospecto, Contratos, el Mapa, las Rutas y el interruptor de Ruta.' },
      { icono: 'person', titulo: 'Perfil', desc: 'Ahí editas tu nombre y teléfono, cambias tu foto de perfil, ves esta guía y cierras sesión.' },
    ],
  },
  {
    id: 'prospectos',
    icono: 'people',
    titulo: 'Prospectos',
    subtitulo: 'Personas que estás evaluando',
    pasos: [
      { icono: 'person-add', titulo: 'Agregar un prospecto', desc: 'En Inicio toca Nuevo prospecto (o ＋ Nuevo en la pestaña Prospectos). Solo el nombre es obligatorio; teléfono, correo y notas ayudan a darle seguimiento.' },
      { icono: 'create', titulo: 'Campos de texto y listas', desc: 'Los campos de texto son cajas blancas con borde: tocas y escribes. Las listas tienen una flecha ▾ a la derecha: tocas y eliges una opción. Los botones redondos (como el régimen pensionario) se eligen de uno en uno.' },
      { icono: 'list', titulo: 'Datos opcionales', desc: 'Debajo hay campos opcionales siempre visibles: estado del prospecto, CURP, precalificación FOVISSSTE (estado y municipio donde usará el crédito, estado de residencia, régimen pensionario, discapacidad) y la captura del simulador.' },
      { icono: 'checkmark-circle', titulo: 'Aviso al guardar', desc: 'Al guardar sale un aviso: "El prospecto se guardó correctamente" si hay internet, o "Se guardó en tu dispositivo…" si no lo hay. Toca Aceptar para volver a la lista.' },
      { icono: 'refresh', titulo: 'Estado del prospecto', desc: 'Desde su detalle cambia entre Nuevo y Precalificado. Los estados avanzados los lleva el administrador.' },
      { icono: 'folder-open', titulo: 'Pasar a cliente', desc: 'Cuando se confirma como cliente, entra a su detalle y toca Iniciar expediente: pasa a la pestaña Expedientes y deja de aparecer en Prospectos.' },
    ],
  },
  {
    id: 'expedientes',
    icono: 'folder',
    titulo: 'Expedientes',
    subtitulo: 'Tus clientes y sus documentos',
    pasos: [
      { icono: 'clipboard', titulo: 'Tu lista de expedientes', desc: 'Cada tarjeta muestra el nombre del cliente, el folio, el trámite y cuántos documentos tiene. Toca una para abrirla. El administrador puede filtrar por asesor.' },
      { icono: 'call', titulo: 'Datos del cliente', desc: 'Arriba del expediente ves su nombre, folio, teléfono, correo y CURP. Ya no hay foto del cliente.' },
      { icono: 'git-network', titulo: 'Sin etapas ni estado', desc: 'El expediente ya no avanza por etapas: tu trabajo es subir bien los documentos y el equipo del panel los revisa y captura.' },
      { icono: 'checkmark-done-circle', titulo: 'Expedientes completos', desc: 'Cuando el administrador valida todos los documentos, recibes el aviso "Expediente completo" y ese expediente ya no se muestra en la app; sigue disponible en el panel.' },
    ],
  },
  {
    id: 'documentos',
    icono: 'document-text',
    titulo: 'Documentos',
    subtitulo: 'Escanear, subir y validar',
    pasos: [
      { icono: 'scan', titulo: 'Agregar un documento', desc: 'En el expediente toca Escanear o subir documento. Elige el tipo: INE, CURP, acta de nacimiento, acta de matrimonio, comprobante de domicilio, talón de pago, constancia laboral, constancia de situación fiscal, estado de cuenta u otro.' },
      { icono: 'alert-circle', titulo: 'Revisa los requisitos', desc: 'Al elegir el tipo aparece un recuadro con lo que debe cumplir. Ejemplos: estado de cuenta, constancias y comprobante de domicilio no mayores a 3 meses; los últimos 3 talones de pago; INE vigente por ambos lados.' },
      { icono: 'camera', titulo: 'Escanear o subir archivo', desc: 'Escanear documento usa la cámara (varias páginas se unen en un PDF; requiere el build de producción). Archivo adjunta un PDF o una foto de tu galería.' },
      { icono: 'pricetag', titulo: 'Nota para identificarlo', desc: 'Escribe una nota corta, por ejemplo "INE del dueño de la casa". Puedes subir varios documentos del mismo tipo y la nota aparece como etiqueta dorada para reconocer cada uno al instante.' },
      { icono: 'warning', titulo: 'Confirma antes de subir', desc: 'Al tocar Subir documento sale un aviso con los requisitos de ese tipo. Si cumple, toca Sí, cumple; si no, Revisar de nuevo. Así evitamos subir documentos vencidos o ilegibles.' },
      { icono: 'shield-checkmark', titulo: 'Estado de cada documento', desc: 'En revisión: recién subido. Validado: un administrador lo aprobó. Rechazado: aparece el motivo en rojo; usa Reemplazar para subir el correcto.' },
      { icono: 'notifications', titulo: 'Avisos', desc: 'Al subir documentos, los administradores reciben una notificación. Al validarlos, el asesor recibe la suya, y otra más cuando el expediente queda completo (todos sus documentos validados).' },
      { icono: 'mail', titulo: 'Carpeta por correo', desc: 'Solo el administrador ve en el expediente el botón Enviar carpeta a mi correo: genera la carpeta con todos los documentos y manda un enlace (72 horas) para descargarla en su computadora.' },
      { icono: 'person-circle', titulo: 'Solo el administrador valida', desc: 'Validar y Rechazar solo aparecen con una cuenta de administrador (también se hace desde el panel). Los asesores ven el resultado pero no pueden cambiarlo.' },
      { icono: 'swap-horizontal', titulo: 'Ver, reemplazar o eliminar', desc: 'Cada documento tiene tres botones: Ver (se abre con un enlace temporal de 5 minutos), Reemplazar (sube otro archivo y vuelve a quedar En revisión; requiere internet) y Eliminar (pide confirmación).' },
    ],
  },
  {
    id: 'contratos',
    icono: 'create',
    titulo: 'Contratos',
    subtitulo: 'Todos los asesores pueden generarlos',
    pasos: [
      { icono: 'id-card', titulo: 'Registrar contrato', desc: 'Desde Inicio → Contratos → Registrar contrato (disponible para todos los asesores). Escanea la INE del acreditado (y del obligado solidario si aplica) para leer sus datos automáticamente.' },
      { icono: 'eye', titulo: 'Revisar datos', desc: 'Confirma que los datos leídos de la INE sean correctos antes de continuar. Puedes corregirlos a mano.' },
      { icono: 'help-circle', titulo: 'Foto o a mano', desc: 'Al empezar se abre un aviso con ejemplo: puedes subir los datos con foto de la INE o capturarlos a mano. Usa la credencial original (no una fotocopia) y céntrala completa en el cuadro de la cámara. Lo vuelves a ver con "¿Cómo tomar la foto?".' },
      { icono: 'document-text', titulo: 'Generar el PDF', desc: 'Elige el tipo de trámite y el tamaño de hoja, y toca Generar contrato. Queda en el historial de Contratos para consultarlo o compartirlo.' },
      { icono: 'document-text', titulo: 'Pagaré', desc: 'Al terminar el contrato aparecen los botones del pagaré para verlo, imprimirlo o compartirlo. Ya lleva los datos del acreditado y la fecha; el importe y el vencimiento se llenan a mano.' },
      { icono: 'cloud-offline', titulo: 'Funciona sin conexión', desc: 'Puedes registrar contratos sin internet; se guardan en tu dispositivo y se suben al recuperar la señal.' },
      { icono: 'people', titulo: 'Quién los ve', desc: 'Cada asesor ve en su historial los contratos que generó; el administrador ve todos. Solo el administrador puede editar el texto de la plantilla.' },
    ],
  },
  {
    id: 'offline',
    icono: 'cellular',
    titulo: 'Modo sin internet',
    subtitulo: 'La app funciona aunque no tengas señal',
    pasos: [
      { icono: 'cloud-offline', titulo: 'Barra de estado', desc: 'Arriba verás una barra cuando no hay conexión ("Sin internet · Modo offline") o cuando hay algo por sincronizar. Si no hay barra, todo está al día.' },
      { icono: 'phone-portrait', titulo: 'Datos guardados', desc: 'Sin conexión, las listas muestran lo que viste la última vez, con el aviso "Datos guardados en el dispositivo".' },
      { icono: 'create', titulo: 'Crear sin conexión', desc: 'Puedes registrar prospectos, visitas, anuncios y subir documentos. Se guardan en tu teléfono, te lo avisamos con un mensaje y se envían solos al volver la señal.' },
      { icono: 'swap-horizontal', titulo: 'Lo que sí necesita internet', desc: 'Abrir o ver documentos ya cargados, reemplazarlos, validarlos y rechazarlos requieren conexión.' },
      { icono: 'flash', titulo: 'Sincronización automática', desc: 'Al recuperar internet la app envía todo lo pendiente. También puedes tocar la barra para sincronizar a mano.' },
    ],
  },
  {
    id: 'mapa',
    icono: 'map',
    titulo: 'Mapa de Visitas',
    subtitulo: 'Documenta tu actividad en campo',
    pasos: [
      { icono: 'location', titulo: 'Registrar visita', desc: 'En el Mapa toca Registrar visita. La app detecta tu ubicación. Agrega notas y, si quieres, fotos de la galería.' },
      { icono: 'home', titulo: 'Tipo: Cliente', desc: 'Para visitar a un prospecto. Puedes vincular la visita a un contacto para que el administrador vea su historial.' },
      { icono: 'business', titulo: 'Tipo: Propiedad', desc: 'Para un inmueble en evaluación: escribe el nombre o dirección para identificarlo en el mapa.' },
      { icono: 'school', titulo: 'Tipo: Escuela', desc: 'Para visitas a escuelas o instituciones (ferias, presentaciones).' },
      { icono: 'cloud-offline', titulo: 'Funciona offline', desc: 'Las visitas sin señal se guardan y se sincronizan al recuperar internet.' },
    ],
  },
  {
    id: 'anuncios',
    icono: 'megaphone',
    titulo: 'Anuncios publicitarios',
    subtitulo: 'La propaganda que colocas en campo',
    pasos: [
      { icono: 'megaphone', titulo: 'Registrar anuncio', desc: 'Desde el Mapa toca el botón del megáfono. Elige el tipo (lona, hoja en tienda, hoja en poste, volante u otro), la fecha y una descripción opcional.' },
      { icono: 'camera', titulo: 'Fotos del anuncio', desc: 'Hasta 3 fotos con la cámara o la galería; se comprimen y se suben solas en segundo plano.' },
      { icono: 'location', titulo: 'Ubicación automática', desc: 'Al guardar se registra tu ubicación actual como el lugar del anuncio: asegúrate de estar frente a él.' },
      { icono: 'map', titulo: 'Verlos en el mapa', desc: 'Usa el chip Anuncios del Mapa para mostrarlos u ocultarlos. Toca uno para ver su detalle o marcarlo como retirado.' },
    ],
  },
  {
    id: 'rutas',
    icono: 'navigate',
    titulo: 'Ruta',
    subtitulo: 'Tu recorrido del día',
    pasos: [
      { icono: 'power', titulo: 'Activar la ruta', desc: 'En Inicio activa el interruptor Ruta. Antes te mostramos un aviso que explica qué va a pasar: se guarda tu recorrido con tu ubicación (también en segundo plano), tu administrador lo ve en el mapa, puede gastar más batería y puedes apagarla cuando quieras.' },
      { icono: 'alarm', titulo: 'No olvides apagarla', desc: 'Si dejas la ruta activa, a las 7 pm y a las 9 pm te llega un aviso para desactivarla. Si sigue activa pasadas las 10 pm, se desactiva sola al abrir la app.' },
      { icono: 'lock-open', titulo: 'Permiso de ubicación', desc: 'Tu teléfono te pedirá permiso. Elige "Permitir siempre" para que la ruta no se corte al cerrar la pantalla.' },
      { icono: 'map', titulo: 'Mi ruta', desc: 'Toca Rutas en Inicio para ver el día que elijas: arriba un resumen (puntos, distancia aproximada y horario), el mapa con tu trazo y, abajo, la línea de tiempo de tus paradas.' },
      { icono: 'cloud-offline', titulo: 'Puntos pendientes', desc: 'Si no hay señal, los puntos se guardan y se envían solos al recuperarla; en Inicio ves cuántos faltan.' },
      { icono: 'people', titulo: 'Administradores', desc: 'Pueden elegir un asesor (o Todos) para ver sus recorridos, cada uno con su color.' },
    ],
  },
  {
    id: 'perfil',
    icono: 'person',
    titulo: 'Mi Perfil',
    subtitulo: 'Tu información',
    pasos: [
      { icono: 'create', titulo: 'Editar datos', desc: 'Toca Editar para cambiar tu nombre y teléfono, y Guardar al terminar. Ya no se piden banco ni CLABE.' },
      { icono: 'camera', titulo: 'Foto de perfil', desc: 'Toca tu foto y elige Tomar selfie para actualizarla.' },
      { icono: 'help-circle', titulo: 'Esta guía', desc: 'En Perfil puedes volver a abrir esta guía de uso cuando quieras.' },
      { icono: 'log-out', titulo: 'Cerrar sesión', desc: 'Al final de Perfil está el botón Cerrar sesión.' },
    ],
  },
];

export default function AyudaScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAbiertos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark[900]} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.dark[700]} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Centro de Ayuda</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={styles.banner}>
          <Ionicons name="help-circle" size={40} color={Colors.gold[400]} />
          <View style={styles.bannerTexto}>
            <Text style={styles.bannerTitulo}>Guía de uso</Text>
            <Text style={styles.bannerSub}>Toca cada sección para ver los pasos detallados.</Text>
          </View>
        </View>

        {/* Secciones */}
        {SECCIONES.map(s => (
          <View key={s.id} style={styles.seccion}>
            <TouchableOpacity
              style={styles.seccionHeader}
              onPress={() => toggle(s.id)}
              activeOpacity={0.7}
            >
              <View style={styles.seccionLeft}>
                <Ionicons name={s.icono as IconName} size={26} color={Colors.gold[400]} />
                <View>
                  <Text style={styles.seccionTitulo}>{s.titulo}</Text>
                  <Text style={styles.seccionSub}>{s.subtitulo}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.dark[400]} />
            </TouchableOpacity>

            {abiertos[s.id] && (
              <View style={styles.pasos}>
                {s.pasos.map((p, i) => (
                  <View key={i} style={styles.paso}>
                    <View style={styles.pasoBadge}>
                      <Ionicons name={p.icono as IconName} size={22} color={Colors.gold[400]} />
                    </View>
                    <View style={styles.pasoTexto}>
                      <View style={styles.pasoTituloRow}>
                        <View style={styles.pasoNumPill}>
                          <Text style={styles.pasoNum}>{i + 1}</Text>
                        </View>
                        <Text style={styles.pasoTitulo}>{p.titulo}</Text>
                      </View>
                      <Text style={styles.pasoDesc}>{p.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Necesitas más ayuda? Contacta a tu administrador.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark[900],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark[800],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: Colors.gold[400],
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.gold[400] + '15',
    borderWidth: 1,
    borderColor: Colors.gold[400] + '30',
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
  },
  bannerEmoji: { fontSize: 28 },
  bannerTexto: { flex: 1 },
  bannerTitulo: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.gold[300],
  },
  bannerSub: {
    fontSize: Typography.fontSize.sm,
    color: Colors.dark[400],
    marginTop: 2,
  },
  seccion: {
    backgroundColor: Colors.dark[800],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark[700],
    overflow: 'hidden',
  },
  seccionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
  },
  seccionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  seccionEmoji: { fontSize: 24 },
  seccionTitulo: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
  },
  seccionSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.dark[400],
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: Colors.dark[500],
    transform: [{ rotate: '0deg' }],
  },
  chevronAbierto: {
    transform: [{ rotate: '90deg' }],
    color: Colors.gold[400],
  },
  pasos: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark[700],
    padding: Spacing.base,
    gap: Spacing.base,
  },
  paso: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pasoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gold[400] + '20',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pasoEmoji: { fontSize: 18 },
  pasoTexto: { flex: 1 },
  pasoTituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  pasoNumPill: {
    backgroundColor: Colors.gold[400] + '20',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  pasoNum: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gold[400],
  },
  pasoTitulo: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
  },
  pasoDesc: {
    fontSize: Typography.fontSize.sm,
    color: Colors.dark[300],
    lineHeight: Typography.fontSize.sm * 1.6,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.base,
  },
  footerText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.dark[500],
    textAlign: 'center',
  },
});
