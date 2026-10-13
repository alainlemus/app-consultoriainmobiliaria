import React, { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
  Image, Alert, Modal, ActivityIndicator, Switch, TextInput as RNTextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius } from '../../src/theme';
import Input from '../../src/components/ui/Input';
import EstadoSelectModal from '../../src/components/ui/EstadoSelectModal';
import { createContacto, uploadSimuladorScreenshot } from '../../src/services/api';
import { useSyncContext } from '../../src/contexts/SyncContext';
import { upsertCacheContacto, encolarFotos, desencolarFotos } from '../../src/services/offline';
import { persistirDocumento, limpiarArchivoLocal } from '../../src/utils/comprimirFoto';
import type { ServicioProspecto } from '../../src/types';
import { SERVICIO_LABEL } from '../../src/types';

type EstadoP = 'nuevo' | 'precalificado';

const ESTADOS: { value: EstadoP; label: string }[] = [
  { value: 'nuevo',         label: 'Nuevo' },
  { value: 'precalificado', label: 'Precalificado' },
];

const REGIMENES: { value: string; label: string }[] = [
  { value: 'decimo_transitorio', label: 'Décimo Transitorio' },
  { value: 'cuenta_individual',  label: 'Cuenta Individual' },
];

export default function NuevoProspectoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { online, encolar } = useSyncContext();

  // ── Campos base ────────────────────────────────────────────────────────────
   const [form, setForm] = useState({
    nombre:           '',
    telefono:         '',
    email:            '',
    curp:             '',
    nss:              '',
    notas:            '',
    estado_prospecto: 'nuevo' as EstadoP,
    servicio:         'FOVISSSTE' as ServicioProspecto,  // por ahora solo FOVISSSTE
    // Precalificación compartida
    estado_uso_credito:    '',
    municipio_uso_credito: '',
    // Solo FOVISSSTE
    estado_residencia:     '',
    regimen_pensionario:   '',
  });
  const [tieneDiscapacidad, setTieneDiscapacidad] = useState(false);
  const [screenshotAsset,   setScreenshotAsset]   = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [errors,  setErrors]  = useState<Partial<Record<keyof typeof form, string>>>({});
  const [loading, setLoading] = useState(false);
  // Aviso al terminar: guardado en el servidor o solo en el dispositivo (sin internet)
  const [aviso, setAviso] = useState<{ offline: boolean } | null>(null);
  const [masDatos, setMasDatos] = useState(false);

  function set(key: keyof typeof form) {
    return (val: string) => setForm(f => ({ ...f, [key]: val }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof typeof form, string>> = {};
    if (!form.nombre.trim()) e.nombre   = 'El nombre es requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Imagen: captura del simulador ──────────────────────────────────────────
  async function seleccionarScreenshot() {
    const permisos = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permisos.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el acceso a la galería en Configuración.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) setScreenshotAsset(result.assets[0]);
  }

  function irAProspectos() {
    setAviso(null);
    router.replace({ pathname: '/(tabs)/prospectos', params: { refresh: Date.now() } });
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        nombre:                form.nombre.trim(),
        telefono:              form.telefono              || undefined,
        email:                 form.email                 || undefined,
        curp:                  form.curp.trim().toUpperCase() || undefined,
        notas:                 form.notas                 || undefined,
        estado_prospecto:      form.estado_prospecto,
        servicio:              form.servicio              || undefined,
        origen:                'app_movil' as const,
        // Precalificación FOVISSSTE
        ...(form.servicio === 'FOVISSSTE' ? {
          estado_uso_credito:    form.estado_uso_credito    || undefined,
          municipio_uso_credito: form.municipio_uso_credito || undefined,
          estado_residencia:     form.estado_residencia     || undefined,
          regimen_pensionario:   form.regimen_pensionario   || undefined,
          tiene_discapacidad:    tieneDiscapacidad,
        } : {}),
        // Precalificación INFONAVIT
        ...(form.servicio === 'INFONAVIT' ? {
          nss:                   form.nss.trim()            || undefined,
          estado_uso_credito:    form.estado_uso_credito    || undefined,
          municipio_uso_credito: form.municipio_uso_credito || undefined,
        } : {}),
      };

      if (!online) {
        // ── Sin internet: encolar JSON + persistir imágenes en documentDirectory ──
        const localId = await encolar('crear_contacto', payload);
        await upsertCacheContacto({
          id:               0,
          _local_id:        localId,
          _pendiente_sync:  true,
          nombre:           payload.nombre,
          telefono:         payload.telefono,
          email:            payload.email,
          servicio:         payload.servicio as any,
          estado_prospecto: payload.estado_prospecto as any ?? 'nuevo',
          notas:            payload.notas,
          created_at:       new Date().toISOString(),
        });
        setAviso({ offline: true });
        return;
      }

      // ── Con red: crear contacto primero ──────────────────────────────────────
      let contacto;
      try {
        contacto = await createContacto(payload);
      } catch (e: unknown) {
        const msg = (e instanceof Error ? e.message : '').toLowerCase();
        if (msg.includes('network') || msg.includes('failed') || msg.includes('timeout')) {
          // Red caída → encolar sin fotos y avisar
          const localId = await encolar('crear_contacto', payload);
          await upsertCacheContacto({
            id: 0, _local_id: localId, _pendiente_sync: true,
            nombre: payload.nombre, telefono: payload.telefono,
            email: payload.email, servicio: payload.servicio as any,
            estado_prospecto: payload.estado_prospecto as any ?? 'nuevo',
            notas: payload.notas, created_at: new Date().toISOString(),
          });
          setAviso({ offline: true });
          return;
        }
        throw e;
      }

      // ── Contacto creado → subir imágenes en background ───────────────────────
      // Se encolan ANTES de intentar subir (no solo si falla): con señal
      // lenta el proceso puede suspenderse a media subida y perder la imagen
      // sin dejar rastro si solo se encolara en el catch.
      if (screenshotAsset && contacto.id) {
        const screenshot = await persistirDocumento(
          screenshotAsset.uri,
          screenshotAsset.fileName ?? 'simulador.jpg',
        );
        const screenshotFoto = {
          uri:  screenshot,
          name: screenshotAsset.fileName ?? 'simulador.jpg',
          type: screenshotAsset.mimeType ?? 'image/jpeg',
        };
        const contactoId = contacto.id;
        encolarFotos({ entidad: 'contacto_screenshot', entidad_id: contactoId, fotos: [screenshotFoto] }).then(idLocal =>
          uploadSimuladorScreenshot(contactoId, screenshotFoto)
            .then(() => Promise.all([limpiarArchivoLocal(screenshotFoto.uri), desencolarFotos(idLocal)]))
            .catch(() => {}),
        );
      }

      setAviso({ offline: false });
    } catch (e: unknown) {
      setErrors({ nombre: e instanceof Error ? e.message : 'Error al guardar.' });
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: Colors.cream[50] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Nuevo prospecto</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Datos personales ──────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Datos del prospecto</Text>
        <View style={styles.section}>
          <Input
            label="Nombre completo *"
            value={form.nombre}
            onChangeText={set('nombre')}
            error={errors.nombre}
            placeholder="Ej. Juan Pérez García"
            autoCapitalize="words"
          />
          <Input
            label="Teléfono"
            value={form.telefono}
            onChangeText={set('telefono')}
            keyboardType="phone-pad"
            placeholder="55 1234 5678"
          />
          <Input
            label="Correo electrónico"
            value={form.email}
            onChangeText={set('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="correo@ejemplo.com"
          />
        </View>

        {/* ── Notas ────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Notas</Text>
        <View style={styles.section}>
          <Input
            value={form.notas}
            onChangeText={set('notas')}
            multiline
            numberOfLines={3}
            placeholder="Información adicional sobre el prospecto…"
          />
        </View>

        {/* ── Más datos (plegado) ────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.masDatosBtn}
          onPress={() => setMasDatos(v => !v)}
          activeOpacity={0.8}
        >
          <Text style={styles.masDatosText}>{masDatos ? '▾  Menos datos' : '▸  Más datos (opcional)'}</Text>
        </TouchableOpacity>

        {masDatos ? (
          <>
        {/* ── Estado del prospecto ─────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Estado del prospecto</Text>
        <View style={styles.section}>
          <View style={styles.estadoGrid}>
            {ESTADOS.map(e => (
              <TouchableOpacity
                key={e.value}
                style={[styles.estadoChip, form.estado_prospecto === e.value && styles.estadoChipActive]}
                onPress={() => setForm(f => ({ ...f, estado_prospecto: e.value }))}
                activeOpacity={0.8}
              >
                <Text style={[styles.estadoChipText, form.estado_prospecto === e.value && styles.estadoChipTextActive]}>
                  {e.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.sectionLabel}>CURP</Text>
        <View style={styles.section}>
          <Input
            label="CURP (opcional)"
            value={form.curp}
            onChangeText={(v) => set('curp')(v.toUpperCase())}
            autoCapitalize="characters"
            placeholder="LOHA850101HDFPLN02"
            maxLength={18}
          />
        </View>

        {/* ── Precalificación FOVISSSTE ─────────────────────────────── */}
        {form.servicio === 'FOVISSSTE' ? (
          <>
            <Text style={styles.sectionLabel}>Precalificación FOVISSSTE</Text>
            <Text style={styles.sectionHint}>Opcional — completa si ya realizaste la consulta en el simulador.</Text>
            <View style={styles.section}>

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Estado donde usará el crédito</Text>
                <EstadoSelectModal
                  value={form.estado_uso_credito}
                  onChange={v => setForm(f => ({ ...f, estado_uso_credito: v }))}
                  placeholder="Elegir estado"
                />
              </View>
      
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Municipio donde usará el crédito</Text>
                <RNTextInput
                  style={styles.fieldInput}
                  value={form.municipio_uso_credito}
                  onChangeText={set('municipio_uso_credito')}
                  autoCapitalize="words"
                  placeholder="Ej: Pachuca"
                  placeholderTextColor={Colors.dark[400]}
                />
              </View>
      
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Estado de residencia actual</Text>
                <EstadoSelectModal
                  value={form.estado_residencia}
                  onChange={v => setForm(f => ({ ...f, estado_residencia: v }))}
                  placeholder="Elegir estado"
                />
              </View>
      
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Régimen pensionario</Text>
                <Text style={styles.fieldHint}>Elige una opción</Text>
              </View>
              <View style={styles.regimenRow}>
                {REGIMENES.map(r => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.regimenChip, form.regimen_pensionario === r.value && styles.regimenChipActive]}
                    onPress={() => setForm(f => ({ ...f, regimen_pensionario: r.value }))}
                  >
                    <Text style={[styles.regimenChipText, form.regimen_pensionario === r.value && styles.regimenChipTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
      
              <View style={[styles.fieldRow, styles.switchBox]}>
                <Text style={[styles.fieldLabel, { marginBottom: 0, flex: 1 }]}>¿Tiene alguna discapacidad?</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{tieneDiscapacidad ? 'Sí' : 'No'}</Text>
                  <Switch
                    value={tieneDiscapacidad}
                    onValueChange={setTieneDiscapacidad}
                    trackColor={{ false: Colors.cream[300], true: Colors.gold[400] }}
                    thumbColor={Colors.white}
                  />
                </View>
              </View>
            </View>

            {/* Captura del simulador FOVISSSTE */}
            <Text style={styles.sectionLabel}>Captura del simulador</Text>
            <View style={styles.section}>
              {screenshotAsset ? (
                <Image source={{ uri: screenshotAsset.uri }} style={styles.screenshotPreview} resizeMode="contain" />
              ) : (
                <Text style={styles.screenshotEmpty}>Sin captura del simulador</Text>
              )}
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                <TouchableOpacity
                  style={[styles.fotoBtn, { flex: 1 }]}
                  onPress={() => Linking.openURL('https://inscripcioncontinua.fovissste.gob.mx/simulador/')}
                >
                  <Text style={styles.fotoBtnText}>Abrir simulador</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.fotoBtn, { flex: 1 }]} onPress={seleccionarScreenshot}>
                  <Text style={styles.fotoBtnText}>Subir captura</Text>
                </TouchableOpacity>
              </View>
              {screenshotAsset && (
                <TouchableOpacity onPress={() => setScreenshotAsset(null)} style={[styles.fotoRemoveBtn, { alignItems: 'center' }]}>
                  <Text style={styles.fotoRemoveBtnText}>Quitar captura</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : null}

        {/* ── Precalificación INFONAVIT ─────────────────────────────── */}
        {form.servicio === 'INFONAVIT' ? (
          <>
            <Text style={styles.sectionLabel}>Precalificación INFONAVIT</Text>
            <Text style={styles.sectionHint}>Opcional — completa si ya consultaste Mi Cuenta INFONAVIT.</Text>
            <View style={styles.section}>

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>NSS (Número de Seguridad Social)</Text>
                <RNTextInput
                  style={styles.fieldInput}
                  value={form.nss}
                  onChangeText={set('nss')}
                  keyboardType="number-pad"
                  placeholder="Ej: 12345678901"
                  placeholderTextColor={Colors.dark[400]}
                  maxLength={15}
                />
              </View>
      
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Estado donde usará el crédito</Text>
                <EstadoSelectModal
                  value={form.estado_uso_credito}
                  onChange={v => setForm(f => ({ ...f, estado_uso_credito: v }))}
                  placeholder="Elegir estado"
                />
              </View>
      
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Municipio donde usará el crédito</Text>
                <RNTextInput
                  style={styles.fieldInput}
                  value={form.municipio_uso_credito}
                  onChangeText={set('municipio_uso_credito')}
                  autoCapitalize="words"
                  placeholder="Ej: Pachuca"
                  placeholderTextColor={Colors.dark[400]}
                />
              </View>
            </View>

            {/* Captura Mi Cuenta INFONAVIT */}
            <Text style={styles.sectionLabel}>Captura del portal</Text>
            <View style={styles.section}>
              {screenshotAsset ? (
                <Image source={{ uri: screenshotAsset.uri }} style={styles.screenshotPreview} resizeMode="contain" />
              ) : (
                <Text style={styles.screenshotEmpty}>Sin captura del portal</Text>
              )}
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                <TouchableOpacity
                  style={[styles.fotoBtn, { flex: 1 }]}
                  onPress={() => Linking.openURL('https://micuenta.infonavit.org.mx/')}
                >
                  <Text style={styles.fotoBtnText}>Abrir Mi Cuenta</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.fotoBtn, { flex: 1 }]} onPress={seleccionarScreenshot}>
                  <Text style={styles.fotoBtnText}>Subir captura</Text>
                </TouchableOpacity>
              </View>
              {screenshotAsset && (
                <TouchableOpacity onPress={() => setScreenshotAsset(null)} style={[styles.fotoRemoveBtn, { alignItems: 'center' }]}>
                  <Text style={styles.fotoRemoveBtnText}>Quitar captura</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : null}

          </>
        ) : null}

        {/* ── Guardar ───────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveBtnText}>Guardar prospecto</Text>
          }
        </TouchableOpacity>
      </ScrollView>
      {/* Aviso de guardado: en línea o sin conexión */}
      <Modal visible={aviso !== null} transparent animationType="fade" onRequestClose={irAProspectos}>
        <View style={styles.avisoBackdrop}>
          <View style={styles.avisoCard}>
            <View style={[styles.avisoIcono, aviso?.offline && styles.avisoIconoOffline]}>
              <Text style={styles.avisoIconoText}>{aviso?.offline ? '📴' : '✓'}</Text>
            </View>
            <Text style={styles.avisoTitulo}>Prospecto guardado</Text>
            <Text style={styles.avisoTexto}>
              {aviso?.offline
                ? 'Se guardó en tu dispositivo porque no hay internet. Se enviará automáticamente cuando recuperes la conexión.'
                : 'El prospecto se guardó correctamente.'}
            </Text>
            <TouchableOpacity style={styles.avisoBtn} onPress={irAProspectos} activeOpacity={0.85}>
              <Text style={styles.avisoBtnText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Aviso de guardado
  avisoBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  avisoCard:     { width: '100%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center' },
  avisoIcono:    { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.base },
  avisoIconoOffline: { backgroundColor: Colors.gold[400] },
  avisoIconoText:{ fontSize: 30, color: Colors.white, fontWeight: '700' },
  avisoTitulo:   { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900], marginBottom: Spacing.xs },
  avisoTexto:    { fontSize: Typography.fontSize.sm, color: Colors.dark[500], textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg },
  avisoBtn:      { alignSelf: 'stretch', backgroundColor: Colors.dark[900], borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  avisoBtnText:  { color: Colors.gold[400], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },

  masDatosBtn:  { marginTop: Spacing.base, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.white },
  masDatosText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[700] },

  flex: { flex: 1 },

  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom:     Spacing.md,
    backgroundColor:   Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[300],
  },
  backBtn:  { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.dark[700] },
  topTitle: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },

  body: { padding: Spacing.base },

  sectionLabel: {
    fontSize:      Typography.fontSize.xs,
    fontWeight:    Typography.fontWeight.semibold,
    color:         Colors.dark[500],
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop:     Spacing.base,
    marginBottom:  Spacing.xs,
  },
  sectionHint: {
    fontSize:     Typography.fontSize.xs,
    color:        Colors.dark[400],
    marginBottom: Spacing.sm,
    fontStyle:    'italic',
  },

  section: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    padding:         Spacing.base,
    borderWidth:     1,
    borderColor:     Colors.cream[300],
  },

  fieldError: {
    fontSize:     Typography.fontSize.xs,
    color:        Colors.error ?? '#ef4444',
    marginBottom: Spacing.sm,
  },

  // ── Foto ────────────────────────────────────────────────────────────────────
  fotoBtn: {
    borderWidth:       1,
    borderColor:       Colors.cream[300],
    borderRadius:      Radius.md,
    paddingVertical:   Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor:   Colors.cream[50],
    alignItems:        'center',
  },
  fotoBtnText:       { fontSize: Typography.fontSize.sm, color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold },
  fotoRemoveBtn:     { marginTop: Spacing.xs, paddingVertical: 4 },
  fotoRemoveBtnText: { fontSize: Typography.fontSize.xs, color: Colors.dark[400] },

  // ── Servicios ───────────────────────────────────────────────────────────────

  // ── Estado prospecto ────────────────────────────────────────────────────────
  estadoGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  estadoChip:           { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.cream[50] },
  estadoChipActive:     { borderColor: Colors.dark[800], backgroundColor: Colors.dark[800] },
  estadoChipText:       { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[500] },
  estadoChipTextActive: { color: Colors.white },

  // ── Campos FOVISSSTE ────────────────────────────────────────────────────────
  fieldRow:   { marginBottom: Spacing.base },
  fieldLabel: { fontSize: Typography.fontSize.sm, color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold, marginBottom: Spacing.xs },
  fieldHint:  { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: -2 },
  // Campo de texto: caja blanca con borde (igual que Input)
  fieldInput: {
    backgroundColor:   Colors.white,
    borderWidth:       1.5,
    borderColor:       Colors.dark[300],
    borderRadius:      Radius.md,
    minHeight:         50,
    paddingHorizontal: Spacing.base,
    fontSize:          Typography.fontSize.base,
    color:             Colors.dark[900],
  },
  switchBox: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.cream[100],
    borderWidth:       1.5,
    borderColor:       Colors.dark[300],
    borderRadius:      Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.sm,
  },

  // Régimen chips
  regimenRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.sm, flexWrap: 'wrap' },
  regimenChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical:   6,
    borderRadius:      Radius.full,
    borderWidth:       1.5,
    borderColor:       Colors.cream[300],
    backgroundColor:   Colors.cream[50],
  },
  regimenChipActive:     { borderColor: Colors.gold[400], backgroundColor: Colors.gold[50] },
  regimenChipText:       { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[500] },
  regimenChipTextActive: { color: Colors.gold[600] },

  // Switch (discapacidad)
  switchRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  switchLabel:{ fontSize: Typography.fontSize.sm, color: Colors.dark[600] },

  // Captura simulador
  screenshotPreview: { width: '100%', height: 200, borderRadius: Radius.sm, backgroundColor: Colors.cream[100] },
  screenshotEmpty:   { textAlign: 'center', color: Colors.dark[400], fontSize: Typography.fontSize.xs, paddingVertical: Spacing.md },

  // ── Guardar ─────────────────────────────────────────────────────────────────
  saveBtn: {
    marginTop:       Spacing.xl,
    backgroundColor: Colors.dark[900],
    borderRadius:    Radius.md,
    paddingVertical: Spacing.base,
    alignItems:      'center',
  },
  saveBtnText: {
    color:         Colors.white,
    fontSize:      Typography.fontSize.base,
    fontWeight:    Typography.fontWeight.bold,
    letterSpacing: 0.5,
  },


});
