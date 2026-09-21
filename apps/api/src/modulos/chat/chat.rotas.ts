import {
  atualizarConversaSchema,
  conversaSchema,
  criarConversaSchema,
  enviarMensagemSchema,
  listarMensagensSchema,
  marcarMensagensLidasRespostaSchema,
  mensagemSchema,
  paginacaoSchema,
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
  enviarMensagem,
  listar,
  listarMensagens,
  marcarLidas,
} from './chat.servico.js';

const parametrosConversa = z.object({ id: uuidSchema });

const podeParticipar = exigirPapel('gestao', 'professor', 'responsavel');
const podeCriar = exigirPapel('gestao', 'responsavel');
const exigirModuloChat = exigirModulo('chat');

/** Responsável precisa do módulo `chat`; gestão e professor não dependem de módulo. */
async function exigirModuloChatDoResponsavel(pedido: FastifyRequest): Promise<void> {
  if (usuarioAtual(pedido).papel === 'responsavel') return exigirModuloChat(pedido);
}

export const rotasChat: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/conversas',
    {
      preHandler: [autenticar, podeParticipar, exigirModuloChatDoResponsavel],
      schema: {
        tags: ['chat'],
        summary: 'Lista as conversas visíveis para o usuário autenticado',
        querystring: paginacaoSchema,
        response: { 200: z.object({ conversas: z.array(conversaSchema) }) },
      },
    },
    async (pedido) => ({ conversas: await listar(usuarioAtual(pedido), pedido.query) }),
  );

  app.post(
    '/api/conversas',
    {
      preHandler: [autenticar, podeCriar, exigirModuloChatDoResponsavel],
      schema: {
        tags: ['chat'],
        summary: 'Retorna a conversa do aluno ou cria uma nova',
        body: criarConversaSchema,
        response: {
          200: z.object({ conversa: conversaSchema }),
          201: z.object({ conversa: conversaSchema }),
        },
      },
    },
    async (pedido, resposta) => {
      const { conversa, criada } = await criar(usuarioAtual(pedido), pedido.body);
      resposta.status(criada ? 201 : 200);
      return { conversa };
    },
  );

  app.get(
    '/api/conversas/:id/mensagens',
    {
      preHandler: [autenticar, podeParticipar, exigirModuloChatDoResponsavel],
      schema: {
        tags: ['chat'],
        summary: 'Lista as mensagens não deletadas de uma conversa (cursor para as anteriores)',
        params: parametrosConversa,
        querystring: listarMensagensSchema,
        response: { 200: z.object({ mensagens: z.array(mensagemSchema) }) },
      },
    },
    async (pedido) => ({
      mensagens: await listarMensagens(usuarioAtual(pedido), pedido.params.id, pedido.query),
    }),
  );

  app.post(
    '/api/conversas/:id/mensagens',
    {
      preHandler: [autenticar, podeParticipar, exigirModuloChatDoResponsavel],
      schema: {
        tags: ['chat'],
        summary: 'Envia uma mensagem na conversa',
        params: parametrosConversa,
        body: enviarMensagemSchema,
        response: {
          200: z.object({ mensagem: mensagemSchema }),
          201: z.object({ mensagem: mensagemSchema }),
        },
      },
    },
    async (pedido, resposta) => {
      const { mensagem, criada } = await enviarMensagem(
        usuarioAtual(pedido),
        pedido.params.id,
        pedido.body,
      );
      resposta.status(criada ? 201 : 200);
      return { mensagem };
    },
  );

  app.patch(
    '/api/conversas/:id/lidas',
    {
      preHandler: [autenticar, podeParticipar, exigirModuloChatDoResponsavel],
      schema: {
        tags: ['chat'],
        summary: 'Marca como lidas as mensagens recebidas na conversa',
        params: parametrosConversa,
        response: { 200: marcarMensagensLidasRespostaSchema },
      },
    },
    async (pedido) => ({
      atualizadas: await marcarLidas(usuarioAtual(pedido), pedido.params.id),
    }),
  );

  app.patch(
    '/api/conversas/:id',
    {
      preHandler: [autenticar, podeParticipar, exigirModuloChatDoResponsavel],
      schema: {
        tags: ['chat'],
        summary: 'Oculta ou reexibe uma conversa',
        params: parametrosConversa,
        body: atualizarConversaSchema,
        response: { 200: z.object({ conversa: conversaSchema }) },
      },
    },
    async (pedido) => ({
      conversa: await atualizar(usuarioAtual(pedido), pedido.params.id, pedido.body),
    }),
  );
};
