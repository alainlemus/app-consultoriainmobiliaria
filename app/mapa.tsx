/**
 * Pantalla: Mapa de Visitas
 * Ruta: /mapa
 */

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
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

import { ESTADOS_MX, MUNICIPIOS_MX } from '../src/data/mexico';
import { getContactos, getUbicacionesMapa, registrarUbicacion, subirFotosVisita, actualizarSemaforoEscuela, getAnunciosMapa, actualizarEstadoAnuncio, getAsesores, type AsesorBasico } from '../src/services/api';
import { cacheUbicaciones, getCacheUbicaciones, getUbicacionesPendientesSync, upsertCacheUbicacion } from '../src/services/offline';
import { useSyncContext } from '../src/contexts/SyncContext';
import { useAuth } from '../src/contexts/AuthContext';
import { Colors, Radius, Spacing, Typography } from '../src/theme';
import type { Contacto, Ubicacion, SemaforoEscuela, Anuncio } from '../src/types';
import { ANUNCIO_TIPO_EMOJI, ANUNCIO_TIPO_LABEL } from '../src/types';

// ── Constantes de tipo ────────────────────────────────────────────────────────
const TIPO_COLOR: Record<string, string> = {
  visita_cliente: Colors.gold[400],
  propiedad:      Colors.dark[700],
  escuela:        '#3b82f6',
};
const TIPO_ICON: Record<string, string> = {
  visita_cliente: '🏠',
  propiedad:      '🏢',
  escuela:        '🏫',
};
const TIPO_LABEL: Record<string, string> = {
  visita_cliente: 'Cliente',
  propiedad:      'Propiedad',
  escuela:        'Escuela',
};

const SEMAFORO_COLOR: Record<SemaforoEscuela, string> = {
  verde:    '#22c55e',
  amarillo: '#f59e0b',
  rojo:     '#ef4444',
};
const SEMAFORO_EMOJI: Record<SemaforoEscuela, string> = {
  verde:    '🟢',
  amarillo: '🟡',
  rojo:     '🔴',
};
const SEMAFORO_LABEL: Record<SemaforoEscuela, string> = {
  verde:    'Hay maestros clientes',
  amarillo: 'Sin clientes aún',
  rojo:     'Acceso denegado',
};

const REGION_CDMX: Region = {
  latitude: 19.4326, longitude: -99.1332,
  latitudeDelta: 0.15, longitudeDelta: 0.15,
};

type TipoVisita = 'visita_cliente' | 'propiedad' | 'escuela';

