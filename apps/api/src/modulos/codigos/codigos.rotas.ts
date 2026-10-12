import { codigoRedefinicaoSchema, paginacaoSchema, uuidSchema } from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { autenticar, exigirPapel, usuarioAtual } from '../../nucleo/autenticacao/middleware.js';
import { gerar, limpar, listar, revogar } from './codigos.servico.js';

const somenteGestao = exigirPapel('gestao');

export const rotasCodigos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/codigos',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['codigos'],
        summary: 'Lista os códigos de redefinição',
        operationId: 'listarCodigos',
        description: 'Lista os códigos de redefinição com paginação. Restrito à gestão.',
        querystring: paginacaoSchema,
        response: { 200: z.object({ codigos: z.array(codigoRedefinicaoSchema) }) },
      },
    },
    async (pedido) => ({ codigos: await listar(pedido.query) }),
  );

  app.post(
    '/api/codigos/perfil/:perfilId',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['codigos'],
        summary: 'Gera um novo código para o perfil',
        operationId: 'gerarCodigo',
        description:
          'Gera um código novo para o perfil informado, invalidando o anterior quando houver.',
        params: z.object({ perfilId: uuidSchema }),
        response: {
          201: z.object({ codigo: z.string(), expira_em: z.string() }),
        },
      },
    },
    async (pedido, resposta) => {
      const { codigo, expiraEm } = await gerar(pedido.params.perfilId, usuarioAtual(pedido).id);
      resposta.status(201);
      return { codigo, expira_em: expiraEm.toISOString() };
    },
  );

  app.patch(
    '/api/codigos/:id/revogar',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['codigos'],
        summary: 'Revoga um código ativo',
        operationId: 'revogarCodigo',
        description: 'Revoga um código ativo para que não possa mais ser usado.',
        params: z.object({ id: uuidSchema }),
        response: { 200: z.object({ codigo: codigoRedefinicaoSchema }) },
      },
    },
    async (pedido) => ({ codigo: await revogar(pedido.params.id, usuarioAtual(pedido).id) }),
  );

  app.post(
    '/api/codigos/limpar',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['codigos'],
        summary: 'Remove códigos usados, expirados ou revogados',
        operationId: 'limparCodigos',
        description: 'Remove códigos usados, expirados ou revogados em lote.',
        response: { 200: z.object({ removidos: z.number().int() }) },
      },
    },
    async (pedido) => ({ removidos: await limpar(usuarioAtual(pedido).id) }),
  );
};
