/**
 * Pantalla: Subir / Escanear Documento
 * Ruta: /expedientes/documentos/subir?expedienteId=X&tipo=Y
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { uploadDocumento } from '../../../src/services/api';
import { Colors, Radius, Spacing, Typography } from '../../../src/theme';

// ── Tipos de documento ────────────────────────────────────────────────────────

const TIPOS_DOCUMENTO = [
  { value: 'identificacion_oficial',  label: 'Identificación oficial' },
  { value: 'curp',                    label: 'CURP' },
  { value: 'comprobante_domicilio',   label: 'Comprobante domicilio' },
  { value: 'estado_cuenta',          label: 'Estado de cuenta' },
  { value: 'comprobante_ingresos',   label: 'Comprobante ingresos' },
  { value: 'acta_nacimiento',        label: 'Acta de nacimiento' },
  { value: 'poder_notarial',         label: 'Poder notarial' },
  { value: 'otro',                   label: 'Otro' },
] as const;

type TipoDocumento = typeof TIPOS_DOCUMENTO[number]['value'];
type Mode = 'selector' | 'camara' | 'preview';

export default function SubirDocumentoScreen() {
  const { expedienteId, tipo: tipoParam } = useLocalSearchParams<{
    expedienteId: string;
    tipo?: string;
  }>();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [mode, setMode]           = useState<Mode>('selector');
  const [imageUri, setImageUri]   = useState<string | null>(null);
  const [tipo, setTipo]           = useState<TipoDocumento>(
    (tipoParam as TipoDocumento) ?? 'identificacion_oficial',
  );
  const [notas, setNotas]         = useState('');
  const [uploading, setUploading] = useState(false);
  const [facing, setFacing]       = useState<'front' | 'back'>('back');

  const abrirCamara = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permiso requerido', 'Activa el acceso a la cámara en Configuración.');
        return;
      }
    }
    setMode('camara');
  };

  const tomarFoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) { setImageUri(photo.uri); setMode('preview'); }
    } catch {
      Alert.alert('Error', 'No se pudo tomar la foto.');
    }
  };

  const seleccionarGaleria = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el acceso a la galería en Configuración.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setMode('preview');
    }
  };

  const subir = async () => {
    if (!imageUri || !expedienteId) return;
    setUploading(true);
    try {
      await uploadDocumento(Number(expedienteId), imageUri, tipo, notas || undefined);
      Alert.alert('Listo', 'Documento subido correctamente.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error al subir', e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setUploading(false);
    }
  };

  // ── Selector ──────────────────────────────────────────────────────────────
  if (mode === 'selector') {
    return (
      <View style={s.container}>
        <Text style={s.title}>Agregar documento</Text>
        <Text style={s.subtitle}>Expediente #{expedienteId}</Text>

        <Text style={s.label}>Tipo de documento</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
          {TIPOS_DOCUMENTO.map((t) => (
            <Pressable
              key={t.value}
              style={[s.chip, tipo === t.value && s.chipActivo]}
              onPress={() => setTipo(t.value)}
            >
              <Text style={[s.chipText, tipo === t.value && s.chipTextActivo]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={s.label}>Notas (opcional)</Text>
        <TextInput
          style={s.input}
          placeholder="Ej: INE vigente, anverso y reverso"
          placeholderTextColor={Colors.dark[400]}
          value={notas}
          onChangeText={setNotas}
          multiline
          numberOfLines={3}
        />

        <View style={s.actions}>
          <Pressable style={s.btnCamara} onPress={abrirCamara}>
            <Text style={s.btnIcon}>📷</Text>
            <Text style={s.btnLabel}>Tomar foto</Text>
          </Pressable>
          <Pressable style={s.btnGaleria} onPress={seleccionarGaleria}>
            <Text style={s.btnIcon}>🖼️</Text>
            <Text style={s.btnLabel}>Galería</Text>
          </Pressable>
        </View>

        <Pressable style={s.btnCancelar} onPress={() => router.back()}>
          <Text style={s.btnCancelarText}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  // ── Cámara ────────────────────────────────────────────────────────────────
  if (mode === 'camara') {
    return (
      <View style={s.cameraContainer}>
        <CameraView ref={cameraRef} style={s.camera} facing={facing}>
          <View style={s.cameraOverlay}>
            <View style={s.cameraFrame} />
          </View>
          <View style={s.cameraControls}>
            <Pressable style={s.camBtn} onPress={() => setMode('selector')}>
              <Text style={s.camBtnTxt}>✕</Text>
            </Pressable>
            <Pressable style={s.shutter} onPress={tomarFoto}>
              <View style={s.shutterInner} />
            </Pressable>
            <Pressable style={s.camBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
              <Text style={s.camBtnTxt}>🔄</Text>
            </Pressable>
          </View>
        </CameraView>
      </View>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.previewScroll}>
        <Text style={s.title}>Revisar documento</Text>
        {imageUri && <Image source={{ uri: imageUri }} style={s.previewImg} resizeMode="contain" />}

        <Text style={s.label}>Tipo de documento</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
          {TIPOS_DOCUMENTO.map((t) => (
            <Pressable key={t.value} style={[s.chip, tipo === t.value && s.chipActivo]} onPress={() => setTipo(t.value)}>
              <Text style={[s.chipText, tipo === t.value && s.chipTextActivo]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={s.label}>Notas</Text>
        <TextInput
          style={s.input}
          placeholder="Descripción del documento..."
          placeholderTextColor={Colors.dark[400]}
          value={notas}
          onChangeText={setNotas}
          multiline
          numberOfLines={3}
        />

        <Pressable style={[s.btnSubir, uploading && s.btnDisabled]} onPress={subir} disabled={uploading}>
          {uploading
            ? <ActivityIndicator color={Colors.cream[50]} />
            : <Text style={s.btnSubirText}>Subir documento</Text>
          }
        </Pressable>
        <Pressable style={s.btnCancelar} onPress={() => setMode('selector')}>
          <Text style={s.btnCancelarText}>Volver a capturar</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream[50],
    padding: Spacing.base,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.dark[900],
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.dark[500],
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.dark[700],
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.dark[300],
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.dark[900],
    fontSize: Typography.fontSize.base,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexGrow: 0,
    marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.dark[300],
    marginRight: Spacing.sm,
    backgroundColor: Colors.white,
  },
  chipActivo: {
    backgroundColor: Colors.gold[400],
    borderColor: Colors.gold[400],
  },
  chipText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.dark[700],
  },
  chipTextActivo: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginTop: Spacing.xl,
  },
  btnCamara: {
    flex: 1,
    backgroundColor: Colors.gold[400],
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  btnGaleria: {
    flex: 1,
    backgroundColor: Colors.dark[800],
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  btnIcon: { fontSize: 28 },
  btnLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  btnCancelar: {
    marginTop: Spacing.base,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  btnCancelarText: {
    fontSize: Typography.fontSize.base,
    color: Colors.dark[500],
  },
  // Cámara
  cameraContainer: { flex: 1, backgroundColor: Colors.black },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraFrame: {
    width: 280,
    height: 200,
    borderWidth: 2,
    borderColor: Colors.gold[400],
    borderRadius: Radius.md,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 50,
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  camBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camBtnTxt: { fontSize: 22 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
  },
  // Preview
  previewScroll: {
    padding: Spacing.base,
    paddingBottom: Spacing['4xl'],
  },
  previewImg: {
    width: '100%',
    height: 260,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark[900],
    marginBottom: Spacing.base,
  },
  btnSubir: {
    backgroundColor: Colors.gold[400],
    borderRadius: Radius.lg,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  btnDisabled: { opacity: 0.6 },
  btnSubirText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
});
