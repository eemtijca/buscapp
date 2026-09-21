import type { Prisma } from '../../../generated/prisma/client.js';
import { prisma } from '../../nucleo/banco/cliente.js';

/** Comparações de data usam meia-noite UTC para não deslocar o dia civil. */
export function paraData(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Inclusão padrão das listagens: dados do aluno, do responsável e os anexos
 * vinculados via `justificativa_anexos` (apenas os campos exibidos na tela).
 */
export const INCLUSAO_JUSTIFICATIVA = {
  alunos: { select: { id: true, nome: true } },
  perfis_justificativas_faltas_responsavel_idToperfis: { select: { id: true, nome: true } },
  justificativa_anexos: {
    select: {
      anexos: { select: { id: true, nome_arquivo: true, mime_type: true, storage_path: true } },
    },
  },
} satisfies Prisma.justificativas_faltasInclude;

export interface FiltroJustificativas {
  alunoIds: string[] | null;
  alunoId?: string;
  status?: 'pendente' | 'aceita' | 'recusada';
  dataInicio?: Date;
  dataFim?: Date;
  limite?: number;
  offset?: number;
}

export async function listarJustificativas(filtro: FiltroJustificativas) {
  const filtroData =
    filtro.dataInicio || filtro.dataFim
      ? {
          data_falta: {
            ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
            ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
          },
        }
      : {};

  return prisma.justificativas_faltas.findMany({
    where: {
      AND: [
        ...(filtro.alunoIds ? [{ aluno_id: { in: filtro.alunoIds } }] : []),
        ...(filtro.alunoId ? [{ aluno_id: filtro.alunoId }] : []),
        ...(filtro.status ? [{ status: filtro.status }] : []),
        ...(Object.keys(filtroData).length ? [filtroData] : []),
      ],
    },
    include: INCLUSAO_JUSTIFICATIVA,
    orderBy: { created_at: 'desc' },
    ...(filtro.limite !== undefined ? { take: filtro.limite } : {}),
    ...(filtro.offset !== undefined ? { skip: filtro.offset } : {}),
  });
}

export async function buscarJustificativaPorId(id: string) {
  return prisma.justificativas_faltas.findUnique({
    where: { id },
    include: INCLUSAO_JUSTIFICATIVA,
  });
}

export interface DadosNovaJustificativa {
  responsavel_id: string;
  aluno_id: string;
  data_falta: Date;
  data_fim: Date | null;
  motivo: string;
}

export async function criarJustificativa(dados: DadosNovaJustificativa) {
  return prisma.justificativas_faltas.create({ data: dados });
}

export async function removerJustificativa(id: string) {
  return prisma.justificativas_faltas.delete({ where: { id } });
}

export async function vincularAnexos(justificativaId: string, anexoIds: string[]) {
  return prisma.justificativa_anexos.createMany({
    data: anexoIds.map((anexo_id) => ({ justificativa_id: justificativaId, anexo_id })),
  });
}

export async function buscarAnexosPorIds(ids: string[]) {
  if (!ids.length) return [];
  return prisma.anexos.findMany({
    where: { id: { in: ids } },
    select: { id: true, criado_por: true },
  });
}

/**
 * Avalia apenas justificativas ainda pendentes de forma atômica; retorna `null`
 * quando nada foi atualizado (inexistente ou já avaliada).
 */
export async function avaliarJustificativaPendente(
  id: string,
  avaliadoPor: string,
  status: 'aceita' | 'recusada',
  agora: Date,
) {
  try {
    return await prisma.justificativas_faltas.update({
      where: { id, status: 'pendente' },
      data: { status, avaliado_por: avaliadoPor, avaliado_em: agora },
      include: INCLUSAO_JUSTIFICATIVA,
    });
  } catch (erro) {
    if ((erro as { code?: string }).code === 'P2025') return null;
    throw erro;
  }
}

/** Responsáveis ativos do aluno e toda a gestão ativa, quando consultável. */
export async function listarDestinatarios(alunoId: string): Promise<string[]> {
  const [vinculos, gestao] = await Promise.all([
    prisma.vinculos_responsaveis.findMany({
      where: { aluno_id: alunoId, ativo: true },
      select: { responsavel_id: true },
    }),
    prisma.perfis.findMany({
      where: { papel: 'gestao', status: 'ativo' },
      select: { id: true },
    }),
  ]);

  return [
    ...new Set([
      ...vinculos.map((vinculo) => vinculo.responsavel_id),
      ...gestao.map((perfil) => perfil.id),
    ]),
  ];
}
