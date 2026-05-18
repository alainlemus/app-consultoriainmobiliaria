/**
 * Pantalla: Mapa de Visitas
 * Ruta: /mapa
 */

import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';

import { getUbicacionesMapa, registrarUbicacion } from '../src/services/api';
import { Colors, Radius, Spacing, Typography } from '../src/theme';
import type { Ubicacion } from '../src/types';

const TIPO_COLOR: Record<string, string> = {
  visita_cliente: Colors.gold[400],
  propiedad:      Colors.dark[700],
};
const TIPO_ICON: Record<string, string> = {
  visita_cliente: '🏠',
  propiedad:      '🏢',
};

const REGION_CDMX: Region = {
  latitude: 19.4326, longitude: -99.1332,
  latitudeDelta: 0.15, longitudeDelta: 0.15,
};

export default function MapaScreen() {
  const mapRef = useRef<MapView>(null);

  const [ubicaciones, setUbicaciones]   = useState<Ubicacion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [registrando, setRegistrando]   = useState(false);
  const [userLoc, setUserLoc]           = useState<{ lat: number; lng: number } | null>(null);
  const [notas, setNotas]               = useState('');
  const [tipo, setTipo]                 = useState<'visita_cliente' | 'propiedad'>('visita_cliente');
  const [filtro, setFiltro]             = useState<string>('todos');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUbicacionesMapa();
      setUbicaciones(data);
      if (data.length > 0) {
        const u = data[data.length - 1];
        mapRef.current?.animateToRegion({
          latitude: u.latitud, longitude: u.longitud,
          latitudeDelta: 0.12, longitudeDelta: 0.12,
        }, 600);
      }
    } catch {
      Alert.alert('Error', 'No se pudieron cargar las visitas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const obtenerGPS = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el acceso a ubicación en Configuración.');
      return null;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  };

  const centrarEnMi = async () => {
    const loc = await obtenerGPS();
    if (!loc) return;
    setUserLoc(loc);
    mapRef.current?.animateToRegion({
      latitude: loc.lat, longitude: loc.lng,
      latitudeDelta: 0.05, longitudeDelta: 0.05,
    }, 600);
  };

  const abrirRegistro = async () => {
    const loc = await obtenerGPS();
    if (!loc) return;
    setUserLoc(loc);
    setNotas('');
    setTipo('visita_cliente');
    setModalVisible(true);
  };

  const registrar = async () => {
    if (!userLoc) return;
    setRegistrando(true);
    try {
      await registrarUbicacion({
        latitud:     userLoc.lat,
        longitud:    userLoc.lng,
        tipo,
        notas:       notas || undefined,
        visitado_en: new Date().toISOString(),
      });
      setModalVisible(false);
      await cargar();
    } catch (e: unknown) {
      Alert.alert('Error al registrar', e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setRegistrando(false);
    }
  };

  const marcadores = filtro === 'todos'
    ? ubicaciones
    : ubicaciones.filter(u => u.tipo === filtro);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <View>
          <Text style={s.headerTitle}>Mapa de visitas</Text>
          <Text style={s.headerSub}>{ubicaciones.length} registros</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={s.filtros}>
        {['todos', 'visita_cliente', 'propiedad'].map(f => (
          <Pressable key={f} style={[s.chip, filtro === f && s.chipActivo]} onPress={() => setFiltro(f)}>
            <Text style={[s.chipText, filtro === f && s.chipTextActivo]}>
              {f === 'todos' ? 'Todos' : f === 'visita_cliente' ? '🏠 Clientes' : '🏢 Propiedades'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Mapa */}
      <View style={s.mapWrap}>
        {loading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.gold[400]} />
          </View>
        )}

        <MapView ref={mapRef} style={s.map} initialRegion={REGION_CDMX} showsUserLocation showsMyLocationButton={false}>
          {marcadores.map((u, i) => (
            <Marker
              key={u.id ?? `l-${i}`}
              coordinate={{ latitude: u.latitud, longitude: u.longitud }}
              pinColor={TIPO_COLOR[u.tipo]}
            >
              <View style={[s.pin, { borderColor: TIPO_COLOR[u.tipo] }]}>
                <Text style={s.pinIcon}>{TIPO_ICON[u.tipo]}</Text>
              </View>
              <Callout tooltip>
                <View style={s.callout}>
                  <Text style={s.calloutTipo}>{u.tipo === 'visita_cliente' ? 'Visita cliente' : 'Propiedad'}</Text>
                  {u.notas ? <Text style={s.calloutNotas}>{u.notas}</Text> : null}
                  <Text style={s.calloutFecha}>
                    {new Date(u.visitado_en).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {/* FABs */}
        <View style={s.fabs}>
          <Pressable style={s.fabSec} onPress={centrarEnMi}>
            <Text style={s.fabIcon}>🎯</Text>
          </Pressable>
          <Pressable style={s.fab} onPress={abrirRegistro}>
            <Text style={s.fabIcon}>＋</Text>
          </Pressable>
        </View>
      </View>

      {/* Modal nueva visita */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={s.backdrop} onPress={() => setModalVisible(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <Text style={s.sheetTitle}>Registrar visita</Text>

              <Text style={s.sheetLabel}>Tipo</Text>
              <View style={s.tipoRow}>
                {(['visita_cliente', 'propiedad'] as const).map(t => (
                  <Pressable key={t} style={[s.tipoBtn, tipo === t && s.tipoBtnActivo]} onPress={() => setTipo(t)}>
                    <Text style={s.tipoBtnIcon}>{TIPO_ICON[t]}</Text>
                    <Text style={[s.tipoBtnText, tipo === t && s.tipoBtnTextActivo]}>
                      {t === 'visita_cliente' ? 'Cliente' : 'Propiedad'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.sheetLabel}>Notas</Text>
              <TextInput
                style={s.sheetInput}
                placeholder="Ej: Primera visita, interesado en crédito FOVISSSTE"
                placeholderTextColor={Colors.dark[400]}
                value={notas}
                onChangeText={setNotas}
                multiline
                numberOfLines={3}
                returnKeyType="done"
                blurOnSubmit
              />

              {userLoc && (
                <Text style={s.coords}>
                  📍 {userLoc.lat.toFixed(5)}, {userLoc.lng.toFixed(5)}
                </Text>
              )}

              <Pressable style={[s.btnGuardar, registrando && s.btnDisabled]} onPress={registrar} disabled={registrando}>
                {registrando
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={s.btnGuardarText}>Guardar visita</Text>
                }
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream[50] },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingTop: 56,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.dark[900],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: Colors.white, fontSize: 18 },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  headerSub: { fontSize: Typography.fontSize.xs, color: Colors.gold[300] },

  filtros: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.dark[900],
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipActivo: { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  chipText: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)' },
  chipTextActivo: { color: Colors.white, fontWeight: Typography.fontWeight.bold },

  mapWrap: { flex: 1, position: 'relative' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(250,248,243,0.8)',
  },
  map: { flex: 1 },

  pin: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.white, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4,
  },
  pinIcon: { fontSize: 18 },

  callout: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, minWidth: 160,
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 6,
  },
  calloutTipo:  { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900], marginBottom: 2 },
  calloutNotas: { fontSize: Typography.fontSize.xs, color: Colors.dark[600], marginBottom: 2 },
  calloutFecha: { fontSize: Typography.fontSize.xs, color: Colors.dark[400] },

  fabs: {
    position: 'absolute', bottom: 32, right: 20,
    gap: Spacing.md, alignItems: 'center',
  },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.gold[400],
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 8,
  },
  fabSec: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.dark[800],
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4,
  },
  fabIcon: { fontSize: 22, color: Colors.white },

  // Modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.cream[50],
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.base, paddingBottom: 32,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.dark[300], alignSelf: 'center', marginBottom: Spacing.base,
  },
  sheetTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.dark[900], marginBottom: Spacing.base,
  },
  sheetLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.dark[700], marginBottom: Spacing.sm,
  },
  tipoRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.base },
  tipoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.dark[300], backgroundColor: Colors.white,
  },
  tipoBtnActivo: { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  tipoBtnIcon: { fontSize: 18 },
  tipoBtnText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[700] },
  tipoBtnTextActivo: { color: Colors.white },
  sheetInput: {
    backgroundColor: Colors.white, borderWidth: 1,
    borderColor: Colors.dark[300], borderRadius: Radius.md,
    padding: Spacing.md, color: Colors.dark[900],
    fontSize: Typography.fontSize.base, textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  coords: { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginBottom: Spacing.base },
  btnGuardar: {
    backgroundColor: Colors.gold[400], borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnGuardarText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
});
