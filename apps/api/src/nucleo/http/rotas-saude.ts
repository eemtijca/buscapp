import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { autenticar, exigirPapel } from '../../nucleo/autenticacao/middleware.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { contarConexoes } from '../../nucleo/eventos/barramento.js';
import { resumoMetricas } from '../../nucleo/http/metricas.js';

export const rotasSaude: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/saude',
    {
      schema: {
        tags: ['saude'],
        summary: 'Verifica a disponibilidade da API',
        response: {
          200: z.object({
            status: z.literal('ok'),
            hora: z.string(),
          }),
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      hora: new Date().toISOString(),
    }),
  );

  app.get(
    '/api/saude/pronto',
    {
      schema: {
        tags: ['saude'],
        summary: 'Readiness: confere a conexão com o banco',
        response: {
          200: z.object({ status: z.literal('ok'), banco: z.literal('ok') }),
          503: z.object({ status: z.literal('indisponivel'), banco: z.literal('erro') }),
        },
      },
    },
    async (_pedido, resposta) => {
      try {
        await prisma.$queryRaw`select 1`;
        return { status: 'ok' as const, banco: 'ok' as const };
      } catch {
        return resposta
          .status(503)
          .send({ status: 'indisponivel' as const, banco: 'erro' as const });
      }
    },
  );

  app.get(
    '/api/saude/metricas',
    {
      preHandler: [autenticar, exigirPapel('gestao')],
      schema: {
        tags: ['saude'],
        summary: 'Resumo operacional de requisições e conexões SSE',
        response: {
          200: z.object({
            requisicoes: z.object({
              total: z.number().int(),
              erros_cliente: z.number().int(),
              erros_servidor: z.number().int(),
              muitas_requisicoes: z.number().int(),
              media_ms: z.number().int(),
            }),
            conexoes_sse: z.number().int(),
          }),
        },
      },
    },
    async () => ({
      requisicoes: resumoMetricas(),
      conexoes_sse: contarConexoes(),
    }),
  );
};
