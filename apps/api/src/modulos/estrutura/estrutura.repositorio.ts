import type {
  AtualizarAnoLetivo,
  AtualizarAtribuicao,
  AtualizarDisciplina,
  CriarAnoLetivo,
  CriarAtribuicao,
  CriarDisciplina,
  CriarTurma,
  ListarAtribuicoes,
  ListarDisciplinas,
  ListarEnturmacoes,
  ListarTurmas,
} from '@buscapp/contratos';
import { prisma } from '../../nucleo/banco/cliente.js';

interface FiltroTurmas {
  id?: { in: string[] };
}

/** Data de hoje (UTC) gravada em colunas `@db.Date`. */
export function hojeUtc(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

// --- Turmas ---

export async function listarTurmas(filtro: FiltroTurmas, consulta: ListarTurmas) {
  return prisma.turmas.findMany({
    where: {
      ...filtro,
      ...(consulta.ativo !== undefined ? { ativo: consulta.ativo } : {}),
      ...(consulta.ano_letivo_id ? { ano_letivo_id: consulta.ano_letivo_id } : {}),
    },
    orderBy: { nome_completo: 'asc' },
  });
}

export async function buscarTurmaPorId(id: string) {
  return prisma.turmas.findUnique({ where: { id } });
}

export async function criarTurma(dados: CriarTurma, nomeCompleto: string) {
  return prisma.turmas.create({
    data: {
      ano_letivo_id: dados.ano_letivo_id,
      serie: dados.serie,
      letra: dados.letra,
      nome_completo: nomeCompleto,
      capacidade: dados.capacidade ?? null,
      ativo: dados.ativo ?? true,
    },
  });
}

export interface DadosAtualizacaoTurma {
  serie?: string;
  letra?: string;
  nome_completo?: string;
  capacidade?: number | null;
  ativo?: boolean;
}

export async function atualizarTurma(id: string, dados: DadosAtualizacaoTurma) {
  return prisma.turmas.update({
    where: { id },
    data: {
      ...(dados.serie !== undefined ? { serie: dados.serie } : {}),
      ...(dados.letra !== undefined ? { letra: dados.letra } : {}),
      ...(dados.nome_completo !== undefined ? { nome_completo: dados.nome_completo } : {}),
      ...(dados.capacidade !== undefined ? { capacidade: dados.capacidade } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    },
  });
}

export async function atualizarStatusTurma(id: string, ativo: boolean) {
  return prisma.turmas.update({ where: { id }, data: { ativo } });
}

/** IDs das turmas em que o professor possui atribuição ativa. */
export async function idsDeTurmasDoProfessor(professorId: string): Promise<string[]> {
  const atribuicoes = await prisma.atribuicoes_professores.findMany({
    where: { professor_id: professorId, ativo: true },
    select: { turma_id: true },
  });
  return [...new Set(atribuicoes.map((atribuicao) => atribuicao.turma_id))];
}

/** IDs das turmas de alunos matriculados vinculados ao responsável. */
export async function idsDeTurmasDoResponsavel(responsavelId: string): Promise<string[]> {
  const enturmacoes = await prisma.enturmacoes.findMany({
    where: {
      status: 'matriculado',
      alunos: {
        vinculos_responsaveis: {
          some: { responsavel_id: responsavelId, ativo: true },
        },
      },
    },
    select: { turma_id: true },
  });
  return [...new Set(enturmacoes.map((enturmacao) => enturmacao.turma_id))];
}

// --- Disciplinas ---

export async function listarDisciplinas(consulta: ListarDisciplinas) {
  return prisma.disciplinas.findMany({
    where: (consulta.ativo !== undefined ? { ativo: consulta.ativo } : {}),
    orderBy: { nome: 'asc' },
  });
}

export async function buscarDisciplinaPorId(id: string) {
  return prisma.disciplinas.findUnique({ where: { id } });
}

export async function criarDisciplina(dados: CriarDisciplina) {
  return prisma.disciplinas.create({
    data: {
      nome: dados.nome,
      codigo_sige: dados.codigo_sige ?? null,
      carga_horaria: dados.carga_horaria ?? null,
      ativo: dados.ativo ?? true,
    },
  });
}

export async function atualizarDisciplina(id: string, dados: AtualizarDisciplina) {
  return prisma.disciplinas.update({
    where: { id },
    data: {
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.codigo_sige !== undefined ? { codigo_sige: dados.codigo_sige } : {}),
      ...(dados.carga_horaria !== undefined ? { carga_horaria: dados.carga_horaria } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    },
  });
}

export async function atualizarStatusDisciplina(id: string, ativo: boolean) {
  return prisma.disciplinas.update({ where: { id }, data: { ativo } });
}

// --- Atribuições ---

export async function listarAtribuicoes(consulta: ListarAtribuicoes) {
  return prisma.atribuicoes_professores.findMany({
    where: {
      ...(consulta.professor_id ? { professor_id: consulta.professor_id } : {}),
      ...(consulta.turma_id ? { turma_id: consulta.turma_id } : {}),
      ...(consulta.ativo !== undefined ? { ativo: consulta.ativo } : {}),
    },
    include: {
      perfis: { select: { id: true, nome: true } },
      turmas: { select: { id: true, nome_completo: true } },
      disciplinas: { select: { id: true, nome: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function buscarAtribuicaoPorId(id: string) {
  return prisma.atribuicoes_professores.findUnique({
    where: { id },
    include: {
      perfis: { select: { id: true, nome: true } },
      turmas: { select: { id: true, nome_completo: true } },
      disciplinas: { select: { id: true, nome: true } },
    },
  });
}

export type AtribuicaoComRelacoes = NonNullable<Awaited<ReturnType<typeof buscarAtribuicaoPorId>>>;

export async function criarAtribuicao(dados: CriarAtribuicao) {
  return prisma.atribuicoes_professores.create({
    data: {
      professor_id: dados.professor_id,
      turma_id: dados.turma_id,
      disciplina_id: dados.disciplina_id ?? null,
      papel: dados.papel,
      data_inicio: new Date(`${dados.data_inicio}T00:00:00.000Z`),
      data_fim: dados.data_fim ? new Date(`${dados.data_fim}T00:00:00.000Z`) : null,
      ativo: dados.ativo ?? true,
    },
  });
}

export async function atualizarAtribuicao(id: string, dados: AtualizarAtribuicao) {
  return prisma.atribuicoes_professores.update({
    where: { id },
    data: {
      ...(dados.professor_id !== undefined ? { professor_id: dados.professor_id } : {}),
      ...(dados.turma_id !== undefined ? { turma_id: dados.turma_id } : {}),
      ...(dados.disciplina_id !== undefined ? { disciplina_id: dados.disciplina_id } : {}),
      ...(dados.papel !== undefined ? { papel: dados.papel } : {}),
      ...(dados.data_inicio !== undefined
        ? { data_inicio: new Date(`${dados.data_inicio}T00:00:00.000Z`) }
        : {}),
      ...(dados.data_fim !== undefined
        ? { data_fim: dados.data_fim ? new Date(`${dados.data_fim}T00:00:00.000Z`) : null }
        : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    },
  });
}

export async function atualizarStatusAtribuicao(id: string, ativo: boolean) {
  return prisma.atribuicoes_professores.update({ where: { id }, data: { ativo } });
}

// --- Anos letivos ---

export async function listarAnosLetivos() {
  return prisma.anos_letivos.findMany({ orderBy: { ano: 'desc' } });
}

export async function buscarAnoLetivoPorId(id: string) {
  return prisma.anos_letivos.findUnique({ where: { id } });
}

export async function criarAnoLetivo(dados: CriarAnoLetivo) {
  return prisma.anos_letivos.create({
    data: {
      ano: dados.ano,
      status: 'planejado',
      ativo: false,
      data_inicio: new Date(`${dados.data_inicio}T00:00:00.000Z`),
      data_fim: new Date(`${dados.data_fim}T00:00:00.000Z`),
    },
  });
}

export async function atualizarAnoLetivo(id: string, dados: AtualizarAnoLetivo) {
  return prisma.anos_letivos.update({
    where: { id },
    data: {
      ...(dados.ano !== undefined ? { ano: dados.ano } : {}),
      ...(dados.data_inicio !== undefined
        ? { data_inicio: new Date(`${dados.data_inicio}T00:00:00.000Z`) }
        : {}),
      ...(dados.data_fim !== undefined
        ? { data_fim: new Date(`${dados.data_fim}T00:00:00.000Z`) }
        : {}),
    },
  });
}

export async function buscarAnoLetivoVigente() {
  return prisma.anos_letivos.findFirst({ where: { status: 'ativo', ativo: true } });
}

export type ResultadoAtivacaoAnoLetivo =
  | { tipo: 'ok'; ano: Awaited<ReturnType<typeof atualizarAnoLetivo>> }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'ja_ativo' }
  | { tipo: 'arquivado' };

/**
 * Virada de ano letivo em transação única: arquiva o vigente, ativa o alvo e
 * registra as duas ações na auditoria.
 */
export async function executarAtivacaoAnoLetivo(
  anoId: string,
  usuarioId: string,
): Promise<ResultadoAtivacaoAnoLetivo> {
  return prisma.$transaction(async (tx) => {
    const alvo = await tx.anos_letivos.findUnique({ where: { id: anoId } });
    if (!alvo) return { tipo: 'nao_encontrado' };
    if (alvo.status === 'arquivado') return { tipo: 'arquivado' };
    if (alvo.ativo) return { tipo: 'ja_ativo' };

    const vigente = await tx.anos_letivos.findFirst({
      where: { status: 'ativo', ativo: true, id: { not: anoId } },
    });

    if (vigente) {
      await tx.anos_letivos.update({
        where: { id: vigente.id },
        data: { status: 'arquivado', ativo: false },
      });
      await tx.auditoria.create({
        data: {
          usuario_id: usuarioId,
          acao: 'ARQUIVAR_ANO_LETIVO',
          entidade: 'anos_letivos',
          entidade_id: vigente.id,
          dados_anteriores: { status: vigente.status, ativo: vigente.ativo },
          dados_novos: { status: 'arquivado', ativo: false },
        },
      });
    }

    const atualizado = await tx.anos_letivos.update({
      where: { id: anoId },
      data: { status: 'ativo', ativo: true },
    });
    await tx.auditoria.create({
      data: {
        usuario_id: usuarioId,
        acao: 'ATIVAR_ANO_LETIVO',
        entidade: 'anos_letivos',
        entidade_id: anoId,
        dados_anteriores: { status: alvo.status, ativo: alvo.ativo },
        dados_novos: { status: 'ativo', ativo: true },
      },
    });

    return { tipo: 'ok', ano: atualizado };
  });
}

// --- Enturmações ---

export async function listarEnturmacoes(
  consulta: ListarEnturmacoes,
  alunoIdsVisiveis: string[] | null,
) {
  return prisma.enturmacoes.findMany({
    where: {
      ...(alunoIdsVisiveis !== null ? { aluno_id: { in: alunoIdsVisiveis } } : {}),
      ...(consulta.aluno_id ? { aluno_id: consulta.aluno_id } : {}),
      ...(consulta.turma_id ? { turma_id: consulta.turma_id } : {}),
      ...(consulta.status ? { status: consulta.status } : {}),
    },
    include: {
      turmas: { select: { id: true, nome_completo: true } },
      anos_letivos: { select: { id: true, ano: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function buscarEnturmacaoPorId(id: string) {
  return prisma.enturmacoes.findUnique({
    where: { id },
    include: {
      turmas: { select: { id: true, nome_completo: true } },
      anos_letivos: { select: { id: true, ano: true } },
    },
  });
}

export type EnturmacaoComRelacoes = NonNullable<Awaited<ReturnType<typeof buscarEnturmacaoPorId>>>;

export async function buscarAlunoPorId(id: string) {
  return prisma.alunos.findUnique({ where: { id } });
}

export async function buscarPerfilPorId(id: string) {
  return prisma.perfis.findUnique({ where: { id } });
}

export interface DadosEnturmacao {
  aluno_id: string;
  turma_id: string;
  ano_letivo_id: string;
  data_matricula: Date;
  observacoes: string | null;
}

/**
 * Enturma o aluno respeitando a unicidade de (aluno, ano letivo): encerra a
 * enturmação ativa, reaproveita a linha quando for do mesmo ano ou cria uma nova.
 */
export async function enturmarAluno(dados: DadosEnturmacao): Promise<EnturmacaoComRelacoes> {
  return prisma.$transaction(async (tx) => {
    const existenteNoAno = await tx.enturmacoes.findUnique({
      where: {
        aluno_id_ano_letivo_id: {
          aluno_id: dados.aluno_id,
          ano_letivo_id: dados.ano_letivo_id,
        },
      },
    });

    if (existenteNoAno) {
      return tx.enturmacoes.update({
        where: { id: existenteNoAno.id },
        data: {
          turma_id: dados.turma_id,
          status: 'matriculado',
          data_matricula: dados.data_matricula,
          data_encerramento: null,
          observacoes: dados.observacoes,
        },
        include: {
          turmas: { select: { id: true, nome_completo: true } },
          anos_letivos: { select: { id: true, ano: true } },
        },
      });
    }

    const ativa = await tx.enturmacoes.findFirst({
      where: { aluno_id: dados.aluno_id, status: 'matriculado' },
      orderBy: { created_at: 'desc' },
    });

    if (ativa) {
      await tx.enturmacoes.update({
        where: { id: ativa.id },
        data: { status: 'transferido', data_encerramento: hojeUtc() },
      });
    }

    return tx.enturmacoes.create({
      data: {
        aluno_id: dados.aluno_id,
        turma_id: dados.turma_id,
        ano_letivo_id: dados.ano_letivo_id,
        status: 'matriculado',
        data_matricula: dados.data_matricula,
        observacoes: dados.observacoes,
      },
      include: {
        turmas: { select: { id: true, nome_completo: true } },
        anos_letivos: { select: { id: true, ano: true } },
      },
    });
  });
}

export interface DadosAtualizacaoEnturmacao {
  turma_id?: string;
  status?: string;
  data_encerramento?: Date | null;
}

export async function atualizarEnturmacao(id: string, dados: DadosAtualizacaoEnturmacao) {
  return prisma.enturmacoes.update({
    where: { id },
    data: {
      ...(dados.turma_id !== undefined ? { turma_id: dados.turma_id } : {}),
      ...(dados.status !== undefined ? { status: dados.status } : {}),
      ...(dados.data_encerramento !== undefined
        ? { data_encerramento: dados.data_encerramento }
        : {}),
    },
    include: {
      turmas: { select: { id: true, nome_completo: true } },
      anos_letivos: { select: { id: true, ano: true } },
    },
  });
}
