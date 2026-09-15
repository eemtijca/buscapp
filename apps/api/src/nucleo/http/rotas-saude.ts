import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

export const rotasSaude: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/saude',
    {
      schema: {
        tags: ['saude'],
        summary: 'Verifica a disponibilidade da API',
        response: {
          200: z.object({
            status: z.literal('ok'),
            hora: z.string(),
          }),
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      hora: new Date().toISOString(),
    }),
  );
};
