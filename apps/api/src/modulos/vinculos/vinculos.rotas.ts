import {
  atualizarVinculoSchema,
  criarVinculoSchema,
  listarVinculosSchema,
  uuidSchema,
  vinculoResponsavelSchema,
} from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { autenticar, exigirPapel, usuarioAtual } from '../../nucleo/autenticacao/middleware.js';
import { publicarEvento } from '../../nucleo/eventos/barramento.js';
import { atualizar, criar, listar } from './vinculos.servico.js';

const podeLer = exigirPapel('gestao', 'professor', 'responsavel');
const somenteGestao = exigirPapel('gestao');

export const rotasVinculos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/vinculos',
    {
      preHandler: [autenticar, podeLer],
      schema: {
        tags: ['vinculos'],
        summary: 'Lista vínculos responsável-aluno conforme o escopo',
        querystring: listarVinculosSchema,
        response: { 200: z.object({ vinculos: z.array(vinculoResponsavelSchema) }) },
      },
    },
    async (pedido) => ({ vinculos: await listar(usuarioAtual(pedido), pedido.query) }),
  );

  app.post(
    '/api/vinculos',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['vinculos'],
        summary: 'Cria um vínculo responsável-aluno',
        body: criarVinculoSchema,
        response: { 201: z.object({ vinculo: vinculoResponsavelSchema }) },
      },
    },
    async (pedido, resposta) => {
      const vinculo = await criar(pedido.body);
      publicarEvento({ tabela: 'vinculos_responsaveis' });
      resposta.status(201);
      return { vinculo };
    },
  );

  app.put(
    '/api/vinculos/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['vinculos'],
        summary: 'Atualiza um vínculo',
        params: z.object({ id: uuidSchema }),
        body: atualizarVinculoSchema,
        response: { 200: z.object({ vinculo: vinculoResponsavelSchema }) },
      },
    },
    async (pedido) => {
      const vinculo = await atualizar(pedido.params.id, pedido.body);
      publicarEvento({ tabela: 'vinculos_responsaveis' });
      return { vinculo };
    },
  );
};
