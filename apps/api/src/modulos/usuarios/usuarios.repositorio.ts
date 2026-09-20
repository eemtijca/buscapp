import type { AtualizarUsuario, ListarUsuarios } from '@buscapp/contratos';
import { prisma } from '../../nucleo/banco/cliente.js';

/**
 * Campos devolvidos ao serviço. O `senha_hash` fica fora do select: além de não ser usado,
 * o papel de runtime não tem privilégio de leitura nessa coluna.
 */
const SELECT_PERFIL = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  status: true,
  telefone: true,
  cargo: true,
  notificacoes_ativas: true,
  acesso_modulos: true,
  ultimo_acesso_em: true,
  created_at: true,
  updated_at: true,
} as const;

export async function listarUsuarios(consulta: ListarUsuarios) {
  return prisma.perfis.findMany({
    where: {
      ...(consulta.papel ? { papel: consulta.papel } : {}),
      ...(consulta.status ? { status: consulta.status } : {}),
      ...(consulta.busca
        ? {
            OR: [
              { nome: { contains: consulta.busca, mode: 'insensitive' } },
              { email: { contains: consulta.busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: SELECT_PERFIL,
    orderBy: { nome: 'asc' },
  });
}

export async function buscarUsuarioPorId(id: string) {
  return prisma.perfis.findUnique({ where: { id }, select: SELECT_PERFIL });
}

export async function atualizarUsuario(
  id: string,
  dados: AtualizarUsuario,
  emailNormalizado?: string,
) {
  return prisma.perfis.update({
    where: { id },
    data: {
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(emailNormalizado !== undefined ? { email: emailNormalizado } : {}),
      ...(dados.telefone !== undefined ? { telefone: dados.telefone } : {}),
      ...(dados.cargo !== undefined ? { cargo: dados.cargo } : {}),
      ...(dados.notificacoes_ativas !== undefined
        ? { notificacoes_ativas: dados.notificacoes_ativas }
        : {}),
      ...(dados.acesso_modulos !== undefined ? { acesso_modulos: dados.acesso_modulos } : {}),
    },
    select: SELECT_PERFIL,
  });
}

export async function atualizarStatusUsuario(id: string, status: 'ativo' | 'inativo') {
  return prisma.perfis.update({ where: { id }, data: { status }, select: SELECT_PERFIL });
}
