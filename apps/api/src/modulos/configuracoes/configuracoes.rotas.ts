import {
  atualizarConfiguracaoSistemaSchema,
  atualizarHorarioLetivoSchema,
  atualizarOpcaoConfiguracaoSchema,
  atualizarStatusHorarioLetivoSchema,
  atualizarStatusTagComportamentoSchema,
  atualizarTagComportamentoSchema,
  configuracaoPublicaSchema,
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
  obterConfiguracaoPublica,
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
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Retorna as configurações gerais do sistema (gestão)',
        operationId: 'obterConfiguracoes',
        description: 'Retorna as configurações gerais do sistema, restrito à gestão.',
        response: { 200: z.object({ configuracao: configuracaoSistemaSchema }) },
      },
    },
    async () => ({ configuracao: await obterConfiguracao() }),
  );

  app.get(
    '/api/configuracoes/publicas',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['configuracoes'],
        summary: 'Retorna o subconjunto de configurações visível a todos os perfis',
        operationId: 'obterConfiguracoesPublicas',
        description:
          'Retorna o subconjunto de configurações visível a todos os perfis autenticados.',
        response: { 200: z.object({ configuracao: configuracaoPublicaSchema }) },
      },
    },
    async () => ({ configuracao: await obterConfiguracaoPublica() }),
  );

  app.put(
    '/api/configuracoes',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['configuracoes'],
        summary: 'Atualiza as configurações gerais do sistema',
        operationId: 'atualizarConfiguracoes',
        description:
          'Atualiza as configurações gerais do sistema, como dados da escola, fuso, retenção de anexos e termômetro.',
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
        operationId: 'listarOpcoes',
        description: 'Lista as opções dos catálogos configuráveis, com filtros de tipo e busca.',
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
        operationId: 'criarOpcao',
        description: 'Cria uma opção de catálogo; chave repetida para o mesmo tipo responde 409.',
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
        operationId: 'atualizarOpcao',
        description: 'Atualiza rótulo, ícone, ordem ou situação da opção de catálogo.',
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
        operationId: 'reordenarOpcoes',
        description:
          'Reordena as opções em uma única transação, recebendo a lista de identificadores na ordem desejada.',
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
        operationId: 'excluirOpcao',
        description:
          'Exclui uma opção sem uso; opções referenciadas respondem 409 e devem ser desativadas.',
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
        operationId: 'listarHorarios',
        description: 'Lista os horários letivos usados pelo chat e pelos limites de envio.',
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
        operationId: 'criarHorario',
        description: 'Cria um horário letivo; dia e intervalo repetidos respondem 409.',
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
        operationId: 'atualizarHorario',
        description: 'Atualiza dia, intervalo ou situação do horário letivo.',
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
        operationId: 'atualizarStatusHorario',
        description: 'Ativa ou inativa um horário letivo.',
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
        operationId: 'excluirHorario',
        description: 'Exclui um horário letivo.',
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
        operationId: 'listarTagsComportamento',
        description:
          'Lista as tags de comportamento do catálogo, com filtros de categoria e situação.',
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
        operationId: 'criarTagComportamento',
        description: 'Cria uma tag de comportamento; nome repetido responde 409.',
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
        operationId: 'atualizarTagComportamento',
        description: 'Atualiza a tag; renomear uma tag em uso responde 409.',
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
        operationId: 'atualizarStatusTagComportamento',
        description: 'Ativa ou inativa uma tag de comportamento.',
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
        operationId: 'excluirTagComportamento',
        description:
          'Exclui uma tag sem uso; tags referenciadas respondem 409 e devem ser desativadas.',
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
