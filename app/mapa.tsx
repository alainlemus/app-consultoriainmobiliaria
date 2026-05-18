/**
 * Pantalla: Mapa de Visitas
 * Ruta: /mapa
 */

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';

import { getContactos, getUbicacionesMapa, registrarUbicacion, subirFotosVisita } from '../src/services/api';
import { Colors, Radius, Spacing, Typography } from '../src/theme';
import type { Contacto, Ubicacion } from '../src/types';

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
  const { contacto_id, contacto_nombre } = useLocalSearchParams<{ contacto_id?: string; contacto_nombre?: string }>();

  const [ubicaciones, setUbicaciones]   = useState<Ubicacion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [registrando, setRegistrando]   = useState(false);
  const [userLoc, setUserLoc]           = useState<{ lat: number; lng: number } | null>(null);
  const [notas, setNotas]               = useState('');
  const [tipo, setTipo]                 = useState<'visita_cliente' | 'propiedad'>('visita_cliente');
  const [filtro, setFiltro]             = useState<string>('todos');
  const [municipio, setMunicipio]       = useState('');
  const [estadoVal, setEstadoVal]       = useState('');
  const [contactoId, setContactoId]     = useState<number | null>(null);
  const [prospectos, setProspectos]     = useState<Contacto[]>([]);
  const [busqProspecto, setBusqProspecto] = useState('');
  const [fotosSeleccionadas, setFotosSeleccionadas] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [detalle, setDetalle]           = useState<Ubicacion | null>(null);

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

  // Si llegamos desde el detalle de un prospecto, abrir modal con ese prospecto pre-seleccionado
  useEffect(() => {
    if (contacto_id && contacto_nombre) {
      const id = parseInt(contacto_id, 10);
      if (!isNaN(id)) {
        setContactoId(id);
        setBusqProspecto(contacto_nombre);
        // Pequeño delay para que el mapa cargue primero
        setTimeout(() => abrirRegistro(id, contacto_nombre), 500);
      }
    }
  // Solo al montar — los params no cambian
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const abrirRegistro = async (preContactoId?: number, preContactoNombre?: string) => {
    const loc = await obtenerGPS();
    if (!loc) return;
    setUserLoc(loc);
    setNotas('');
    setTipo('visita_cliente');
    setMunicipio('');
    setEstadoVal('');
    setContactoId(preContactoId ?? null);
    setBusqProspecto(preContactoNombre ?? '');
    setFotosSeleccionadas([]);
    // Cargar prospectos solo si no viene uno pre-seleccionado
    if (!preContactoId) {
      try {
        const res = await getContactos({ page: 1 });
        setProspectos(res.data);
      } catch { /* silencioso */ }
    }
    setModalVisible(true);
  };

  const agregarFotos = async (origen: 'camara' | 'galeria') => {
    const permisos = origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permisos.status !== 'granted') {
      Alert.alert('Permiso requerido', `Activa el acceso a ${origen === 'camara' ? 'la cámara' : 'la galería'} en Configuración.`);
      return;
    }

    const result = origen === 'camara'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsMultipleSelection: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, allowsMultipleSelection: true, selectionLimit: 5 });

    if (!result.canceled) {
      setFotosSeleccionadas(prev => {
        const nuevas = [...prev, ...result.assets];
        return nuevas.slice(0, 5); // máximo 5
      });
    }
  };

  const quitarFoto = (index: number) => {
    setFotosSeleccionadas(prev => prev.filter((_, i) => i !== index));
  };

  const registrar = async () => {
    if (!userLoc) return;
    setRegistrando(true);
    try {
      const ubicacion = await registrarUbicacion({
        latitud:      userLoc.lat,
        longitud:     userLoc.lng,
        tipo,
        notas:        notas     || undefined,
        municipio:    municipio || undefined,
        estado:       estadoVal || undefined,
        contacto_id:  contactoId ?? undefined,
        visitado_en:  new Date().toISOString(),
      });

      // Subir fotos si hay
      if (fotosSeleccionadas.length > 0 && ubicacion.id) {
        const fotos = fotosSeleccionadas.map((f, i) => ({
          uri:  f.uri,
          name: f.fileName ?? `foto_${i + 1}.jpg`,
          type: f.mimeType ?? 'image/jpeg',
        }));
        await subirFotosVisita(ubicacion.id, fotos);
      }

      setModalVisible(false);
      setNotas('');
      setMunicipio('');
      setEstadoVal('');
      setContactoId(null);
      setBusqProspecto('');
      setFotosSeleccionadas([]);
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
              onPress={() => setDetalle(u)}
            >
              <View style={[s.pin, { borderColor: TIPO_COLOR[u.tipo] }]}>
                <Text style={s.pinIcon}>{TIPO_ICON[u.tipo]}</Text>
                {(u.fotos?.length ?? 0) > 0 && (
                  <View style={s.fotoBadge}>
                    <Text style={s.fotoBadgeText}>{u.fotos!.length}</Text>
                  </View>
                )}
              </View>
            </Marker>
          ))}
        </MapView>

        {/* FABs */}
        <View style={s.fabs}>
          <Pressable style={s.fabSec} onPress={centrarEnMi}>
            <Text style={s.fabIcon}>🎯</Text>
          </Pressable>
          <Pressable style={s.fab} onPress={() => abrirRegistro()}>
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

              {/* Prospecto vinculado */}
              <Text style={s.sheetLabel}>
                Prospecto{contactoId ? ' ✓' : ' (opcional)'}
              </Text>
              {contactoId ? (
                // Pre-seleccionado — solo lectura con opción de quitar
                <View style={s.prospFijo}>
                  <Text style={s.prospFijoText}>{busqProspecto}</Text>
                  <Pressable onPress={() => { setContactoId(null); setBusqProspecto(''); }}>
                    <Text style={{ color: Colors.dark[400], fontSize: 16 }}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput
                    style={[s.sheetInput, { marginBottom: Spacing.sm }]}
                    placeholder="Buscar por nombre..."
                    placeholderTextColor={Colors.dark[400]}
                    value={busqProspecto}
                    onChangeText={setBusqProspecto}
                    returnKeyType="search"
                    blurOnSubmit
                  />
                  {busqProspecto.length > 0 && (
                    <View style={s.prospDropdown}>
                      {prospectos
                        .filter(p => p.nombre.toLowerCase().includes(busqProspecto.toLowerCase()))
                        .slice(0, 5)
                        .map(p => (
                          <Pressable
                            key={p.id}
                            style={s.prospItem}
                            onPress={() => { setContactoId(p.id); setBusqProspecto(p.nombre); }}
                          >
                            <Text style={s.prospItemText}>{p.nombre}</Text>
                          </Pressable>
                        ))
                      }
                      {prospectos.filter(p => p.nombre.toLowerCase().includes(busqProspecto.toLowerCase())).length === 0 && (
                        <Text style={s.prospVacio}>Sin resultados</Text>
                      )}
                    </View>
                  )}
                </>
              )}

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

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetLabel}>Municipio</Text>
                  <TextInput
                    style={[s.sheetInput, { marginBottom: 0 }]}
                    placeholder="Ej: Pachuca"
                    placeholderTextColor={Colors.dark[400]}
                    value={municipio}
                    onChangeText={setMunicipio}
                    returnKeyType="next"
                    blurOnSubmit
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetLabel}>Estado</Text>
                  <TextInput
                    style={[s.sheetInput, { marginBottom: 0 }]}
                    placeholder="Ej: Hidalgo"
                    placeholderTextColor={Colors.dark[400]}
                    value={estadoVal}
                    onChangeText={setEstadoVal}
                    returnKeyType="done"
                    blurOnSubmit
                  />
                </View>
              </View>

              <View style={{ height: 14 }} />

              {/* Fotos */}
              <Text style={s.sheetLabel}>
                Fotos{fotosSeleccionadas.length > 0 ? ` (${fotosSeleccionadas.length}/5)` : ' (opcional)'}
              </Text>
              <View style={s.fotosRow}>
                {fotosSeleccionadas.map((f, i) => (
                  <View key={i} style={s.fotoThumb}>
                    <Image source={{ uri: f.uri }} style={s.fotoImg} />
                    <TouchableOpacity style={s.fotoRemove} onPress={() => quitarFoto(i)}>
                      <Text style={{ color: Colors.white, fontSize: 10, fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {fotosSeleccionadas.length < 5 && (
                  <View style={s.fotosBtns}>
                    <TouchableOpacity style={s.fotoBtn} onPress={() => agregarFotos('camara')}>
                      <Text style={s.fotoBtnIcon}>📷</Text>
                      <Text style={s.fotoBtnText}>Cámara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.fotoBtn} onPress={() => agregarFotos('galeria')}>
                      <Text style={s.fotoBtnIcon}>🖼️</Text>
                      <Text style={s.fotoBtnText}>Galería</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

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

      {/* Modal detalle de visita con fotos */}
      <Modal visible={!!detalle} animationType="slide" transparent onRequestClose={() => setDetalle(null)}>
        <Pressable style={s.backdrop} onPress={() => setDetalle(null)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          {detalle && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* Tipo */}
              <View style={s.detalleHeader}>
                <Text style={s.detalleIconGrande}>{TIPO_ICON[detalle.tipo]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.detalleTipo}>
                    {detalle.tipo === 'visita_cliente' ? 'Visita cliente' : 'Propiedad'}
                  </Text>
                  <Text style={s.detalleFecha}>
                    {new Date(detalle.visitado_en).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </Text>
                </View>
                <Pressable onPress={() => setDetalle(null)} style={s.detalleClose}>
                  <Text style={{ color: Colors.dark[500], fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>

              {/* Info */}
              {detalle.contacto && (
                <View style={s.detalleRow}>
                  <Text style={s.detalleLabel}>Cliente</Text>
                  <Text style={s.detalleVal}>{detalle.contacto}</Text>
                </View>
              )}
              {detalle.notas ? (
                <View style={s.detalleRow}>
                  <Text style={s.detalleLabel}>Notas</Text>
                  <Text style={s.detalleVal}>{detalle.notas}</Text>
                </View>
              ) : null}
              <View style={s.detalleRow}>
                <Text style={s.detalleLabel}>Coordenadas</Text>
                <Text style={s.detalleVal}>{detalle.latitud.toFixed(6)}, {detalle.longitud.toFixed(6)}</Text>
              </View>

              {/* Fotos */}
              {(detalle.fotos?.length ?? 0) > 0 && (
                <>
                  <Text style={[s.sheetLabel, { marginTop: Spacing.base }]}>
                    Fotos ({detalle.fotos!.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      {detalle.fotos!.map(f => (
                        <View key={f.id} style={s.detalleThumb}>
                          <Image source={{ uri: f.url }} style={s.detalleImg} resizeMode="cover" />
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
            </ScrollView>
          )}
        </View>
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

  // Fotos
  fotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  fotoThumb: { width: 72, height: 72, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  fotoImg:   { width: '100%', height: '100%' },
  fotoRemove: {
    position: 'absolute', top: 3, right: 3,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  fotosBtns: { flexDirection: 'row', gap: Spacing.sm },
  fotoBtn: {
    width: 72, height: 72, borderRadius: Radius.md,
    borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: Colors.dark[300],
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white, gap: 2,
  },
  fotoBtnIcon: { fontSize: 22 },
  fotoBtnText: { fontSize: 9, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold },

  // Prospecto selector
  prospDropdown: {
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.dark[300],
    borderRadius: Radius.md, marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  prospItem: {
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.cream[200],
  },
  prospItemActivo: { backgroundColor: Colors.gold[400] },
  prospItemText: { fontSize: Typography.fontSize.sm, color: Colors.dark[900] },
  prospItemTextActivo: { color: Colors.white, fontWeight: Typography.fontWeight.semibold },
  prospVacio: { padding: Spacing.md, fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center' },
  prospLimpiar: { marginBottom: Spacing.sm, alignSelf: 'flex-start' },
  prospLimpiarText: { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  prospFijo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gold[50] ?? '#fffbeb',
    borderWidth: 1, borderColor: Colors.gold[400],
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    paddingVertical: 10, marginBottom: Spacing.md,
  },
  prospFijoText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900], flex: 1 },

  // Badge de foto en el pin del mapa
  fotoBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.gold[400], borderWidth: 1.5, borderColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  fotoBadgeText: { fontSize: 9, color: Colors.white, fontWeight: Typography.fontWeight.bold },

  // Modal detalle
  detalleHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, marginBottom: Spacing.base,
  },
  detalleIconGrande: { fontSize: 32 },
  detalleTipo: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.dark[900],
  },
  detalleFecha: { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2 },
  detalleClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.cream[200],
    alignItems: 'center', justifyContent: 'center',
  },
  detalleRow: {
    flexDirection: 'row', gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.cream[200],
  },
  detalleLabel: {
    width: 90, fontSize: Typography.fontSize.sm,
    color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold,
  },
  detalleVal: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[900] },
  detalleThumb: {
    width: 120, height: 120, borderRadius: Radius.md, overflow: 'hidden',
  },
  detalleImg: { width: '100%', height: '100%' },
});
