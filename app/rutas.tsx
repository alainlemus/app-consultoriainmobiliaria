import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRutasAsesores, getRutasDias, getRutasPuntos } from '../src/services/api';
import { useAuth } from '../src/contexts/AuthContext';
import { Colors, Radius, Spacing, Typography } from '../src/theme';
import type { RutaAsesor, RutaDia, RutaPunto } from '../src/types';

// ── Constantes ────────────────────────────────────────────────────────────────

const ROUTE_COLOR  = Colors.gold[400];
const REGION_CDMX: Region = {
  latitude:       19.4326,
  longitude:     -99.1332,
  latitudeDelta:  0.5,
  longitudeDelta: 0.5,
};

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
  const [asesorId,     setAsesorId]     = useState<number | null>(null);
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
    () => asesores.find(a => a.id === asesorId) ?? null,
    [asesores, asesorId],
  );

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

  const seleccionarAsesor = useCallback((id: number) => {
    setAsesorId(id);
    setModalAsesor(false);
  }, []);

  const seleccionarFecha = useCallback((f: string) => {
    setFecha(f);
    setModalFecha(false);
  }, []);

  // ── Info de distancia aproximada ─────────────────────────────────────────

  const distanciaKm = useMemo(() => {
    if (puntos.length < 2) return null;
    let total = 0;
    for (let i = 1; i < puntos.length; i++) {
      const dx = (puntos[i].lng - puntos[i-1].lng) * Math.cos((puntos[i].lat * Math.PI) / 180) * 111;
      const dy = (puntos[i].lat - puntos[i-1].lat) * 111;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total.toFixed(1);
  }, [puntos]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {isSuperAdmin ? 'Rutas de Asesores' : 'Mi Ruta'}
        </Text>
        <View style={s.headerRight} />
      </View>

      {/* ── Filtros ── */}
      <View style={s.filtros}>

        {/* Selector Asesor — solo super_admin */}
        {isSuperAdmin && (
          <TouchableOpacity
            style={[s.chip, asesorSeleccionado && s.chipActive]}
            onPress={() => setModalAsesor(true)}
            activeOpacity={0.75}
          >
            {loadingAsesores
              ? <ActivityIndicator size={12} color={Colors.gold[400]} style={{ marginRight: 4 }} />
              : <Text style={s.chipIcon}>👤</Text>
            }
            <Text style={[s.chipLabel, asesorSeleccionado && s.chipLabelActive]} numberOfLines={1}>
              {asesorSeleccionado ? asesorSeleccionado.name : 'Seleccionar asesor'}
            </Text>
            <Text style={s.chipArrow}>▾</Text>
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
            : <Text style={s.chipIcon}>📅</Text>
          }
          <Text style={[s.chipLabel, fecha && s.chipLabelActive, !asesorId && s.chipLabelDisabled]} numberOfLines={1}>
            {fecha ? formatFecha(fecha) : 'Seleccionar fecha'}
          </Text>
          <Text style={s.chipArrow}>▾</Text>
        </TouchableOpacity>

        {/* Botón limpiar fecha */}
        {fecha && (
          <TouchableOpacity
            style={s.clearBtn}
            onPress={() => { setFecha(null); setPuntos([]); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Barra de resumen (cuando hay puntos) ── */}
      {puntos.length > 0 && !loadingPuntos && (
        <View style={s.resumen}>
          <View style={s.resumenItem}>
            <Text style={s.resumenValor}>{puntos.length}</Text>
            <Text style={s.resumenLabel}>puntos</Text>
          </View>
          {distanciaKm && (
            <View style={s.resumenItem}>
              <Text style={s.resumenValor}>{distanciaKm} km</Text>
              <Text style={s.resumenLabel}>dist. aprox.</Text>
            </View>
          )}
          <View style={s.resumenItem}>
            <Text style={s.resumenValor}>{puntos[0].hora.slice(0, 5)}</Text>
            <Text style={s.resumenLabel}>inicio</Text>
          </View>
          <View style={s.resumenItem}>
            <Text style={s.resumenValor}>{puntos[puntos.length - 1].hora.slice(0, 5)}</Text>
            <Text style={s.resumenLabel}>último</Text>
          </View>
        </View>
      )}

      {/* ── Error ── */}
      {error && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={s.errorClose}>✕</Text>
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
            <Text style={s.emptyIcon}>🗺️</Text>
            <Text style={s.emptyTitle}>
              {isSuperAdmin ? 'Selecciona un asesor' : 'Sin datos de ruta'}
            </Text>
            <Text style={s.emptySubtitle}>
              {isSuperAdmin
                ? 'Elige un asesor para ver su historial de rutas'
                : 'Activa el rastreo en el inicio para registrar tu ruta'}
            </Text>
          </View>
        ) : !fecha ? (
          <View style={s.centered}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyTitle}>Selecciona una fecha</Text>
            <Text style={s.emptySubtitle}>
              {dias.length > 0
                ? `Hay ${dias.length} día${dias.length !== 1 ? 's' : ''} con registros`
                : 'No hay rutas registradas para este asesor'}
            </Text>
          </View>
        ) : puntos.length === 0 ? (
          <View style={s.centered}>
            <Text style={s.emptyIcon}>📍</Text>
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
            <Polyline
              coordinates={puntos.map(p => ({ latitude: p.lat, longitude: p.lng }))}
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
          </MapView>
        )}
      </View>

      {/* ── Lista de puntos ── */}
      {puntos.length > 0 && (
        <View style={s.lista}>
          <Text style={s.listaTitulo}>
            Recorrido del {formatFechaLarga(fecha!)}
          </Text>
          <FlatList
            data={puntos}
            keyExtractor={p => String(p.id)}
            horizontal={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.sm }}
            renderItem={({ item: p, index }) => (
              <View style={[s.puntoRow, index > 0 && s.puntoRowBorder]}>
                <View style={[s.puntoDot, index === 0 && s.puntoDotStart, index === puntos.length - 1 && s.puntoDotEnd]} />
                <View style={s.puntoInfo}>
                  <Text style={s.puntoHora}>{p.hora}</Text>
                  <Text style={s.puntoCoords}>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</Text>
                </View>
                <View style={s.puntoBadges}>
                  {p.precision > 0 && <Text style={s.badge}>±{p.precision}m</Text>}
                  {p.velocidad > 0 && <Text style={s.badge}>{Math.round(p.velocidad)} km/h</Text>}
                </View>
              </View>
            )}
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
                          <Text style={s.badgeVerdeText}>🟢 {a.puntos_hoy} pts hoy</Text>
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
                  {a.id === asesorId && <Text style={s.sheetItemCheck}>✓</Text>}
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
                    {d.fecha === fecha && <Text style={s.sheetItemCheck}>✓</Text>}
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
  backBtn:     { paddingVertical: Spacing.xs, paddingRight: Spacing.md },
  backText:    { color: Colors.gold[400], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
  headerTitle: { color: Colors.cream[50], fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, flex: 1, textAlign: 'center' },
  headerRight: { width: 60 },

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

  // Resumen
  resumen: {
    flexDirection:   'row',
    backgroundColor: Colors.dark[900],
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    gap:             Spacing.base,
  },
  resumenItem:  { alignItems: 'center', flex: 1 },
  resumenValor: { color: Colors.gold[400], fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  resumenLabel: { color: Colors.dark[400], fontSize: Typography.fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5 },

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
  mapContainer: { flex: 1 },
  map:          { flex: 1 },
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

  // Lista de puntos
  lista: {
    backgroundColor: Colors.white,
    borderTopWidth:  1,
    borderTopColor:  Colors.cream[200],
    maxHeight:       190,
  },
  listaTitulo: {
    fontSize:        Typography.fontSize.xs,
    color:           Colors.dark[500],
    fontWeight:      Typography.fontWeight.semibold,
    textTransform:   'uppercase',
    letterSpacing:   1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.cream[50],
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[200],
  },
  puntoRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.base, gap: Spacing.sm },
  puntoRowBorder: { borderTopWidth: 1, borderTopColor: Colors.cream[100] },
  puntoDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gold[400] },
  puntoDotStart:  { backgroundColor: '#22c55e' },
  puntoDotEnd:    { backgroundColor: Colors.crimson[500] },
  puntoInfo:      { flex: 1 },
  puntoHora:      { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800] },
  puntoCoords:    { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: 1 },
  puntoBadges:    { flexDirection: 'row', gap: Spacing.xs },
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
