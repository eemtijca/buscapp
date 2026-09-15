import { z } from 'zod';
import { uuidSchema } from './comuns.js';

export const vinculoResponsavelSchema = z.object({
  id: uuidSchema,
  responsavel_id: uuidSchema,
  aluno_id: uuidSchema,
  tipo_relacao: z.string(),
  contato_prioritario: z.boolean(),
  ativo: z.boolean(),
  created_at: z.string(),
  responsavel_nome: z.string().nullable().optional(),
});

export type VinculoResponsavel = z.infer<typeof vinculoResponsavelSchema>;

export const criarVinculoSchema = z.object({
  responsavel_id: uuidSchema,
  aluno_id: uuidSchema,
  tipo_relacao: z.string().trim().min(1),
  contato_prioritario: z.boolean().optional(),
});

export const atualizarVinculoSchema = z.object({
  tipo_relacao: z.string().trim().min(1).optional(),
  contato_prioritario: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

export const listarVinculosSchema = z.object({
  aluno_id: uuidSchema.optional(),
  responsavel_id: uuidSchema.optional(),
  ativo: z.enum(['true', 'false']).optional(),
});

export type CriarVinculo = z.infer<typeof criarVinculoSchema>;
export type AtualizarVinculo = z.infer<typeof atualizarVinculoSchema>;
export type ListarVinculos = z.infer<typeof listarVinculosSchema>;
