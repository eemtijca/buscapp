import type {
  CriarFrequencia,
  Frequencia,
  ListarFrequencias,
  RegistrarLoteFrequencia,
  RegistroResumoFrequencia,
  RemoverLoteFrequencia,
  ResumoAlunoFrequencia,
  ResumirFrequencias,
  TipoRegistroFrequencia,
} from '@buscapp/contratos';
import type { PerfilAutenticado } from '../../nucleo/autenticacao/tipos.js';
import { garantirTurmaDoProfessor, idsDeAlunosVisiveis } from '../../nucleo/autorizacao/escopo.js';
import { publicarEvento } from '../../nucleo/eventos/barramento.js';
import { erroNaoAutorizado, erroValidacao } from '../../nucleo/http/erros.js';
import {
  buscarEnturmacoesAtivasPorAlunos,
  buscarFrequenciaPorClientRequestId,
  buscarFrequenciaPorContexto,
  criarFrequencia,
  criarFrequencias,
  listarAusenciasDoContexto,
  listarFrequencias,
  listarResponsaveisDosAlunos,
  marcarAusenciasComoDeletadas,
  paraData,
  type ContextoLoteFrequencia,
} from './frequencias.repositorio.js';

interface FrequenciaBruta {
  id: string;
  aluno_id: string;
  professor_id: string;
  turma_id: string;
  disciplina_id: string | null;
  ano_letivo_id: string;
  data_aula: Date;
  tipo_registro: TipoRegistroFrequencia;
  periodo: string;
  status: 'presente' | 'ausente' | 'justificado';
  observacao: string | null;
  motivos_ausencia: string[];
  client_request_id: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Dias civis são serializados em `yyyy-mm-dd` para não sofrer deslocamento de fuso. */
function dataCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function paraFrequencia(frequencia: FrequenciaBruta): Frequencia {
  return {
    id: frequencia.id,
    aluno_id: frequencia.aluno_id,
    professor_id: frequencia.professor_id,
    turma_id: frequencia.turma_id,
    disciplina_id: frequencia.disciplina_id,
    ano_letivo_id: frequencia.ano_letivo_id,
    data_aula: dataCivil(frequencia.data_aula),
    tipo_registro: frequencia.tipo_registro,
    periodo: frequencia.periodo,
    status: frequencia.status,
    observacao: frequencia.observacao,
    motivos_ausencia: frequencia.motivos_ausencia,
    client_request_id: frequencia.client_request_id,
    deleted_at: frequencia.deleted_at?.toISOString() ?? null,
    created_at: frequencia.created_at.toISOString(),
    updated_at: frequencia.updated_at.toISOString(),
  };
}

function erroDeChaveUnica(erro: unknown): boolean {
  return (erro as { code?: string }).code === 'P2002';
}

/** Restringe a lista de alunos pedida ao escopo de visibilidade do usuário. */
async function alunosNoEscopo(
  usuario: PerfilAutenticado,
  solicitados: string[],
): Promise<string[] | null> {
  const visiveis = await idsDeAlunosVisiveis(usuario);
  const unicos = [...new Set(solicitados)];

  if (visiveis === null) return unicos.length ? unicos : null;
  if (!unicos.length) return visiveis;

  const permitidos = new Set(visiveis);
  return unicos.filter((alunoId) => permitidos.has(alunoId));
}

/** Notifica o actor e os responsáveis vinculados para atualizar alertas e listagens. */
async function publicarAtualizacao(
  usuarioId: string,
  escopo: Record<string, string>,
  alunoIds: string[],
): Promise<void> {
  const responsaveis = await listarResponsaveisDosAlunos(alunoIds);
  const destinatarios = [...new Set([usuarioId, ...responsaveis])];
  publicarEvento({
    tabela: 'frequencias',
    escopo,
    ...(destinatarios.length ? { destinatarios } : {}),
  });
}

export interface ResultadoLoteFrequencia {
  idempotente: boolean;
  registradas: number;
}

/** Chamada por exceção: valida a turma, a enturmação dos ausentes e grava em lote. */
export async function registrarLote(
  usuario: PerfilAutenticado,
  dados: RegistrarLoteFrequencia,
): Promise<ResultadoLoteFrequencia> {
  await garantirTurmaDoProfessor(usuario, dados.turma_id);

  const jaRegistrado = await buscarFrequenciaPorClientRequestId(dados.client_request_id);
  if (jaRegistrado) return { idempotente: true, registradas: 0 };

  const ausentes = [
    ...new Map(dados.ausentes.map((ausente) => [ausente.aluno_id, ausente])).values(),
  ];
  if (!ausentes.length) return { idempotente: false, registradas: 0 };

  const alunoIds = ausentes.map((ausente) => ausente.aluno_id);
  const enturmacoes = await buscarEnturmacoesAtivasPorAlunos(alunoIds, dados.turma_id);
  const porAluno = new Map(enturmacoes.map((enturmacao) => [enturmacao.aluno_id, enturmacao]));
  if (alunoIds.some((alunoId) => !porAluno.has(alunoId))) {
    throw erroValidacao('Um ou mais alunos não estão matriculados nesta turma.');
  }

  const registros = ausentes.map((ausente, indice) => ({
    aluno_id: ausente.aluno_id,
    professor_id: usuario.id,
    turma_id: dados.turma_id,
    ano_letivo_id: porAluno.get(ausente.aluno_id)?.ano_letivo_id as string,
    data_aula: paraData(dados.data_aula),
    tipo_registro: dados.tipo_registro,
    periodo: dados.periodo,
    status: 'ausente' as const,
    observacao: ausente.observacao ?? null,
    motivos_ausencia: ausente.motivos_ausencia ?? [],
    // O id de requisição identifica o lote; marca apenas o primeiro registro.
    client_request_id: indice === 0 ? dados.client_request_id : null,
  }));

  try {
    const resultado = await criarFrequencias(registros);
    await publicarAtualizacao(
      usuario.id,
      { turma_id: dados.turma_id, data_aula: dados.data_aula },
      alunoIds,
    );
    return { idempotente: false, registradas: resultado.count };
  } catch (erro) {
    if (erroDeChaveUnica(erro)) return { idempotente: true, registradas: 0 };
    throw erro;
  }
}

export interface ResultadoRemocaoFrequencias {
  removidas: number;
}

/** Desfaz a chamada marcando as ausências do contexto como excluídas (soft delete). */
export async function removerLote(
  usuario: PerfilAutenticado,
  filtro: RemoverLoteFrequencia,
): Promise<ResultadoRemocaoFrequencias> {
  await garantirTurmaDoProfessor(usuario, filtro.turma_id);

  const contexto: ContextoLoteFrequencia = {
    turmaId: filtro.turma_id,
    dataAula: paraData(filtro.data_aula),
    periodo: filtro.periodo,
    tipoRegistro: filtro.tipo_registro,
  };

  const ausencias = await listarAusenciasDoContexto(contexto);
  const { count } = await marcarAusenciasComoDeletadas(contexto);

  if (count > 0) {
    await publicarAtualizacao(
      usuario.id,
      { turma_id: filtro.turma_id, data_aula: filtro.data_aula },
      ausencias.map((ausencia) => ausencia.aluno_id),
    );
  }

  return { removidas: count };
}

export interface ResultadoRegistroFrequencia {
  frequencia: Frequencia;
  idempotente: boolean;
}

/** Registro individual de ausência: deriva turma/ano da enturmação ativa do aluno. */
export async function registrar(
  usuario: PerfilAutenticado,
  dados: CriarFrequencia,
): Promise<ResultadoRegistroFrequencia> {
  if (usuario.papel === 'responsavel') throw erroNaoAutorizado();

  if (dados.client_request_id) {
    const existente = await buscarFrequenciaPorClientRequestId(dados.client_request_id);
    if (existente) return { frequencia: paraFrequencia(existente), idempotente: true };
  }

  const dataAula = paraData(dados.data_aula);
  const enturmacoes = await buscarEnturmacoesAtivasPorAlunos([dados.aluno_id]);
  const enturmacao = enturmacoes[0];
  if (!enturmacao) throw erroValidacao('Aluno não está matriculado em nenhuma turma ativa.');

  await garantirTurmaDoProfessor(usuario, enturmacao.turma_id);

  try {
    const frequencia = await criarFrequencia({
      aluno_id: dados.aluno_id,
      professor_id: usuario.id,
      turma_id: enturmacao.turma_id,
      ano_letivo_id: enturmacao.ano_letivo_id,
      data_aula: dataAula,
      tipo_registro: dados.tipo_registro,
      periodo: dados.periodo,
      status: 'ausente',
      observacao: dados.observacao ?? null,
      motivos_ausencia: dados.motivos_ausencia ?? [],
      client_request_id: dados.client_request_id ?? null,
    });

    await publicarAtualizacao(
      usuario.id,
      { aluno_id: dados.aluno_id, turma_id: enturmacao.turma_id, data_aula: dados.data_aula },
      [dados.aluno_id],
    );

    return { frequencia: paraFrequencia(frequencia), idempotente: false };
  } catch (erro) {
    if (erroDeChaveUnica(erro)) {
      const existente =
        (dados.client_request_id
          ? await buscarFrequenciaPorClientRequestId(dados.client_request_id)
          : null) ??
        (await buscarFrequenciaPorContexto(
          dados.aluno_id,
          dataAula,
          dados.tipo_registro,
          dados.periodo,
        ));
      if (existente) return { frequencia: paraFrequencia(existente), idempotente: true };
    }
    throw erro;
  }
}

/** Lista escopada por papel, com todos os filtros suportados pela tela de monitoramento. */
export async function listar(
  usuario: PerfilAutenticado,
  consulta: ListarFrequencias,
): Promise<Frequencia[]> {
  const solicitados = [
    ...(consulta.aluno_id ? [consulta.aluno_id] : []),
    ...(consulta.aluno_ids ?? []),
  ];
  const alunoIds = await alunosNoEscopo(usuario, solicitados);

  const frequencias = await listarFrequencias({
    alunoIds: alunoIds ?? undefined,
    turmaId: consulta.turma_id,
    dataAula: consulta.data_aula ? paraData(consulta.data_aula) : undefined,
    dataInicio: consulta.data_inicio ? paraData(consulta.data_inicio) : undefined,
    dataFim: consulta.data_fim ? paraData(consulta.data_fim) : undefined,
    periodo: consulta.periodo,
    status: consulta.status,
    tipoRegistro: consulta.tipo_registro,
    incluirDeletadas: consulta.incluir_deletadas,
  });

  return frequencias.map(paraFrequencia);
}

/** Agrega ausências e justificativas por aluno para o painel de monitoramento. */
export async function resumir(
  usuario: PerfilAutenticado,
  consulta: ResumirFrequencias,
): Promise<ResumoAlunoFrequencia[]> {
  const alunoIds = await alunosNoEscopo(usuario, consulta.aluno_ids ?? []);

  const frequencias = await listarFrequencias({
    alunoIds: alunoIds ?? undefined,
    dataInicio: consulta.data_inicio ? paraData(consulta.data_inicio) : undefined,
    dataFim: consulta.data_fim ? paraData(consulta.data_fim) : undefined,
    incluirDeletadas: false,
  });

  const baseIds = alunoIds ?? [...new Set(frequencias.map((frequencia) => frequencia.aluno_id))];
  const resumo = new Map<string, ResumoAlunoFrequencia>(
    baseIds.map((alunoId) => [
      alunoId,
      {
        aluno_id: alunoId,
        total_ausentes: 0,
        total_justificados: 0,
        registros: [] as RegistroResumoFrequencia[],
      },
    ]),
  );

  for (const frequencia of frequencias) {
    const item = resumo.get(frequencia.aluno_id);
    if (!item) continue;

    if (frequencia.status === 'ausente') item.total_ausentes += 1;
    if (frequencia.status === 'justificado') item.total_justificados += 1;

    item.registros.push({
      aluno_id: frequencia.aluno_id,
      data_aula: dataCivil(frequencia.data_aula),
      periodo: frequencia.periodo,
      status: frequencia.status,
      motivos_ausencia: frequencia.motivos_ausencia,
    });
  }

  return [...resumo.values()];
}
