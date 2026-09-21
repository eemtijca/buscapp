import type {
  AnoLetivo,
  AtribuicaoProfessor,
  AtualizarAnoLetivo,
  AtualizarAtribuicao,
  AtualizarDisciplina,
  AtualizarEnturmacao,
  AtualizarTurma,
  CriarAnoLetivo,
  CriarAtribuicao,
  CriarDisciplina,
  CriarEnturmacao,
  CriarTurma,
  Disciplina,
  Enturmacao,
  ListarAtribuicoes,
  ListarDisciplinas,
  ListarEnturmacoes,
  ListarTurmas,
  Turma,
} from '@buscapp/contratos';
import type { PerfilAutenticado } from '../../nucleo/autenticacao/tipos.js';
import { filtroAlunosVisiveis, podeVerAluno } from '../../nucleo/autorizacao/escopo.js';
import { comEscopo } from '../../nucleo/banco/cliente.js';
import { publicarEvento } from '../../nucleo/eventos/barramento.js';
import { ErroHttp, erroNaoEncontrado, erroValidacao } from '../../nucleo/http/erros.js';
import {
  atualizarAnoLetivo as atualizarAnoLetivoNoBanco,
  atualizarAtribuicao as atualizarAtribuicaoNoBanco,
  atualizarDisciplina as atualizarDisciplinaNoBanco,
  atualizarEnturmacao as atualizarEnturmacaoNoBanco,
  atualizarStatusAtribuicao as atualizarStatusAtribuicaoNoBanco,
  atualizarStatusDisciplina as atualizarStatusDisciplinaNoBanco,
  atualizarStatusTurma as atualizarStatusTurmaNoBanco,
  atualizarTurma as atualizarTurmaNoBanco,
  buscarAlunoPorId,
  buscarAnoLetivoPorId,
  buscarAtribuicaoPorId,
  buscarDisciplinaPorId,
  buscarEnturmacaoPorId,
  buscarPerfilPorId,
  buscarTurmaPorId,
  criarAnoLetivo as criarAnoLetivoNoBanco,
  criarAtribuicao as criarAtribuicaoNoBanco,
  criarDisciplina as criarDisciplinaNoBanco,
  criarTurma as criarTurmaNoBanco,
  enturmarAluno,
  executarAtivacaoAnoLetivo,
  hojeUtc,
  idsDeTurmasDoProfessor,
  idsDeTurmasDoResponsavel,
  listarAnosLetivos as listarAnosLetivosNoBanco,
  listarAtribuicoes as listarAtribuicoesNoBanco,
  listarDisciplinas as listarDisciplinasNoBanco,
  listarEnturmacoes as listarEnturmacoesNoBanco,
  listarTurmas as listarTurmasNoBanco,
  type AtribuicaoComRelacoes,
  type EnturmacaoComRelacoes,
} from './estrutura.repositorio.js';

type TurmaBruta = Awaited<ReturnType<typeof listarTurmasNoBanco>>[number];
type DisciplinaBruta = Awaited<ReturnType<typeof listarDisciplinasNoBanco>>[number];
type AnoLetivoBruto = Awaited<ReturnType<typeof listarAnosLetivosNoBanco>>[number];

function dataIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function dataOuNulo(data: Date | null): string | null {
  return data ? dataIso(data) : null;
}

function dataDeEntrada(valor: string): Date {
  return new Date(`${valor}T00:00:00.000Z`);
}

function ehConflitoUnicidade(erro: unknown): boolean {
  const erroTipado = erro as { code?: string; cause?: { code?: string } };
  return (
    erroTipado.code === 'P2002' || erroTipado.code === '23505' || erroTipado.cause?.code === '23505'
  );
}

function validarPeriodo(inicio: string, fim: string | null | undefined): void {
  if (fim && fim < inicio) {
    throw erroValidacao('A data de fim deve ser posterior ou igual à data de início.');
  }
}

// --- Turmas ---

