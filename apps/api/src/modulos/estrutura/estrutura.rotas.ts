import {
  anoLetivoSchema,
  atribuicaoProfessorSchema,
  atualizarAnoLetivoSchema,
  atualizarAtribuicaoSchema,
  atualizarDisciplinaSchema,
  atualizarEnturmacaoSchema,
  atualizarTurmaSchema,
  criarAnoLetivoSchema,
  criarAtribuicaoSchema,
  criarDisciplinaSchema,
  criarEnturmacaoSchema,
  criarTurmaSchema,
  disciplinaSchema,
  enturmacaoSchema,
  listarAtribuicoesSchema,
  listarDisciplinasSchema,
  listarEnturmacoesSchema,
  listarTurmasSchema,
  statusGenericoSchema,
  turmaSchema,
  uuidSchema,
} from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { autenticar, exigirPapel, usuarioAtual } from '../../nucleo/autenticacao/middleware.js';
import {
  ativarAnoLetivo,
  atualizarAnoLetivo,
  atualizarAtribuicao,
  atualizarDisciplina,
  atualizarEnturmacao,
  atualizarStatusAtribuicao,
  atualizarStatusDisciplina,
  atualizarStatusTurma,
  atualizarTurma,
  criarAnoLetivo,
  criarAtribuicao,
  criarDisciplina,
  criarEnturmacao,
  criarTurma,
  listarAnosLetivos,
  listarAtribuicoes,
  listarDisciplinas,
  listarEnturmacoes,
  listarTurmas,
} from './estrutura.servico.js';

const parametrosPorId = z.object({ id: uuidSchema });
const podeLer = exigirPapel('gestao', 'professor', 'responsavel');
const somenteGestao = exigirPapel('gestao');

