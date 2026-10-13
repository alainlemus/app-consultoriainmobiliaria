import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator, FlatList, Modal, Pressable,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRutasAsesores, getRutasDias, getRutasPuntos } from '../src/services/api';
import { getDirectionsRoute } from '../src/services/directionsRoute';
import { useAuth } from '../src/contexts/AuthContext';
import { Colors, Radius, Shadows, Spacing, Typography } from '../src/theme';
import type { RutaAsesor, RutaDia, RutaPunto, RutaPuntoTipo } from '../src/types';

const TIPO_ICONO: Record<RutaPuntoTipo, React.ComponentProps<typeof Ionicons>['name']> = {
  gps:            'location',
  visita_cliente: 'home',
  escuela:        'school',
  propiedad:      'business',
};

const TIPO_LABEL: Record<RutaPuntoTipo, string> = {
  gps:            'Punto de ruta',
  visita_cliente: 'Visita a cliente',
  escuela:        'Visita a escuela',
  propiedad:      'Visita a propiedad',
};

type Coord = { latitude: number; longitude: number };

// ── Constantes ────────────────────────────────────────────────────────────────

const ROUTE_COLOR  = Colors.gold[400];
const REGION_CDMX: Region = {
  latitude:       19.4326,
  longitude:     -99.1332,
  latitudeDelta:  0.5,
  longitudeDelta: 0.5,
};

/** Sentinel para "ver todos los asesores a la vez" (solo super_admin) */
const TODOS = 'todos' as const;
type AsesorSel = number | typeof TODOS;

// Paleta para distinguir asesores en el mapa cuando se ve "Todos"
const PALETA_ASESORES = ['#cd9d36', '#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777'];
function colorPorAsesor(asesorId: number, ordenAsesores: number[]): string {
  const idx = ordenAsesores.indexOf(asesorId);
  return PALETA_ASESORES[idx % PALETA_ASESORES.length];
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD local
}

function formatFecha(f: string): string {
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
}

