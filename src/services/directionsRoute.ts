/**
 * directionsRoute.ts
 *
 * Reconstruye el camino real entre paradas distantes (inicio de ruta,
 * visitas a clientes/escuelas/propiedades, fin de ruta) usando la Directions
 * API de Google — a diferencia de la Roads API (src/services/roadsSnap.ts),
 * que solo "pega a la calle" puntos ya cercanos entre sí, la Directions API
 * calcula la vialidad real entre paradas que pueden estar a varios
 * kilómetros de distancia.
 *
 * Si la llamada falla (sin conexión, cuota agotada, API no habilitada), se
 * debe hacer fallback silencioso a la polilínea cruda — ver uso en
 * app/rutas.tsx. Este módulo nunca oculta el error, solo lo propaga.
 */

import type { LatLng } from './roadsSnap';

const DIRECTIONS_API_URL = 'https://maps.googleapis.com/maps/api/directions/json';

// La Directions API acepta máximo 25 puntos por request (origen + destino + 23 waypoints).
const MAX_PUNTOS_POR_LOTE = 25;

interface DirectionsResponse {
  status?: string;
  error_message?: string;
  routes?: { overview_polyline?: { points?: string } }[];
}

/** Decodifica una polilínea codificada (algoritmo estándar de Google Maps). */
function decodePolyline(encoded: string): LatLng[] {
  const puntos: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let result = 0, shift = 0, b: number;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    puntos.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return puntos;
}

async function rutaLote(puntos: LatLng[]): Promise<LatLng[]> {
  if (puntos.length < 2) return puntos;

  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('Falta EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');

  const origen      = puntos[0];
  const destino     = puntos[puntos.length - 1];
  const intermedios = puntos.slice(1, -1);

  const params = new URLSearchParams({
    origin:      `${origen.lat},${origen.lng}`,
    destination: `${destino.lat},${destino.lng}`,
    key,
  });
  if (intermedios.length > 0) {
    params.set('waypoints', intermedios.map(p => `${p.lat},${p.lng}`).join('|'));
  }

  const res  = await fetch(`${DIRECTIONS_API_URL}?${params.toString()}`);
  const data: DirectionsResponse = await res.json();

  if (!res.ok || data.status !== 'OK') {
    throw new Error(data.error_message ?? `Directions API error: ${data.status ?? res.status}`);
  }

  const encoded = data.routes?.[0]?.overview_polyline?.points;
  if (!encoded) throw new Error('Directions API no devolvió una ruta');

  return decodePolyline(encoded);
}

/**
 * Divide en lotes de máximo 25 puntos (límite de la Directions API),
 * solapando 1 punto entre lotes consecutivos para que el trazo no pierda
 * continuidad en el corte.
 */
export async function getDirectionsRoute(puntos: LatLng[]): Promise<LatLng[]> {
  if (puntos.length < 2) return puntos;

  const lotes: LatLng[][] = [];
  let i = 0;
  while (i < puntos.length) {
    const fin = Math.min(i + MAX_PUNTOS_POR_LOTE, puntos.length);
    lotes.push(puntos.slice(i, fin));
    if (fin === puntos.length) break;
    i = fin - 1;
  }

  const resultado: LatLng[] = [];
  for (const lote of lotes) {
    resultado.push(...(await rutaLote(lote)));
  }
  return resultado;
}
