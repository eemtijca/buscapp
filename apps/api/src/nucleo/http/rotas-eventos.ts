import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { origemAutorizada } from '../../ambiente.js';
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
        operationId: 'assinarEventos',
        description:
          'Abre um stream SSE com eventos de invalidação de dados. O cliente revalida os recursos indicados no evento e reconecta quando a conexão cair.',
      },
    },
    async (pedido, resposta) => {
      const origem = pedido.headers.origin;
      const origemPermitida = origem && origemAutorizada(origem) ? origem : undefined;
      conectarEventos(usuarioAtual(pedido).id, resposta, origemPermitida);
      return resposta;
    },
  );
};
