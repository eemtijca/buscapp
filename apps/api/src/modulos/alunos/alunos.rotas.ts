import {
  alunoSchema,
  atualizarAlunoSchema,
  criarAlunoSchema,
  listarAlunosSchema,
  uuidSchema,
} from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { autenticar, exigirPapel, usuarioAtual } from '../../nucleo/autenticacao/middleware.js';
import { atualizar, criar, listar, obter } from './alunos.servico.js';

const parametrosAluno = z.object({ id: uuidSchema });
const podeLer = exigirPapel('gestao', 'professor', 'responsavel');
const somenteGestao = exigirPapel('gestao');

export const rotasAlunos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/alunos',
    {
      preHandler: [autenticar, podeLer],
      schema: {
        tags: ['alunos'],
        summary: 'Lista os alunos visíveis para o usuário autenticado',
        operationId: 'listarAlunos',
        description:
          'Lista os alunos visíveis para o perfil, com busca por nome e matrícula e filtro de status.',
        querystring: listarAlunosSchema,
        response: { 200: z.object({ alunos: z.array(alunoSchema) }) },
      },
    },
    async (pedido) => ({ alunos: await listar(usuarioAtual(pedido), pedido.query) }),
  );

  app.get(
    '/api/alunos/:id',
    {
      preHandler: [autenticar, podeLer],
      schema: {
        tags: ['alunos'],
        summary: 'Retorna um aluno visível para o usuário autenticado',
        operationId: 'obterAluno',
        description:
          'Retorna um aluno visível para o perfil; registros fora do escopo respondem 404.',
        params: parametrosAluno,
        response: { 200: z.object({ aluno: alunoSchema }) },
      },
    },
    async (pedido) => ({ aluno: await obter(usuarioAtual(pedido), pedido.params.id) }),
  );

  app.post(
    '/api/alunos',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['alunos'],
        summary: 'Cadastra um aluno',
        operationId: 'criarAluno',
        description: 'Cadastra um aluno. Matrícula repetida responde 409.',
        body: criarAlunoSchema,
        response: { 201: z.object({ aluno: alunoSchema }) },
      },
    },
    async (pedido, resposta) => {
      const aluno = await criar(pedido.body, usuarioAtual(pedido).id);
      resposta.status(201);
      return { aluno };
    },
  );

  app.put(
    '/api/alunos/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['alunos'],
        summary: 'Atualiza um aluno',
        operationId: 'atualizarAluno',
        description:
          'Atualiza os dados do aluno, incluindo situação, documentos recebidos e observações.',
        params: parametrosAluno,
        body: atualizarAlunoSchema,
        response: { 200: z.object({ aluno: alunoSchema }) },
      },
    },
    async (pedido) => ({
      aluno: await atualizar(pedido.params.id, pedido.body, usuarioAtual(pedido).id),
    }),
  );
};
