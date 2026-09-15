import {
  criarFrequenciaSchema,
  frequenciaSchema,
  listarFrequenciasSchema,
  registrarLoteFrequenciaSchema,
  removerLoteFrequenciaSchema,
  resumirFrequenciasSchema,
  resumoAlunoFrequenciaSchema,
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
import {
  listar,
  obter,
  registrar,
  registrarLote,
  removerLote,
  resumir,
} from './frequencias.servico.js';

const podeLer = exigirPapel('gestao', 'professor', 'responsavel');
const podeLancar = exigirPapel('gestao', 'professor');

/** Gestão dispensa módulo; professor precisa do módulo `frequencia` habilitado. */
const moduloFrequenciaDoProfessor = async (pedido: FastifyRequest): Promise<void> => {
  if (usuarioAtual(pedido).papel === 'professor') {
    await exigirModulo('frequencia')(pedido);
  }
};

export const rotasFrequencias: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/api/frequencias/lote',
    {
      preHandler: [autenticar, podeLancar, moduloFrequenciaDoProfessor],
      schema: {
        tags: ['frequencias'],
        summary: 'Lança as ausências de uma turma em um período (idempotente)',
        body: registrarLoteFrequenciaSchema,
        response: {
          200: z.object({ ok: z.literal(true), idempotente: z.literal(true) }),
          201: z.object({ ok: z.literal(true), registradas: z.number().int() }),
        },
      },
    },
    async (pedido, resposta) => {
      const resultado = await registrarLote(usuarioAtual(pedido), pedido.body);
      if (resultado.idempotente) {
        return { ok: true as const, idempotente: true as const };
      }
      resposta.status(201);
      return { ok: true as const, registradas: resultado.registradas };
    },
  );

  app.delete(
    '/api/frequencias/lote',
    {
      preHandler: [autenticar, podeLancar, moduloFrequenciaDoProfessor],
      schema: {
        tags: ['frequencias'],
        summary: 'Desfaz a chamada lançada para a turma, data, período e tipo informados',
        querystring: removerLoteFrequenciaSchema,
        response: { 200: z.object({ ok: z.literal(true), removidas: z.number().int() }) },
      },
    },
    async (pedido) => {
      const { removidas } = await removerLote(usuarioAtual(pedido), pedido.query);
      return { ok: true as const, removidas };
    },
  );

  app.post(
    '/api/frequencias',
    {
      preHandler: [autenticar, podeLancar, moduloFrequenciaDoProfessor],
      schema: {
        tags: ['frequencias'],
        summary: 'Registra a ausência individual de um aluno em um período',
        body: criarFrequenciaSchema,
        response: {
          200: z.object({ frequencia: frequenciaSchema, idempotente: z.literal(true) }),
          201: z.object({ frequencia: frequenciaSchema }),
        },
      },
    },
    async (pedido, resposta) => {
      const resultado = await registrar(usuarioAtual(pedido), pedido.body);
      if (resultado.idempotente) {
        return { frequencia: resultado.frequencia, idempotente: true as const };
      }
      resposta.status(201);
      return { frequencia: resultado.frequencia };
    },
  );

  app.get(
    '/api/frequencias/resumo',
    {
      preHandler: [autenticar, podeLer],
      schema: {
        tags: ['frequencias'],
        summary: 'Resume ausências e justificativas por aluno para o monitoramento',
        querystring: resumirFrequenciasSchema,
        response: { 200: z.object({ resumo: z.array(resumoAlunoFrequenciaSchema) }) },
      },
    },
    async (pedido) => ({ resumo: await resumir(usuarioAtual(pedido), pedido.query) }),
  );

  app.get(
    '/api/frequencias/:id',
    {
      preHandler: [autenticar, podeLer],
      schema: {
        tags: ['frequencias'],
        summary: 'Retorna uma frequência visível para o usuário',
        params: z.object({ id: uuidSchema }),
        response: { 200: z.object({ frequencia: frequenciaSchema }) },
      },
    },
    async (pedido) => ({ frequencia: await obter(usuarioAtual(pedido), pedido.params.id) }),
  );

  app.get(
    '/api/frequencias',
    {
      preHandler: [autenticar, podeLer],
      schema: {
        tags: ['frequencias'],
        summary: 'Lista as frequências visíveis para o usuário autenticado',
        querystring: listarFrequenciasSchema,
        response: { 200: z.object({ frequencias: z.array(frequenciaSchema) }) },
      },
    },
    async (pedido) => ({ frequencias: await listar(usuarioAtual(pedido), pedido.query) }),
  );
};
