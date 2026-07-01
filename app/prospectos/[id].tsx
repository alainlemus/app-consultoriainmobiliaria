import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, Alert, Image, Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Badge, { ESTADO_PROSPECTO_BADGE } from '../../src/components/ui/Badge';
import EstadoSelectModal from '../../src/components/ui/EstadoSelectModal';
import { getContacto, updateContacto, uploadFotoContacto, uploadSimuladorScreenshot, getUbicacionesMapa } from '../../src/services/api';
import { getCacheContacto, getCacheContactos, encolarFotos } from '../../src/services/offline';
import { useSyncContext } from '../../src/contexts/SyncContext';
import { comprimirFoto, persistirDocumento } from '../../src/utils/comprimirFoto';
import type { Contacto, EstadoProspecto, ServicioProspecto, Ubicacion } from '../../src/types';
import { SERVICIO_LABEL } from '../../src/types';

const ESTADOS: { value: EstadoProspecto; label: string }[] = [
  { value: 'nuevo',         label: 'Nuevo' },
  { value: 'precalificado', label: 'Precalificado' },
];

const REGIMENES: { value: string; label: string }[] = [
  { value: 'decimo_transitorio', label: 'Décimo Transitorio' },
  { value: 'cuenta_individual',  label: 'Cuenta Individual' },
];

const SERVICIOS: { value: ServicioProspecto; label: string }[] = [
  { value: 'FOVISSSTE',              label: 'FOVISSSTE' },
  { value: 'INFONAVIT',              label: 'INFONAVIT' },
  { value: 'AVALUO',                 label: 'Avalúo' },
  { value: 'ESCRITURACION',          label: 'Escrituración' },
  { value: 'ASESORIA_PERSONALIZADA', label: 'Asesoría\npersonalizada' },
  { value: 'OTRO',                   label: 'Otro' },
];

