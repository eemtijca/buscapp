import type { Prisma } from '../../../generated/prisma/client.js';
import { prisma } from '../../nucleo/banco/cliente.js';

export interface FiltroFrequencias {
  alunoIds?: string[];
  turmaId?: string;
  dataAula?: Date;
  dataInicio?: Date;
  dataFim?: Date;
  periodo?: string;
  status?: 'presente' | 'ausente' | 'justificado';
  tipoRegistro?: 'chamada_aula' | 'entrada_portao' | 'saida';
  incluirDeletadas?: boolean;
}

export interface ContextoLoteFrequencia {
  turmaId: string;
  dataAula: Date;
  periodo: string;
  tipoRegistro: 'chamada_aula' | 'entrada_portao' | 'saida';
}

/** Comparações de data usam meia-noite UTC para não deslocar o dia civil. */
export function paraData(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export async function listarFrequencias(filtro: FiltroFrequencias) {
  const filtroData = filtro.dataAula
    ? { data_aula: filtro.dataAula }
    : filtro.dataInicio || filtro.dataFim
      ? {
          data_aula: {
            ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
            ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
          },
        }
      : {};

  return prisma.frequencias.findMany({
    where: {
      ...(filtro.alunoIds ? { aluno_id: { in: filtro.alunoIds } } : {}),
      ...(filtro.turmaId ? { turma_id: filtro.turmaId } : {}),
      ...filtroData,
      ...(filtro.periodo ? { periodo: filtro.periodo } : {}),
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.tipoRegistro ? { tipo_registro: filtro.tipoRegistro } : {}),
      ...(filtro.incluirDeletadas ? {} : { deleted_at: null }),
    },
    orderBy: [{ data_aula: 'desc' }, { periodo: 'asc' }, { created_at: 'desc' }],
  });
}

export async function buscarFrequenciaPorClientRequestId(clientRequestId: string) {
  return prisma.frequencias.findUnique({ where: { client_request_id: clientRequestId } });
}

export async function buscarFrequenciaPorId(id: string) {
  return prisma.frequencias.findUnique({ where: { id } });
}

export async function buscarFrequenciaPorContexto(
  alunoId: string,
  dataAula: Date,
  tipoRegistro: ContextoLoteFrequencia['tipoRegistro'],
  periodo: string,
) {
  return prisma.frequencias.findFirst({
    where: {
      aluno_id: alunoId,
      data_aula: dataAula,
      tipo_registro: tipoRegistro,
      periodo,
      deleted_at: null,
    },
  });
}

export async function buscarEnturmacoesAtivasPorAlunos(alunoIds: string[], turmaId?: string) {
  return prisma.enturmacoes.findMany({
    where: {
      aluno_id: { in: alunoIds },
      status: 'matriculado',
      ...(turmaId ? { turma_id: turmaId } : {}),
    },
    orderBy: { data_matricula: 'desc' },
  });
}

export async function criarFrequencias(dados: Prisma.frequenciasCreateManyInput[]) {
  return prisma.frequencias.createMany({ data: dados });
}

export async function criarFrequencia(dados: Prisma.frequenciasCreateManyInput) {
  return prisma.frequencias.create({ data: dados });
}

export async function listarAusenciasDoContexto(contexto: ContextoLoteFrequencia) {
  return prisma.frequencias.findMany({
    where: {
      turma_id: contexto.turmaId,
      data_aula: contexto.dataAula,
      periodo: contexto.periodo,
      tipo_registro: contexto.tipoRegistro,
      deleted_at: null,
    },
    select: { aluno_id: true },
  });
}

export async function marcarAusenciasComoDeletadas(contexto: ContextoLoteFrequencia) {
  return prisma.frequencias.updateMany({
    where: {
      turma_id: contexto.turmaId,
      data_aula: contexto.dataAula,
      periodo: contexto.periodo,
      tipo_registro: contexto.tipoRegistro,
      deleted_at: null,
    },
    data: { deleted_at: new Date() },
  });
}

export async function listarResponsaveisDosAlunos(alunoIds: string[]): Promise<string[]> {
  if (!alunoIds.length) return [];

  const vinculos = await prisma.vinculos_responsaveis.findMany({
    where: { aluno_id: { in: alunoIds }, ativo: true },
    select: { responsavel_id: true },
  });

  return [...new Set(vinculos.map((vinculo) => vinculo.responsavel_id))];
}
