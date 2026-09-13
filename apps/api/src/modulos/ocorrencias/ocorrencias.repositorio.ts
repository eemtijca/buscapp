import type {
  AtualizarOcorrencia,
  ListarOcorrencias,
  ListarRegistrosComportamento,
} from '@buscapp/contratos';
import { prisma } from '../../nucleo/banco/cliente.js';

const INCLUSAO_OCORRENCIA = {
  alunos: { select: { id: true, nome: true } },
  perfis_ocorrencias_professor_idToperfis: { select: { id: true, nome: true } },
  perfis_ocorrencias_coordenador_idToperfis: { select: { id: true, nome: true } },
};

const INCLUSAO_REGISTRO = {
  alunos: { select: { id: true, nome: true } },
  perfis: { select: { id: true, nome: true } },
  registro_comportamento_tags: {
    select: {
      tags_comportamento: {
        select: { nome: true, categoria: true, icone: true, descricao: true },
      },
    },
  },
};

function normalizarTipos(tipo: ListarOcorrencias['tipo']): string[] {
  if (!tipo) return [];
  return Array.isArray(tipo) ? tipo : [tipo];
}

export async function listarOcorrencias(alunoIds: string[] | null, consulta: ListarOcorrencias) {
  const tipos = normalizarTipos(consulta.tipo);
  return prisma.ocorrencias.findMany({
    where: {
      AND: [
        ...(alunoIds ? [{ aluno_id: { in: alunoIds } }] : []),
        ...(consulta.aluno_id ? [{ aluno_id: consulta.aluno_id }] : []),
        ...(consulta.status ? [{ status: consulta.status }] : []),
        ...(tipos.length ? [{ tipo: { hasSome: tipos } }] : []),
        ...(consulta.exige_presenca_pendente
          ? [{ exige_presenca_responsavel: true, presenca_responsavel_confirmada: false }]
          : []),
      ],
    },
    include: INCLUSAO_OCORRENCIA,
    orderBy: { created_at: 'desc' },
  });
}

export async function buscarOcorrenciaPorId(id: string) {
  return prisma.ocorrencias.findUnique({ where: { id }, include: INCLUSAO_OCORRENCIA });
}

export async function buscarEnturmacaoAtiva(alunoId: string) {
  return prisma.enturmacoes.findFirst({
    where: { aluno_id: alunoId, status: 'matriculado' },
    orderBy: { data_matricula: 'desc' },
    select: { turma_id: true, ano_letivo_id: true },
  });
}

export async function buscarTagsPorNomes(nomes: string[]) {
  if (!nomes.length) return [];
  return prisma.tags_comportamento.findMany({
    where: { nome: { in: nomes } },
    select: { id: true, nome: true, categoria: true, icone: true, descricao: true },
  });
}

export async function buscarTiposOcorrenciaValidos(tipos: string[]) {
  if (!tipos.length) return [];
  return prisma.opcoes_configuracao.findMany({
    where: { tipo: 'tipo_ocorrencia', chave: { in: tipos } },
    select: { chave: true },
  });
}

export interface DadosNovaOcorrencia {
  aluno_id: string;
  professor_id: string;
  coordenador_id: string | null;
  turma_id: string;
  ano_letivo_id: string;
  titulo: string;
  descricao: string;
  tipo: string[];
  exige_presenca_responsavel: boolean;
  tags_comportamento: string[];
  notificar_coordenacao: boolean;
  notificar_responsavel: boolean;
}

export async function criarOcorrencia(dados: DadosNovaOcorrencia) {
  return prisma.ocorrencias.create({ data: dados, include: INCLUSAO_OCORRENCIA });
}

export async function atualizarOcorrencia(id: string, dados: AtualizarOcorrencia, agora: Date) {
  return prisma.ocorrencias.update({
    where: { id },
    data: {
      ...(dados.exige_presenca_responsavel !== undefined
        ? { exige_presenca_responsavel: dados.exige_presenca_responsavel }
        : {}),
      ...(dados.status !== undefined
        ? {
            status: dados.status,
            closed_at: dados.status === 'resolvida' || dados.status === 'arquivada' ? agora : null,
          }
        : {}),
      ...(dados.presenca_responsavel_confirmada !== undefined
        ? {
            presenca_responsavel_confirmada: dados.presenca_responsavel_confirmada,
            data_confirmacao_presenca: dados.presenca_responsavel_confirmada ? agora : null,
          }
        : {}),
      updated_at: agora,
    },
    include: INCLUSAO_OCORRENCIA,
  });
}

export async function listarRegistros(
  alunoIds: string[] | null,
  consulta: ListarRegistrosComportamento,
) {
  const periodo: { gte?: Date; lte?: Date } = {};
  if (consulta.data_inicio) periodo.gte = new Date(`${consulta.data_inicio}T00:00:00.000Z`);
  if (consulta.data_fim) periodo.lte = new Date(`${consulta.data_fim}T23:59:59.999Z`);

  return prisma.registros_comportamento.findMany({
    where: {
      AND: [
        ...(alunoIds ? [{ aluno_id: { in: alunoIds } }] : []),
        ...(consulta.aluno_id ? [{ aluno_id: consulta.aluno_id }] : []),
        ...(consulta.data_inicio || consulta.data_fim ? [{ data_hora: periodo }] : []),
      ],
    },
    include: INCLUSAO_REGISTRO,
    orderBy: { data_hora: 'desc' },
  });
}

export interface DadosNovoRegistro {
  aluno_id: string;
  professor_id: string;
  turma_id: string;
  ano_letivo_id: string;
  descricao: string;
}

export async function criarRegistro(dados: DadosNovoRegistro, tagIds: string[]) {
  return prisma.registros_comportamento.create({
    data: {
      aluno_id: dados.aluno_id,
      professor_id: dados.professor_id,
      turma_id: dados.turma_id,
      ano_letivo_id: dados.ano_letivo_id,
      observacao: dados.descricao,
      registro_comportamento_tags: {
        create: tagIds.map((tag_id) => ({ tag_id })),
      },
    },
    include: INCLUSAO_REGISTRO,
  });
}
