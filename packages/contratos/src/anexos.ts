import { z } from 'zod';
import { uuidSchema } from './comuns.js';

export const anexoSchema = z.object({
  id: uuidSchema,
  storage_path: z.string(),
  nome_arquivo: z.string(),
  mime_type: z.string(),
  tamanho_bytes: z.number().int(),
  criado_por: uuidSchema.nullable(),
  expurgo_em: z.string(),
  processado_em: z.string().nullable(),
  created_at: z.string(),
});

export type Anexo = z.infer<typeof anexoSchema>;