export function paraTurma(turma: TurmaBruta): Turma {
  return {
    id: turma.id,
    ano_letivo_id: turma.ano_letivo_id,
    serie: turma.serie,
    letra: turma.letra,
    nome_completo: turma.nome_completo,
    capacidade: turma.capacidade,
    ativo: turma.ativo,
    created_at: turma.created_at.toISOString(),
    updated_at: turma.updated_at.toISOString(),
  };
}

async function filtroTurmasVisiveis(usuario: PerfilAutenticado) {
  if (usuario.papel === 'gestao') return {};
  const ids =
    usuario.papel === 'professor'
      ? await idsDeTurmasDoProfessor(usuario.id)
      : await idsDeTurmasDoResponsavel(usuario.id);
  return { id: { in: ids } };
}

export async function listarTurmas(
  usuario: PerfilAutenticado,
  consulta: ListarTurmas,
): Promise<Turma[]> {
  const turmas = await listarTurmasNoBanco(await filtroTurmasVisiveis(usuario), consulta);
  return turmas.map(paraTurma);
}

export async function criarTurma(dados: CriarTurma): Promise<Turma> {
  const anoLetivo = await buscarAnoLetivoPorId(dados.ano_letivo_id);
  if (!anoLetivo) throw erroNaoEncontrado('Ano letivo não encontrado.');

  try {
    const turma = await criarTurmaNoBanco(dados, `${dados.serie} ${dados.letra}`);
    publicarEvento({ tabela: 'turmas' });
    return paraTurma(turma);
  } catch (erro) {
    if (ehConflitoUnicidade(erro)) {
      throw new ErroHttp(
        409,
        'turma_duplicada',
        'Já existe uma turma com esta série e letra neste ano letivo.',
      );
    }
    throw erro;
  }
}

export async function atualizarTurma(id: string, dados: AtualizarTurma): Promise<Turma> {
  const existente = await buscarTurmaPorId(id);
  if (!existente) throw erroNaoEncontrado('Turma não encontrada.');

  const serie = dados.serie ?? existente.serie;
  const letra = dados.letra ?? existente.letra;

  try {
    const turma = await atualizarTurmaNoBanco(id, {
      ...dados,
      nome_completo: `${serie} ${letra}`,
    });
    publicarEvento({ tabela: 'turmas' });
    return paraTurma(turma);
  } catch (erro) {
    if (ehConflitoUnicidade(erro)) {
      throw new ErroHttp(
        409,
        'turma_duplicada',
        'Já existe uma turma com esta série e letra neste ano letivo.',
      );
    }
    throw erro;
  }
}

export async function atualizarStatusTurma(id: string, ativo: boolean): Promise<Turma> {
  const existente = await buscarTurmaPorId(id);
  if (!existente) throw erroNaoEncontrado('Turma não encontrada.');

  const turma = await atualizarStatusTurmaNoBanco(id, ativo);
  publicarEvento({ tabela: 'turmas' });
  return paraTurma(turma);
}

// --- Disciplinas ---

export function paraDisciplina(disciplina: DisciplinaBruta): Disciplina {
  return {
    id: disciplina.id,
    nome: disciplina.nome,
    codigo_sige: disciplina.codigo_sige,
    carga_horaria: disciplina.carga_horaria,
    ativo: disciplina.ativo,
    created_at: disciplina.created_at.toISOString(),
    updated_at: disciplina.updated_at.toISOString(),
  };
}

export async function listarDisciplinas(consulta: ListarDisciplinas): Promise<Disciplina[]> {
  const disciplinas = await listarDisciplinasNoBanco(consulta);
  return disciplinas.map(paraDisciplina);
}

export async function criarDisciplina(dados: CriarDisciplina): Promise<Disciplina> {
  try {
    const disciplina = await criarDisciplinaNoBanco(dados);
    publicarEvento({ tabela: 'disciplinas' });
    return paraDisciplina(disciplina);
  } catch (erro) {
    if (ehConflitoUnicidade(erro)) {
      throw new ErroHttp(
        409,
        'codigo_sige_duplicado',
        'Já existe uma disciplina com este código SIGE.',
      );
    }
    throw erro;
  }
}

