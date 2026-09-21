import {
  anonimizacaoRespostaSchema,
  anonimizarAlunoSchema,
  exportacaoTitularSchema,
  uuidSchema,
} from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { autenticar, exigirPapel, usuarioAtual } from '../../nucleo/autenticacao/middleware.js';
import { anonimizarTitular, exportarTitular } from './lgpd.servico.js';

const parametrosAluno = z.object({ id: uuidSchema });
const somenteGestao = exigirPapel('gestao');

export const rotasLgpd: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/lgpd/alunos/:id/exportar',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['lgpd'],
        summary: 'Exporta os dados pessoais do aluno (direito de acesso)',
        params: parametrosAluno,
        response: { 200: exportacaoTitularSchema },
      },
    },
    async (pedido) => exportarTitular(pedido.params.id),
  );

  app.post(
    '/api/lgpd/alunos/:id/anonimizar',
    {
      preHandler: [autenticar, somenteGestao],
      schema: {
        tags: ['lgpd'],
        summary: 'Anonimiza os dados pessoais do aluno e remove os anexos (irreversível)',
        params: parametrosAluno,
        body: anonimizarAlunoSchema,
        response: { 200: anonimizacaoRespostaSchema },
      },
    },
    async (pedido) => {
      const resultado = await anonimizarTitular(
        pedido.params.id,
        usuarioAtual(pedido).id,
        pedido.ip,
      );
      return { ok: true as const, anexos_removidos: resultado.anexosRemovidos };
    },
  );
};
