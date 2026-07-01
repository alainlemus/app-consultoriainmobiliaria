/**
 * Pantalla: Registrar Anuncio Publicitario
 * Ruta: /anuncio/nuevo
 *
 * El asesor registra dónde colocó propaganda (lona, hoja, volante, etc.)
 * desde su ubicación GPS actual, con fotos opcionales.
 *
 * Soporte offline: si no hay red, el anuncio se encola en AsyncStorage y
 * se sincroniza automáticamente cuando se recupera la conexión.
 */

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useState } from 'react';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { registrarAnuncio, subirFotosAnuncio } from '../../src/services/api';
import { encolarAnuncio, encolarFotos } from '../../src/services/offline';
import { comprimirFotos } from '../../src/utils/comprimirFoto';
import { useSyncContext } from '../../src/contexts/SyncContext';
import { Colors, Radius, Spacing, Typography } from '../../src/theme';
import type { TipoAnuncio } from '../../src/types';
import { ANUNCIO_TIPO_EMOJI, ANUNCIO_TIPO_LABEL } from '../../src/types';

const TIPOS: TipoAnuncio[] = ['lona', 'hoja_tienda', 'hoja_poste', 'volante', 'otro'];

export default function NuevoAnuncioScreen() {
  const insets = useSafeAreaInsets();
  const { online, refrescar } = useSyncContext();

  const [tipo,        setTipo]        = useState<TipoAnuncio>('hoja_poste');
  const [descripcion, setDescripcion] = useState('');
  const [colocadoEn,  setColocadoEn]  = useState(new Date().toISOString().split('T')[0]);
  const [fotos,       setFotos]       = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [guardando,   setGuardando]   = useState(false);
  const [gpsMsg,      setGpsMsg]      = useState('');

  async function handleGuardar() {
    setGuardando(true);
    setGpsMsg('Obteniendo ubicación GPS…');
    try {
      // 1. Pedir permiso y obtener GPS
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a ubicación en Configuración.');
        return;
      }

      const loc = await Promise.race<Location.LocationObject | null>([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 15000)),
      ]);

      if (!loc) {
        const last = await Location.getLastKnownPositionAsync();
        if (!last) {
          Alert.alert('Sin GPS', 'No se pudo obtener la ubicación. Verifica que el GPS esté activo.');
          return;
        }
        Alert.alert('Ubicación aproximada', 'Se usó la última ubicación conocida.');
      }

      const coords = loc?.coords ?? (await Location.getLastKnownPositionAsync())?.coords;
      if (!coords) {
        Alert.alert('Error GPS', 'No se pudo obtener coordenadas.');
        return;
      }

      const fotosPayload = fotos.length > 0
        ? await comprimirFotos(fotos, 'anuncio')
        : [];

      // Sube las fotos en background sin retener al asesor en pantalla.
      // Si falla → encola en FOTOS_QUEUE para reintento automático.
      const subirFotosBackground = (anuncioId: number) => {
        if (fotosPayload.length === 0) return;
        subirFotosAnuncio(anuncioId, fotosPayload).catch(() => {
          encolarFotos({
            entidad:    'anuncio',
            entidad_id: anuncioId,
            fotos:      fotosPayload,
          });
        });
      };

      // 2a. Con red: intentar guardar directo
      if (online) {
        setGpsMsg('Guardando anuncio…');
        try {
          const anuncio = await registrarAnuncio({
            latitud:     coords.latitude,
            longitud:    coords.longitude,
            tipo,
            descripcion: descripcion || undefined,
            colocado_en: colocadoEn,
          });

          // Anuncio guardado → cerrar pantalla inmediatamente
          // Las fotos se suben en background sin bloquear al asesor
          Alert.alert(
            '✓ Anuncio registrado',
            'Se guardó el anuncio en tu ubicación actual.',
            [{ text: 'Aceptar', onPress: () => router.back() }],
          );
          if (anuncio.id) subirFotosBackground(anuncio.id);
          return;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : '';
          const esErrorDeRed = msg.toLowerCase().includes('network') ||
                               msg.toLowerCase().includes('failed') ||
                               msg.toLowerCase().includes('timeout');
          if (!esErrorDeRed) {
            Alert.alert('Error', msg || 'No se pudo registrar el anuncio.');
            return;
          }
          // Error de red → encolar todo
        }
      }

      // 2b. Sin red (o con fallo de red): encolar para sync posterior
      setGpsMsg('Guardando localmente…');
      await encolarAnuncio({
        latitud:     coords.latitude,
        longitud:    coords.longitude,
        tipo,
        descripcion: descripcion || undefined,
        colocado_en: colocadoEn,
        fotos:       fotosPayload,
      });
      await refrescar();

      Alert.alert(
        '📋 Guardado sin conexión',
        'El anuncio se guardó en tu dispositivo y se enviará automáticamente cuando recuperes la conexión a internet.',
        [{ text: 'Aceptar', onPress: () => router.back() }],
      );
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo registrar el anuncio.');
    } finally {
      setGuardando(false);
      setGpsMsg('');
    }
  }

  async function agregarFotos() {
    const permisos = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permisos.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el acceso a la galería en Configuración.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsMultipleSelection: true,
      selectionLimit: 3,
    });
    if (!result.canceled) {
      setFotos(prev => [...prev, ...result.assets].slice(0, 3));
    }
  }

  async function tomarFoto() {
    const permisos = await ImagePicker.requestCameraPermissionsAsync();
    if (permisos.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el acceso a la cámara en Configuración.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setFotos(prev => [...prev, result.assets[0]].slice(0, 3));
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: Colors.cream[50] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <View>
          <Text style={s.headerTitle}>Nuevo anuncio</Text>
          <Text style={s.headerSub}>Registrar propaganda colocada</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Aviso GPS */}
        <View style={s.gpsNotice}>
          <Text style={s.gpsNoticeText}>
            📍 Se registrará tu ubicación GPS actual al guardar. Asegúrate de estar frente al anuncio.
          </Text>
        </View>

        {/* Tipo de anuncio */}
        <Text style={s.sectionLabel}>Tipo de anuncio</Text>
        <View style={s.tiposGrid}>
          {TIPOS.map(t => (
            <Pressable
              key={t}
              style={[s.tipoBtn, tipo === t && s.tipoBtnActive]}
              onPress={() => setTipo(t)}
            >
              <Text style={s.tipoEmoji}>{ANUNCIO_TIPO_EMOJI[t]}</Text>
              <Text style={[s.tipoLabel, tipo === t && s.tipoLabelActive]}>
                {ANUNCIO_TIPO_LABEL[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Fecha de colocación */}
        <Text style={s.sectionLabel}>Fecha de colocación</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            value={colocadoEn}
            onChangeText={setColocadoEn}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.dark[400]}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* Descripción */}
        <Text style={s.sectionLabel}>Descripción / notas (opcional)</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={[s.input, s.inputMulti]}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={3}
            placeholder="Ej: Lona en fachada de farmacia, esquina Av. Juárez con Morelos"
            placeholderTextColor={Colors.dark[400]}
            textAlignVertical="top"
          />
        </View>

        {/* Fotos */}
        <Text style={s.sectionLabel}>
          Fotos del anuncio{fotos.length > 0 ? ` (${fotos.length}/3)` : ' (opcional)'}
        </Text>
        <View style={s.fotosRow}>
          {fotos.map((f, i) => (
            <View key={i} style={s.fotoThumb}>
              <Image source={{ uri: f.uri }} style={s.fotoImg} />
              <Pressable
                style={s.fotoRemove}
                onPress={() => setFotos(prev => prev.filter((_, idx) => idx !== i))}
              >
                <Text style={{ color: Colors.white, fontSize: 10, fontWeight: 'bold' }}>✕</Text>
              </Pressable>
            </View>
          ))}
          {fotos.length < 3 && (
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TouchableOpacity style={s.fotoBtn} onPress={tomarFoto}>
                <Text style={s.fotoBtnIcon}>📷</Text>
                <Text style={s.fotoBtnText}>Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.fotoBtn} onPress={agregarFotos}>
                <Text style={s.fotoBtnIcon}>🖼️</Text>
                <Text style={s.fotoBtnText}>Galería</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Botón guardar */}
        <Pressable
          style={[s.saveBtn, guardando && s.saveBtnDisabled, !online && s.saveBtnOffline]}
          onPress={handleGuardar}
          disabled={guardando}
        >
          {guardando ? (
            <View style={{ alignItems: 'center', gap: Spacing.sm }}>
              <ActivityIndicator color={Colors.white} />
              {gpsMsg ? <Text style={s.saveBtnText}>{gpsMsg}</Text> : null}
            </View>
          ) : (
            <Text style={s.saveBtnText}>
              {online ? '📍 Registrar en mi ubicación actual' : '📋 Guardar sin conexión'}
            </Text>
          )}
        </Pressable>

        {!online && (
          <Text style={s.offlineHint}>
            Sin conexión. El anuncio se guardará localmente y se enviará cuando recuperes internet.
          </Text>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingBottom:     Spacing.md,
    backgroundColor:   Colors.dark[900],
  },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backIcon:   { color: Colors.white, fontSize: 18 },
  headerTitle:{ fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.white },
  headerSub:  { fontSize: Typography.fontSize.xs, color: Colors.gold[300] },

  body: { padding: Spacing.base, gap: Spacing.xs },

  gpsNotice: {
    backgroundColor: Colors.gold[50],
    borderWidth:     1,
    borderColor:     Colors.gold[300],
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    marginBottom:    Spacing.sm,
  },
  gpsNoticeText: {
    fontSize:   Typography.fontSize.sm,
    color:      Colors.gold[700],
    lineHeight: Typography.fontSize.sm * 1.5,
  },

  sectionLabel: {
    fontSize:      Typography.fontSize.xs,
    fontWeight:    Typography.fontWeight.semibold,
    color:         Colors.dark[500],
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop:     Spacing.md,
    marginBottom:  Spacing.xs,
  },

  tiposGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.sm,
  },
  tipoBtn: {
    width:           '47%',
    flexGrow:        1,
    alignItems:      'center',
    paddingVertical: Spacing.md,
    borderRadius:    Radius.md,
    borderWidth:     1.5,
    borderColor:     Colors.cream[300],
    backgroundColor: Colors.white,
    gap:             Spacing.xs,
    minHeight:       72,
    justifyContent:  'center',
  },
  tipoBtnActive: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  tipoEmoji:     { fontSize: Typography.fontSize.xl },
  tipoLabel:     { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[500], textAlign: 'center' },
  tipoLabelActive: { color: '#c2410c' },

  inputWrap: {
    backgroundColor: Colors.white,
    borderWidth:     1,
    borderColor:     Colors.cream[300],
    borderRadius:    Radius.md,
    paddingHorizontal: Spacing.md,
    marginBottom:    Spacing.xs,
  },
  input: {
    fontSize:        Typography.fontSize.base,
    color:           Colors.dark[900],
    paddingVertical: Spacing.md,
    minHeight:       48,
  },
  inputMulti: {
    minHeight:       90,
    paddingTop:      Spacing.md,
  },

  fotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  fotoThumb: { width: 72, height: 72, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  fotoImg:   { width: '100%', height: '100%' },
  fotoRemove: {
    position: 'absolute', top: 3, right: 3,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  fotoBtn: {
    width: 72, height: 72, borderRadius: Radius.md,
    borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: Colors.dark[300],
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white, gap: 2,
  },
  fotoBtnIcon: { fontSize: 22 },
  fotoBtnText: { fontSize: 9, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold },

  saveBtn: {
    marginTop:       Spacing.xl,
    backgroundColor: '#f97316',
    borderRadius:    Radius.md,
    paddingVertical: Spacing.base,
    alignItems:      'center',
    minHeight:       56,
    justifyContent:  'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnOffline:  { backgroundColor: Colors.dark[600] },
  saveBtnText: {
    color:      Colors.white,
    fontSize:   Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  offlineHint: {
    marginTop:  Spacing.sm,
    fontSize:   Typography.fontSize.xs,
    color:      Colors.dark[400],
    textAlign:  'center',
    lineHeight: Typography.fontSize.xs * 1.5,
  },
});
