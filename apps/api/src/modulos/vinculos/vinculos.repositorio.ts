import type { AtualizarVinculo, CriarVinculo, ListarVinculos } from '@buscapp/contratos';
import { prisma } from '../../nucleo/banco/cliente.js';

export async function listarVinculos(filtros: ListarVinculos) {
  return prisma.vinculos_responsaveis.findMany({
    where: {
      ...(filtros.aluno_id ? { aluno_id: filtros.aluno_id } : {}),
      ...(filtros.responsavel_id ? { responsavel_id: filtros.responsavel_id } : {}),
      ...(filtros.ativo !== undefined ? { ativo: filtros.ativo === 'true' } : {}),
    },
    include: { perfis: { select: { nome: true } } },
    orderBy: [{ contato_prioritario: 'desc' }, { created_at: 'asc' }],
  });
}

export async function buscarVinculo(id: string) {
  return prisma.vinculos_responsaveis.findUnique({ where: { id } });
}

export async function criarVinculo(dados: CriarVinculo) {
  return prisma.vinculos_responsaveis.create({
    data: {
      responsavel_id: dados.responsavel_id,
      aluno_id: dados.aluno_id,
      tipo_relacao: dados.tipo_relacao,
      contato_prioritario: dados.contato_prioritario ?? false,
    },
    include: { perfis: { select: { nome: true } } },
  });
}

export async function atualizarVinculo(id: string, dados: AtualizarVinculo) {
  return prisma.vinculos_responsaveis.update({
    where: { id },
    data: {
      ...(dados.tipo_relacao !== undefined ? { tipo_relacao: dados.tipo_relacao } : {}),
      ...(dados.contato_prioritario !== undefined
        ? { contato_prioritario: dados.contato_prioritario }
        : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    },
    include: { perfis: { select: { nome: true } } },
  });
}
