import {
  atualizarConfiguracaoSistemaSchema,
  atualizarHorarioLetivoSchema,
  atualizarOpcaoConfiguracaoSchema,
  atualizarStatusHorarioLetivoSchema,
  atualizarStatusTagComportamentoSchema,
  atualizarTagComportamentoSchema,
  configuracaoSistemaSchema,
  criarHorarioLetivoSchema,
  criarOpcaoConfiguracaoSchema,
  criarTagComportamentoSchema,
  horarioLetivoSchema,
  listarOpcoesConfiguracaoSchema,
  listarTagsComportamentoSchema,
  opcaoConfiguracaoSchema,
  reordenarOpcoesConfiguracaoSchema,
  tagComportamentoCatalogoSchema,
  uuidSchema,
} from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { autenticar, exigirPapel } from '../../nucleo/autenticacao/middleware.js';
import {
  atualizarConfiguracaoSistema,
  atualizarHorarioLetivo,
  atualizarOpcaoConfiguracao,
  atualizarStatusHorarioLetivo,
  atualizarStatusTagComportamento,
  atualizarTagComportamento,
  criarHorarioLetivo,
  criarOpcaoConfiguracao,
  criarTagComportamento,
  excluirHorarioLetivo,
  excluirOpcaoConfiguracao,
  excluirTagComportamento,
  listarHorariosLetivos,
  listarOpcoesConfiguracao,
  listarTagsComportamento,
  obterConfiguracao,
  reordenarOpcoesConfiguracao,
} from './configuracoes.servico.js';

const parametrosOpcao = z.object({ id: uuidSchema });
const parametrosHorario = z.object({ id: uuidSchema });
const parametrosTag = z.object({ id: uuidSchema });
const somenteGestao = exigirPapel('gestao');

