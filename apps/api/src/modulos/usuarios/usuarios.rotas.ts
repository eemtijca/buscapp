import {
  atualizarStatusUsuarioSchema,
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  listarUsuariosSchema,
  usuarioSchema,
  uuidSchema,
} from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { autenticar, exigirPapel, usuarioAtual } from '../../nucleo/autenticacao/middleware.js';
import { atualizar, atualizarStatus, criar, listar, obter } from './usuarios.servico.js';

const parametrosUsuario = z.object({ id: uuidSchema });
const somenteGestao = exigirPapel('gestao');

export const rotasUsuarios: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/usuarios',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['usuarios'],
        summary: 'Lista os usuários cadastrados',
        operationId: 'listarUsuarios',
        description:
          'Lista perfis com filtros de papel, status e busca. Operação restrita à gestão.',
        querystring: listarUsuariosSchema,
        response: { 200: z.object({ usuarios: z.array(usuarioSchema) }) },
      },
    },
    async (pedido) => ({ usuarios: await listar(pedido.query) }),
  );

  app.get(
    '/api/usuarios/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['usuarios'],
        summary: 'Retorna um usuário',
        operationId: 'obterUsuario',
        description: 'Retorna os dados de um perfil específico para a gestão.',
        params: parametrosUsuario,
        response: { 200: z.object({ usuario: usuarioSchema }) },
      },
    },
    async (pedido) => ({ usuario: await obter(pedido.params.id) }),
  );

  app.post(
    '/api/usuarios',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['usuarios'],
        summary: 'Cria um usuário pendente com código de primeiro acesso',
        operationId: 'criarUsuario',
        description:
          'Cria um perfil pendente e devolve o código de primeiro acesso e a senha temporária, exibidos apenas nesta resposta. Email repetido responde 409.',
        body: criarUsuarioSchema,
        response: {
          201: z.object({
            usuario: usuarioSchema,
            codigo: z.string(),
            senha_temporaria: z.string(),
          }),
        },
      },
    },
    async (pedido, resposta) => {
      const criado = await criar(pedido.body, usuarioAtual(pedido).id);
      resposta.status(201);
      return criado;
    },
  );

  app.put(
    '/api/usuarios/:id',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['usuarios'],
        summary: 'Atualiza dados cadastrais e módulos de acesso',
        operationId: 'atualizarUsuario',
        description:
          'Atualiza dados cadastrais, módulos de acesso e preferências de notificação do perfil.',
        params: parametrosUsuario,
        body: atualizarUsuarioSchema,
        response: { 200: z.object({ usuario: usuarioSchema }) },
      },
    },
    async (pedido) => ({
      usuario: await atualizar(pedido.params.id, pedido.body, usuarioAtual(pedido).id),
    }),
  );

  app.patch(
    '/api/usuarios/:id/status',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['usuarios'],
        summary: 'Ativa ou inativa um usuário (inativar revoga as sessões)',
        operationId: 'atualizarStatusUsuario',
        description:
          'Ativa ou inativa o perfil. A inativação revoga as sessões abertas e o próprio usuário não pode ser inativado.',
        params: parametrosUsuario,
        body: atualizarStatusUsuarioSchema,
        response: { 200: z.object({ usuario: usuarioSchema }) },
      },
    },
    async (pedido) => ({
      usuario: await atualizarStatus(pedido.params.id, pedido.body, usuarioAtual(pedido).id),
    }),
  );
};
