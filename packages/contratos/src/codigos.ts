import { z } from 'zod';
import { uuidSchema } from './comuns.js';

export const statusCodigoSchema = z.enum(['ativo', 'usado', 'expirado', 'revogado']);

export const codigoRedefinicaoSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  perfil_id: uuidSchema,
  perfil_nome: z.string().nullable(),
  usado_em: z.string().nullable(),
  revogado_em: z.string().nullable(),
  expira_em: z.string(),
  created_at: z.string(),
  status: statusCodigoSchema,
});

export type CodigoRedefinicao = z.infer<typeof codigoRedefinicaoSchema>;