export const rotasConfiguracoes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/configuracoes',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['configuracoes'],
        summary: 'Retorna as configurações gerais do sistema',
        response: { 200: z.object({ configuracao: configuracaoSistemaSchema }) },
      },
    },
    async () => ({ configuracao: await obterConfiguracao() }),
  );

  app.put(
    '/api/configuracoes',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Atualiza as configurações gerais do sistema',
        body: atualizarConfiguracaoSistemaSchema,
        response: { 200: z.object({ configuracao: configuracaoSistemaSchema }) },
      },
    },
    async (pedido) => ({ configuracao: await atualizarConfiguracaoSistema(pedido.body) }),
  );

  app.get(
    '/api/opcoes',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['configuracoes'],
        summary: 'Lista as opções de configuração (catálogo)',
        querystring: listarOpcoesConfiguracaoSchema,
        response: { 200: z.object({ opcoes: z.array(opcaoConfiguracaoSchema) }) },
      },
    },
    async (pedido) => ({ opcoes: await listarOpcoesConfiguracao(pedido.query) }),
  );

  app.post(
    '/api/opcoes',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Cria uma opção de configuração',
        body: criarOpcaoConfiguracaoSchema,
        response: { 201: z.object({ opcao: opcaoConfiguracaoSchema }) },
      },
    },
    async (pedido, resposta) => {
      const opcao = await criarOpcaoConfiguracao(pedido.body);
      resposta.status(201);
      return { opcao };
    },
  );

  app.put(
    '/api/opcoes/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Atualiza rótulo, ícone, ordem ou status de uma opção',
        params: parametrosOpcao,
        body: atualizarOpcaoConfiguracaoSchema,
        response: { 200: z.object({ opcao: opcaoConfiguracaoSchema }) },
      },
    },
    async (pedido) => ({ opcao: await atualizarOpcaoConfiguracao(pedido.params.id, pedido.body) }),
  );

  app.patch(
    '/api/opcoes/reordenar',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Reordena opções em uma única transação',
        body: reordenarOpcoesConfiguracaoSchema,
        response: { 200: z.object({ opcoes: z.array(opcaoConfiguracaoSchema) }) },
      },
    },
    async (pedido) => ({ opcoes: await reordenarOpcoesConfiguracao(pedido.body) }),
  );

  app.delete(
    '/api/opcoes/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Exclui uma opção não referenciada do catálogo',
        params: parametrosOpcao,
        response: { 204: z.null() },
      },
    },
    async (pedido, resposta) => {
      await excluirOpcaoConfiguracao(pedido.params.id);
      resposta.status(204).send(null);
    },
  );

  app.get(
    '/api/horarios',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['configuracoes'],
        summary: 'Lista os horários letivos',
        response: { 200: z.object({ horarios: z.array(horarioLetivoSchema) }) },
      },
    },
    async () => ({ horarios: await listarHorariosLetivos() }),
  );

  app.post(
    '/api/horarios',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Cria um horário letivo',
        body: criarHorarioLetivoSchema,
        response: { 201: z.object({ horario: horarioLetivoSchema }) },
      },
    },
    async (pedido, resposta) => {
      const horario = await criarHorarioLetivo(pedido.body);
      resposta.status(201);
      return { horario };
    },
  );

  app.put(
    '/api/horarios/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Atualiza um horário letivo',
        params: parametrosHorario,
        body: atualizarHorarioLetivoSchema,
        response: { 200: z.object({ horario: horarioLetivoSchema }) },
      },
    },
    async (pedido) => ({ horario: await atualizarHorarioLetivo(pedido.params.id, pedido.body) }),
  );

  app.patch(
    '/api/horarios/:id/status',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Ativa ou inativa um horário letivo',
        params: parametrosHorario,
        body: atualizarStatusHorarioLetivoSchema,
        response: { 200: z.object({ horario: horarioLetivoSchema }) },
      },
    },
    async (pedido) => ({
      horario: await atualizarStatusHorarioLetivo(pedido.params.id, pedido.body.ativo),
    }),
  );

  app.delete(
    '/api/horarios/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Exclui um horário letivo',
        params: parametrosHorario,
        response: { 204: z.null() },
      },
    },
    async (pedido, resposta) => {
      await excluirHorarioLetivo(pedido.params.id);
      resposta.status(204).send(null);
    },
  );

  app.get(
    '/api/tags-comportamento',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['configuracoes'],
        summary: 'Lista as tags de comportamento',
        querystring: listarTagsComportamentoSchema,
        response: { 200: z.object({ tags: z.array(tagComportamentoCatalogoSchema) }) },
      },
    },
    async (pedido) => ({ tags: await listarTagsComportamento(pedido.query) }),
  );

  app.post(
    '/api/tags-comportamento',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Cria uma tag de comportamento',
        body: criarTagComportamentoSchema,
        response: { 201: z.object({ tag: tagComportamentoCatalogoSchema }) },
      },
    },
    async (pedido, resposta) => {
      const tag = await criarTagComportamento(pedido.body);
      resposta.status(201);
      return { tag };
    },
  );

  app.put(
    '/api/tags-comportamento/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Atualiza uma tag de comportamento',
        params: parametrosTag,
        body: atualizarTagComportamentoSchema,
        response: { 200: z.object({ tag: tagComportamentoCatalogoSchema }) },
      },
    },
    async (pedido) => ({ tag: await atualizarTagComportamento(pedido.params.id, pedido.body) }),
  );

  app.patch(
    '/api/tags-comportamento/:id/status',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Ativa ou inativa uma tag de comportamento',
        params: parametrosTag,
        body: atualizarStatusTagComportamentoSchema,
        response: { 200: z.object({ tag: tagComportamentoCatalogoSchema }) },
      },
    },
    async (pedido) => ({
      tag: await atualizarStatusTagComportamento(pedido.params.id, pedido.body.ativo),
    }),
  );

  app.delete(
    '/api/tags-comportamento/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Exclui uma tag de comportamento não referenciada',
        params: parametrosTag,
        response: { 204: z.null() },
      },
    },
    async (pedido, resposta) => {
      await excluirTagComportamento(pedido.params.id);
      resposta.status(204).send(null);
    },
  );
};
