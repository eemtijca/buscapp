import { z } from 'zod';

export const expurgoRespostaSchema = z.object({
  ok: z.literal(true),
  anexos: z.number().int(),
  codigos: z.number().int(),
  sessoes: z.number().int(),
  contadores: z.number().int(),
});

export type ExpurgoResposta = z.infer<typeof expurgoRespostaSchema>;
