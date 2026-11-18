/**
 * Super admin: lo que hacen todos los gestores (/v1/admin/encargos-gestor).
 * Solo lectura; enviar, corregir y cancelar se hacen en el panel web.
 */
import { apiFetch, resolveStorageUrl } from './api';
import type { EncargoDetalle, EncargoResumen } from './gestorApi';

export type FiltroAdmin = 'abiertos' | 'vencidos' | 'terminados' | 'todos';

export interface EncargoAdmin extends EncargoResumen {
  gestor: { id: number; nombre: string } | null;
  vencido: boolean;
  updated_at: string | null;
}

export type EncargoAdminDetalle = EncargoAdmin & EncargoDetalle;

export interface MetaEncargosAdmin {
  vencidos: number;
  gestores: { id: number; nombre: string }[];
}

export async function getEncargosAdmin(p: { filtro?: FiltroAdmin; gestorId?: number | null; expedienteId?: number } = {}): Promise<{ data: EncargoAdmin[]; meta: MetaEncargosAdmin }> {
  const q = new URLSearchParams();
  if (p.filtro) q.set('filtro', p.filtro);
  if (p.gestorId) q.set('gestor_id', String(p.gestorId));
  if (p.expedienteId) q.set('expediente_id', String(p.expedienteId));
  const qs = q.toString();
  return apiFetch<{ data: EncargoAdmin[]; meta: MetaEncargosAdmin }>(`/admin/encargos-gestor${qs ? `?${qs}` : ''}`);
}

export async function getEncargoAdmin(id: number): Promise<EncargoAdminDetalle> {
  return (await apiFetch<{ data: EncargoAdminDetalle }>(`/admin/encargos-gestor/${id}`)).data;
}

export async function urlDocumentoAdmin(encargoId: number, documentoId: number): Promise<string> {
  const res = await apiFetch<{ url: string }>(`/admin/encargos-gestor/${encargoId}/documentos/${documentoId}/url`);
  return resolveStorageUrl(res.url) ?? res.url;
}

/** Texto del historial visto por la administración (el gestor lo ve en segunda persona). */
export const EVENTOS_ADMIN: Record<string, string> = {
  enviado: 'Se envió al gestor', revision_con_observaciones: 'El gestor marcó documentos con observaciones',
  reenviado: 'Se corrigió y se le regresó', tramite_iniciado: 'Todo correcto: empezó el trámite',
  documento_subido: 'Subió un documento', documento_validado: 'Documento validado',
  documento_rechazado: 'Documento rechazado', entregado: 'Avisó que terminó', reabierto: 'Reabrió el encargo',
  terminado: 'Encargo terminado', cancelado: 'Encargo cancelado',
};
