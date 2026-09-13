import {
  listarNotificacoesRespostaSchema,
  listarNotificacoesSchema,
  notificacaoRespostaSchema,
  notificacoesAtualizadasSchema,
  notificacoesRemovidasSchema,
  uuidSchema,
} from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { autenticar, usuarioAtual } from '../../nucleo/autenticacao/middleware.js';
import { limpar, listar, marcarConversa, marcarLida, marcarTodas } from './notificacoes.servico.js';

const parametrosNotificacao = z.object({ id: uuidSchema });
const parametrosConversa = z.object({ conversaId: uuidSchema });

export const rotasNotificacoes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/notificacoes',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['notificacoes'],
        summary: 'Lista as notificações do usuário autenticado',
        querystring: listarNotificacoesSchema,
        response: { 200: listarNotificacoesRespostaSchema },
      },
    },
    async (pedido) => listar(usuarioAtual(pedido).id, pedido.query),
  );

  app.patch(
    '/api/notificacoes/lidas',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['notificacoes'],
        summary: 'Marca todas as notificações não lidas do usuário como lidas',
        response: { 200: notificacoesAtualizadasSchema },
      },
    },
    async (pedido) => marcarTodas(usuarioAtual(pedido).id),
  );

  app.patch(
    '/api/notificacoes/conversa/:conversaId/lidas',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['notificacoes'],
        summary: 'Marca como lidas as notificações de mensagem de uma conversa',
        params: parametrosConversa,
        response: { 200: notificacoesAtualizadasSchema },
      },
    },
    async (pedido) => marcarConversa(usuarioAtual(pedido).id, pedido.params.conversaId),
  );

  app.patch(
    '/api/notificacoes/:id/lida',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['notificacoes'],
        summary: 'Marca uma notificação do usuário como lida',
        params: parametrosNotificacao,
        response: { 200: notificacaoRespostaSchema },
      },
    },
    async (pedido) => ({
      notificacao: await marcarLida(usuarioAtual(pedido).id, pedido.params.id),
    }),
  );

  app.delete(
    '/api/notificacoes',
    {
      preHandler: [autenticar],
      schema: {
        tags: ['notificacoes'],
        summary: 'Remove todas as notificações do usuário autenticado',
        response: { 200: notificacoesRemovidasSchema },
      },
    },
    async (pedido) => limpar(usuarioAtual(pedido).id),
  );
};
