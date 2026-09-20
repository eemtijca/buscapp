import { expurgoRespostaSchema } from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { timingSafeEqual } from 'node:crypto';
import { ambiente } from '../../ambiente.js';
import { ErroHttp } from '../../nucleo/http/erros.js';
import { executarExpurgo } from './tarefas.servico.js';

/** Compara o segredo do agendador em tempo constante. */
function segredoConfere(cabecalho: string | undefined): boolean {
  const esperado = ambiente.CRON_SECRET;
  if (!esperado) return false;
  const recebido = cabecalho?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const rotasTarefas: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/api/tarefas/expurgo',
    {
      schema: {
        tags: ['tarefas'],
        summary: 'Aplica a retenção de anexos, códigos, sessões e contadores (agendador)',
        response: { 200: expurgoRespostaSchema },
      },
    },
    async (pedido) => {
      if (!ambiente.CRON_SECRET) {
        // Sem segredo configurado a rota fica desabilitada.
        throw new ErroHttp(404, 'nao_encontrado', 'Rota não encontrada.');
      }
      if (!segredoConfere(pedido.headers.authorization)) {
        throw new ErroHttp(403, 'nao_autorizado', 'Segredo do agendador inválido.');
      }

      return executarExpurgo();
    },
  );
};
