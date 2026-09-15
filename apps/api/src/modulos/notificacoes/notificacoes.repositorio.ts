import type { ListarNotificacoes } from '@buscapp/contratos';
import { prisma } from '../../nucleo/banco/cliente.js';

export async function listarNotificacoes(destinatarioId: string, consulta: ListarNotificacoes) {
  return prisma.notificacoes.findMany({
    where: {
      destinatario_id: destinatarioId,
      ...(consulta.lida !== undefined ? { lida: consulta.lida } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: consulta.limite,
  });
}

export async function contarNaoLidas(destinatarioId: string): Promise<number> {
  return prisma.notificacoes.count({
    where: { destinatario_id: destinatarioId, lida: false },
  });
}

export async function buscarNotificacaoDoUsuario(id: string, destinatarioId: string) {
  return prisma.notificacoes.findFirst({
    where: { id, destinatario_id: destinatarioId },
  });
}

export async function marcarNotificacaoComoLida(id: string) {
  return prisma.notificacoes.update({
    where: { id },
    data: { lida: true, lida_em: new Date() },
  });
}

export async function marcarNotificacoesComoLidas(destinatarioId: string): Promise<number> {
  const resultado = await prisma.notificacoes.updateMany({
    where: { destinatario_id: destinatarioId, lida: false },
    data: { lida: true, lida_em: new Date() },
  });
  return resultado.count;
}

export async function marcarNotificacoesDaConversaComoLidas(
  destinatarioId: string,
  conversaId: string,
): Promise<number> {
  const resultado = await prisma.notificacoes.updateMany({
    where: {
      destinatario_id: destinatarioId,
      tipo: 'mensagem',
      lida: false,
      metadados: { path: ['conversa_id'], equals: conversaId },
    },
    data: { lida: true, lida_em: new Date() },
  });
  return resultado.count;
}

export async function removerNotificacoes(destinatarioId: string): Promise<number> {
  const resultado = await prisma.notificacoes.deleteMany({
    where: { destinatario_id: destinatarioId },
  });
  return resultado.count;
}
