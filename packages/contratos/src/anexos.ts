import { z } from 'zod';
import { uuidSchema } from './comuns.js';

export const MIMES_ANEXO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export const mimeAnexoSchema = z.enum(MIMES_ANEXO);

export const solicitacaoUploadAnexoSchema = z.object({
  nome_arquivo: z.string().trim().min(1).max(255),
  mime_type: mimeAnexoSchema,
  tamanho_bytes: z.number().int().positive(),
});

export type SolicitacaoUploadAnexo = z.infer<typeof solicitacaoUploadAnexoSchema>;

export const confirmacaoUploadAnexoSchema = solicitacaoUploadAnexoSchema.extend({
  chave: z.string().trim().min(1).max(1024),
});

export type ConfirmacaoUploadAnexo = z.infer<typeof confirmacaoUploadAnexoSchema>;

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
