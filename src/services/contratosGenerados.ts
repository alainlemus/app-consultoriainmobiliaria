/**
 * Historial local de contratos generados en la app.
 *
 * Cada contrato generado (PDF ya persistido en documentDirectory vía
 * persistirDocumento) queda registrado aquí para poder consultarlo después
 * desde la pantalla /contratos, sin volver a generarlo.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import type { ContratoGeneradoRemoto } from './api';

const KEY = 'cache:contratos_generados';

export interface ContratoGenerado {
  id:                  string;
  expedienteId?:       number | null;
  folio?:              string | null;
  clienteNombre:       string;
  fileUri:             string;
  ineAcreditadoUri?:   string | null;
  ineSolidarioUri?:    string | null;
  sincronizado?:       boolean;
  createdAt:           string;
  /** Presente solo si este registro se reconstruyó desde el backend (no hay PDF local en el dispositivo). */
  remotoId?:           number;
}

export async function getContratosGenerados(): Promise<ContratoGenerado[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const lista = raw ? (JSON.parse(raw) as ContratoGenerado[]) : [];
    // Más recientes primero
    return lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function guardarContratoGenerado(
  params: Omit<ContratoGenerado, 'id' | 'createdAt'>,
): Promise<ContratoGenerado> {
  const entry: ContratoGenerado = {
    id:        uuidv4(),
    createdAt: new Date().toISOString(),
    ...params,
  };
  const lista = await getContratosGenerados();
  lista.unshift(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(lista));
  return entry;
}

export async function getContratoGenerado(id: string): Promise<ContratoGenerado | null> {
  const lista = await getContratosGenerados();
  return lista.find(c => c.id === id) ?? null;
}

export async function eliminarContratoGenerado(id: string): Promise<void> {
  const lista = await getContratosGenerados();
  const restantes = lista.filter(c => c.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(restantes));
}

/** Marca un contrato del historial local como ya subido al backend. */
export async function marcarContratoSincronizado(id: string): Promise<void> {
  const lista = await getContratosGenerados();
  const idx = lista.findIndex(c => c.id === id);
  if (idx === -1) return;
  lista[idx] = { ...lista[idx], sincronizado: true };
  await AsyncStorage.setItem(KEY, JSON.stringify(lista));
}

/**
 * Completa el historial local con los contratos que existen en el backend
 * pero no en este dispositivo (típicamente tras desinstalar/reinstalar la
 * app, o al iniciar sesión en un dispositivo nuevo). No hay PDF local para
 * estos registros — se abren bajo demanda vía getContratoGeneradoUrls().
 * Al subir un contrato, `local_id` en el servidor es el mismo `id` con el
 * que se guardó localmente, así que basta comparar por ese campo.
 */
export async function hidratarDesdeServidor(remotos: ContratoGeneradoRemoto[]): Promise<ContratoGenerado[]> {
  const lista = await getContratosGenerados();
  const idsLocales = new Set(lista.map(c => c.id));
  const faltantes = remotos.filter(r => !idsLocales.has(r.local_id));
  if (faltantes.length === 0) return lista;

  const nuevos: ContratoGenerado[] = faltantes.map(r => ({
    id:            r.local_id,
    remotoId:      r.id,
    folio:         r.folio,
    clienteNombre: r.acreditado_nombre,
    fileUri:       '',
    sincronizado:  true,
    createdAt:     r.created_at,
  }));

  const combinada = [...nuevos, ...lista];
  await AsyncStorage.setItem(KEY, JSON.stringify(combinada));
  return combinada;
}