export async function atualizarDisciplina(
  id: string,
  dados: AtualizarDisciplina,
): Promise<Disciplina> {
  const existente = await buscarDisciplinaPorId(id);
  if (!existente) throw erroNaoEncontrado('Disciplina não encontrada.');

  try {
    const disciplina = await atualizarDisciplinaNoBanco(id, dados);
    publicarEvento({ tabela: 'disciplinas' });
    return paraDisciplina(disciplina);
  } catch (erro) {
    if (ehConflitoUnicidade(erro)) {
      throw new ErroHttp(
        409,
        'codigo_sige_duplicado',
        'Já existe uma disciplina com este código SIGE.',
      );
    }
    throw erro;
  }
}

export async function atualizarStatusDisciplina(id: string, ativo: boolean): Promise<Disciplina> {
  const existente = await buscarDisciplinaPorId(id);
  if (!existente) throw erroNaoEncontrado('Disciplina não encontrada.');
  const disciplina = await atualizarStatusDisciplinaNoBanco(id, ativo);
  publicarEvento({ tabela: 'disciplinas' });
  return paraDisciplina(disciplina);
}

// --- Atribuições ---

export function paraAtribuicao(atribuicao: AtribuicaoComRelacoes): AtribuicaoProfessor {
  return {
    id: atribuicao.id,
    professor_id: atribuicao.professor_id,
    turma_id: atribuicao.turma_id,
    disciplina_id: atribuicao.disciplina_id,
    papel: atribuicao.papel,
    data_inicio: dataIso(atribuicao.data_inicio),
    data_fim: dataOuNulo(atribuicao.data_fim),
    ativo: atribuicao.ativo,
    created_at: atribuicao.created_at.toISOString(),
    updated_at: atribuicao.updated_at.toISOString(),
    professor: { id: atribuicao.perfis.id, nome: atribuicao.perfis.nome },
    turma: { id: atribuicao.turmas.id, nome_completo: atribuicao.turmas.nome_completo },
    disciplina: atribuicao.disciplinas
      ? { id: atribuicao.disciplinas.id, nome: atribuicao.disciplinas.nome }
      : null,
  };
}

async function validarReferenciasAtribuicao(dados: AtualizarAtribuicao): Promise<void> {
  if (dados.professor_id !== undefined) {
    const professor = await buscarPerfilPorId(dados.professor_id);
    if (!professor) throw erroNaoEncontrado('Professor não encontrado.');
  }
  if (dados.turma_id !== undefined) {
    const turma = await buscarTurmaPorId(dados.turma_id);
    if (!turma) throw erroNaoEncontrado('Turma não encontrada.');
  }
  if (dados.disciplina_id !== undefined && dados.disciplina_id !== null) {
    const disciplina = await buscarDisciplinaPorId(dados.disciplina_id);
    if (!disciplina) throw erroNaoEncontrado('Disciplina não encontrada.');
  }
}

export async function listarAtribuicoes(
  consulta: ListarAtribuicoes,
): Promise<AtribuicaoProfessor[]> {
  const atribuicoes = await listarAtribuicoesNoBanco(consulta);
  return atribuicoes.map(paraAtribuicao);
}

export async function criarAtribuicao(dados: CriarAtribuicao): Promise<AtribuicaoProfessor> {
  await validarReferenciasAtribuicao(dados);
  validarPeriodo(dados.data_inicio, dados.data_fim);

  const criada = await criarAtribuicaoNoBanco(dados);
  const atribuicao = await buscarAtribuicaoPorId(criada.id);
  if (!atribuicao) throw erroNaoEncontrado('Atribuição não encontrada.');

  publicarEvento({ tabela: 'atribuicoes_professores' });
  return paraAtribuicao(atribuicao);
}