function formatFechaLarga(f: string): string {
  const [y, m, d] = f.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

// ── Componente principal ─────────────────────────────────────────────────────

/** Tarjeta pequeña del resumen: icono, valor y etiqueta. */
function Dato({ icono, valor, etiqueta }: { icono: React.ComponentProps<typeof Ionicons>['name']; valor: string; etiqueta: string }) {
  return (
    <View style={s.dato}>
      <Ionicons name={icono} size={18} color={Colors.gold[500]} />
      <Text style={s.datoValor} numberOfLines={1}>{valor}</Text>
      <Text style={s.datoEtiqueta} numberOfLines={1}>{etiqueta}</Text>
    </View>
  );
}

export default function RutasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { user, isSuperAdmin } = useAuth();

  // Estado base
  const isAsesor = (!isSuperAdmin && user?.roles?.includes('asesor')) ?? false;

  const [asesores,     setAsesores]     = useState<RutaAsesor[]>([]);
  const [dias,         setDias]         = useState<RutaDia[]>([]);
  const [puntos,       setPuntos]       = useState<RutaPunto[]>([]);
  const [asesorId,     setAsesorId]     = useState<AsesorSel | null>(null);
  const [fecha,        setFecha]        = useState<string | null>(null);

  // Loading
  const [loadingAsesores, setLoadingAsesores] = useState(false);
  const [loadingDias,     setLoadingDias]     = useState(false);
  const [loadingPuntos,   setLoadingPuntos]   = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  // Modales
  const [modalAsesor, setModalAsesor] = useState(false);
  const [modalFecha,  setModalFecha]  = useState(false);

  // ── Asesor seleccionado ────────────────────────────────────────────────────

  const asesorSeleccionado = useMemo(
    () => (asesorId && asesorId !== TODOS ? asesores.find(a => a.id === asesorId) ?? null : null),
    [asesores, asesorId],
  );

  const nombreAsesorChip = asesorId === TODOS ? 'Todos los asesores' : asesorSeleccionado?.name ?? null;

  // ── Cargar asesores (super_admin) ─────────────────────────────────────────

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoadingAsesores(true);
    getRutasAsesores()
      .then(setAsesores)
      .catch(() => setError('No se pudo cargar la lista de asesores'))
      .finally(() => setLoadingAsesores(false));
  }, [isSuperAdmin]);

  // ── Si es asesor, fijarlo como asesorId ───────────────────────────────────

  useEffect(() => {
    if (!isAsesor || !user?.id) return;
    setAsesorId(user.id);
  }, [isAsesor, user?.id]);

  // ── Cargar días al cambiar de asesor ──────────────────────────────────────

  useEffect(() => {
    if (!asesorId) return;
    setDias([]);
    setFecha(null);
    setPuntos([]);
    setLoadingDias(true);
    getRutasDias(asesorId)
      .then(data => {
        setDias(data);
        // Auto-seleccionar hoy si existe; si no, la fecha más reciente
        const fechaHoy = hoy();
        const tieneHoy = data.some(d => d.fecha === fechaHoy);
        if (tieneHoy) {
          setFecha(fechaHoy);
        } else if (data.length > 0) {
          setFecha(data[0].fecha); // ya viene ordenado desc
        }
      })
      .catch(() => setError('No se pudieron cargar las fechas'))
      .finally(() => setLoadingDias(false));
  }, [asesorId]);

  // ── Cargar puntos al cambiar de fecha ─────────────────────────────────────

  useEffect(() => {
    if (!asesorId || !fecha) return;
    setPuntos([]);
    setLoadingPuntos(true);
    setError(null);
    getRutasPuntos(asesorId, fecha)
      .then(data => {
        setPuntos(data);
        // Centrar mapa en el primer punto
        if (data.length > 0 && mapRef.current) {
          setTimeout(() => {
            mapRef.current?.animateToRegion({
              latitude:      data[0].lat,
              longitude:     data[0].lng,
              latitudeDelta:  0.04,
              longitudeDelta: 0.04,
            }, 600);
          }, 300);
        }
      })
      .catch(() => setError('No se pudieron cargar los puntos de ruta'))
      .finally(() => setLoadingPuntos(false));
  }, [asesorId, fecha]);

  // ── Región del mapa ───────────────────────────────────────────────────────

  const mapRegion: Region = puntos.length > 0
    ? { latitude: puntos[0].lat, longitude: puntos[0].lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : REGION_CDMX;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const seleccionarAsesor = useCallback((id: AsesorSel) => {
    setAsesorId(id);
    setModalAsesor(false);
  }, []);

  const seleccionarFecha = useCallback((f: string) => {
    setFecha(f);
    setModalFecha(false);
  }, []);

  const verTodos = asesorId === TODOS;

  // ── Agrupar puntos por asesor (solo relevante en modo "Todos") ───────────

  const ordenAsesores = useMemo(() => asesores.map(a => a.id), [asesores]);

  const gruposPorAsesor = useMemo(() => {
    if (!verTodos) return [];
    const mapa = new Map<number, { asesorId: number; nombre: string; puntos: RutaPunto[]; color: string }>();
    for (const p of puntos) {
      if (p.asesor_id == null) continue;
      if (!mapa.has(p.asesor_id)) {
        mapa.set(p.asesor_id, {
          asesorId: p.asesor_id,
          nombre:   p.asesor_nombre ?? `Asesor #${p.asesor_id}`,
          puntos:   [],
          color:    colorPorAsesor(p.asesor_id, ordenAsesores),
        });
      }
      mapa.get(p.asesor_id)!.puntos.push(p);
    }
    return Array.from(mapa.values());
  }, [verTodos, puntos, ordenAsesores]);

  // ── Reconstrucción de la ruta real (Directions API) ───────────────────────
  // Los puntos ahora son paradas dispersas (inicio, visitas a clientes/
  // escuelas/propiedades, fin) que pueden estar a varios km entre sí — una
  // línea recta entre ellos no sirve. Se pide a la Directions API el camino
  // real por vialidad; si falla (sin conexión, cuota agotada, API no
  // habilitada en Google Cloud) se cae en silencio a la polilínea cruda —
  // nunca rompe el mapa.
  const [puntosAjustados, setPuntosAjustados] = useState<Coord[] | null>(null);
  const [ajustadosPorAsesor, setAjustadosPorAsesor] = useState<Record<number, Coord[]>>({});

  useEffect(() => {
    setPuntosAjustados(null);
    setAjustadosPorAsesor({});

    if (verTodos) {
      gruposPorAsesor.forEach(g => {
        if (g.puntos.length < 2) return;
        getDirectionsRoute(g.puntos.map(p => ({ lat: p.lat, lng: p.lng })))
          .then(ruta => {
            setAjustadosPorAsesor(prev => ({
              ...prev,
              [g.asesorId]: ruta.map(s => ({ latitude: s.lat, longitude: s.lng })),
            }));
          })
          .catch(() => { /* se queda la polilínea cruda de este asesor */ });
      });
    } else if (puntos.length >= 2) {
      getDirectionsRoute(puntos.map(p => ({ lat: p.lat, lng: p.lng })))
        .then(ruta => setPuntosAjustados(ruta.map(s => ({ latitude: s.lat, longitude: s.lng }))))
        .catch(() => { /* se queda la polilínea cruda */ });
    }
  }, [verTodos, puntos, gruposPorAsesor]);

  // ── Info de distancia aproximada (no aplica al ver varios asesores juntos) ─
  // Usa la polilínea ya reconstruida por la Directions API cuando está
  // disponible — sumar línea recta entre paradas dispersas subestima mucho
  // la distancia real recorrida por carretera.

  const distanciaKm = useMemo(() => {
    if (verTodos) return null;
    const base = puntosAjustados ?? puntos.map(p => ({ latitude: p.lat, longitude: p.lng }));
    if (base.length < 2) return null;
    let total = 0;
    for (let i = 1; i < base.length; i++) {
      const dx = (base[i].longitude - base[i-1].longitude) * Math.cos((base[i].latitude * Math.PI) / 180) * 111;
      const dy = (base[i].latitude - base[i-1].latitude) * 111;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total.toFixed(1);
  }, [verTodos, puntos, puntosAjustados]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Atrás">
          <Ionicons name="arrow-back" size={22} color={Colors.gold[400]} />
        </TouchableOpacity>
        <View style={s.headerCentro}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {isSuperAdmin ? 'Rutas de asesores' : 'Mi ruta'}
          </Text>
          {fecha ? <Text style={s.headerSub} numberOfLines={1}>{formatFechaLarga(fecha)}</Text> : null}
        </View>
        <View style={s.headerRight} />
      </View>

      {/* ── Filtros ── */}
      <View style={s.filtros}>

        {/* Selector Asesor — solo super_admin */}
        {isSuperAdmin && (
          <TouchableOpacity
            style={[s.chip, nombreAsesorChip && s.chipActive]}
            onPress={() => setModalAsesor(true)}
            activeOpacity={0.75}
          >
            {loadingAsesores
              ? <ActivityIndicator size={12} color={Colors.gold[400]} style={{ marginRight: 4 }} />
              : <Ionicons name={verTodos ? 'people' : 'person'} size={16} color={Colors.dark[500]} />
            }
            <Text style={[s.chipLabel, nombreAsesorChip && s.chipLabelActive]} numberOfLines={1}>
              {nombreAsesorChip ?? 'Seleccionar asesor'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.dark[400]} style={s.chipArrow} />
          </TouchableOpacity>
        )}

        {/* Selector Fecha */}
        <TouchableOpacity
          style={[s.chip, fecha && s.chipActive, !asesorId && s.chipDisabled]}
          onPress={() => asesorId && setModalFecha(true)}
          disabled={!asesorId}
          activeOpacity={0.75}
        >
          {loadingDias
            ? <ActivityIndicator size={12} color={Colors.gold[400]} style={{ marginRight: 4 }} />
            : <Ionicons name="calendar" size={20} color={Colors.dark[500]} style={s.chipIcon} />
          }
          <Text style={[s.chipLabel, fecha && s.chipLabelActive, !asesorId && s.chipLabelDisabled]} numberOfLines={1}>
            {fecha ? formatFecha(fecha) : 'Seleccionar fecha'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.dark[400]} style={s.chipArrow} />
        </TouchableOpacity>

        {/* Botón limpiar fecha */}
        {fecha && (
          <TouchableOpacity
            style={s.clearBtn}
            onPress={() => { setFecha(null); setPuntos([]); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={Colors.dark[500]} style={s.clearBtnText} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Resumen (cuando hay puntos) ── */}
      {puntos.length > 0 && !loadingPuntos && (
        <View style={s.resumen}>
          <Dato icono="location" valor={String(puntos.length)} etiqueta="Puntos" />
          {verTodos ? (
            <Dato icono="people" valor={String(gruposPorAsesor.length)} etiqueta="Asesores" />
          ) : distanciaKm ? (
            <Dato icono="navigate" valor={`${distanciaKm} km`} etiqueta="Distancia aprox." />
          ) : null}
          <Dato
            icono="time"
            valor={`${puntos[0].hora.slice(0, 5)} – ${puntos[puntos.length - 1].hora.slice(0, 5)}`}
            etiqueta="Horario"
          />
        </View>
      )}

      {/* ── Leyenda de asesores (solo modo "Todos") ── */}
      {verTodos && gruposPorAsesor.length > 0 && !loadingPuntos && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.leyenda} contentContainerStyle={s.leyendaContent}>
          {gruposPorAsesor.map(g => (
            <View key={g.asesorId} style={s.leyendaItem}>
              <View style={[s.leyendaDot, { backgroundColor: g.color }]} />
              <Text style={s.leyendaText} numberOfLines={1}>{g.nombre} ({g.puntos.length})</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Error ── */}
      {error && (
        <View style={s.errorBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="warning" size={16} color={Colors.dark[500]} /><Text style={[s.errorText, { flexShrink: 1 }]}>{error}</Text></View>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={18} color={Colors.dark[500]} style={s.errorClose} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Mapa ── */}
      <View style={s.mapContainer}>
        {loadingPuntos ? (
          <View style={s.centered}>
            <ActivityIndicator color={Colors.gold[400]} size="large" />
            <Text style={s.loadingText}>Cargando ruta…</Text>
          </View>
        ) : !asesorId ? (
          <View style={s.centered}>
            <View style={s.emptyCirculo}><Ionicons name="map-outline" size={40} color={Colors.gold[500]} /></View>
            <Text style={s.emptyTitle}>
              {isSuperAdmin ? 'Selecciona un asesor' : 'Sin datos de ruta'}
            </Text>
            <Text style={s.emptySubtitle}>
              {isSuperAdmin
                ? 'Elige un asesor (o "Todos") para ver su historial de rutas'
                : 'Activa el rastreo en el inicio para registrar tu ruta'}
            </Text>
          </View>
        ) : !fecha ? (
          <View style={s.centered}>
            <View style={s.emptyCirculo}><Ionicons name="calendar-outline" size={40} color={Colors.gold[500]} /></View>
            <Text style={s.emptyTitle}>Selecciona una fecha</Text>
            <Text style={s.emptySubtitle}>
              {dias.length > 0
                ? `Hay ${dias.length} día${dias.length !== 1 ? 's' : ''} con registros`
                : `No hay rutas registradas para ${verTodos ? 'ningún asesor' : 'este asesor'}`}
            </Text>
          </View>
        ) : puntos.length === 0 ? (
          <View style={s.centered}>
            <View style={s.emptyCirculo}><Ionicons name="location-outline" size={40} color={Colors.gold[500]} /></View>
            <Text style={s.emptyTitle}>Sin puntos</Text>
            <Text style={s.emptySubtitle}>No hay ruta registrada el {formatFechaLarga(fecha)}</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={s.map}
            initialRegion={mapRegion}
            showsUserLocation={false}
            showsCompass
            showsScale
          >
            {verTodos ? (
              // ── Modo "Todos": una polilínea + marcadores de inicio/fin por asesor, con color propio ──
              gruposPorAsesor.map(g => (
                <React.Fragment key={g.asesorId}>
                  <Polyline
                    coordinates={ajustadosPorAsesor[g.asesorId] ?? g.puntos.map(p => ({ latitude: p.lat, longitude: p.lng }))}
                    strokeColor={g.color}
                    strokeWidth={4}
                  />
                  <Marker
                    coordinate={{ latitude: g.puntos[0].lat, longitude: g.puntos[0].lng }}
                    title={g.nombre}
                    description={`Inicio · ${g.puntos[0].hora}`}
                    pinColor={g.color}
                  />
                  {g.puntos.length > 1 && (
                    <Marker
                      coordinate={{ latitude: g.puntos[g.puntos.length - 1].lat, longitude: g.puntos[g.puntos.length - 1].lng }}
                      title={g.nombre}
                      description={`Último · ${g.puntos[g.puntos.length - 1].hora}`}
                      pinColor={g.color}
                    />
                  )}
                </React.Fragment>
              ))
            ) : (
              <>
                <Polyline
                  coordinates={puntosAjustados ?? puntos.map(p => ({ latitude: p.lat, longitude: p.lng }))}
                  strokeColor={ROUTE_COLOR}
                  strokeWidth={4}
                  lineDashPattern={undefined}
                />
                {/* Marcador de inicio */}
                <Marker
                  coordinate={{ latitude: puntos[0].lat, longitude: puntos[0].lng }}
                  title="Inicio"
                  description={puntos[0].hora}
                  pinColor="#22c55e"
                />
                {/* Marcador de fin */}
                {puntos.length > 1 && (
                  <Marker
                    coordinate={{ latitude: puntos[puntos.length - 1].lat, longitude: puntos[puntos.length - 1].lng }}
                    title="Último punto"
                    description={puntos[puntos.length - 1].hora}
                    pinColor={Colors.crimson[500]}
                  />
                )}
                {/* Marcadores de visitas (cliente/escuela/propiedad) — los puntos
                    'gps' de inicio/fin ya se pintan arriba, se omiten aquí */}
                {puntos.map((p, index) => (
                  index > 0 && index < puntos.length - 1 && p.tipo !== 'gps' ? (
                    <Marker
                      key={p.id}
                      coordinate={{ latitude: p.lat, longitude: p.lng }}
                      title={p.nombre_lugar ?? TIPO_LABEL[p.tipo]}
                      description={`${TIPO_LABEL[p.tipo]} · ${p.hora}`}
                    >
                      <View style={s.marcadorTipo}>
                        <Ionicons name={TIPO_ICONO[p.tipo]} size={20} color={Colors.dark[700]} />
                      </View>
                    </Marker>
                  ) : null
                ))}
              </>
            )}
          </MapView>
        )}
      </View>

      {/* ── Recorrido: línea de tiempo ── */}
      {puntos.length > 0 && (
        <View style={s.lista}>
          <Text style={s.listaTitulo}>Recorrido</Text>
          <FlatList
            data={puntos}
            keyExtractor={p => String(p.id)}
            horizontal={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.sm, paddingHorizontal: Spacing.base }}
            renderItem={({ item: p, index }) => {
              const esInicio = index === 0;
              const esFin    = index === puntos.length - 1 && puntos.length > 1;
              const color    = verTodos && p.asesor_id != null
                ? colorPorAsesor(p.asesor_id, ordenAsesores)
                : esInicio ? '#22c55e' : esFin ? Colors.crimson[500] : Colors.gold[400];
              const icono: React.ComponentProps<typeof Ionicons>['name'] =
                p.tipo !== 'gps' ? TIPO_ICONO[p.tipo] : esInicio ? 'play' : esFin ? 'flag' : 'ellipse';
              const titulo = p.nombre_lugar
                ?? (p.tipo !== 'gps' ? TIPO_LABEL[p.tipo] : esInicio ? 'Inicio de la ruta' : esFin ? 'Fin de la ruta' : 'Punto de la ruta');
              return (
                <View style={s.paso}>
                  <View style={s.pasoLinea}>
                    <View style={[s.pasoIcono, { backgroundColor: color }]}>
                      <Ionicons name={icono} size={p.tipo === 'gps' && !esInicio && !esFin ? 8 : 15} color={Colors.white} />
                    </View>
                    {index < puntos.length - 1 && <View style={s.pasoConector} />}
                  </View>
                  <View style={s.pasoCuerpo}>
                    <View style={s.pasoFila}>
                      <Text style={s.pasoTitulo} numberOfLines={1}>{titulo}</Text>
                      <Text style={s.pasoHora}>{p.hora.slice(0, 5)}</Text>
                    </View>
                    <Text style={s.pasoSub} numberOfLines={1}>
                      {p.tipo !== 'gps' && p.nombre_lugar ? `${TIPO_LABEL[p.tipo]} · ` : ''}
                      {verTodos && p.asesor_nombre ? `${p.asesor_nombre} · ` : ''}
                      {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                    </Text>
                    {(p.precision > 0 || p.velocidad > 0) && (
                      <View style={s.puntoBadges}>
                        {p.precision > 0 && <Text style={s.badge}>±{p.precision} m</Text>}
                        {p.velocidad > 0 && <Text style={s.badge}>{Math.round(p.velocidad)} km/h</Text>}
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* ── Modal selector de asesor ── */}
      <Modal
        visible={modalAsesor}
        animationType="slide"
        transparent
        onRequestClose={() => setModalAsesor(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setModalAsesor(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + Spacing.base }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Seleccionar asesor</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {asesores.length > 0 && (
              <TouchableOpacity
                style={[s.sheetItem, asesorId === TODOS && s.sheetItemActive]}
                onPress={() => seleccionarAsesor(TODOS)}
                activeOpacity={0.75}
              >
                <View style={s.sheetItemLeft}>
                  <Text style={[s.sheetItemName, asesorId === TODOS && s.sheetItemNameActive]}>
                    <Ionicons name="people" size={16} color={Colors.dark[500]} />{' '}Todos los asesores
                  </Text>
                  <Text style={s.sheetItemSub}>Ver las rutas de todos juntas, con un color por asesor</Text>
                </View>
                {asesorId === TODOS && <Ionicons name="checkmark" size={18} color={Colors.dark[500]} style={s.sheetItemCheck} />}
              </TouchableOpacity>
            )}
            {asesores.length === 0 ? (
              <Text style={s.sheetEmpty}>No hay asesores disponibles</Text>
            ) : (
              asesores.map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[s.sheetItem, a.id === asesorId && s.sheetItemActive]}
                  onPress={() => seleccionarAsesor(a.id)}
                  activeOpacity={0.75}
                >
                  <View style={s.sheetItemLeft}>
                    <Text style={[s.sheetItemName, a.id === asesorId && s.sheetItemNameActive]}>
                      {a.name}
                    </Text>
                    <View style={s.sheetItemMeta}>
                      {a.puntos_hoy > 0 && (
                        <View style={s.badgeVerde}>
                          <Text style={s.badgeVerdeText}><Ionicons name="ellipse" size={10} color="#22c55e" />{' '}{a.puntos_hoy} pts hoy</Text>
                        </View>
                      )}
                      {a.total_puntos > 0 && (
                        <Text style={s.sheetItemSub}>{a.total_puntos} pts totales</Text>
                      )}
                      {a.total_puntos === 0 && (
                        <Text style={s.sheetItemSub}>Sin rutas registradas</Text>
                      )}
                    </View>
                  </View>
                  {a.id === asesorId && <Ionicons name="checkmark" size={18} color={Colors.dark[500]} style={s.sheetItemCheck} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal selector de fecha ── */}
      <Modal
        visible={modalFecha}
        animationType="slide"
        transparent
        onRequestClose={() => setModalFecha(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setModalFecha(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + Spacing.base }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Seleccionar fecha</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {dias.length === 0 ? (
              <Text style={s.sheetEmpty}>Sin fechas disponibles para este asesor</Text>
            ) : (
              dias.map(d => {
                const esHoy = d.fecha === hoy();
                return (
                  <TouchableOpacity
                    key={d.fecha}
                    style={[s.sheetItem, d.fecha === fecha && s.sheetItemActive]}
                    onPress={() => seleccionarFecha(d.fecha)}
                    activeOpacity={0.75}
                  >
                    <View style={s.sheetItemLeft}>
                      <Text style={[s.sheetItemName, d.fecha === fecha && s.sheetItemNameActive]}>
                        {formatFechaLarga(d.fecha)}
                        {esHoy && <Text style={s.hoyBadge}> · Hoy</Text>}
                      </Text>
                      <Text style={s.sheetItemSub}>{d.puntos} punto{d.puntos !== 1 ? 's' : ''} registrado{d.puntos !== 1 ? 's' : ''}</Text>
                    </View>
                    {d.fecha === fecha && <Ionicons name="checkmark" size={18} color={Colors.dark[500]} style={s.sheetItemCheck} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream[50] },

  // Header
  header: {
    backgroundColor:   Colors.dark[900],
    paddingHorizontal: Spacing.base,
    paddingBottom:     Spacing.md,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerCentro:{ flex: 1, alignItems: 'center' },
  headerTitle: { color: Colors.cream[50], fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, textAlign: 'center' },
  headerSub:   { color: Colors.gold[400], fontSize: Typography.fontSize.xs, marginTop: 1, textTransform: 'capitalize' },
  headerRight: { width: 40 },

  // Filtros
  filtros: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical:  Spacing.sm,
    backgroundColor:  Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[200],
  },
  chip: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.cream[50],
    borderRadius:    Radius.full,
    borderWidth:     1,
    borderColor:     Colors.cream[300],
    paddingVertical:   Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap:             Spacing.xs,
  },
  chipActive:        { backgroundColor: Colors.gold[50], borderColor: Colors.gold[400] },
  chipDisabled:      { opacity: 0.45 },
  chipIcon:          { fontSize: 14 },
  chipLabel:         { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[500], fontWeight: Typography.fontWeight.medium },
  chipLabelActive:   { color: Colors.gold[700], fontWeight: Typography.fontWeight.semibold },
  chipLabelDisabled: { color: Colors.dark[300] },
  chipArrow:         { fontSize: 11, color: Colors.dark[400] },
  clearBtn:          { padding: Spacing.xs },
  clearBtnText:      { color: Colors.dark[400], fontSize: Typography.fontSize.sm },

  // Resumen: tarjetas con icono
  resumen: {
    flexDirection:     'row',
    gap:               Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.sm,
    backgroundColor:   Colors.cream[50],
  },
  dato: {
    flex:            1,
    alignItems:      'center',
    gap:             2,
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  datoValor:    { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  datoEtiqueta: { fontSize: Typography.fontSize.xs, color: Colors.dark[400] },

  // Leyenda (modo "Todos")
  leyenda: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[200],
  },
  leyendaContent: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs, gap: Spacing.md },
  leyendaItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaDot:     { width: 10, height: 10, borderRadius: 5 },
  leyendaText:    { fontSize: Typography.fontSize.xs, color: Colors.dark[600], fontWeight: Typography.fontWeight.medium },

  // Error
  errorBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.sm,
  },
  errorText:  { flex: 1, color: '#dc2626', fontSize: Typography.fontSize.sm },
  errorClose: { color: '#dc2626', fontSize: Typography.fontSize.base, paddingLeft: Spacing.sm },

  // Mapa
  mapContainer: { flex: 1, marginHorizontal: Spacing.base, marginBottom: Spacing.sm, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.cream[200] },
  map:          { flex: 1 },
  emptyCirculo: { width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.gold[50], alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  centered: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        Spacing['2xl'],
    backgroundColor: Colors.cream[50],
  },
  loadingText:  { color: Colors.dark[400], fontSize: Typography.fontSize.sm, marginTop: Spacing.md },
  emptyIcon:    { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle:   { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.dark[700], textAlign: 'center', marginBottom: Spacing.xs },
  emptySubtitle:{ fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', lineHeight: Typography.fontSize.sm * 1.5 },

  // Recorrido (línea de tiempo)
  lista: {
    backgroundColor: Colors.white,
    borderTopLeftRadius:  Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderTopWidth:  1,
    borderTopColor:  Colors.cream[200],
    maxHeight:       250,
  },
  listaTitulo: {
    fontSize:        Typography.fontSize.sm,
    color:           Colors.dark[700],
    fontWeight:      Typography.fontWeight.bold,
    paddingHorizontal: Spacing.base,
    paddingTop:      Spacing.md,
    paddingBottom:   Spacing.sm,
  },
  paso:          { flexDirection: 'row', gap: Spacing.md },
  pasoLinea:     { alignItems: 'center', width: 28 },
  pasoIcono:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pasoConector:  { flex: 1, width: 2, backgroundColor: Colors.cream[300], marginVertical: 2 },
  pasoCuerpo:    { flex: 1, paddingBottom: Spacing.md },
  pasoFila:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  pasoTitulo:    { flex: 1, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  pasoHora:      { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.gold[600] },
  pasoSub:       { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 1 },
  puntoBadges:   { flexDirection: 'row', gap: Spacing.xs, marginTop: 4 },

  // Marcador circular para paradas de visita (cliente/escuela/propiedad)
  marcadorTipo: {
    width:            30,
    height:           30,
    borderRadius:     15,
    backgroundColor:  Colors.white,
    borderWidth:      2,
    borderColor:      Colors.gold[400],
    alignItems:       'center',
    justifyContent:   'center',
    ...Shadows.sm,
  },
  marcadorTipoEmoji: { fontSize: 15 },
  badge: {
    fontSize:        Typography.fontSize.xs,
    color:           Colors.dark[500],
    backgroundColor: Colors.cream[100],
    paddingHorizontal: Spacing.xs,
    paddingVertical:  1,
    borderRadius:    Radius.sm,
  },

  // Modal / Bottom Sheet
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor:   Colors.white,
    borderTopLeftRadius:  Radius.lg * 2,
    borderTopRightRadius: Radius.lg * 2,
    paddingTop:        Spacing.sm,
    maxHeight:         '65%',
  },
  sheetHandle: {
    width:           44,
    height:          4,
    backgroundColor: Colors.cream[300],
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    Spacing.md,
  },
  sheetTitle: {
    fontSize:        Typography.fontSize.lg,
    fontWeight:      Typography.fontWeight.bold,
    color:           Colors.dark[800],
    paddingHorizontal: Spacing.base,
    paddingBottom:   Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[200],
  },
  sheetEmpty: {
    padding:   Spacing.xl,
    color:     Colors.dark[400],
    fontSize:  Typography.fontSize.sm,
    textAlign: 'center',
  },
  sheetItem: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: Spacing.base,
    paddingVertical:  Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[100],
  },
  sheetItemActive:    { backgroundColor: Colors.gold[50] },
  sheetItemLeft:      { flex: 1 },
  sheetItemName:      { fontSize: Typography.fontSize.base, color: Colors.dark[800], fontWeight: Typography.fontWeight.medium },
  sheetItemNameActive:{ color: Colors.gold[700], fontWeight: Typography.fontWeight.bold },
  sheetItemMeta:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  sheetItemSub:       { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 2 },
  sheetItemCheck:     { color: Colors.gold[400], fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold },
  hoyBadge:           { color: Colors.gold[600], fontWeight: Typography.fontWeight.semibold },
  badgeVerde: {
    backgroundColor: '#dcfce7',
    borderRadius:    Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical:  1,
  },
  badgeVerdeText: { fontSize: Typography.fontSize.xs, color: '#15803d', fontWeight: Typography.fontWeight.semibold },
});
