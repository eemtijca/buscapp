import {
  avaliarJustificativaSchema,
  criarJustificativaSchema,
  justificativaSchema,
  listarJustificativasSchema,
  uuidSchema,
} from '@buscapp/contratos';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  autenticar,
  exigirModulo,
  exigirPapel,
  usuarioAtual,
} from '../../nucleo/autenticacao/middleware.js';
import { avaliar, criar, listar, obter } from './justificativas.servico.js';

const parametrosJustificativa = z.object({ id: uuidSchema });
const podeLer = exigirPapel('gestao', 'professor', 'responsavel');
const podeEnviar = exigirPapel('gestao', 'responsavel');
const somenteGestao = exigirPapel('gestao');

/** Gestão e professor dispensam módulo; responsável precisa do módulo `justificativa`. */
const moduloJustificativaDoResponsavel = async (pedido: FastifyRequest): Promise<void> => {
  if (usuarioAtual(pedido).papel === 'responsavel') {
    await exigirModulo('justificativa')(pedido);
  }
};

export const rotasJustificativas: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/justificativas',
    {
      preHandler: [autenticar, podeLer, moduloJustificativaDoResponsavel],
      schema: {
        tags: ['justificativas'],
        summary: 'Lista as justificativas visíveis para o usuário autenticado',
        querystring: listarJustificativasSchema,
        response: { 200: z.object({ justificativas: z.array(justificativaSchema) }) },
      },
    },
    async (pedido) => ({ justificativas: await listar(usuarioAtual(pedido), pedido.query) }),
  );

  app.get(
    '/api/justificativas/:id',
    {
      preHandler: [autenticar, podeLer, moduloJustificativaDoResponsavel],
      schema: {
        tags: ['justificativas'],
        summary: 'Retorna uma justificativa visível para o usuário autenticado',
        params: parametrosJustificativa,
        response: { 200: z.object({ justificativa: justificativaSchema }) },
      },
    },
    async (pedido) => ({ justificativa: await obter(usuarioAtual(pedido), pedido.params.id) }),
  );

  app.post(
    '/api/justificativas',
    {
      preHandler: [autenticar, podeEnviar, moduloJustificativaDoResponsavel],
      schema: {
        tags: ['justificativas'],
        summary: 'Envia uma justificativa de falta (responsável ou gestão)',
        body: criarJustificativaSchema,
        response: { 201: z.object({ justificativa: justificativaSchema }) },
      },
    },
    async (pedido, resposta) => {
      const justificativa = await criar(usuarioAtual(pedido), pedido.body);
      resposta.status(201);
      return { justificativa };
    },
  );

  app.patch(
    '/api/justificativas/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['justificativas'],
        summary: 'Avalia (aceita ou recusa) uma justificativa pendente',
        params: parametrosJustificativa,
        body: avaliarJustificativaSchema,
        response: { 200: z.object({ justificativa: justificativaSchema }) },
      },
    },
    async (pedido) => ({
      justificativa: await avaliar(usuarioAtual(pedido), pedido.params.id, pedido.body),
    }),
  );
};
