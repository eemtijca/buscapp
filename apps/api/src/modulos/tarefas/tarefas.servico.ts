import type { ExpurgoResposta } from '@buscapp/contratos';
import { armazenamento } from '../../nucleo/armazenamento/index.js';
import { auditar } from '../../nucleo/auditoria/registrar.js';
import { prismaAdmin as prisma } from '../../nucleo/banco/cliente.js';

const DIA_MS = 24 * 60 * 60 * 1000;
/** Sessões encerradas ou expiradas são removidas após esta janela. */
const RETENCAO_SESSOES_DIAS = 7;

/**
 * Aplica a retenção configurada: remove anexos vencidos (com o objeto no storage),
 * códigos fora da janela, sessões encerradas antigas e contadores de rate limiting.
 * Idempotente: pode ser chamado mais de uma vez pelo mesmo agendador.
 */
export async function executarExpurgo(): Promise<ExpurgoResposta> {
  const agora = new Date();
  const config = await prisma.configuracoes_sistema.findUnique({ where: { id: 1 } });
  const retencaoCodigosDias = config?.dias_retencao_codigos ?? 30;

  const anexosVencidos = await prisma.anexos.findMany({
    where: { expurgado_em: null, expurgo_em: { lte: agora } },
    select: { id: true, storage_path: true },
  });
  for (const anexo of anexosVencidos) {
    await armazenamento()
      .remover(anexo.storage_path)
      .catch(() => undefined);
  }
  const anexos = await prisma.anexos.deleteMany({
    where: { id: { in: anexosVencidos.map((anexo) => anexo.id) } },
  });

  const limiteCodigos = new Date(agora.getTime() - retencaoCodigosDias * DIA_MS);
  const codigos = await prisma.codigos_redefinicao.deleteMany({
    where: {
      created_at: { lt: limiteCodigos },
      OR: [
        { usado_em: { not: null } },
        { revogado_em: { not: null } },
        { expira_em: { lte: agora } },
      ],
    },
  });
  await prisma.codigos_redefinicao_tentativas.deleteMany({
    where: {
      OR: [
        { bloqueado_ate: null, updated_at: { lt: limiteCodigos } },
        { bloqueado_ate: { lte: agora } },
      ],
    },
  });

  const limiteSessoes = new Date(agora.getTime() - RETENCAO_SESSOES_DIAS * DIA_MS);
  const sessoes = await prisma.sessoes.deleteMany({
    where: {
      OR: [
        { expira_em: { lte: limiteSessoes } },
        { revogada_em: { not: null, lte: limiteSessoes } },
      ],
    },
  });

  const contadores = await prisma.rate_limit_contadores.deleteMany({
    where: { expira_em: { lte: agora } },
  });

  await auditar({
    acao: 'EXPURGO',
    entidade: 'sistema',
    dadosNovos: {
      anexos: anexos.count,
      codigos: codigos.count,
      sessoes: sessoes.count,
      contadores: contadores.count,
    },
  });

  return {
    ok: true,
    anexos: anexos.count,
    codigos: codigos.count,
    sessoes: sessoes.count,
    contadores: contadores.count,
  };
}
