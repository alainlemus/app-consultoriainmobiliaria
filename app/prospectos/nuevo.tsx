import React, { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
  Image, Alert, ActivityIndicator, Switch, TextInput as RNTextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius } from '../../src/theme';
import Input from '../../src/components/ui/Input';
import EstadoSelectModal from '../../src/components/ui/EstadoSelectModal';
import { createContacto, uploadFotoContacto, uploadSimuladorScreenshot } from '../../src/services/api';
import { useSyncContext } from '../../src/contexts/SyncContext';
import type { ServicioProspecto } from '../../src/types';
import { SERVICIO_LABEL } from '../../src/types';

type EstadoP = 'nuevo' | 'precalificado';

const ESTADOS: { value: EstadoP; label: string }[] = [
  { value: 'nuevo',         label: 'Nuevo' },
  { value: 'precalificado', label: 'Precalificado' },
];

const SERVICIOS: { value: ServicioProspecto; label: string }[] = [
  { value: 'FOVISSSTE',              label: 'FOVISSSTE' },
  { value: 'INFONAVIT',              label: 'INFONAVIT' },
  { value: 'AVALUO',                 label: 'Avalúo' },
  { value: 'ESCRITURACION',          label: 'Escrituración' },
  { value: 'ASESORIA_PERSONALIZADA', label: 'Asesoría\npersonalizada' },
  { value: 'OTRO',                   label: 'Otro' },
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
    servicio:         '' as ServicioProspecto,
    // Precalificación compartida
    estado_uso_credito:    '',
    municipio_uso_credito: '',
    // Solo FOVISSSTE
    estado_residencia:     '',
    regimen_pensionario:   '',
  });
  const [tieneDiscapacidad, setTieneDiscapacidad] = useState(false);
  const [fotoAsset,         setFotoAsset]         = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [screenshotAsset,   setScreenshotAsset]   = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [errors,  setErrors]  = useState<Partial<Record<keyof typeof form, string>>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function set(key: keyof typeof form) {
    return (val: string) => setForm(f => ({ ...f, [key]: val }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof typeof form, string>> = {};
    if (!form.nombre.trim()) e.nombre   = 'El nombre es requerido';
    if (!form.servicio)      e.servicio = 'Selecciona un tipo de servicio';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Imagen: foto de perfil ─────────────────────────────────────────────────
  async function seleccionarFoto(origen: 'camara' | 'galeria') {
    const permisos = origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permisos.status !== 'granted') {
      Alert.alert('Permiso requerido', `Activa el acceso a ${origen === 'camara' ? 'la cámara' : 'la galería'} en Configuración.`);
      return;
    }
    const result = origen === 'camara'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });

    if (!result.canceled && result.assets[0]) setFotoAsset(result.assets[0]);
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
        // ── Sin internet: guardar en cola, fotos y screenshots quedan pendientes ──
        await encolar('crear_contacto', payload);
        Alert.alert(
          'Guardado sin conexión',
          'El prospecto se registró en tu dispositivo. Se enviará al CRM automáticamente cuando recuperes internet.',
          [{ text: 'Entendido', onPress: () => router.replace({ pathname: '/(tabs)/prospectos', params: { refresh: Date.now() } }) }],
        );
        return;
      }

      const contacto = await createContacto(payload);

      if (fotoAsset && contacto.id) {
        await uploadFotoContacto(contacto.id, {
          uri:  fotoAsset.uri,
          name: fotoAsset.fileName ?? 'foto.jpg',
          type: fotoAsset.mimeType ?? 'image/jpeg',
        });
      }

      if (screenshotAsset && contacto.id) {
        await uploadSimuladorScreenshot(contacto.id, {
          uri:  screenshotAsset.uri,
          name: screenshotAsset.fileName ?? 'simulador.jpg',
          type: screenshotAsset.mimeType ?? 'image/jpeg',
        });
      }

      setSuccess(true);
      setTimeout(() => router.replace({ pathname: '/(tabs)/prospectos', params: { refresh: Date.now() } }), 900);
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
        {success && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓  Prospecto guardado</Text>
          </View>
        )}

        {/* ── Foto del prospecto ─────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Foto del prospecto</Text>
        <View style={styles.section}>
          <View style={styles.fotoRow}>
            <View style={styles.fotoPreviewWrap}>
              {fotoAsset ? (
                <Image source={{ uri: fotoAsset.uri }} style={styles.fotoPreview} />
              ) : (
                <View style={styles.fotoPlaceholder}>
                  <Text style={styles.fotoPlaceholderIcon}>👤</Text>
                </View>
              )}
            </View>
            <View style={styles.fotoBtns}>
              <TouchableOpacity style={styles.fotoBtn} onPress={() => seleccionarFoto('camara')}>
                <Text style={styles.fotoBtnText}>📷  Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fotoBtn, { marginTop: Spacing.xs }]} onPress={() => seleccionarFoto('galeria')}>
                <Text style={styles.fotoBtnText}>🖼️  Galería</Text>
              </TouchableOpacity>
              {fotoAsset && (
                <TouchableOpacity onPress={() => setFotoAsset(null)} style={styles.fotoRemoveBtn}>
                  <Text style={styles.fotoRemoveBtnText}>Quitar foto</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── Datos personales ──────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Datos personales</Text>
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
          <Input
            label="CURP (opcional)"
            value={form.curp}
            onChangeText={(v) => set('curp')(v.toUpperCase())}
            autoCapitalize="characters"
            placeholder="LOHA850101HDFPLN02"
            maxLength={18}
          />
        </View>

        {/* ── Tipo de servicio ──────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Tipo de servicio *</Text>
        <View style={styles.section}>
          {errors.servicio ? <Text style={styles.fieldError}>{errors.servicio}</Text> : null}
          <View style={styles.servicioGrid}>
            {SERVICIOS.map(s => (
              <TouchableOpacity
                key={s.value}
                style={[styles.servicioBtn, form.servicio === s.value && styles.servicioBtnActive]}
                onPress={() => setForm(f => ({ ...f, servicio: s.value }))}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.servicioBtnText, form.servicio === s.value && styles.servicioBtnTextActive]}
                  numberOfLines={2}
                  textBreakStrategy="simple"
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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
                  placeholder="Seleccionar estado"
                />
              </View>
              <View style={styles.divider} />

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
              <View style={styles.divider} />

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Estado de residencia actual</Text>
                <EstadoSelectModal
                  value={form.estado_residencia}
                  onChange={v => setForm(f => ({ ...f, estado_residencia: v }))}
                  placeholder="Seleccionar estado"
                />
              </View>
              <View style={styles.divider} />

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Régimen pensionario</Text>
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
              <View style={styles.divider} />

              <View style={[styles.fieldRow, { alignItems: 'center' }]}>
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
              <View style={styles.divider} />

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Estado donde usará el crédito</Text>
                <EstadoSelectModal
                  value={form.estado_uso_credito}
                  onChange={v => setForm(f => ({ ...f, estado_uso_credito: v }))}
                  placeholder="Seleccionar estado"
                />
              </View>
              <View style={styles.divider} />

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
    </KeyboardAvoidingView>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  fotoRow:          { flexDirection: 'row', alignItems: 'center', gap: Spacing.base },
  fotoPreviewWrap:  { width: 80, height: 80, borderRadius: 40, overflow: 'hidden' },
  fotoPreview:      { width: 80, height: 80 },
  fotoPlaceholder:  { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.cream[200], alignItems: 'center', justifyContent: 'center' },
  fotoPlaceholderIcon: { fontSize: 32 },
  fotoBtns:    { flex: 1 },
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
  servicioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  servicioBtn: {
    width:           '30%',
    flexGrow:        1,
    paddingVertical: Spacing.md,
    borderRadius:    Radius.md,
    borderWidth:     1.5,
    borderColor:     Colors.cream[300],
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: Colors.cream[50],
    minHeight:       56,
  },
  servicioBtnActive:     { borderColor: Colors.gold[400], backgroundColor: Colors.gold[50] },
  servicioBtnText:       { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[500], textAlign: 'center' },
  servicioBtnTextActive: { color: Colors.gold[600] },

  // ── Estado prospecto ────────────────────────────────────────────────────────
  estadoGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  estadoChip:           { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.cream[50] },
  estadoChipActive:     { borderColor: Colors.dark[800], backgroundColor: Colors.dark[800] },
  estadoChipText:       { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[500] },
  estadoChipTextActive: { color: Colors.white },

  // ── Campos FOVISSSTE ────────────────────────────────────────────────────────
  fieldRow:   { paddingVertical: Spacing.sm },
  fieldLabel: { fontSize: Typography.fontSize.xs, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldInput: { fontSize: Typography.fontSize.sm, color: Colors.dark[900], paddingVertical: Spacing.xs },
  divider:    { height: 1, backgroundColor: Colors.cream[200] },

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

  successBanner: {
    backgroundColor: '#f0fdf4',
    borderWidth:     1,
    borderColor:     '#bbf7d0',
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    marginBottom:    Spacing.base,
    alignItems:      'center',
  },
  successText: { color: '#15803d', fontWeight: Typography.fontWeight.semibold, fontSize: Typography.fontSize.sm },
});
