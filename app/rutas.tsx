/**
 * Pantalla: Rutas de Asesores
 * Ruta: /rutas
 *
 * Muestra la ruta GPS de un asesor en el mapa con polyline.
 * - super_admin: ve todas las rutas, selector de asesor + fecha
 * - asesor: ve solo su propia ruta, selector de fecha
 */

import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRutasAsesores, getRutasDias, getRutasPuntos, getMe } from '../src/services/api';
import { useAuth } from '../src/contexts/AuthContext';
import { Colors, Radius, Spacing, Typography } from '../src/theme';
import type { RutaAsesor, RutaDia, RutaPunto } from '../src/types';

const ROUTE_COLOR = Colors.gold[400];
const REGION_CDMX = {
  latitude:       19.4326,
  longitude:     -99.1332,
  latitudeDelta:  0.5,
  longitudeDelta: 0.5,
};

export default function RutasScreen() {
  const insets = useSafeAreaInsets();
  const { user, isSuperAdmin } = useAuth();

  const [asesores,       setAsesores]       = useState<RutaAsesor[]>([]);
  const [dias,          setDias]          = useState<RutaDia[]>([]);
  const [puntos,        setPuntos]        = useState<RutaPunto[]>([]);
  const [asesorId,      setAsesorId]      = useState<number | null>(null);
  const [fecha,         setFecha]         = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [showAsesorList, setShowAsesorList] = useState(false);
  const [showFechaList,  setShowFechaList]  = useState(false);

  // Determinar si es asesor (no super_admin y tiene rol asesor)
  const isAsesor = (!isSuperAdmin && user?.roles?.includes('asesor')) ?? false;

  // Cargar lista de asesores (solo super_admin)
  useEffect(() => {
    if (!isSuperAdmin) return;
    getRutasAsesores().then(setAsesores).catch(() => {});
  }, [isSuperAdmin]);

  // Cuando cambia el asesor, cargar sus días disponibles
  useEffect(() => {
    if (!asesorId) return;
    setFecha(null);
    setPuntos([]);
    getRutasDias(asesorId).then(setDias).catch(() => {});
  }, [asesorId]);

  // Cuando cambia la fecha, cargar los puntos
  useEffect(() => {
    if (!asesorId || !fecha) return;
    setLoading(true);
    getRutasPuntos(asesorId, fecha)
      .then(setPuntos)
      .catch(() => setPuntos([]))
      .finally(() => setLoading(false));
  }, [asesorId, fecha]);

  // Si es asesor, usar su propio ID y cargar días al iniciar
  useEffect(() => {
    if (!isAsesor || !user?.id) return;
    setAsesorId(user.id);
  }, [isAsesor, user?.id]);

  // Centro del mapa según los puntos
  const mapRegion = puntos.length > 0
    ? {
        latitude:       puntos[0].lat,
        longitude:      puntos[0].lng,
        latitudeDelta:  0.05,
        longitudeDelta: 0.05,
      }
    : REGION_CDMX;

  const seleccionarAsesor = (id: number) => {
    setAsesorId(id);
    setShowAsesorList(false);
  };

  const seleccionarFecha = (f: string) => {
    setFecha(f);
    setShowFechaList(false);
  };

  const nombreAsesor = asesores.find(a => a.id === asesorId)?.name ?? 'Seleccionar asesor';

  const formatFecha = (f: string) => {
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isSuperAdmin ? 'Rutas de Asesores' : 'Mi Ruta'}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Filtros */}
      <View style={styles.filtros}>
        {/* Selector Asesor (solo super_admin) */}
        {isSuperAdmin && (
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setShowAsesorList(!showAsesorList)}
          >
            <Text style={styles.selectorLabel}>Asesor</Text>
            <Text style={styles.selectorValue}>{nombreAsesor}</Text>
            <Text style={styles.selectorArrow}>▼</Text>
          </TouchableOpacity>
        )}

        {/* Selector Fecha */}
        <TouchableOpacity
          style={[styles.selector, !asesorId && styles.selectorDisabled]}
          onPress={() => asesorId && setShowFechaList(!showFechaList)}
          disabled={!asesorId}
        >
          <Text style={[styles.selectorLabel, !asesorId && styles.selectorLabelDisabled]}>Fecha</Text>
          <Text style={[styles.selectorValue, !fecha && styles.selectorPlaceholder]}>
            {fecha ? formatFecha(fecha) : 'Seleccionar fecha'}
          </Text>
          <Text style={styles.selectorArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown Asesores */}
      {showAsesorList && (
        <View style={styles.dropdown}>
          {asesores.length === 0 ? (
            <Text style={styles.dropdownEmpty}>Sin datos</Text>
          ) : (
            asesores.map(a => (
              <TouchableOpacity
                key={a.id}
                style={[styles.dropdownItem, a.id === asesorId && styles.dropdownItemActive]}
                onPress={() => seleccionarAsesor(a.id)}
              >
                <Text style={[styles.dropdownItemText, a.id === asesorId && styles.dropdownItemTextActive]}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* Dropdown Fechas */}
      {showFechaList && (
        <View style={styles.dropdown}>
          {dias.length === 0 ? (
            <Text style={styles.dropdownEmpty}>Sin días disponibles</Text>
          ) : (
            dias.map(d => (
              <TouchableOpacity
                key={d.fecha}
                style={[styles.dropdownItem, d.fecha === fecha && styles.dropdownItemActive]}
                onPress={() => seleccionarFecha(d.fecha)}
              >
                <Text style={[styles.dropdownItemText, d.fecha === fecha && styles.dropdownItemTextActive]}>
                  {formatFecha(d.fecha)} ({d.puntos} pts)
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* Mapa */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.gold[400]} size="large" />
          </View>
        ) : puntos.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyText}>
              {asesorId && fecha
                ? 'Sin puntos en esta fecha'
                : 'Selecciona asesor y fecha para ver la ruta'}
            </Text>
          </View>
        ) : (
          <MapView
            style={styles.map}
            initialRegion={mapRegion}
            showsUserLocation={false}
          >
            {/* Polyline de la ruta */}
            <Polyline
              coordinates={puntos.map(p => ({
                latitude:  p.lat,
                longitude: p.lng,
              }))}
              strokeColor={ROUTE_COLOR}
              strokeWidth={4}
            />

            {/* Markers en cada punto */}
            {puntos.map((p, i) => (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                title={`Punto ${i + 1}`}
                description={p.hora}
                pinColor={Colors.crimson[500]}
              />
            ))}
          </MapView>
        )}
      </View>

      {/* Lista de puntos */}
      <View style={styles.listaContainer}>
        <Text style={styles.listaTitle}>
          {puntos.length > 0 ? `${puntos.length} puntos` : 'Sin puntos'}
        </Text>
        <FlatList
          data={puntos}
          keyExtractor={item => String(item.id)}
          renderItem={({ item, index }) => (
            <View style={[styles.puntoRow, index > 0 && styles.puntoRowBorder]}>
              <Text style={styles.puntoIcon}>📍</Text>
              <View style={styles.puntoInfo}>
                <Text style={styles.puntoHora}>{item.hora}</Text>
                <Text style={styles.puntoCoords}>
                  {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                </Text>
              </View>
              {item.precision > 0 && (
                <Text style={styles.puntoPrecision}>±{item.precision}m</Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.listaEmpty}>Selecciona una fecha para ver los puntos</Text>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.md }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.cream[50],
  },

  // Header
  header: {
    backgroundColor: Colors.dark[900],
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.md,
  },
  backText: {
    color: Colors.gold[400],
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  headerTitle: {
    color: Colors.cream[50],
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  headerRight: {
    width: 60,
  },

  // Filtros
  filtros: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.base,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[200],
  },
  selector: {
    flex: 1,
    backgroundColor: Colors.cream[50],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cream[200],
    padding: Spacing.sm,
  },
  selectorDisabled: {
    opacity: 0.5,
  },
  selectorLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.dark[400],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  selectorLabelDisabled: {
    color: Colors.dark[300],
  },
  selectorValue: {
    fontSize: Typography.fontSize.base,
    color: Colors.dark[800],
    fontWeight: Typography.fontWeight.semibold,
    marginTop: 2,
  },
  selectorPlaceholder: {
    color: Colors.dark[400],
    fontWeight: Typography.fontWeight.normal,
  },
  selectorArrow: {
    fontSize: Typography.fontSize.xs,
    color: Colors.dark[400],
    marginTop: 2,
  },

  // Dropdown
  dropdown: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[200],
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[100],
  },
  dropdownItemActive: {
    backgroundColor: Colors.gold[50],
  },
  dropdownItemText: {
    fontSize: Typography.fontSize.base,
    color: Colors.dark[700],
  },
  dropdownItemTextActive: {
    color: Colors.gold[700],
    fontWeight: Typography.fontWeight.semibold,
  },
  dropdownEmpty: {
    padding: Spacing.base,
    color: Colors.dark[400],
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },

  // Mapa
  mapContainer: {
    flex: 1,
    backgroundColor: Colors.cream[100],
  },
  map: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    color: Colors.dark[400],
    textAlign: 'center',
  },

  // Lista de puntos
  listaContainer: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.cream[200],
    maxHeight: 200,
  },
  listaTitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.dark[500],
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.cream[50],
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[200],
  },
  listaEmpty: {
    padding: Spacing.base,
    color: Colors.dark[400],
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  puntoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  puntoRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.cream[100],
  },
  puntoIcon: {
    fontSize: Typography.fontSize.base,
  },
  puntoInfo: {
    flex: 1,
  },
  puntoHora: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.dark[800],
  },
  puntoCoords: {
    fontSize: Typography.fontSize.xs,
    color: Colors.dark[400],
    marginTop: 1,
  },
  puntoPrecision: {
    fontSize: Typography.fontSize.xs,
    color: Colors.dark[400],
    backgroundColor: Colors.cream[100],
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
});
