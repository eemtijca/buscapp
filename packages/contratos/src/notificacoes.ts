import { z } from 'zod';
import { uuidSchema } from './comuns.js';
import { booleanQuerySchema } from './estrutura.js';

export const tipoNotificacaoSchema = z.enum([
  'ausencia_portao',
  'ausencia_aula',
  'monitoramento',
  'ocorrencia',
  'justificativa',
  'mensagem',
  'sistema',
  'codigo_redefinicao',
]);

export type TipoNotificacao = z.infer<typeof tipoNotificacaoSchema>;

export const notificacaoSchema = z.object({
  id: uuidSchema,
  destinatario_id: uuidSchema,
  tipo: tipoNotificacaoSchema,
  titulo: z.string(),
  corpo: z.string().nullable(),
  metadados: z.record(z.string(), z.unknown()).nullable(),
  lida: z.boolean(),
  lida_em: z.string().nullable(),
  created_at: z.string(),
});

export type Notificacao = z.infer<typeof notificacaoSchema>;

export const listarNotificacoesSchema = z.object({
  limite: z.coerce.number().int().min(1).max(100).default(20),
  lida: booleanQuerySchema.optional(),
});

export type ListarNotificacoes = z.infer<typeof listarNotificacoesSchema>;

export const listarNotificacoesRespostaSchema = z.object({
  notificacoes: z.array(notificacaoSchema),
  nao_lidas: z.number().int().nonnegative(),
});

export type ListarNotificacoesResposta = z.infer<typeof listarNotificacoesRespostaSchema>;

export const notificacaoRespostaSchema = z.object({ notificacao: notificacaoSchema });

export const notificacoesAtualizadasSchema = z.object({
  atualizadas: z.number().int().nonnegative(),
});

export const notificacoesRemovidasSchema = z.object({
  removidas: z.number().int().nonnegative(),
});
