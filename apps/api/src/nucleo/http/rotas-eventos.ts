import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { origensPermitidas } from '../../ambiente.js';
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
      const origem = pedido.headers.origin;
      const origemPermitida = origem && origensPermitidas.includes(origem) ? origem : undefined;
      conectarEventos(usuarioAtual(pedido).id, resposta, origemPermitida);
      return resposta;
    },
  );
};
