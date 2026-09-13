import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { autenticar, usuarioAtual } from '../autenticacao/middleware.js';
import { conectarEventos } from '../eventos/barramento.js';

export const rotasEventos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/eventos',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['eventos'],
        summary: 'Stream SSE de invalidação para atualização em tempo real',
      },
    },
    async (pedido, resposta) => {
      conectarEventos(usuarioAtual(pedido).id, resposta);
      return resposta;
    },
  );
};
