import { auditoriaSchema, listarAuditoriaSchema } from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { autenticar, exigirPapel } from '../../nucleo/autenticacao/middleware.js';
import { listar } from './auditoria.servico.js';

export const rotasAuditoria: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/auditoria',
    {
      preHandler: [autenticar, exigirPapel('gestao')],
      schema: {
        tags: ['auditoria'],
        summary: 'Lista os eventos de auditoria com filtros e paginação',
        querystring: listarAuditoriaSchema,
        response: { 200: z.object({ auditoria: z.array(auditoriaSchema) }) },
      },
    },
    async (pedido) => ({ auditoria: await listar(pedido.query) }),
  );
};