export async function atualizarAtribuicao(
  id: string,
  dados: AtualizarAtribuicao,
): Promise<AtribuicaoProfessor> {
  const existente = await buscarAtribuicaoPorId(id);
  if (!existente) throw erroNaoEncontrado('Atribuição não encontrada.');

  await validarReferenciasAtribuicao(dados);
  const inicio = dados.data_inicio ?? dataIso(existente.data_inicio);
  const fim = dados.data_fim !== undefined ? dados.data_fim : dataOuNulo(existente.data_fim);
  validarPeriodo(inicio, fim);

  await atualizarAtribuicaoNoBanco(id, dados);
  const atribuicao = await buscarAtribuicaoPorId(id);
  if (!atribuicao) throw erroNaoEncontrado('Atribuição não encontrada.');

  publicarEvento({ tabela: 'atribuicoes_professores' });
  return paraAtribuicao(atribuicao);
}

export async function atualizarStatusAtribuicao(
  id: string,
  ativo: boolean,
): Promise<AtribuicaoProfessor> {
  const existente = await buscarAtribuicaoPorId(id);
  if (!existente) throw erroNaoEncontrado('Atribuição não encontrada.');

  await atualizarStatusAtribuicaoNoBanco(id, ativo);
  const atribuicao = await buscarAtribuicaoPorId(id);
  if (!atribuicao) throw erroNaoEncontrado('Atribuição não encontrada.');

  publicarEvento({ tabela: 'atribuicoes_professores' });
  return paraAtribuicao(atribuicao);
}

// --- Anos letivos ---

export function paraAnoLetivo(ano: AnoLetivoBruto): AnoLetivo {
  return {
    id: ano.id,
    ano: ano.ano,
    status: ano.status,
    data_inicio: dataIso(ano.data_inicio),
    data_fim: dataIso(ano.data_fim),
    ativo: ano.ativo,
    created_at: ano.created_at.toISOString(),
    updated_at: ano.updated_at.toISOString(),
  };
}

export async function listarAnosLetivos(): Promise<AnoLetivo[]> {
  const anos = await listarAnosLetivosNoBanco();
  return anos.map(paraAnoLetivo);
}

export async function criarAnoLetivo(dados: CriarAnoLetivo): Promise<AnoLetivo> {
  validarPeriodo(dados.data_inicio, dados.data_fim);

  try {
    const ano = await criarAnoLetivoNoBanco(dados);
    publicarEvento({ tabela: 'anos_letivos' });
    return paraAnoLetivo(ano);
  } catch (erro) {
    if (ehConflitoUnicidade(erro)) {
      throw new ErroHttp(409, 'ano_letivo_duplicado', 'Já existe um ano letivo para este ano.');
    }
    throw erro;
  }
}

export async function atualizarAnoLetivo(
  id: string,
  dados: AtualizarAnoLetivo,
): Promise<AnoLetivo> {
  const existente = await buscarAnoLetivoPorId(id);
  if (!existente) throw erroNaoEncontrado('Ano letivo não encontrado.');

  validarPeriodo(
    dados.data_inicio ?? dataIso(existente.data_inicio),
    dados.data_fim ?? dataIso(existente.data_fim),
  );

  try {
    const ano = await atualizarAnoLetivoNoBanco(id, dados);
    publicarEvento({ tabela: 'anos_letivos' });
    return paraAnoLetivo(ano);
  } catch (erro) {
    if (ehConflitoUnicidade(erro)) {
      throw new ErroHttp(409, 'ano_letivo_duplicado', 'Já existe um ano letivo para este ano.');
    }
    throw erro;
  }
}

export async function ativarAnoLetivo(id: string, usuarioId: string): Promise<AnoLetivo> {
  let resultado;
  try {
    resultado = await executarAtivacaoAnoLetivo(id, usuarioId);
  } catch (erro) {
    // O índice único do ano ativo impede duas viradas concorrentes.
    if ((erro as { code?: string }).code === 'P2002') {
      throw new ErroHttp(409, 'virada_concorrente', 'Outro ano letivo foi ativado em paralelo.');
    }
    throw erro;
  }

  if (resultado.tipo === 'nao_encontrado') throw erroNaoEncontrado('Ano letivo não encontrado.');
  if (resultado.tipo === 'ja_ativo') throw erroValidacao('Este ano letivo já está ativo.');

  publicarEvento({ tabela: 'anos_letivos' });
  return paraAnoLetivo(resultado.ano);
}

