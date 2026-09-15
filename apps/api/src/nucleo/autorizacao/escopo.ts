import { prisma } from '../banco/cliente.js';
import { erroNaoAutorizado } from '../http/erros.js';
import type { PerfilAutenticado } from '../autenticacao/tipos.js';

/**
 * Escopo de visibilidade de alunos por papel, espelhando as políticas RLS originais:
 * gestão vê todos; professor vê alunos das turmas em que leciona; responsável vê
 * apenas os alunos vinculados a ele.
 */
export async function idsDeAlunosVisiveis(usuario: PerfilAutenticado): Promise<string[] | null> {
  if (usuario.papel === 'gestao') return null;

  if (usuario.papel === 'professor') {
    const atribuicoes = await prisma.atribuicoes_professores.findMany({
      where: { professor_id: usuario.id, ativo: true },
      select: { turma_id: true },
    });
    const turmaIds = atribuicoes.map((atribuicao) => atribuicao.turma_id);
    if (!turmaIds.length) return [];

    const enturmacoes = await prisma.enturmacoes.findMany({
      where: { turma_id: { in: turmaIds }, status: 'matriculado' },
      select: { aluno_id: true },
    });
    return [...new Set(enturmacoes.map((enturmacao) => enturmacao.aluno_id))];
  }

  const vinculos = await prisma.vinculos_responsaveis.findMany({
    where: { responsavel_id: usuario.id, ativo: true },
    select: { aluno_id: true },
  });
  return vinculos.map((vinculo) => vinculo.aluno_id);
}

/** Filtro Prisma para consultas de alunos respeitando o escopo do usuário. */
export async function filtroAlunosVisiveis(
  usuario: PerfilAutenticado,
): Promise<{ id?: { in: string[] } }> {
  const ids = await idsDeAlunosVisiveis(usuario);
  return ids === null ? {} : { id: { in: ids } };
}

export async function podeVerAluno(usuario: PerfilAutenticado, alunoId: string): Promise<boolean> {
  const ids = await idsDeAlunosVisiveis(usuario);
  return ids === null || ids.includes(alunoId);
}

export async function garantirAlunoVisivel(
  usuario: PerfilAutenticado,
  alunoId: string,
): Promise<void> {
  if (!(await podeVerAluno(usuario, alunoId))) {
    throw erroNaoAutorizado('Aluno fora do seu escopo de acesso.');
  }
}

/** Garante que o professor leciona na turma informada. Gestão passa sempre. */
export async function garantirTurmaDoProfessor(
  usuario: PerfilAutenticado,
  turmaId: string,
): Promise<void> {
  if (usuario.papel === 'gestao') return;
  if (usuario.papel !== 'professor') throw erroNaoAutorizado();

  const atribuicao = await prisma.atribuicoes_professores.findFirst({
    where: { professor_id: usuario.id, turma_id: turmaId, ativo: true },
    select: { id: true },
  });
  if (!atribuicao) throw erroNaoAutorizado('Turma fora do seu escopo de acesso.');
}