export default function DetalleProspectoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { online, encolar } = useSyncContext();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [contacto,  setContacto]  = useState<Contacto | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [desdeCache, setDesdeCache] = useState(false);
  const [ultimaVisita, setUltimaVisita] = useState<Ubicacion | null>(null);

  // Campos del formulario de edición
  const [nombre,   setNombre]   = useState('');
  const [telefono, setTelefono] = useState('');
  const [email,    setEmail]    = useState('');
  const [curp,     setCurp]     = useState('');
  const [notas,    setNotas]    = useState('');
  const [servicio, setServicio] = useState<ServicioProspecto>('');
  const [estado,   setEstado]   = useState<EstadoProspecto>('nuevo');
  const [fotoAsset, setFotoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  // Campos precalificación (FOVISSSTE + INFONAVIT)
  const [nss,                 setNss]                 = useState('');
  const [estadoUsoCredito,    setEstadoUsoCredito]    = useState('');
  const [municipioUsoCredito, setMunicipioUsoCredito] = useState('');
  const [estadoResidencia,    setEstadoResidencia]    = useState('');
  const [regimenPensionario,  setRegimenPensionario]  = useState('');
  const [tieneDiscapacidad,   setTieneDiscapacidad]   = useState(false);
  const [screenshotAsset, setScreenshotAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  useEffect(() => {
    if (!id) return;
    const numId = Number(id);

    // Intentar online primero, con fallback al cache
    if (!online) {
      // Offline: buscar directamente en el cache
      Promise.all([
        getCacheContacto(numId),
        Promise.resolve<Ubicacion[]>([]),
      ]).then(([c, _visitas]) => {
        if (c) {
          setContacto(c);
          poblarFormulario(c);
          setDesdeCache(true);
        }
      }).finally(() => setLoading(false));
      return;
    }

    Promise.all([
      getContacto(numId),
      getUbicacionesMapa(),
    ])
      .then(([c, visitas]) => {
        setContacto(c);
        poblarFormulario(c);
        setDesdeCache(false);
        const suyas = visitas
          .filter(v => v.contacto_id === numId)
          .sort((a, b) => new Date(b.visitado_en).getTime() - new Date(a.visitado_en).getTime());
        setUltimaVisita(suyas[0] ?? null);
      })
      .catch(async () => {
        // Fallo de red: intentar desde cache
        const cached = await getCacheContacto(numId);
        if (cached) {
          setContacto(cached);
          poblarFormulario(cached);
          setDesdeCache(true);
        }
      })
      .finally(() => setLoading(false));
  }, [id, online]);

  function poblarFormulario(c: Contacto) {
    setNombre(c.nombre ?? '');
    setTelefono(c.telefono ?? '');
    setEmail(c.email ?? '');
    setCurp(c.curp ?? '');
    setNotas(c.notas ?? '');
    setServicio((c.servicio as ServicioProspecto) ?? '');
    // Simplificar: si el estado actual no es 'precalificado', mostrar como 'nuevo'
    setEstado(c.estado_prospecto === 'precalificado' ? 'precalificado' : 'nuevo');
    setFotoAsset(null);
    // Precalificación
    setNss(c.nss ?? '');
    setEstadoUsoCredito(c.estado_uso_credito ?? '');
    setMunicipioUsoCredito(c.municipio_uso_credito ?? '');
    setEstadoResidencia(c.estado_residencia ?? '');
    setRegimenPensionario(c.regimen_pensionario ?? '');
    setTieneDiscapacidad(c.tiene_discapacidad ?? false);
    setScreenshotAsset(null);
  }

  async function handleSave() {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre no puede estar vacío.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id:                    Number(id),
        nombre:                nombre.trim(),
        telefono:              telefono || undefined,
        email:                 email    || undefined,
        curp:                  curp.trim().toUpperCase() || undefined,
        notas:                 notas    || undefined,
        servicio:              servicio || undefined,
        estado_prospecto:      estado,
        // Precalificación FOVISSSTE
        ...(servicio === 'FOVISSSTE' ? {
          estado_uso_credito:    estadoUsoCredito    || undefined,
          municipio_uso_credito: municipioUsoCredito || undefined,
          estado_residencia:     estadoResidencia    || undefined,
          regimen_pensionario:   regimenPensionario  || undefined,
          tiene_discapacidad:    tieneDiscapacidad,
        } : {}),
        // Precalificación INFONAVIT
        ...(servicio === 'INFONAVIT' ? {
          nss:                   nss.trim() || undefined,
          estado_uso_credito:    estadoUsoCredito    || undefined,
          municipio_uso_credito: municipioUsoCredito || undefined,
        } : {}),
      };

      if (!online) {
        // Sin internet: encolar la actualización — fotos no se pueden asociar sin red
        await encolar('actualizar_contacto', payload);
        Alert.alert(
          '📋 Guardado sin conexión',
          'Los cambios se guardarán en el CRM cuando recuperes internet. Las fotos se podrán agregar al reconectarte.',
          [{ text: 'OK' }],
        );
        setEditing(false);
        return;
      }

      // ── Con red: actualizar contacto primero ──────────────────────────────────
      let updated: Contacto;
      try {
        updated = await updateContacto(Number(id), payload);
      } catch (e: unknown) {
        const msg = (e instanceof Error ? e.message : '').toLowerCase();
        if (msg.includes('network') || msg.includes('failed') || msg.includes('timeout')) {
          await encolar('actualizar_contacto', payload);
          Alert.alert(
            '📋 Guardado sin conexión',
            'Los cambios se guardarán en el CRM cuando recuperes internet.',
            [{ text: 'OK' }],
          );
          setEditing(false);
          return;
        }
        throw e;
      }

      let finalContacto: Contacto = updated;

      // ── Subir foto en background ──────────────────────────────────────────────
      if (fotoAsset && updated.id) {
        const foto = await comprimirFoto(fotoAsset.uri, 'foto_contacto');
        uploadFotoContacto(updated.id, foto)
          .then(c => { finalContacto = c; })
          .catch(() => {
            encolarFotos({ entidad: 'contacto_foto', entidad_id: updated.id, fotos: [foto] });
          });
      }

      // ── Subir screenshot en background ────────────────────────────────────────
      if (screenshotAsset && updated.id) {
        const uri = await persistirDocumento(
          screenshotAsset.uri,
          screenshotAsset.fileName ?? 'simulador.jpg',
        );
        const screenshotFoto = {
          uri,
          name: screenshotAsset.fileName ?? 'simulador.jpg',
          type: screenshotAsset.mimeType ?? 'image/jpeg',
        };
        uploadSimuladorScreenshot(updated.id, screenshotFoto)
          .then(c => { finalContacto = c; })
          .catch(() => {
            encolarFotos({ entidad: 'contacto_screenshot', entidad_id: updated.id, fotos: [screenshotFoto] });
          });
      }

      setContacto(finalContacto);
      setEditing(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (contacto) poblarFormulario(contacto);
    setEditing(false);
  }

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

    if (!result.canceled && result.assets[0]) {
      setFotoAsset(result.assets[0]);
    }
  }

  async function seleccionarScreenshot() {
    const permisos = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permisos.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el acceso a la galería en Configuración.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality:    0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setScreenshotAsset(result.assets[0]);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.flex}>
        <TopBar title="Cargando…" onBack={() => router.back()} insetTop={insets.top} />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold[400]} size="large" />
        </View>
      </View>
    );
  }

  if (!contacto) {
    return (
      <View style={styles.flex}>
        <TopBar title="No encontrado" onBack={() => router.back()} insetTop={insets.top} />
        <Text style={styles.notFound}>No se encontró el prospecto.</Text>
      </View>
    );
  }

  // ── Vista detalle ────────────────────────────────────────────────────────
  if (!editing) {
    const fotoUri = contacto.foto_url ?? null;

    return (
      <View style={styles.flex}>
        <TopBar
          title={contacto.nombre}
          subtitle="Prospecto"
          onBack={() => router.back()}
          insetTop={insets.top}
          rightElement={
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>Editar</Text>
            </TouchableOpacity>
          }
        />

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Banner offline */}
          {desdeCache && (
            <View style={styles.cacheBanner}>
              <Text style={styles.cacheText}>📴 Sin conexión — mostrando datos guardados</Text>
            </View>
          )}
          {/* Foto + badges */}
          <View style={styles.heroRow}>
            {fotoUri ? (
              <Image source={{ uri: fotoUri }} style={styles.fotoHero} />
            ) : (
              <View style={[styles.fotoHero, styles.fotoHeroPlaceholder]}>
                <Text style={{ fontSize: 36 }}>👤</Text>
              </View>
            )}
            <View style={styles.heroBadges}>
              <Badge
                label={contacto.estado_prospecto}
                variant={ESTADO_PROSPECTO_BADGE[contacto.estado_prospecto] ?? 'gray'}
              />
              {contacto.servicio ? (
                <View style={[styles.servicioPill, { marginTop: 6 }]}>
                  <Text style={styles.servicioPillText}>
                    {SERVICIO_LABEL[contacto.servicio] ?? contacto.servicio}
                  </Text>
                </View>
              ) : null}
              {ultimaVisita ? (
                <TouchableOpacity
                  style={[styles.servicioPill, styles.ubicacionPill, { marginTop: 6 }]}
                  activeOpacity={0.75}
                  onPress={() => router.push({
                    pathname: '/mapa',
                    params: {
                      lat: String(ultimaVisita.latitud),
                      lng: String(ultimaVisita.longitud),
                      contacto_id: String(contacto.id),
                      contacto_nombre: contacto.nombre,
                    },
                  })}
                >
                  <Text style={styles.ubicacionPillText}>
                    📍 {[ultimaVisita.municipio, ultimaVisita.estado].filter(Boolean).join(', ') || 'Ver en mapa'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <SectionLabel>Datos personales</SectionLabel>
          <Card>
            <InfoRow label="Nombre"    value={contacto.nombre ?? '—'} />
            <InfoRow label="Teléfono"  value={contacto.telefono ?? '—'} />
            <InfoRow label="Correo"    value={contacto.email ?? '—'} />
            <InfoRow label="CURP"      value={contacto.curp ?? '—'} />
            <InfoRow label="Servicio"  value={SERVICIO_LABEL[contacto.servicio ?? ''] ?? contacto.servicio ?? '—'} last />
          </Card>

          {contacto.notas ? (
            <>
              <SectionLabel>Notas</SectionLabel>
              <Card>
                <Text style={styles.notasText}>{contacto.notas}</Text>
              </Card>
            </>
          ) : null}

          {/* ── Precalificación FOVISSSTE (vista) ─────────────────── */}
          {contacto.servicio === 'FOVISSSTE' && (
            contacto.estado_uso_credito || contacto.municipio_uso_credito ||
            contacto.estado_residencia  || contacto.regimen_pensionario   ||
            contacto.simulador_screenshot_url
          ) ? (
            <>
              <SectionLabel>Precalificación FOVISSSTE</SectionLabel>
              <Card>
                {contacto.estado_uso_credito ? (
                  <InfoRow label="Estado (crédito)"    value={contacto.estado_uso_credito} />
                ) : null}
                {contacto.municipio_uso_credito ? (
                  <InfoRow label="Municipio (crédito)" value={contacto.municipio_uso_credito} />
                ) : null}
                {contacto.estado_residencia ? (
                  <InfoRow label="Estado (residencia)" value={contacto.estado_residencia} />
                ) : null}
                {contacto.regimen_pensionario ? (
                  <InfoRow
                    label="Régimen"
                    value={contacto.regimen_pensionario === 'decimo_transitorio' ? 'Décimo Transitorio' : 'Cuenta Individual'}
                  />
                ) : null}
                <InfoRow
                  label="Discapacidad"
                  value={contacto.tiene_discapacidad ? 'Sí' : 'No'}
                  last={!contacto.simulador_screenshot_url}
                />
              </Card>
              {contacto.simulador_screenshot_url ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => Linking.openURL(contacto.simulador_screenshot_url!)}
                  style={styles.screenshotContainer}
                >
                  <Image
                    source={{ uri: contacto.simulador_screenshot_url }}
                    style={styles.screenshotThumb}
                    resizeMode="cover"
                  />
                  <Text style={styles.screenshotHint}>Toca para ver la captura completa</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          {/* ── Precalificación INFONAVIT (vista) ─────────────────── */}
          {contacto.servicio === 'INFONAVIT' && (
            contacto.nss || contacto.estado_uso_credito ||
            contacto.municipio_uso_credito || contacto.simulador_screenshot_url
          ) ? (
            <>
              <SectionLabel>Precalificación INFONAVIT</SectionLabel>
              <Card>
                {contacto.nss ? (
                  <InfoRow label="NSS" value={contacto.nss} />
                ) : null}
                {contacto.estado_uso_credito ? (
                  <InfoRow label="Estado (crédito)"    value={contacto.estado_uso_credito} />
                ) : null}
                {contacto.municipio_uso_credito ? (
                  <InfoRow label="Municipio (crédito)" value={contacto.municipio_uso_credito} last={!contacto.simulador_screenshot_url} />
                ) : null}
              </Card>
              {contacto.simulador_screenshot_url ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => Linking.openURL(contacto.simulador_screenshot_url!)}
                  style={styles.screenshotContainer}
                >
                  <Image
                    source={{ uri: contacto.simulador_screenshot_url }}
                    style={styles.screenshotThumb}
                    resizeMode="cover"
                  />
                  <Text style={styles.screenshotHint}>Toca para ver la captura completa</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          <SectionLabel>Fechas</SectionLabel>
          <Card>
            <InfoRow label="Registrado"  value={fmt(contacto.created_at)} />
            <InfoRow label="Actualizado" value={fmt(contacto.updated_at)} last />
          </Card>

          {/* Acciones rápidas */}
          <SectionLabel>Acciones</SectionLabel>
          <View style={styles.actionsCard}>
            {contacto.expediente_activo ? (
              <ActionRow
                icon="📂"
                label={`Ver expediente${contacto.expediente_activo.folio ? ` ${contacto.expediente_activo.folio}` : ''}`}
                sublabel={`Estado: ${contacto.expediente_activo.estado.replace('_', ' ')}`}
                onPress={() => router.push(`/expedientes/${contacto.expediente_activo!.id}`)}
              />
            ) : (
              <ActionRow
                icon="📁"
                label="Iniciar expediente"
                onPress={() => router.push({
                  pathname: '/expedientes/nuevo',
                  params: { contacto_id: String(contacto.id), contacto_nombre: contacto.nombre },
                })}
              />
            )}
            <ActionRow
              icon="🔎"
              label="Precalificar"
              sublabel="Simulador FOVISSSTE"
              onPress={() => Linking.openURL('https://inscripcioncontinua.fovissste.gob.mx/simulador/')}
              border
            />
            {ultimaVisita ? (
              <ActionRow
                icon="📍"
                label="Ver ubicación en mapa"
                sublabel={[ultimaVisita.municipio, ultimaVisita.estado].filter(Boolean).join(', ') || undefined}
                onPress={() => router.push({
                  pathname: '/mapa',
                  params: {
                    lat: String(ultimaVisita.latitud),
                    lng: String(ultimaVisita.longitud),
                    contacto_id: String(contacto.id),
                    contacto_nombre: contacto.nombre,
                  },
                })}
                border
              />
            ) : null}
            {!ultimaVisita && (
              <ActionRow
                icon="🗺️"
                label="Registrar visita"
                onPress={() => router.push({ pathname: '/mapa', params: { contacto_id: String(contacto.id), contacto_nombre: contacto.nombre } })}
                border
              />
            )}
            <ActionRow icon="✏️" label="Editar prospecto" onPress={() => setEditing(true)} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Formulario edición ───────────────────────────────────────────────────
  const fotoPreviewUri = fotoAsset?.uri ?? contacto.foto_url ?? null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopBar
        title="Editar prospecto"
        onBack={handleCancelEdit}
        insetTop={insets.top}
        rightElement={
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Foto */}
        <SectionLabel>Foto del prospecto</SectionLabel>
        <View style={styles.formCard}>
          <View style={styles.fotoEditRow}>
            {fotoPreviewUri ? (
              <Image source={{ uri: fotoPreviewUri }} style={styles.fotoEdit} />
            ) : (
              <View style={[styles.fotoEdit, styles.fotoEditPlaceholder]}>
                <Text style={{ fontSize: 28 }}>👤</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: Spacing.xs }}>
              <TouchableOpacity style={styles.fotoBtn} onPress={() => seleccionarFoto('camara')}>
                <Text style={styles.fotoBtnText}>📷  Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fotoBtn} onPress={() => seleccionarFoto('galeria')}>
                <Text style={styles.fotoBtnText}>🖼️  Galería</Text>
              </TouchableOpacity>
              {fotoAsset && (
                <TouchableOpacity onPress={() => setFotoAsset(null)}>
                  <Text style={styles.fotoRemoveBtnText}>Quitar foto nueva</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <SectionLabel>Datos personales</SectionLabel>
        <View style={styles.formCard}>
          <FormField label="Nombre completo *">
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
              placeholder="Nombre completo"
              placeholderTextColor={Colors.dark[400]}
            />
          </FormField>
          <FormField label="Teléfono" border>
            <TextInput
              style={styles.input}
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
              placeholder="55 1234 5678"
              placeholderTextColor={Colors.dark[400]}
            />
          </FormField>
          <FormField label="Correo electrónico" border>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="correo@ejemplo.com"
              placeholderTextColor={Colors.dark[400]}
            />
          </FormField>
          <FormField label="CURP (opcional)" border last>
            <TextInput
              style={styles.input}
              value={curp}
              onChangeText={(v) => setCurp(v.toUpperCase())}
              autoCapitalize="characters"
              placeholder="LOHA850101HDFPLN02"
              placeholderTextColor={Colors.dark[400]}
              maxLength={18}
            />
          </FormField>
        </View>

        <SectionLabel>Tipo de servicio</SectionLabel>
        <View style={styles.formCard}>
          <View style={styles.servicioGrid}>
            {SERVICIOS.map(s => (
              <TouchableOpacity
                key={s.value}
                style={[styles.servicioBtn, servicio === s.value && styles.servicioBtnActive]}
                onPress={() => setServicio(s.value)}
              >
                <Text
                  style={[styles.servicioBtnText, servicio === s.value && styles.servicioBtnTextActive]}
                  numberOfLines={2}
                  textBreakStrategy="simple"
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <SectionLabel>Estado del prospecto</SectionLabel>
        <View style={styles.formCard}>
          <View style={styles.estadoGrid}>
            {ESTADOS.map(e => (
              <TouchableOpacity
                key={e.value}
                style={[styles.estadoChip, estado === e.value && styles.estadoChipActive]}
                onPress={() => setEstado(e.value)}
              >
                <Text style={[styles.estadoChipText, estado === e.value && styles.estadoChipTextActive]}>
                  {e.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <SectionLabel>Notas</SectionLabel>
        <View style={styles.formCard}>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={notas}
            onChangeText={setNotas}
            multiline
            numberOfLines={4}
            placeholder="Observaciones sobre el prospecto…"
            placeholderTextColor={Colors.dark[400]}
            textAlignVertical="top"
          />
        </View>

        {/* ── Precalificación FOVISSSTE (edición) ───────────────────── */}
        {servicio === 'FOVISSSTE' ? (
          <>
            <SectionLabel>Precalificación FOVISSSTE</SectionLabel>
            <View style={styles.formCard}>
              <FormField label="Estado donde usará el crédito">
                <EstadoSelectModal
                  value={estadoUsoCredito}
                  onChange={setEstadoUsoCredito}
                  placeholder="Ej: Hidalgo"
                />
              </FormField>
              <FormField label="Municipio donde usará el crédito" border>
                <TextInput
                  style={styles.input}
                  value={municipioUsoCredito}
                  onChangeText={setMunicipioUsoCredito}
                  autoCapitalize="words"
                  placeholder="Ej: Pachuca"
                  placeholderTextColor={Colors.dark[400]}
                />
              </FormField>
              <FormField label="Estado de residencia actual" border>
                <EstadoSelectModal
                  value={estadoResidencia}
                  onChange={setEstadoResidencia}
                  placeholder="Ej: Hidalgo"
                />
              </FormField>
              <FormField label="Régimen pensionario" border>
                <View style={styles.servicioGrid}>
                  {REGIMENES.map(r => (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.servicioBtn, regimenPensionario === r.value && styles.servicioBtnActive]}
                      onPress={() => setRegimenPensionario(r.value)}
                    >
                      <Text
                        style={[styles.servicioBtnText, regimenPensionario === r.value && styles.servicioBtnTextActive]}
                        numberOfLines={2}
                        textBreakStrategy="simple"
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FormField>
              <FormField label="¿Tiene alguna discapacidad?" border last>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{tieneDiscapacidad ? 'Sí' : 'No'}</Text>
                  <Switch
                    value={tieneDiscapacidad}
                    onValueChange={setTieneDiscapacidad}
                    trackColor={{ false: Colors.cream[300], true: Colors.gold[400] }}
                    thumbColor={Colors.white}
                  />
                </View>
              </FormField>
            </View>

            {/* Captura del simulador FOVISSSTE */}
            <SectionLabel>Captura del simulador</SectionLabel>
            <View style={styles.formCard}>
              {(screenshotAsset?.uri ?? contacto.simulador_screenshot_url) ? (
                <Image
                  source={{ uri: screenshotAsset?.uri ?? contacto.simulador_screenshot_url! }}
                  style={styles.screenshotPreview}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.screenshotEmpty}>Sin captura del simulador</Text>
              )}
              <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.sm }}>
                <TouchableOpacity
                  style={[styles.fotoBtn, { flex: 1 }]}
                  onPress={() => Linking.openURL('https://inscripcioncontinua.fovissste.gob.mx/simulador/')}
                >
                  <Text style={styles.fotoBtnText}>Abrir simulador</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fotoBtn, { flex: 1 }]}
                  onPress={seleccionarScreenshot}
                >
                  <Text style={styles.fotoBtnText}>Subir captura</Text>
                </TouchableOpacity>
              </View>
              {screenshotAsset ? (
                <TouchableOpacity onPress={() => setScreenshotAsset(null)} style={{ alignItems: 'center', paddingBottom: Spacing.sm }}>
                  <Text style={styles.fotoRemoveBtnText}>Quitar nueva captura</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        {/* ── Precalificación INFONAVIT (edición) ───────────────────── */}
        {servicio === 'INFONAVIT' ? (
          <>
            <SectionLabel>Precalificación INFONAVIT</SectionLabel>
            <View style={styles.formCard}>
              <FormField label="NSS (Número de Seguridad Social)">
                <TextInput
                  style={styles.input}
                  value={nss}
                  onChangeText={setNss}
                  keyboardType="number-pad"
                  placeholder="Ej: 12345678901"
                  placeholderTextColor={Colors.dark[400]}
                  maxLength={15}
                />
              </FormField>
              <FormField label="Estado donde usará el crédito" border>
                <EstadoSelectModal
                  value={estadoUsoCredito}
                  onChange={setEstadoUsoCredito}
                  placeholder="Ej: Hidalgo"
                />
              </FormField>
              <FormField label="Municipio donde usará el crédito" border last>
                <TextInput
                  style={styles.input}
                  value={municipioUsoCredito}
                  onChangeText={setMunicipioUsoCredito}
                  autoCapitalize="words"
                  placeholder="Ej: Pachuca"
                  placeholderTextColor={Colors.dark[400]}
                />
              </FormField>
            </View>

            {/* Captura Mi Cuenta INFONAVIT */}
            <SectionLabel>Captura del portal</SectionLabel>
            <View style={styles.formCard}>
              {(screenshotAsset?.uri ?? contacto.simulador_screenshot_url) ? (
                <Image
                  source={{ uri: screenshotAsset?.uri ?? contacto.simulador_screenshot_url! }}
                  style={styles.screenshotPreview}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.screenshotEmpty}>Sin captura del portal</Text>
              )}
              <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.sm }}>
                <TouchableOpacity
                  style={[styles.fotoBtn, { flex: 1 }]}
                  onPress={() => Linking.openURL('https://micuenta.infonavit.org.mx/')}
                >
                  <Text style={styles.fotoBtnText}>Abrir Mi Cuenta</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fotoBtn, { flex: 1 }]}
                  onPress={seleccionarScreenshot}
                >
                  <Text style={styles.fotoBtnText}>Subir captura</Text>
                </TouchableOpacity>
              </View>
              {screenshotAsset ? (
                <TouchableOpacity onPress={() => setScreenshotAsset(null)} style={{ alignItems: 'center', paddingBottom: Spacing.sm }}>
                  <Text style={styles.fotoRemoveBtnText}>Quitar nueva captura</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtnLarge, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnLargeText}>{saving ? 'Guardando…' : 'Guardar cambios'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
const tb = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.cream[300] },
  back:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.dark[700] },
  mid:      { flex: 1, alignItems: 'center' },
  sub:      { fontSize: 10, color: Colors.dark[400], letterSpacing: 1, textTransform: 'uppercase' },
  title:    { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  right:    { minWidth: 60, alignItems: 'flex-end' },
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function ActionRow({ icon, label, sublabel, onPress, border }: { icon: string; label: string; sublabel?: string; onPress: () => void; border?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, border && styles.actionRowBorder]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{label}</Text>
        {sublabel ? <Text style={{ fontSize: 12, color: Colors.dark[400], marginTop: 1 }}>{sublabel}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function FormField({ label, children, border, last }: { label: string; children: React.ReactNode; border?: boolean; last?: boolean }) {
  return (
    <View style={[styles.formField, border && styles.formFieldBorder]}>
      <Text style={styles.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:     { flex: 1, backgroundColor: Colors.cream[50] },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { textAlign: 'center', color: Colors.dark[400], marginTop: 40 },
  body:     { padding: Spacing.base },

  editBtn:     { borderWidth: 1, borderColor: Colors.dark[700], borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 5 },
  editBtnText: { color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold, fontSize: Typography.fontSize.xs },
  saveBtn:     { backgroundColor: Colors.dark[900], borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  saveBtnText: { color: Colors.gold[400], fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.xs },

  sectionLabel: {
    fontSize:      Typography.fontSize.xs,
    fontWeight:    Typography.fontWeight.bold,
    color:         Colors.dark[500],
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop:     Spacing.base,
    marginBottom:  Spacing.xs,
  },

  // Hero row (foto + badges)
  heroRow:            { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  fotoHero:           { width: 72, height: 72, borderRadius: 36, overflow: 'hidden' },
  fotoHeroPlaceholder:{ backgroundColor: Colors.cream[200], alignItems: 'center', justifyContent: 'center' },
  heroBadges:         { flex: 1, gap: 4 },

  servicioPill:     { backgroundColor: Colors.gold[50], borderWidth: 1, borderColor: Colors.gold[300], borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, alignSelf: 'flex-start' },
  servicioPillText: { fontSize: Typography.fontSize.xs, color: Colors.gold[600], fontWeight: Typography.fontWeight.bold },
  ubicacionPill:     { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  ubicacionPillText: { fontSize: Typography.fontSize.xs, color: '#2563eb', fontWeight: Typography.fontWeight.bold },

  card: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    overflow:        'hidden',
    marginBottom:    Spacing.xs,
  },

  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.cream[200] },
  infoLabel:     { fontSize: Typography.fontSize.xs, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold, flex: 1 },
  infoValue:     { fontSize: Typography.fontSize.sm, color: Colors.dark[800], flex: 2, textAlign: 'right' },

  notasText: { fontSize: Typography.fontSize.sm, color: Colors.dark[700], lineHeight: 20, padding: Spacing.md },

  actionsCard: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    overflow:        'hidden',
    marginBottom:    Spacing.xs,
  },
  actionRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  actionRowBorder: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.cream[200] },
  actionIcon:      { fontSize: 18 },
  actionLabel:     { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800] },
  chevron:         { fontSize: 20, color: Colors.dark[300] },

  // Formulario edición
  formCard: {
    backgroundColor:   Colors.white,
    borderRadius:      Radius.md,
    borderWidth:       1,
    borderColor:       Colors.cream[200],
    overflow:          'hidden',
    marginBottom:      Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  formField:       { paddingVertical: Spacing.sm },
  formFieldBorder: { borderTopWidth: 1, borderTopColor: Colors.cream[200] },
  formLabel:       { fontSize: Typography.fontSize.xs, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    fontSize:        Typography.fontSize.sm,
    color:           Colors.dark[900],
    paddingVertical: Spacing.xs,
  },
  inputMultiline: {
    minHeight: 80,
    padding:   Spacing.md,
  },

  // Foto en edición
  fotoEditRow:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  fotoEdit:            { width: 72, height: 72, borderRadius: 36, overflow: 'hidden' },
  fotoEditPlaceholder: { backgroundColor: Colors.cream[200], alignItems: 'center', justifyContent: 'center' },
  fotoBtn: {
    borderWidth:       1,
    borderColor:       Colors.cream[300],
    borderRadius:      Radius.sm,
    paddingVertical:   Spacing.xs,
    paddingHorizontal: Spacing.md,
    backgroundColor:   Colors.cream[50],
    alignItems:        'center',
  },
  fotoBtnText:       { fontSize: Typography.fontSize.xs, color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold },
  fotoRemoveBtnText: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], textAlign: 'center', marginTop: 2 },

  // Servicios grid
  servicioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingVertical: Spacing.sm },
  servicioBtn: {
    width:           '30%',
    flexGrow:        1,
    paddingVertical: Spacing.sm,
    borderRadius:    Radius.md,
    borderWidth:     1.5,
    borderColor:     Colors.cream[300],
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: Colors.cream[50],
    minHeight:       52,
  },
  servicioBtnActive:    { borderColor: Colors.gold[400], backgroundColor: Colors.gold[50] },
  servicioBtnText:      { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[500], textAlign: 'center' },
  servicioBtnTextActive:{ color: Colors.gold[600] },

  estadoGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingVertical: Spacing.sm },
  estadoChip:           { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.cream[50] },
  estadoChipActive:     { borderColor: Colors.dark[800], backgroundColor: Colors.dark[800] },
  estadoChipText:       { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[500] },
  estadoChipTextActive: { color: Colors.white },

  saveBtnLarge: {
    marginTop:       Spacing.xl,
    backgroundColor: Colors.dark[900],
    borderRadius:    Radius.md,
    paddingVertical: Spacing.base,
    alignItems:      'center',
  },
  saveBtnLargeText: { color: Colors.white, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, letterSpacing: 0.5 },
  cancelBtn:        { marginTop: Spacing.sm, paddingVertical: Spacing.md, alignItems: 'center' },
  cancelBtnText:    { color: Colors.dark[400], fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },

  // Switch row (discapacidad)
  switchRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  switchLabel:{ fontSize: Typography.fontSize.sm, color: Colors.dark[700] },

  // Screenshot (vista)
  screenshotContainer: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    overflow:        'hidden',
    marginBottom:    Spacing.xs,
    alignItems:      'center',
  },
  screenshotThumb: { width: '100%', height: 180 },
  screenshotHint:  { fontSize: Typography.fontSize.xs, color: Colors.dark[400], paddingVertical: Spacing.xs },

  // Screenshot (edición)
  screenshotPreview: {
    width:        '100%',
    height:       200,
    marginTop:    Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cream[100],
  },
  screenshotEmpty: {
    textAlign:   'center',
    color:       Colors.dark[400],
    fontSize:    Typography.fontSize.xs,
    paddingVertical: Spacing.md,
  },

  cacheBanner: {
    backgroundColor:  Colors.dark[800],
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.md,
    marginBottom:      Spacing.sm,
    borderLeftWidth:   4,
    borderLeftColor:   Colors.gold[400],
  },
  cacheText: { color: Colors.white, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },
});
