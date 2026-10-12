import { z } from 'zod';
import { paginacaoSchema, uuidSchema } from './comuns.js';

/** Evento de auditoria com o nome do autor resolvido para a interface. */
export const auditoriaSchema = z.object({
  id: uuidSchema,
  usuario_id: uuidSchema.nullable(),
  usuario_nome: z.string().nullable(),
  acao: z.string(),
  entidade: z.string(),
  entidade_id: uuidSchema.nullable(),
  // `z.unknown()` já aceita null; o `nullable()` extra gerava um `anyOf` vazio no JSON Schema.
  dados_anteriores: z.unknown(),
  dados_novos: z.unknown(),
  ip_origem: z.string().nullable(),
  created_at: z.string(),
});

export type Auditoria = z.infer<typeof auditoriaSchema>;

export const listarAuditoriaSchema = z.object({
  acao: z.string().trim().min(1).max(80).optional(),
  entidade: z.string().trim().min(1).max(80).optional(),
  usuario_id: uuidSchema.optional(),
  data_inicio: z.string().date('Data inicial inválida.').optional(),
  data_fim: z.string().date('Data final inválida.').optional(),
  ...paginacaoSchema.shape,
});

export type ListarAuditoria = z.infer<typeof listarAuditoriaSchema>;
