import type { AtualizarUsuario, CriarUsuario, ListarUsuarios } from '@buscapp/contratos';
import { prisma } from '../../nucleo/banco/cliente.js';

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
    orderBy: { nome: 'asc' },
  });
}

export async function buscarUsuarioPorId(id: string) {
  return prisma.perfis.findUnique({ where: { id } });
}

export async function criarUsuario(
  id: string,
  email: string,
  dados: CriarUsuario,
  senhaHash: string,
) {
  return prisma.perfis.create({
    data: {
      id,
      nome: dados.nome,
      email,
      papel: dados.papel,
      status: 'pendente',
      telefone: dados.telefone ?? null,
      cargo: dados.cargo ?? null,
      acesso_modulos: dados.acesso_modulos ?? [],
      senha_hash: senhaHash,
      senha_alterada_em: new Date(),
    },
  });
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
  });
}

export async function atualizarStatusUsuario(id: string, status: 'ativo' | 'inativo') {
  return prisma.perfis.update({ where: { id }, data: { status } });
}

export async function excluirUsuario(id: string) {
  return prisma.perfis.delete({ where: { id } });
}
