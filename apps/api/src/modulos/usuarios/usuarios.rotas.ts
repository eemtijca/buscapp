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
        params: parametrosUsuario,
        body: atualizarUsuarioSchema,
        response: { 200: z.object({ usuario: usuarioSchema }) },
      },
    },
    async (pedido) => ({ usuario: await atualizar(pedido.params.id, pedido.body) }),
  );

  app.patch(
    '/api/usuarios/:id/status',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['usuarios'],
        summary: 'Ativa ou inativa um usuário (inativar revoga as sessões)',
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