export const rotasEstrutura: FastifyPluginAsyncZod = async (app) => {
  // --- Turmas ---

  app.get(
    '/api/turmas',
    {
      preHandler: [autenticar, podeLer],
      schema: {
        tags: ['estrutura'],
        summary: 'Lista as turmas visíveis para o usuário autenticado',
        querystring: listarTurmasSchema,
        response: { 200: z.object({ turmas: z.array(turmaSchema) }) },
      },
    },
    async (pedido) => ({ turmas: await listarTurmas(usuarioAtual(pedido), pedido.query) }),
  );

  app.post(
    '/api/turmas',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Cadastra uma turma no ano letivo informado',
        body: criarTurmaSchema,
        response: { 201: z.object({ turma: turmaSchema }) },
      },
    },
    async (pedido, resposta) => {
      const turma = await criarTurma(pedido.body);
      resposta.status(201);
      return { turma };
    },
  );

  app.put(
    '/api/turmas/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Atualiza série, letra, capacidade e situação de uma turma',
        params: parametrosPorId,
        body: atualizarTurmaSchema,
        response: { 200: z.object({ turma: turmaSchema }) },
      },
    },
    async (pedido) => ({ turma: await atualizarTurma(pedido.params.id, pedido.body) }),
  );

  app.patch(
    '/api/turmas/:id/status',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Ativa ou inativa uma turma',
        params: parametrosPorId,
        body: statusGenericoSchema,
        response: { 200: z.object({ turma: turmaSchema }) },
      },
    },
    async (pedido) => ({
      turma: await atualizarStatusTurma(pedido.params.id, pedido.body.ativo),
    }),
  );

  // --- Disciplinas ---

  app.get(
    '/api/disciplinas',
    {
      preHandler: [autenticar, podeLer],
      schema: {
        tags: ['estrutura'],
        summary: 'Lista as disciplinas cadastradas',
        querystring: listarDisciplinasSchema,
        response: { 200: z.object({ disciplinas: z.array(disciplinaSchema) }) },
      },
    },
    async (pedido) => ({ disciplinas: await listarDisciplinas(pedido.query) }),
  );

  app.post(
    '/api/disciplinas',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Cadastra uma disciplina',
        body: criarDisciplinaSchema,
        response: { 201: z.object({ disciplina: disciplinaSchema }) },
      },
    },
    async (pedido, resposta) => {
      const disciplina = await criarDisciplina(pedido.body);
      resposta.status(201);
      return { disciplina };
    },
  );

  app.put(
    '/api/disciplinas/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Atualiza uma disciplina',
        params: parametrosPorId,
        body: atualizarDisciplinaSchema,
        response: { 200: z.object({ disciplina: disciplinaSchema }) },
      },
    },
    async (pedido) => ({
      disciplina: await atualizarDisciplina(pedido.params.id, pedido.body),
    }),
  );

  app.patch(
    '/api/disciplinas/:id/status',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Ativa ou inativa uma disciplina',
        params: parametrosPorId,
        body: statusGenericoSchema,
        response: { 200: z.object({ disciplina: disciplinaSchema }) },
      },
    },
    async (pedido) => ({
      disciplina: await atualizarStatusDisciplina(pedido.params.id, pedido.body.ativo),
    }),
  );

  // --- Atribuições de professores ---

  app.get(
    '/api/atribuicoes',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Lista as atribuições de professores com seus vínculos',
        querystring: listarAtribuicoesSchema,
        response: { 200: z.object({ atribuicoes: z.array(atribuicaoProfessorSchema) }) },
      },
    },
    async (pedido) => ({ atribuicoes: await listarAtribuicoes(pedido.query) }),
  );

  app.post(
    '/api/atribuicoes',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Cria uma atribuição de professor',
        body: criarAtribuicaoSchema,
        response: { 201: z.object({ atribuicao: atribuicaoProfessorSchema }) },
      },
    },
    async (pedido, resposta) => {
      const atribuicao = await criarAtribuicao(pedido.body);
      resposta.status(201);
      return { atribuicao };
    },
  );

  app.put(
    '/api/atribuicoes/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Atualiza uma atribuição de professor',
        params: parametrosPorId,
        body: atualizarAtribuicaoSchema,
        response: { 200: z.object({ atribuicao: atribuicaoProfessorSchema }) },
      },
    },
    async (pedido) => ({
      atribuicao: await atualizarAtribuicao(pedido.params.id, pedido.body),
    }),
  );

  app.patch(
    '/api/atribuicoes/:id/status',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Ativa ou encerra uma atribuição de professor',
        params: parametrosPorId,
        body: statusGenericoSchema,
        response: { 200: z.object({ atribuicao: atribuicaoProfessorSchema }) },
      },
    },
    async (pedido) => ({
      atribuicao: await atualizarStatusAtribuicao(pedido.params.id, pedido.body.ativo),
    }),
  );

  // --- Anos letivos ---

  app.get(
    '/api/anos-letivos',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Lista os anos letivos do mais recente para o mais antigo',
        response: { 200: z.object({ anos_letivos: z.array(anoLetivoSchema) }) },
      },
    },
    async () => ({ anos_letivos: await listarAnosLetivos() }),
  );

  app.post(
    '/api/anos-letivos',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Cadastra um ano letivo como planejado',
        body: criarAnoLetivoSchema,
        response: { 201: z.object({ ano_letivo: anoLetivoSchema }) },
      },
    },
    async (pedido, resposta) => {
      const anoLetivo = await criarAnoLetivo(pedido.body);
      resposta.status(201);
      return { ano_letivo: anoLetivo };
    },
  );

  app.put(
    '/api/anos-letivos/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Atualiza ano e período de um ano letivo',
        params: parametrosPorId,
        body: atualizarAnoLetivoSchema,
        response: { 200: z.object({ ano_letivo: anoLetivoSchema }) },
      },
    },
    async (pedido) => ({
      ano_letivo: await atualizarAnoLetivo(pedido.params.id, pedido.body),
    }),
  );

  app.post(
    '/api/anos-letivos/:id/ativar',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Realiza a virada de ano: arquiva o vigente e ativa o ano alvo',
        params: parametrosPorId,
        response: { 200: z.object({ ano_letivo: anoLetivoSchema }) },
      },
    },
    async (pedido) => ({
      ano_letivo: await ativarAnoLetivo(pedido.params.id, usuarioAtual(pedido).id),
    }),
  );

  // --- Enturmações ---

  app.get(
    '/api/enturmacoes',
    {
      preHandler: [autenticar, podeLer],
      schema: {
        tags: ['estrutura'],
        summary: 'Lista as enturmações visíveis para o usuário autenticado',
        querystring: listarEnturmacoesSchema,
        response: { 200: z.object({ enturmacoes: z.array(enturmacaoSchema) }) },
      },
    },
    async (pedido) => ({
      enturmacoes: await listarEnturmacoes(usuarioAtual(pedido), pedido.query),
    }),
  );

  app.post(
    '/api/enturmacoes',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Enturma o aluno, encerrando a matrícula anterior quando houver',
        body: criarEnturmacaoSchema,
        response: { 201: z.object({ enturmacao: enturmacaoSchema }) },
      },
    },
    async (pedido, resposta) => {
      const enturmacao = await criarEnturmacao(pedido.body);
      resposta.status(201);
      return { enturmacao };
    },
  );

  app.put(
    '/api/enturmacoes/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['estrutura'],
        summary: 'Atualiza turma, status e encerramento de uma enturmação',
        params: parametrosPorId,
        body: atualizarEnturmacaoSchema,
        response: { 200: z.object({ enturmacao: enturmacaoSchema }) },
      },
    },
    async (pedido) => ({
      enturmacao: await atualizarEnturmacao(pedido.params.id, pedido.body),
    }),
  );
};
