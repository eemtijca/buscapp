import { prisma } from '../../nucleo/banco/cliente.js';
import type { CriarAluno, AtualizarAluno, ListarAlunos } from '@buscapp/contratos';

interface FiltroAlunos {
  id?: { in: string[] };
}

export async function listarAlunos(filtro: FiltroAlunos, consulta: ListarAlunos) {
  return prisma.alunos.findMany({
    where: {
      ...filtro,
      ...(consulta.status ? { status: consulta.status } : {}),
      ...(consulta.busca
        ? {
            OR: [
              { nome: { contains: consulta.busca, mode: 'insensitive' } },
              { matricula: { contains: consulta.busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { nome: 'asc' },
  });
}

export async function buscarAlunoPorId(id: string) {
  return prisma.alunos.findUnique({ where: { id } });
}

export async function criarAluno(dados: CriarAluno) {
  return prisma.alunos.create({
    data: {
      nome: dados.nome,
      matricula: dados.matricula,
      codigo_inep: dados.codigo_inep ?? null,
      status: dados.status ?? 'ativo',
      observacoes: dados.observacoes ?? null,
      data_nascimento: dados.data_nascimento ? new Date(dados.data_nascimento) : null,
      data_matricula: dados.data_matricula ? new Date(dados.data_matricula) : null,
      transporte_escolar: dados.transporte_escolar ?? false,
      alimentacao_diferenciada: dados.alimentacao_diferenciada ?? false,
      necessidades_especiais: dados.necessidades_especiais ?? false,
      documentos_recebidos: dados.documentos_recebidos ?? [],
    },
  });
}

export async function atualizarAluno(id: string, dados: AtualizarAluno) {
  return prisma.alunos.update({
    where: { id },
    data: {
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.matricula !== undefined ? { matricula: dados.matricula } : {}),
      ...(dados.codigo_inep !== undefined ? { codigo_inep: dados.codigo_inep } : {}),
      ...(dados.status !== undefined ? { status: dados.status } : {}),
      ...(dados.observacoes !== undefined ? { observacoes: dados.observacoes } : {}),
      ...(dados.data_nascimento !== undefined
        ? { data_nascimento: dados.data_nascimento ? new Date(dados.data_nascimento) : null }
        : {}),
      ...(dados.data_matricula !== undefined
        ? { data_matricula: dados.data_matricula ? new Date(dados.data_matricula) : null }
        : {}),
      ...(dados.transporte_escolar !== undefined
        ? { transporte_escolar: dados.transporte_escolar }
        : {}),
      ...(dados.alimentacao_diferenciada !== undefined
        ? { alimentacao_diferenciada: dados.alimentacao_diferenciada }
        : {}),
      ...(dados.necessidades_especiais !== undefined
        ? { necessidades_especiais: dados.necessidades_especiais }
        : {}),
      ...(dados.documentos_recebidos !== undefined
        ? { documentos_recebidos: dados.documentos_recebidos }
        : {}),
    },
  });
}
