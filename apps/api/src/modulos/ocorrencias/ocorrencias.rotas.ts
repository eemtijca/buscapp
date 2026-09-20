import {
  atualizarOcorrenciaSchema,
  criarOcorrenciaSchema,
  criarRegistroComportamentoSchema,
  listarOcorrenciasSchema,
  listarRegistrosComportamentoSchema,
  ocorrenciaSchema,
  registroComportamentoSchema,
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
  atualizar,
  criar,
  criarRegistroComportamento,
  listar,
  listarRegistrosComportamento,
  obter,
} from './ocorrencias.servico.js';

const parametrosOcorrencia = z.object({ id: uuidSchema });
const podeLer = exigirPapel('gestao', 'professor', 'responsavel');
const podeEscrever = exigirPapel('gestao', 'professor');
const somenteGestao = exigirPapel('gestao');

const exigirModuloOcorrencias = exigirModulo('ocorrencias');
const exigirModuloAlertas = exigirModulo('alertas');

/** Leitura: professor exige módulo `ocorrencias`; responsável exige `alertas`; gestão passa. */
async function exigirModuloDeLeitura(pedido: FastifyRequest): Promise<void> {
  const usuario = usuarioAtual(pedido);
  if (usuario.papel === 'professor') return exigirModuloOcorrencias(pedido);
  if (usuario.papel === 'responsavel') return exigirModuloAlertas(pedido);
}

/** Escrita: somente o professor exige módulo `ocorrencias`; gestão insere sem módulo (espelho da RLS). */
async function exigirModuloDeEscrita(pedido: FastifyRequest): Promise<void> {
  if (usuarioAtual(pedido).papel === 'professor') return exigirModuloOcorrencias(pedido);
}

export const rotasOcorrencias: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/ocorrencias',
    {
      preHandler: [autenticar, podeLer, exigirModuloDeLeitura],
      schema: {
        tags: ['ocorrencias'],
        summary: 'Lista as ocorrências visíveis para o usuário autenticado',
        querystring: listarOcorrenciasSchema,
        response: { 200: z.object({ ocorrencias: z.array(ocorrenciaSchema) }) },
      },
    },
    async (pedido) => ({ ocorrencias: await listar(usuarioAtual(pedido), pedido.query) }),
  );

  app.get(
    '/api/ocorrencias/:id',
    {
      preHandler: [autenticar, podeLer, exigirModuloDeLeitura],
      schema: {
        tags: ['ocorrencias'],
        summary: 'Retorna uma ocorrência visível para o usuário autenticado',
        params: parametrosOcorrencia,
        response: { 200: z.object({ ocorrencia: ocorrenciaSchema }) },
      },
    },
    async (pedido) => ({ ocorrencia: await obter(usuarioAtual(pedido), pedido.params.id) }),
  );

  app.post(
    '/api/ocorrencias',
    {
      preHandler: [autenticar, podeEscrever, exigirModuloDeEscrita],
      schema: {
        tags: ['ocorrencias'],
        summary: 'Registra uma ocorrência para um aluno visível',
        body: criarOcorrenciaSchema,
        response: { 201: z.object({ ocorrencia: ocorrenciaSchema }) },
      },
    },
    async (pedido, resposta) => {
      const ocorrencia = await criar(usuarioAtual(pedido), pedido.body);
      resposta.status(201);
      return { ocorrencia };
    },
  );

  app.patch(
    '/api/ocorrencias/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['ocorrencias'],
        summary: 'Atualiza status e presença do responsável de uma ocorrência',
        params: parametrosOcorrencia,
        body: atualizarOcorrenciaSchema,
        response: { 200: z.object({ ocorrencia: ocorrenciaSchema }) },
      },
    },
    async (pedido) => ({ ocorrencia: await atualizar(pedido.params.id, pedido.body) }),
  );

  app.get(
    '/api/registros-comportamento',
    {
      preHandler: [autenticar, podeLer],
      schema: {
        tags: ['ocorrencias'],
        summary: 'Lista os registros de comportamento visíveis para o usuário autenticado',
        querystring: listarRegistrosComportamentoSchema,
        response: { 200: z.object({ registros: z.array(registroComportamentoSchema) }) },
      },
    },
    async (pedido) => ({
      registros: await listarRegistrosComportamento(usuarioAtual(pedido), pedido.query),
    }),
  );

  app.post(
    '/api/registros-comportamento',
    {
      preHandler: [autenticar, podeEscrever, exigirModuloDeEscrita],
      schema: {
        tags: ['ocorrencias'],
        summary: 'Registra um comportamento para um aluno da turma do professor',
        body: criarRegistroComportamentoSchema,
        response: { 201: z.object({ registro: registroComportamentoSchema }) },
      },
    },
    async (pedido, resposta) => {
      const registro = await criarRegistroComportamento(usuarioAtual(pedido), pedido.body);
      resposta.status(201);
      return { registro };
    },
  );
};
