import { z } from 'zod';

/** UUID em formato canônico; aceita identificadores legados fora do padrão RFC 4122. */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    'UUID inválido',
  );

/** Envelope único de erro da API. */
export const erroApiSchema = z.object({
  erro: z.object({
    codigo: z.string(),
    mensagem: z.string(),
    detalhes: z.unknown().optional(),
  }),
});

export type ErroApi = z.infer<typeof erroApiSchema>;

/** Paginação padrão das listagens: `limite` e `offset` com ordenação estável. */
export const paginacaoSchema = z.object({
  limite: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type Paginacao = z.infer<typeof paginacaoSchema>;

/** Paginação por cursor, usada em listas que crescem sem parar (mensagens do chat). */
export const paginacaoCursorSchema = z.object({
  limite: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});

export type PaginacaoCursor = z.infer<typeof paginacaoCursorSchema>;
