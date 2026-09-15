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
