import type { CodigoRedefinicao } from '@buscapp/contratos';
import { prisma } from '../../nucleo/banco/cliente.js';

interface CodigoBruto {
  id: string;
  email: string;
  perfil_id: string;
  usado_em: Date | null;
  revogado_em: Date | null;
  expira_em: Date;
  created_at: Date;
  perfis_codigos_redefinicao_perfil_idToperfis: { nome: string } | null;
}

function statusDe(codigo: CodigoBruto, agora: Date): CodigoRedefinicao['status'] {
  if (codigo.usado_em) return 'usado';
  if (codigo.revogado_em) return 'revogado';
  if (codigo.expira_em <= agora) return 'expirado';
  return 'ativo';
}

export function paraCodigo(
  codigo: CodigoBruto,
  agora = new Date(),
  bloqueado = false,
): CodigoRedefinicao {
  return {
    id: codigo.id,
    email: codigo.email,
    perfil_id: codigo.perfil_id,
    perfil_nome: codigo.perfis_codigos_redefinicao_perfil_idToperfis?.nome ?? null,
    usado_em: codigo.usado_em?.toISOString() ?? null,
    revogado_em: codigo.revogado_em?.toISOString() ?? null,
    expira_em: codigo.expira_em.toISOString(),
    created_at: codigo.created_at.toISOString(),
    status: statusDe(codigo, agora),
    bloqueado,
  };
}

export async function listarCodigos() {
  return prisma.codigos_redefinicao.findMany({
    include: { perfis_codigos_redefinicao_perfil_idToperfis: { select: { nome: true } } },
    orderBy: { created_at: 'desc' },
  });
}

export async function buscarCodigo(id: string) {
  return prisma.codigos_redefinicao.findUnique({
    where: { id },
    include: { perfis_codigos_redefinicao_perfil_idToperfis: { select: { nome: true } } },
  });
}

export async function revogarCodigo(id: string, usuarioId: string) {
  const agora = new Date();
  await prisma.$transaction([
    prisma.codigos_redefinicao.update({
      where: { id },
      data: { expira_em: agora, revogado_em: agora },
    }),
    prisma.auditoria.create({
      data: {
        usuario_id: usuarioId,
        acao: 'REVOGAR_CODIGO',
        entidade: 'codigos_redefinicao',
        entidade_id: id,
      },
    }),
  ]);
}

export async function limparCodigosNaoAtivos(usuarioId: string) {
  const agora = new Date();
  const removidos = await prisma.codigos_redefinicao.deleteMany({
    where: {
      OR: [
        { usado_em: { not: null } },
        { revogado_em: { not: null } },
        { expira_em: { lte: agora } },
      ],
    },
  });
  await prisma.auditoria.create({
    data: {
      usuario_id: usuarioId,
      acao: 'LIMPAR_CODIGOS',
      entidade: 'codigos_redefinicao',
      dados_novos: { removidos: removidos.count },
    },
  });
  return removidos.count;
}

export async function codigoGeradoParaAuditoria(perfilId: string, usuarioId: string) {
  await prisma.auditoria.create({
    data: {
      usuario_id: usuarioId,
      acao: 'GERAR_CODIGO',
      entidade: 'perfis',
      entidade_id: perfilId,
    },
  });
}
