/**
 * Historial local de contratos generados en la app.
 *
 * Cada contrato generado (PDF ya persistido en documentDirectory vía
 * persistirDocumento) queda registrado aquí para poder consultarlo después
 * desde la pantalla /contratos, sin volver a generarlo.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const KEY = 'cache:contratos_generados';

export interface ContratoGenerado {
  id:             string;
  expedienteId?:  number | null;
  folio?:         string | null;
  clienteNombre:  string;
  fileUri:        string;
  createdAt:      string;
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