// --- Enturmações ---

export function paraEnturmacao(enturmacao: EnturmacaoComRelacoes): Enturmacao {
  return {
    id: enturmacao.id,
    aluno_id: enturmacao.aluno_id,
    turma_id: enturmacao.turma_id,
    ano_letivo_id: enturmacao.ano_letivo_id,
    status: enturmacao.status,
    data_matricula: dataIso(enturmacao.data_matricula),
    data_encerramento: dataOuNulo(enturmacao.data_encerramento),
    observacoes: enturmacao.observacoes,
    created_at: enturmacao.created_at.toISOString(),
    updated_at: enturmacao.updated_at.toISOString(),
    turma: { id: enturmacao.turmas.id, nome_completo: enturmacao.turmas.nome_completo },
    ano_letivo: { id: enturmacao.anos_letivos.id, ano: enturmacao.anos_letivos.ano },
  };
}

export async function listarEnturmacoes(
  usuario: PerfilAutenticado,
  consulta: ListarEnturmacoes,
): Promise<Enturmacao[]> {
  return comEscopo(async () => {
    if (consulta.aluno_id && !(await podeVerAluno(usuario, consulta.aluno_id))) {
      // Fora do escopo responde 404 para não revelar a existência do registro.
      throw erroNaoEncontrado('Aluno não encontrado.');
    }

    const filtro = await filtroAlunosVisiveis(usuario);
    const alunoIdsVisiveis = filtro.id?.in ?? null;
    const enturmacoes = await listarEnturmacoesNoBanco(consulta, alunoIdsVisiveis);
    return enturmacoes.map(paraEnturmacao);
  });
}

export async function criarEnturmacao(dados: CriarEnturmacao): Promise<Enturmacao> {
  const aluno = await buscarAlunoPorId(dados.aluno_id);
  if (!aluno) throw erroNaoEncontrado('Aluno não encontrado.');

  const turma = await buscarTurmaPorId(dados.turma_id);
  if (!turma) throw erroNaoEncontrado('Turma não encontrada.');

  let enturmacao;
  try {
    enturmacao = await enturmarAluno({
      aluno_id: dados.aluno_id,
      turma_id: dados.turma_id,
      ano_letivo_id: turma.ano_letivo_id,
      data_matricula: dados.data_matricula ? dataDeEntrada(dados.data_matricula) : hojeUtc(),
      observacoes: dados.observacoes ?? null,
    });
  } catch (erro) {
    if ((erro as { code?: string }).code === 'P2002') {
      throw new ErroHttp(
        409,
        'enturmacao_duplicada',
        'O aluno já possui enturmação neste ano letivo.',
      );
    }
    throw erro;
  }

  publicarEvento({ tabela: 'enturmacoes' });
  return paraEnturmacao(enturmacao);
}

export async function atualizarEnturmacao(
  id: string,
  dados: AtualizarEnturmacao,
): Promise<Enturmacao> {
  const existente = await buscarEnturmacaoPorId(id);
  if (!existente) throw erroNaoEncontrado('Enturmação não encontrada.');

  if (dados.turma_id !== undefined) {
    const turma = await buscarTurmaPorId(dados.turma_id);
    if (!turma) throw erroNaoEncontrado('Turma não encontrada.');
  }

  const atualizada = await atualizarEnturmacaoNoBanco(id, {
    turma_id: dados.turma_id,
    status: dados.status,
    data_encerramento:
      dados.data_encerramento === undefined
        ? undefined
        : dados.data_encerramento
          ? dataDeEntrada(dados.data_encerramento)
          : null,
  });

  publicarEvento({ tabela: 'enturmacoes' });
  return paraEnturmacao(atualizada);
}