export default function MapaScreen() {
  const mapRef    = useRef<MapView>(null);
  const searchRef = useRef<any>(null);
  const { contacto_id, contacto_nombre, lat, lng } = useLocalSearchParams<{
    contacto_id?: string;
    contacto_nombre?: string;
    lat?: string;
    lng?: string;
  }>();
  const { online, encolar } = useSyncContext();
  const { isSuperAdmin }    = useAuth();

  // Coordenadas de llegada (desde detalle de prospecto)
  const initLat = lat ? parseFloat(lat) : null;
  const initLng = lng ? parseFloat(lng) : null;

  const [ubicaciones, setUbicaciones]   = useState<Ubicacion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [registrando, setRegistrando]   = useState(false);
  const [userLoc, setUserLoc]           = useState<{ lat: number; lng: number } | null>(null);
  const [notas, setNotas]               = useState('');
  const [tipo, setTipo]                 = useState<TipoVisita>('visita_cliente');
  const [filtro, setFiltro]             = useState<string>('todos');
  const [detalle, setDetalle]           = useState<Ubicacion | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [desdeCache, setDesdeCache]     = useState(false);

  // ── Anuncios ───────────────────────────────────────────────────────────────
  const [anuncios,        setAnuncios]        = useState<Anuncio[]>([]);
  const [mostrarAnuncios, setMostrarAnuncios] = useState(true);
  const [detalleAnuncio,  setDetalleAnuncio]  = useState<Anuncio | null>(null);

  // ── Filtro por asesor (solo super_admin) ───────────────────────────────────
  const [asesores,       setAsesores]       = useState<AsesorBasico[]>([]);
  const [asesorFiltrado, setAsesorFiltrado] = useState<AsesorBasico | null>(null);
  const [modalAsesores,  setModalAsesores]  = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    getAsesores().then(setAsesores).catch(() => {});
  }, [isSuperAdmin]);

  // ── Semáforo ───────────────────────────────────────────────────────────────
  const [semaforoModal, setSemaforoModal]     = useState(false);
  const [semaforoEscuela, setSemaforoEscuela] = useState<Ubicacion | null>(null);
  const [semaforoNuevo, setSemaforoNuevo]     = useState<SemaforoEscuela>('amarillo');
  const [semaforoNotas, setSemaforoNotas]     = useState('');
  const [guardandoSemaforo, setGuardandoSemaforo] = useState(false);

  // ── Prospecto ──────────────────────────────────────────────────────────────
  const [contactoId, setContactoId]     = useState<number | null>(null);
  const [prospectos, setProspectos]     = useState<Contacto[]>([]);
  const [busqProspecto, setBusqProspecto] = useState('');

  // ── Nombre/dirección (propiedad / escuela) ─────────────────────────────────
  const [nombreLugar, setNombreLugar]   = useState('');
  const [direccion, setDireccion]       = useState('');

  // ── Estado buscador ────────────────────────────────────────────────────────
  const [busqEstado, setBusqEstado]         = useState('');
  const [estadoVal, setEstadoVal]           = useState('');
  const [estadoDropdownVisible, setEstadoDropdownVisible] = useState(false);
  const estadosFiltrados = ESTADOS_MX.filter(e =>
    e.toLowerCase().includes(busqEstado.toLowerCase())
  );

  // ── Municipio selector ─────────────────────────────────────────────────────
  const [municipio, setMunicipio]           = useState('');
  const [municipioDropdownVisible, setMunicipioDropdownVisible] = useState(false);
  const municipiosDelEstado: string[] = estadoVal ? (MUNICIPIOS_MX[estadoVal] ?? []) : [];

  // ── Fotos ──────────────────────────────────────────────────────────────────
  const [fotosSeleccionadas, setFotosSeleccionadas] = useState<ImagePicker.ImagePickerAsset[]>([]);

  // ── Buscador del mapa ──────────────────────────────────────────────────────
  const [busqMapa, setBusqMapa]           = useState('');
  const [busqVisible, setBusqVisible]     = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const resultadosBusq = useMemo(() => {
    if (busqMapa.trim().length < 2) return [];
    const q = busqMapa.toLowerCase();
    return ubicaciones.filter(u =>
      u.contacto?.toLowerCase().includes(q) ||
      u.nombre_lugar?.toLowerCase().includes(q) ||
      u.direccion?.toLowerCase().includes(q) ||
      u.municipio?.toLowerCase().includes(q) ||
      u.estado?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [busqMapa, ubicaciones]);

  // ── Navegación externa ─────────────────────────────────────────────────────
  const abrirNavegacion = async (lat: number, lng: number, app: 'google' | 'waze' | 'apple') => {
    const nativeUrls: Record<string, string> = {
      google: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
      waze:   `waze://ul?ll=${lat},${lng}&navigate=yes`,
      apple:  `maps://maps.apple.com/?daddr=${lat},${lng}`,
    };
    const webUrls: Record<string, string> = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
      waze:   `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      apple:  `http://maps.apple.com/?daddr=${lat},${lng}`,
    };
    try {
      const canOpen = await Linking.canOpenURL(nativeUrls[app]);
      await Linking.openURL(canOpen ? nativeUrls[app] : webUrls[app]);
    } catch {
      await Linking.openURL(webUrls[app]);
    }
  };

  // ── Carga datos del mapa ───────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);

    // Siempre mezclar con las ubicaciones pendientes de sync
    const pendientesCola = await getUbicacionesPendientesSync();

    if (!online) {
      // Sin red: cargar desde cache con filtro de asesor
      const cached = await getCacheUbicaciones();
      const filtradosPorAsesor = asesorFiltrado
        ? cached.filter(u => u.asesor_id === asesorFiltrado.id)
        : cached;
      const pendientesNuevos = pendientesCola.filter(p =>
        !filtradosPorAsesor.some(u => u._local_id === p._local_id)
      );
      setUbicaciones([...pendientesNuevos, ...filtradosPorAsesor]);
      setDesdeCache(true);
      setLoading(false);
      return;
    }

    try {
      const data = await getUbicacionesMapa(
        asesorFiltrado ? { asesor_id: asesorFiltrado.id } : undefined
      );
      const pendientesNuevos = pendientesCola.filter(p =>
        !data.some(u => u._local_id === p._local_id)
      );
      const todo = [...pendientesNuevos, ...data];
      setUbicaciones(todo);
      setDesdeCache(false);
      if (!asesorFiltrado) {
        cacheUbicaciones(data).catch(() => {});
      }

      // Cargar anuncios en paralelo (no bloqueante — fallo silencioso)
      getAnunciosMapa().then(setAnuncios).catch(() => {});

      if (todo.length > 0) {
        // Centrar en la última ubicación real (no pendiente)
        const ultima = data[data.length - 1];
        if (ultima?.latitud != null && ultima?.longitud != null) {
          mapRef.current?.animateToRegion({
            latitude: ultima.latitud, longitude: ultima.longitud,
            latitudeDelta: 0.12, longitudeDelta: 0.12,
          }, 600);
        }
      }
    } catch {
      // Fallo de red: caer al cache
      const cached = await getCacheUbicaciones();
      const filtradosPorAsesor = asesorFiltrado
        ? cached.filter(u => u.asesor_id === asesorFiltrado.id)
        : cached;
      const pendientesNuevos = pendientesCola.filter(p =>
        !filtradosPorAsesor.some(u => u._local_id === p._local_id)
      );
      setUbicaciones([...pendientesNuevos, ...filtradosPorAsesor]);
      setDesdeCache(true);
    } finally {
      setLoading(false);
    }
  }, [online, asesorFiltrado]);

  useEffect(() => { cargar(); }, [cargar]);

  // Verificar permiso de ubicación al montar — evita crash de showsUserLocation en Android
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setLocationPermission(status === 'granted');
    });
  }, []);

  // Centrar en coordenadas recibidas desde el detalle de un prospecto
  useEffect(() => {
    if (loading || initLat === null || initLng === null) return;
    // Centrar mapa
    setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: initLat, longitude: initLng,
        latitudeDelta: 0.02, longitudeDelta: 0.02,
      }, 700);
    }, 300);
    // Buscar la visita más cercana a esas coordenadas y mostrar detalle
    const match = ubicaciones.find(u =>
      u.latitud != null && u.longitud != null &&
      Math.abs(u.latitud - initLat) < 0.001 &&
      Math.abs(u.longitud - initLng) < 0.001
    );
    if (match) setTimeout(() => setDetalle(match), 1000);
  // Solo cuando termina la carga inicial
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Si llegamos desde el detalle de un prospecto para REGISTRAR visita
  // (no cuando llegamos con lat/lng a VER una ubicación existente)
  useEffect(() => {
    if (contacto_id && contacto_nombre && !lat && !lng) {
      const id = parseInt(contacto_id, 10);
      if (!isNaN(id)) {
        setContactoId(id);
        setBusqProspecto(contacto_nombre);
        setTimeout(() => abrirRegistro(id, contacto_nombre), 500);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Semáforo ──────────────────────────────────────────────────────────────
  const abrirSemaforoModal = (ubicacion: Ubicacion) => {
    setSemaforoEscuela(ubicacion);
    setSemaforoNuevo((ubicacion.semaforo as SemaforoEscuela) ?? 'amarillo');
    setSemaforoNotas(ubicacion.semaforo_notas ?? '');
    setSemaforoModal(true);
  };

  const guardarSemaforo = async () => {
    if (!semaforoEscuela?.id) return;
    setGuardandoSemaforo(true);
    try {
      const actualizada = await actualizarSemaforoEscuela(
        semaforoEscuela.id,
        semaforoNuevo,
        semaforoNotas || undefined,
      );
      // Actualizar en la lista local sin recargar todo
      setUbicaciones(prev =>
        prev.map(u => u.id === actualizada.id ? { ...u, semaforo: actualizada.semaforo, semaforo_notas: actualizada.semaforo_notas } : u)
      );
      // Actualizar el detalle si está abierto
      if (detalle?.id === actualizada.id) {
        setDetalle(prev => prev ? { ...prev, semaforo: actualizada.semaforo, semaforo_notas: actualizada.semaforo_notas } : prev);
      }
      setSemaforoModal(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar el semáforo.');
    } finally {
      setGuardandoSemaforo(false);
    }
  };

  // ── GPS ───────────────────────────────────────────────────────────────────
  const obtenerGPS = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el acceso a ubicación en Configuración.');
      return null;
    }
    setLocationPermission(true);
    try {
      // Timeout de 15s — evita ANR en Android 15 (Samsung) con Accuracy.High
      const loc = await Promise.race<Location.LocationObject | null>([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 15000)),
      ]);
      if (!loc) {
        // Fallback: última posición conocida
        const last = await Location.getLastKnownPositionAsync();
        if (!last) {
          Alert.alert('Sin ubicación', 'Verifica que el GPS esté activado.');
          return null;
        }
        return { lat: last.coords.latitude, lng: last.coords.longitude };
      }
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    } catch {
      Alert.alert('Error GPS', 'No se pudo obtener la ubicación.');
      return null;
    }
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

  // ── Abrir modal ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setNotas('');
    setTipo('visita_cliente');
    setNombreLugar('');
    setDireccion('');
    setBusqEstado('');
    setEstadoVal('');
    setEstadoDropdownVisible(false);
    setMunicipio('');
    setMunicipioDropdownVisible(false);
    setFotosSeleccionadas([]);
  };

  const abrirRegistro = async (preContactoId?: number, preContactoNombre?: string) => {
    const loc = await obtenerGPS();
    if (!loc) return;
    setUserLoc(loc);
    resetForm();
    setContactoId(preContactoId ?? null);
    setBusqProspecto(preContactoNombre ?? '');
    if (!preContactoId) {
      try {
        const res = await getContactos({ page: 1 });
        setProspectos(res.data);
      } catch { /* silencioso */ }
    }
    setModalVisible(true);
  };

  // ── Fotos ─────────────────────────────────────────────────────────────────
  const agregarFotos = async (origen: 'camara' | 'galeria') => {
    const permisos = origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permisos.status !== 'granted') {
      Alert.alert('Permiso requerido', `Activa el acceso a ${origen === 'camara' ? 'la cámara' : 'la galería'} en Configuración.`);
      return;
    }
    const result = origen === 'camara'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsMultipleSelection: true, selectionLimit: 5 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, allowsMultipleSelection: true, selectionLimit: 5 });
    if (!result.canceled) {
      setFotosSeleccionadas(prev => [...prev, ...result.assets].slice(0, 5));
    }
  };

  const quitarFoto = (index: number) => {
    setFotosSeleccionadas(prev => prev.filter((_, i) => i !== index));
  };

  // ── Guardar visita ────────────────────────────────────────────────────────
  const registrar = async () => {
    if (!userLoc) return;
    setRegistrando(true);

    const payload = {
      latitud:      userLoc.lat,
      longitud:     userLoc.lng,
      tipo,
      nombre_lugar: nombreLugar || undefined,
      direccion:    direccion   || undefined,
      notas:        notas       || undefined,
      municipio:    municipio   || undefined,
      estado:       estadoVal   || undefined,
      contacto_id:  tipo === 'visita_cliente' ? (contactoId ?? undefined) : undefined,
      visitado_en:  new Date().toISOString(),
    };

    try {
      if (!online) {
        // ── Sin red: encolar y guardar en cache local para verla de inmediato ──
        const localId = await encolar('registrar_ubicacion', payload as any);
        await upsertCacheUbicacion({
          ...payload,
          _local_id:       localId,
          _pendiente_sync: true,
          visitado_en:     payload.visitado_en,
        } as Ubicacion);
        setModalVisible(false);
        resetForm();
        setContactoId(null);
        setBusqProspecto('');
        // Recargar para que aparezca en el mapa
        await cargar();
        return;
      }

      const ubicacion = await registrarUbicacion(payload);

      // Guardar en caché local también cuando hay internet
      await upsertCacheUbicacion({ ...ubicacion, _pendiente_sync: false });

      if (fotosSeleccionadas.length > 0 && ubicacion.id) {
        const fotos = fotosSeleccionadas.map((f, i) => ({
          uri:  f.uri,
          name: f.fileName ?? `foto_${i + 1}.jpg`,
          type: f.mimeType ?? 'image/jpeg',
        }));
        await subirFotosVisita(ubicacion.id, fotos);
      }

      setModalVisible(false);
      resetForm();
      setContactoId(null);
      setBusqProspecto('');
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Mapa de visitas</Text>
          <Text style={s.headerSub}>{ubicaciones.filter(u => !u._pendiente_sync).length} registros{desdeCache ? ' · sin conexión' : ''}</Text>
        </View>
      </View>

      {/* Banner offline */}
      {desdeCache && (
        <View style={s.cacheBanner}>
          <Text style={s.cacheText}>📴 Sin conexión — mostrando visitas guardadas en el dispositivo</Text>
        </View>
      )}

      {/* Filtros */}
      <View style={s.filtrosCont}>
        {(['todos', 'visita_cliente', 'propiedad', 'escuela'] as const).map(f => (
          <Pressable key={f} style={[s.chip, filtro === f && s.chipActivo]} onPress={() => setFiltro(f)}>
            <Text style={[s.chipText, filtro === f && s.chipTextActivo]}>
              {f === 'todos' ? 'Todos' : `${TIPO_ICON[f]} ${TIPO_LABEL[f]}`}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[s.chip, mostrarAnuncios && s.chipAnuncioActivo]}
          onPress={() => setMostrarAnuncios(v => !v)}
        >
          <Text style={[s.chipText, mostrarAnuncios && s.chipTextActivo]}>
            📢 Anuncios {anuncios.length > 0 ? `(${anuncios.filter(a => a.estado !== 'retirado').length})` : ''}
          </Text>
        </Pressable>
        {/* Filtro por asesor — solo super_admin */}
        {isSuperAdmin && (
          <Pressable
            style={[s.chip, asesorFiltrado ? s.chipAsesorActivo : null]}
            onPress={() => setModalAsesores(true)}
          >
            <Text style={[s.chipText, asesorFiltrado ? s.chipTextActivo : null]} numberOfLines={1}>
              👤 {asesorFiltrado ? asesorFiltrado.name : 'Todos'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Mapa */}
      <View style={s.mapWrap}>
        {loading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.gold[400]} />
          </View>
        )}

        <MapView ref={mapRef} style={s.map} initialRegion={REGION_CDMX} showsUserLocation={locationPermission} showsMyLocationButton={false} googleRenderer="LEGACY">
          {marcadores.filter(u => u.latitud != null && u.longitud != null).map((u, i) => {
            const semaforoColor = u.tipo === 'escuela' && u.semaforo
              ? SEMAFORO_COLOR[u.semaforo as SemaforoEscuela]
              : null;
            return (
              <Marker
                key={u.id ?? u._local_id ?? `l-${i}`}
                coordinate={{ latitude: u.latitud ?? 0, longitude: u.longitud ?? 0 }}
                pinColor={TIPO_COLOR[u.tipo]}
                onPress={() => setDetalle(u)}
              >
                <View style={[
                  s.pin,
                  { borderColor: semaforoColor ?? TIPO_COLOR[u.tipo] },
                  semaforoColor ? { borderWidth: 3 } : {},
                  u._pendiente_sync ? { opacity: 0.6, borderStyle: 'dashed' } : {},
                ]}>
                  <Text style={s.pinIcon}>{TIPO_ICON[u.tipo]}</Text>
                  {(u.fotos?.length ?? 0) > 0 && (
                    <View style={s.fotoBadge}>
                      <Text style={s.fotoBadgeText}>{u.fotos!.length}</Text>
                    </View>
                  )}
                  {/* Indicador de semáforo en la esquina del pin */}
                  {semaforoColor && (
                    <View style={[s.semaforoDot, { backgroundColor: semaforoColor }]} />
                  )}
                </View>
              </Marker>
            );
          })}

          {/* Marcadores de anuncios */}
          {mostrarAnuncios && anuncios.map((a, i) => (
            <Marker
              key={`anuncio-${a.id ?? i}`}
              coordinate={{ latitude: a.latitud, longitude: a.longitud }}
              onPress={() => setDetalleAnuncio(a)}
            >
              <View style={[
                s.pin,
                { borderColor: '#f97316', backgroundColor: '#fff7ed' },
                a.estado === 'retirado' ? { opacity: 0.45 } : {},
              ]}>
                <Text style={s.pinIcon}>{ANUNCIO_TIPO_EMOJI[a.tipo]}</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        {/* Buscador flotante sobre el mapa */}
        <View style={s.searchMapa} pointerEvents="box-none">
          <View style={s.searchMapaBar}>
            <Text style={s.searchMapaIco}>🔍</Text>
            <TextInput
              style={s.searchMapaTxt}
              placeholder="Buscar cliente, dirección, escuela..."
              placeholderTextColor={Colors.dark[400]}
              value={busqMapa}
              onChangeText={t => { setBusqMapa(t); setBusqVisible(t.length >= 2); }}
              returnKeyType="search"
              blurOnSubmit
            />
            {busqMapa.length > 0 && (
              <Pressable onPress={() => { setBusqMapa(''); setBusqVisible(false); }} style={{ paddingHorizontal: 6 }}>
                <Text style={{ color: Colors.dark[400], fontSize: 15 }}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Resultados */}
          {busqVisible && resultadosBusq.length > 0 && (
            <View style={s.searchMapaDrop}>
              {resultadosBusq.map((u, i) => (
                <Pressable
                  key={u.id ?? `r${i}`}
                  style={[s.searchMapaItem, i < resultadosBusq.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.cream[200] }]}
                  onPress={() => {
                    setBusqMapa('');
                    setBusqVisible(false);
                    mapRef.current?.animateToRegion({
                      latitude: u.latitud ?? 0, longitude: u.longitud ?? 0,
                      latitudeDelta: 0.02, longitudeDelta: 0.02,
                    }, 600);
                    setTimeout(() => setDetalle(u), 700);
                  }}
                >
                  <Text style={s.searchMapaItemIco}>{TIPO_ICON[u.tipo]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.searchMapaItemPrim} numberOfLines={1}>
                      {u.nombre_lugar || u.contacto || u.municipio || 'Sin nombre'}
                    </Text>
                    {(u.direccion || u.municipio || u.estado) ? (
                      <Text style={s.searchMapaItemSec} numberOfLines={1}>
                        {[u.direccion, u.municipio, u.estado].filter(Boolean).join(', ')}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ color: Colors.gold[400], fontSize: 13 }}>›</Text>
                </Pressable>
              ))}
            </View>
          )}
          {busqVisible && resultadosBusq.length === 0 && busqMapa.length >= 2 && (
            <View style={[s.searchMapaDrop, { paddingVertical: Spacing.md }]}>
              <Text style={{ color: Colors.dark[500], fontSize: Typography.fontSize.sm, textAlign: 'center' }}>
                Sin resultados para "{busqMapa}"
              </Text>
            </View>
          )}
        </View>

        {/* FABs */}
        <View style={s.fabs}>
          <Pressable style={s.fabSec} onPress={centrarEnMi}>
            <Text style={s.fabIcon}>🎯</Text>
          </Pressable>
          {/* FAB anuncio — naranja para distinguirlo */}
          <Pressable style={s.fabAnuncio} onPress={() => router.push('/anuncio/nuevo')}>
            <Text style={s.fabIcon}>📢</Text>
          </Pressable>
          <Pressable style={s.fab} onPress={() => abrirRegistro()}>
            <Text style={s.fabIcon}>＋</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Modal: registrar visita ─────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={s.backdrop} onPress={() => setModalVisible(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <Text style={s.sheetTitle}>Registrar visita</Text>

              {/* ── Tipo ─────────────────────────────────────────────────── */}
              <Text style={s.sheetLabel}>Tipo</Text>
              <View style={s.tipoRow}>
                {(['visita_cliente', 'propiedad', 'escuela'] as TipoVisita[]).map(t => (
                  <Pressable
                    key={t}
                    style={[s.tipoBtn, tipo === t && { backgroundColor: TIPO_COLOR[t], borderColor: TIPO_COLOR[t] }]}
                    onPress={() => setTipo(t)}
                  >
                    <Text style={s.tipoBtnIcon}>{TIPO_ICON[t]}</Text>
                    <Text style={[s.tipoBtnText, tipo === t && s.tipoBtnTextActivo]}>
                      {TIPO_LABEL[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* ── Prospecto (solo visita_cliente) ───────────────────────── */}
              {tipo === 'visita_cliente' && (
                <>
                  <Text style={s.sheetLabel}>
                    Prospecto{contactoId ? ' ✓' : ' (opcional)'}
                  </Text>
                  {contactoId ? (
                    <View style={s.prospFijo}>
                      <Text style={s.prospFijoText}>{busqProspecto}</Text>
                      <Pressable onPress={() => { setContactoId(null); setBusqProspecto(''); }}>
                        <Text style={{ color: Colors.dark[400], fontSize: 16 }}>✕</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {/* Buscador con ícono lupa */}
                      <View style={s.searchWrap}>
                        <Text style={s.searchIcon}>🔍</Text>
                        <TextInput
                          style={s.searchInput}
                          placeholder="Buscar prospecto por nombre..."
                          placeholderTextColor={Colors.dark[400]}
                          value={busqProspecto}
                          onChangeText={setBusqProspecto}
                          returnKeyType="search"
                          blurOnSubmit
                        />
                        {busqProspecto.length > 0 && (
                          <Pressable onPress={() => setBusqProspecto('')} style={s.searchClear}>
                            <Text style={{ color: Colors.dark[400], fontSize: 14 }}>✕</Text>
                          </Pressable>
                        )}
                      </View>
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
                </>
              )}

              {/* ── Nombre y dirección (propiedad / escuela) ──────────────── */}
              {(tipo === 'propiedad' || tipo === 'escuela') && (
                <>
                  <Text style={s.sheetLabel}>
                    {tipo === 'escuela' ? 'Nombre de la escuela' : 'Nombre de la propiedad'}
                  </Text>
                  <TextInput
                    style={s.sheetInput}
                    placeholder={tipo === 'escuela' ? 'Ej: Escuela Primaria Benito Juárez' : 'Ej: Casa Lomas, Depto 302'}
                    placeholderTextColor={Colors.dark[400]}
                    value={nombreLugar}
                    onChangeText={setNombreLugar}
                    returnKeyType="next"
                    blurOnSubmit
                  />
                  <Text style={s.sheetLabel}>Dirección</Text>
                  <TextInput
                    style={s.sheetInput}
                    placeholder="Ej: Av. Insurgentes 123, Col. Centro"
                    placeholderTextColor={Colors.dark[400]}
                    value={direccion}
                    onChangeText={setDireccion}
                    returnKeyType="next"
                    blurOnSubmit
                  />
                </>
              )}

              {/* ── Estado (buscador) ─────────────────────────────────────── */}
              <Text style={s.sheetLabel}>Estado</Text>
              <View style={s.searchWrap}>
                <Text style={s.searchIcon}>🔍</Text>
                <TextInput
                  style={s.searchInput}
                  placeholder="Buscar estado..."
                  placeholderTextColor={Colors.dark[400]}
                  value={busqEstado}
                  onChangeText={txt => {
                    setBusqEstado(txt);
                    setEstadoDropdownVisible(txt.length > 0);
                    // Si el usuario borra el estado, limpia municipio
                    if (txt === '') { setEstadoVal(''); setMunicipio(''); }
                  }}
                  onFocus={() => { if (busqEstado.length > 0) setEstadoDropdownVisible(true); }}
                  returnKeyType="done"
                  blurOnSubmit
                />
                {busqEstado.length > 0 && (
                  <Pressable onPress={() => { setBusqEstado(''); setEstadoVal(''); setMunicipio(''); setEstadoDropdownVisible(false); }} style={s.searchClear}>
                    <Text style={{ color: Colors.dark[400], fontSize: 14 }}>✕</Text>
                  </Pressable>
                )}
              </View>
              {estadoDropdownVisible && estadosFiltrados.length > 0 && (
                <View style={s.dropdownWrap}>
                  <FlatList
                    data={estadosFiltrados}
                    keyExtractor={item => item}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <Pressable
                        style={s.dropdownItem}
                        onPress={() => {
                          setEstadoVal(item);
                          setBusqEstado(item);
                          setEstadoDropdownVisible(false);
                          setMunicipio('');
                          setMunicipioDropdownVisible(false);
                        }}
                      >
                        <Text style={s.dropdownItemText}>{item}</Text>
                      </Pressable>
                    )}
                  />
                </View>
              )}

              {/* ── Municipio (se activa al elegir estado) ────────────────── */}
              {estadoVal !== '' && (
                <>
                  <Text style={s.sheetLabel}>Municipio</Text>
                  <Pressable
                    style={[s.searchWrap, { paddingRight: Spacing.md }]}
                    onPress={() => setMunicipioDropdownVisible(v => !v)}
                  >
                    <Text style={s.searchIcon}>📍</Text>
                    <Text style={[s.searchInput, { flex: 1, color: municipio ? Colors.dark[900] : Colors.dark[400] }]}>
                      {municipio || 'Seleccionar municipio...'}
                    </Text>
                    <Text style={{ color: Colors.dark[400], fontSize: 12 }}>
                      {municipioDropdownVisible ? '▲' : '▼'}
                    </Text>
                  </Pressable>
                  {municipioDropdownVisible && (
                    <View style={[s.dropdownWrap, { maxHeight: 180 }]}>
                      <FlatList
                        data={municipiosDelEstado}
                        keyExtractor={item => item}
                        nestedScrollEnabled
                        style={{ maxHeight: 176 }}
                        renderItem={({ item }) => (
                          <Pressable
                            style={[s.dropdownItem, municipio === item && s.dropdownItemActivo]}
                            onPress={() => { setMunicipio(item); setMunicipioDropdownVisible(false); }}
                          >
                            <Text style={[s.dropdownItemText, municipio === item && { color: Colors.white }]}>
                              {item}
                            </Text>
                          </Pressable>
                        )}
                      />
                    </View>
                  )}
                </>
              )}

              <View style={{ height: 4 }} />

              {/* ── Notas ─────────────────────────────────────────────────── */}
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

              {/* ── Fotos ─────────────────────────────────────────────────── */}
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

      {/* ── Modal: detalle de visita ──────────────────────────────────────────── */}
      <Modal visible={!!detalle} animationType="slide" transparent onRequestClose={() => setDetalle(null)}>
        <Pressable style={s.backdrop} onPress={() => setDetalle(null)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          {detalle && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* Badge de pendiente sync */}
              {detalle._pendiente_sync && (
                <View style={s.pendienteSyncBanner}>
                  <Text style={s.pendienteSyncText}>⏳ Pendiente de sincronizar — se enviará cuando haya conexión</Text>
                </View>
              )}
              <View style={s.detalleHeader}>
                <View style={[s.detalleIconWrap, { backgroundColor: TIPO_COLOR[detalle.tipo] + '22', borderColor: TIPO_COLOR[detalle.tipo] }]}>
                  <Text style={s.detalleIconGrande}>{TIPO_ICON[detalle.tipo]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.detalleTipo}>{TIPO_LABEL[detalle.tipo]}</Text>
                  {detalle.nombre_lugar ? (
                    <Text style={s.detalleNombreLugar}>{detalle.nombre_lugar}</Text>
                  ) : null}
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

              {detalle.contacto && (
                <View style={s.detalleRow}>
                  <Text style={s.detalleLabel}>Cliente</Text>
                  <Text style={s.detalleVal}>{detalle.contacto}</Text>
                </View>
              )}

              {/* Semáforo — solo escuelas */}
              {detalle.tipo === 'escuela' && (
                <View style={s.semaforoSection}>
                  <Text style={s.semaforoTitulo}>Estado del semáforo</Text>
                  <View style={s.semaforoRow}>
                    <Text style={s.semaforoEmoji}>
                      {SEMAFORO_EMOJI[(detalle.semaforo as SemaforoEscuela) ?? 'amarillo']}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.semaforoLabel}>
                        {SEMAFORO_LABEL[(detalle.semaforo as SemaforoEscuela) ?? 'amarillo']}
                      </Text>
                      {detalle.semaforo_notas ? (
                        <Text style={s.semaforoNotas}>{detalle.semaforo_notas}</Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={s.semaforoCambiarBtn}
                      onPress={() => { setDetalle(null); setTimeout(() => abrirSemaforoModal(detalle), 300); }}
                    >
                      <Text style={s.semaforoCambiarText}>Cambiar</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {detalle.direccion ? (
                <View style={s.detalleRow}>
                  <Text style={s.detalleLabel}>Dirección</Text>
                  <Text style={s.detalleVal}>{detalle.direccion}</Text>
                </View>
              ) : null}
              {detalle.municipio || detalle.estado ? (
                <View style={s.detalleRow}>
                  <Text style={s.detalleLabel}>Ubicación</Text>
                  <Text style={s.detalleVal}>
                    {[detalle.municipio, detalle.estado].filter(Boolean).join(', ')}
                  </Text>
                </View>
              ) : null}
              {detalle.notas ? (
                <View style={s.detalleRow}>
                  <Text style={s.detalleLabel}>Notas</Text>
                  <Text style={s.detalleVal}>{detalle.notas}</Text>
                </View>
              ) : null}
              <View style={s.detalleRow}>
                <Text style={s.detalleLabel}>Coordenadas</Text>
                <Text style={s.detalleVal}>
                  {detalle.latitud != null && detalle.longitud != null
                    ? `${detalle.latitud.toFixed(6)}, ${detalle.longitud.toFixed(6)}`
                    : 'Sin coordenadas registradas'}
                </Text>
              </View>

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

              {/* Cómo llegar */}
              <Text style={[s.sheetLabel, { marginTop: Spacing.base }]}>Cómo llegar</Text>
              <View style={s.navRow}>
                <Pressable
                  style={[s.navBtn, { backgroundColor: '#4285F4' }]}
                  onPress={() => detalle.latitud != null && detalle.longitud != null && abrirNavegacion(detalle.latitud, detalle.longitud, 'google')}
                >
                  <Text style={s.navBtnIco}>🗺️</Text>
                  <Text style={s.navBtnTxt}>Google Maps</Text>
                </Pressable>
                <Pressable
                  style={[s.navBtn, { backgroundColor: '#00C4B3' }]}
                  onPress={() => detalle.latitud != null && detalle.longitud != null && abrirNavegacion(detalle.latitud, detalle.longitud, 'waze')}
                >
                  <Text style={s.navBtnIco}>🚗</Text>
                  <Text style={s.navBtnTxt}>Waze</Text>
                </Pressable>
                {Platform.OS === 'ios' && (
                  <Pressable
                    style={[s.navBtn, { backgroundColor: Colors.dark[600] }]}
                    onPress={() => detalle.latitud != null && detalle.longitud != null && abrirNavegacion(detalle.latitud, detalle.longitud, 'apple')}
                  >
                    <Text style={s.navBtnIco}>🍎</Text>
                    <Text style={s.navBtnTxt}>Maps</Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Modal: semáforo de escuela ────────────────────────────────────────── */}
      <Modal visible={semaforoModal} animationType="slide" transparent onRequestClose={() => setSemaforoModal(false)}>
        <Pressable style={s.backdrop} onPress={() => setSemaforoModal(false)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>
            Semáforo — {semaforoEscuela?.nombre_lugar ?? 'Escuela'}
          </Text>
          <Text style={[s.sheetLabel, { marginBottom: Spacing.base }]}>
            ¿Cuál es el estado actual de esta escuela?
          </Text>

          {(['verde', 'amarillo', 'rojo'] as SemaforoEscuela[]).map(op => (
            <Pressable
              key={op}
              style={[
                s.semaforoOpcion,
                semaforoNuevo === op && { borderColor: SEMAFORO_COLOR[op], backgroundColor: SEMAFORO_COLOR[op] + '18' },
              ]}
              onPress={() => setSemaforoNuevo(op)}
            >
              <Text style={s.semaforoOpcionEmoji}>{SEMAFORO_EMOJI[op]}</Text>
              <Text style={[
                s.semaforoOpcionLabel,
                semaforoNuevo === op && { color: SEMAFORO_COLOR[op], fontWeight: Typography.fontWeight.bold },
              ]}>
                {SEMAFORO_LABEL[op]}
              </Text>
              {semaforoNuevo === op && <Text style={{ color: SEMAFORO_COLOR[op], fontSize: 18 }}>✓</Text>}
            </Pressable>
          ))}

          <Text style={[s.sheetLabel, { marginTop: Spacing.base }]}>Notas (opcional)</Text>
          <TextInput
            style={s.sheetInput}
            placeholder="Ej: El director nos dijo que no les interesa"
            placeholderTextColor={Colors.dark[400]}
            value={semaforoNotas}
            onChangeText={setSemaforoNotas}
            multiline
            numberOfLines={2}
          />

          <Pressable
            style={[s.btnGuardar, guardandoSemaforo && s.btnDisabled]}
            onPress={guardarSemaforo}
            disabled={guardandoSemaforo}
          >
            {guardandoSemaforo
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.btnGuardarText}>Guardar semáforo</Text>
            }
          </Pressable>
        </View>
      </Modal>

      {/* ── Modal: detalle de anuncio ──────────────────────────────────────────── */}
      <Modal visible={!!detalleAnuncio} animationType="slide" transparent onRequestClose={() => setDetalleAnuncio(null)}>
        <Pressable style={s.backdrop} onPress={() => setDetalleAnuncio(null)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          {detalleAnuncio && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={s.detalleHeader}>
                <View style={[s.detalleIconWrap, { backgroundColor: '#fff7ed', borderColor: '#f97316' }]}>
                  <Text style={s.detalleIconGrande}>{ANUNCIO_TIPO_EMOJI[detalleAnuncio.tipo]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.detalleTipo}>
                    Anuncio — {ANUNCIO_TIPO_LABEL[detalleAnuncio.tipo]}
                  </Text>
                  {detalleAnuncio.estado === 'retirado' && (
                    <View style={{ backgroundColor: '#fee2e2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2 }}>
                      <Text style={{ color: '#dc2626', fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold }}>RETIRADO</Text>
                    </View>
                  )}
                  {detalleAnuncio.colocado_en && (
                    <Text style={s.detalleFecha}>📅 Colocado: {detalleAnuncio.colocado_en}</Text>
                  )}
                </View>
                <Pressable onPress={() => setDetalleAnuncio(null)} style={s.detalleClose}>
                  <Text style={{ color: Colors.dark[500], fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>

              {detalleAnuncio.asesor && (
                <View style={s.detalleRow}>
                  <Text style={s.detalleLabel}>Asesor</Text>
                  <Text style={s.detalleVal}>{detalleAnuncio.asesor}</Text>
                </View>
              )}
              {(detalleAnuncio.direccion || detalleAnuncio.colonia) && (
                <View style={s.detalleRow}>
                  <Text style={s.detalleLabel}>Dirección</Text>
                  <Text style={s.detalleVal}>
                    {[detalleAnuncio.direccion, detalleAnuncio.colonia, detalleAnuncio.municipio, detalleAnuncio.estado_geo]
                      .filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}
              {detalleAnuncio.descripcion && (
                <View style={s.detalleRow}>
                  <Text style={s.detalleLabel}>Notas</Text>
                  <Text style={s.detalleVal}>{detalleAnuncio.descripcion}</Text>
                </View>
              )}

              {/* Fotos */}
              {(detalleAnuncio.fotos?.length ?? 0) > 0 && (
                <>
                  <Text style={[s.sheetLabel, { marginTop: Spacing.base }]}>
                    Fotos ({detalleAnuncio.fotos!.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      {detalleAnuncio.fotos!.map(f => (
                        <View key={f.id} style={s.detalleThumb}>
                          <Image source={{ uri: f.url }} style={s.detalleImg} resizeMode="cover" />
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {/* Acción: marcar como retirado / reactivar */}
              {detalleAnuncio.es_mio && (
                <Pressable
                  style={[
                    s.btnGuardar,
                    { backgroundColor: detalleAnuncio.estado === 'activo' ? Colors.crimson[600] : Colors.success },
                  ]}
                  onPress={async () => {
                    if (!detalleAnuncio.id) return;
                    const nuevoEstado = detalleAnuncio.estado === 'activo' ? 'retirado' : 'activo';
                    try {
                      await actualizarEstadoAnuncio(detalleAnuncio.id, nuevoEstado);
                      setAnuncios(prev => prev.map(a =>
                        a.id === detalleAnuncio.id ? { ...a, estado: nuevoEstado } : a
                      ));
                      setDetalleAnuncio(null);
                    } catch {
                      Alert.alert('Error', 'No se pudo actualizar el estado del anuncio.');
                    }
                  }}
                >
                  <Text style={s.btnGuardarText}>
                    {detalleAnuncio.estado === 'activo' ? '🗑️ Marcar como retirado' : '✓ Reactivar anuncio'}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Modal selector de asesor — mapa */}
      {isSuperAdmin && (
        <Modal visible={modalAsesores} animationType="slide" transparent onRequestClose={() => setModalAsesores(false)}>
          <Pressable style={s.backdrop} onPress={() => setModalAsesores(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Filtrar por asesor</Text>
            <Pressable
              style={[s.asesorItem, !asesorFiltrado && s.asesorItemActivo]}
              onPress={() => { setAsesorFiltrado(null); setModalAsesores(false); }}
            >
              <Text style={[s.asesorItemText, !asesorFiltrado && s.asesorItemTextoActivo]}>
                👥 Todos los asesores
              </Text>
              {!asesorFiltrado && <Text style={{ color: Colors.gold[400] }}>✓</Text>}
            </Pressable>
            {asesores.map(a => (
              <Pressable
                key={a.id}
                style={[s.asesorItem, asesorFiltrado?.id === a.id && s.asesorItemActivo]}
                onPress={() => { setAsesorFiltrado(a); setModalAsesores(false); }}
              >
                <Text style={[s.asesorItemText, asesorFiltrado?.id === a.id && s.asesorItemTextoActivo]}>
                  👤 {a.name}
                </Text>
                {asesorFiltrado?.id === a.id && <Text style={{ color: Colors.gold[400] }}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Modal>
      )}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream[50] },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingTop: 56, paddingBottom: Spacing.md,
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

  // Banner offline
  cacheBanner: {
    backgroundColor: Colors.dark[800],
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: Colors.gold[400],
  },
  cacheText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },

  // Badge pendiente sync en detalle modal
  pendienteSyncBanner: {
    backgroundColor: Colors.gold[50],
    borderWidth: 1,
    borderColor: Colors.gold[400],
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  pendienteSyncText: {
    color: Colors.gold[700],
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    lineHeight: Typography.fontSize.sm * 1.4,
  },

  // Filtros
  filtrosCont: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    backgroundColor: Colors.dark[900],
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipAnuncioActivo: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipAsesorActivo:  { backgroundColor: Colors.gold[600], borderColor: Colors.gold[600] },
  chipActivo: { backgroundColor: Colors.gold[400], borderColor: Colors.gold[400] },
  chipText: { fontSize: Typography.fontSize.xs, color: '#ffffff' },
  chipTextActivo: { color: Colors.dark[900], fontWeight: Typography.fontWeight.bold },

  // Mapa
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
  semaforoDot: {
    position: 'absolute', bottom: -2, right: -2,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.white,
  },
  fabs: {
    position: 'absolute', bottom: 32, right: 20,
    gap: Spacing.md, alignItems: 'center',
  },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.gold[400],    alignItems: 'center', justifyContent: 'center',
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
  fabAnuncio: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#f97316',
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
    maxHeight: '92%',
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

  // Tipo selector
  tipoRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  tipoBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 3, paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.dark[300], backgroundColor: Colors.white,
  },
  tipoBtnIcon: { fontSize: 20 },
  tipoBtnText: { fontSize: 11, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[700] },
  tipoBtnTextActivo: { color: Colors.white },

  // Inputs
  sheetInput: {
    backgroundColor: Colors.white, borderWidth: 1,
    borderColor: Colors.dark[300], borderRadius: Radius.md,
    padding: Spacing.md, color: Colors.dark[900],
    fontSize: Typography.fontSize.base, textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },

  // Search input con ícono
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderWidth: 1,
    borderColor: Colors.dark[300], borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    minHeight: 48,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1, color: Colors.dark[900],
    fontSize: Typography.fontSize.base,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm : 4,
  },
  searchClear: { padding: 4, marginLeft: 4 },

  // Dropdown
  dropdownWrap: {
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.dark[300],
    borderRadius: Radius.md, marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: Spacing.md, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.cream[200],
  },
  dropdownItemActivo: { backgroundColor: Colors.gold[400] },
  dropdownItemText: { fontSize: Typography.fontSize.sm, color: Colors.dark[900] },

  // Prospecto
  prospDropdown: {
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.dark[300],
    borderRadius: Radius.md, marginBottom: Spacing.sm, overflow: 'hidden',
  },
  prospItem: {
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.cream[200],
  },
  prospItemText: { fontSize: Typography.fontSize.sm, color: Colors.dark[900] },
  prospVacio: { padding: Spacing.md, fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center' },
  prospFijo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gold[50] ?? '#fffbeb',
    borderWidth: 1, borderColor: Colors.gold[400],
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    paddingVertical: 10, marginBottom: Spacing.md,
  },
  prospFijoText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900], flex: 1 },

  // Coordenadas
  coords: { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginBottom: Spacing.base },

  // Botón guardar
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
    borderWidth: 1.5, borderStyle: Platform.OS === 'ios' ? 'dashed' : 'solid',
    borderColor: Colors.dark[300],
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white, gap: 2,
  },
  fotoBtnIcon: { fontSize: 22 },
  fotoBtnText: { fontSize: 9, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold },
  fotoBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.gold[400], borderWidth: 1.5, borderColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  fotoBadgeText: { fontSize: 9, color: Colors.white, fontWeight: Typography.fontWeight.bold },

  // Detalle modal
  detalleHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, marginBottom: Spacing.base,
  },
  detalleIconWrap: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  detalleIconGrande: { fontSize: 26 },
  detalleTipo: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.dark[900],
  },
  detalleNombreLugar: {
    fontSize: Typography.fontSize.sm, color: Colors.dark[700], marginTop: 1,
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
  detalleThumb: { width: 120, height: 120, borderRadius: Radius.md, overflow: 'hidden' },
  detalleImg:   { width: '100%', height: '100%' },

  // Botones navegación
  navRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4, marginBottom: Spacing.base },
  navBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3,
    paddingVertical: 10, borderRadius: Radius.lg,
  },
  navBtnIco: { fontSize: 18 },
  navBtnTxt: { fontSize: 10, color: Colors.white, fontWeight: Typography.fontWeight.semibold },

  // Buscador flotante del mapa
  searchMapa: {
    position: 'absolute', top: 14, left: 14, right: 14, zIndex: 20,
  },
  searchMapaBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 6,
  },
  searchMapaIco: { fontSize: 16, marginRight: 8 },
  searchMapaTxt: {
    flex: 1, fontSize: Typography.fontSize.sm,
    color: Colors.dark[900],
    paddingVertical: 0,
  },
  searchMapaDrop: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg, marginTop: 6,
    shadowColor: '#000', shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6,
    overflow: 'hidden',
  },
  searchMapaItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
  },
  searchMapaItemIco: { fontSize: 18 },
  searchMapaItemPrim: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.dark[900],
  },
  searchMapaItemSec: { fontSize: 11, color: Colors.dark[500], marginTop: 1 },

  // ── Semáforo ─────────────────────────────────────────────────────────────
  semaforoSection: {
    backgroundColor: Colors.cream[100],
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cream[300],
  },
  semaforoTitulo: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.dark[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  semaforoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  semaforoEmoji: { fontSize: 24 },
  semaforoLabel: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  semaforoNotas: { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2 },
  semaforoCambiarBtn: {
    backgroundColor: Colors.dark[800],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  semaforoCambiarText: { fontSize: Typography.fontSize.xs, color: Colors.white, fontWeight: Typography.fontWeight.semibold },

  // ── Opciones del modal semáforo ───────────────────────────────────────────
  semaforoOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.cream[300],
    backgroundColor: Colors.white,
    marginBottom: Spacing.sm,
  },
  semaforoOpcionEmoji: { fontSize: 22 },
  semaforoOpcionLabel: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[700] },

  // Selector de asesor — mapa
  asesorItem: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius:    Radius.md,
    marginBottom:    Spacing.xs,
  },
  asesorItemActivo:      { backgroundColor: Colors.gold[50] },
  asesorItemText:        { fontSize: Typography.fontSize.base, color: Colors.dark[800] },
  asesorItemTextoActivo: { color: Colors.gold[700], fontWeight: Typography.fontWeight.semibold },
});
