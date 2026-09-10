/**
 * roadsSnap.ts
 *
 * Ajusta una serie de puntos GPS crudos (de src/services/routeTracking.ts)
 * a la vialidad real usando la Roads API de Google, para que la polilínea
 * de app/rutas.tsx no "corte" las esquinas al conectar puntos en línea
 * recta. Requiere que la Roads API esté habilitada en el mismo proyecto de
 * Google Cloud que ya usa EXPO_PUBLIC_GOOGLE_MAPS_API_KEY para el mapa.
 *
 * Si la llamada falla (sin conexión, cuota agotada, API no habilitada), se
 * debe hacer fallback silencioso a los puntos crudos — ver uso en
 * app/rutas.tsx. Este módulo nunca oculta el error, solo lo propaga.
 */

const ROADS_API_URL = 'https://roads.googleapis.com/v1/snapToRoads';

// La Roads API acepta máximo 100 puntos por request.
const MAX_PUNTOS_POR_LOTE = 100;

export interface LatLng {
  lat: number;
  lng: number;
}

interface SnapToRoadsResponse {
  snappedPoints?: { location: { latitude: number; longitude: number } }[];
  error?: { message?: string };
}

async function snapLote(puntos: LatLng[]): Promise<LatLng[]> {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('Falta EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');

  const path = puntos.map(p => `${p.lat},${p.lng}`).join('|');
  const url  = `${ROADS_API_URL}?path=${encodeURIComponent(path)}&interpolate=true&key=${key}`;

  const res = await fetch(url);
  const data: SnapToRoadsResponse = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Roads API error ${res.status}`);
  }

  return (data.snappedPoints ?? []).map(sp => ({
    lat: sp.location.latitude,
    lng: sp.location.longitude,
  }));
}

/**
 * Divide en lotes de máximo 100 puntos, solapando 1 punto entre lotes
 * consecutivos para que el ajuste no pierda continuidad en el corte.
 */
export async function snapPointsToRoads(puntos: LatLng[]): Promise<LatLng[]> {
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
    resultado.push(...(await snapLote(lote)));
  }
  return resultado;
}
