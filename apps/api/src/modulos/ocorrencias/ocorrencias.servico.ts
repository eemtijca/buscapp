import type {
  AtualizarOcorrencia,
  CriarOcorrencia,
  CriarRegistroComportamento,
  ListarOcorrencias,
  ListarRegistrosComportamento,
  Ocorrencia,
  RegistroComportamento,
  StatusOcorrencia,
  TagComportamento,
} from '@buscapp/contratos';
import type { PerfilAutenticado } from '../../nucleo/autenticacao/tipos.js';
import {
  garantirAlunoVisivel,
  idsDeAlunosVisiveis,
  podeVerAluno,
} from '../../nucleo/autorizacao/escopo.js';
import { comEscopo } from '../../nucleo/banco/cliente.js';
import { publicarEvento } from '../../nucleo/eventos/barramento.js';
import { ErroHttp, erroNaoEncontrado, erroValidacao } from '../../nucleo/http/erros.js';
import {
  atualizarOcorrencia,
  buscarEnturmacaoAtiva,
  buscarOcorrenciaPorId,
  buscarTagsPorNomes,
  buscarTiposOcorrenciaValidos,
  criarOcorrencia,
  criarRegistro,
  listarOcorrencias,
  listarRegistros,
} from './ocorrencias.repositorio.js';

interface OcorrenciaBruta {
  id: string;
  aluno_id: string;
  professor_id: string | null;
  turma_id: string;
  ano_letivo_id: string;
  titulo: string;
  descricao: string;
  tipo: string[];
  status: StatusOcorrencia;
  exige_presenca_responsavel: boolean;
  presenca_responsavel_confirmada: boolean;
  data_confirmacao_presenca: Date | null;
  data_ocorrencia: Date;
  closed_at: Date | null;
  tags_comportamento: string[];
  notificar_coordenacao: boolean;
  notificar_responsavel: boolean;
  created_at: Date;
  updated_at: Date;
  alunos: { id: string; nome: string };
  perfis_ocorrencias_professor_idToperfis: { id: string; nome: string } | null;
  perfis_ocorrencias_coordenador_idToperfis: { id: string; nome: string } | null;
}

interface RegistroBruto {
  id: string;
  aluno_id: string;
  professor_id: string;
  turma_id: string;
  ano_letivo_id: string;
  data_hora: Date;
  observacao: string | null;
  created_at: Date;
  updated_at: Date;
  alunos: { id: string; nome: string };
  perfis: { id: string; nome: string } | null;
  registro_comportamento_tags: Array<{ tags_comportamento: TagComportamento }>;
}

function mapaDeTags(tags: TagComportamento[]): Map<string, TagComportamento> {
  return new Map(tags.map((tag) => [tag.nome, tag]));
}

function paraOcorrencia(
  registro: OcorrenciaBruta,
  tags: Map<string, TagComportamento>,
): Ocorrencia {
  const registrante =
    registro.perfis_ocorrencias_professor_idToperfis ??
    registro.perfis_ocorrencias_coordenador_idToperfis;

  return {
    id: registro.id,
    aluno_id: registro.aluno_id,
    aluno: { id: registro.alunos.id, nome: registro.alunos.nome },
    professor_id: registro.professor_id,
    professor: registrante ? { id: registrante.id, nome: registrante.nome } : null,
    turma_id: registro.turma_id,
    ano_letivo_id: registro.ano_letivo_id,
    titulo: registro.titulo,
    descricao: registro.descricao,
    tipo: registro.tipo,
    status: registro.status,
    exige_presenca_responsavel: registro.exige_presenca_responsavel,
    presenca_responsavel_confirmada: registro.presenca_responsavel_confirmada,
    data_confirmacao_presenca: registro.data_confirmacao_presenca?.toISOString() ?? null,
    data_ocorrencia: registro.data_ocorrencia.toISOString(),
    closed_at: registro.closed_at?.toISOString() ?? null,
    tags_comportamento: registro.tags_comportamento,
    lista_tags: registro.tags_comportamento
      .map((nome) => tags.get(nome))
      .filter((tag): tag is TagComportamento => Boolean(tag)),
    notificar_coordenacao: registro.notificar_coordenacao,
    notificar_responsavel: registro.notificar_responsavel,
    created_at: registro.created_at.toISOString(),
    updated_at: registro.updated_at.toISOString(),
  };
}

function paraRegistro(registro: RegistroBruto): RegistroComportamento {
  return {
    id: registro.id,
    aluno_id: registro.aluno_id,
    aluno: { id: registro.alunos.id, nome: registro.alunos.nome },
    professor_id: registro.professor_id,
    professor: registro.perfis ? { id: registro.perfis.id, nome: registro.perfis.nome } : null,
    turma_id: registro.turma_id,
    ano_letivo_id: registro.ano_letivo_id,
    data_hora: registro.data_hora.toISOString(),
    descricao: registro.observacao,
    tags: registro.registro_comportamento_tags.map((join) => join.tags_comportamento),
    created_at: registro.created_at.toISOString(),
    updated_at: registro.updated_at.toISOString(),
  };
}

export async function listar(
  usuario: PerfilAutenticado,
  consulta: ListarOcorrencias,
): Promise<Ocorrencia[]> {
  return comEscopo(async () => {
    const alunoIds = await idsDeAlunosVisiveis(usuario);
    const registros = await listarOcorrencias(alunoIds, consulta);
    const tags = await buscarTagsPorNomes(
      registros.flatMap((registro) => registro.tags_comportamento),
    );
    const mapa = mapaDeTags(tags);
    return registros.map((registro) => paraOcorrencia(registro, mapa));
  });
}

export async function obter(usuario: PerfilAutenticado, id: string): Promise<Ocorrencia> {
  const registro = await buscarOcorrenciaPorId(id);
  if (!registro || !(await podeVerAluno(usuario, registro.aluno_id))) {
    // Fora do escopo responde 404 para não revelar a existência do registro.
    throw erroNaoEncontrado('Ocorrência não encontrada.');
  }
  const tags = await buscarTagsPorNomes(registro.tags_comportamento);
  return paraOcorrencia(registro, mapaDeTags(tags));
}

export async function criar(
  usuario: PerfilAutenticado,
  dados: CriarOcorrencia,
): Promise<Ocorrencia> {
  await garantirAlunoVisivel(usuario, dados.aluno_id);

  const enturmacao = await buscarEnturmacaoAtiva(dados.aluno_id);
  if (!enturmacao) {
    throw erroValidacao('O aluno não possui enturmação ativa em nenhuma turma.');
  }

  const tipos = [...new Set(dados.tipo)];
  const tiposValidos = await buscarTiposOcorrenciaValidos(tipos);
  if (tiposValidos.length !== tipos.length) {
    throw new ErroHttp(400, 'tipo_invalido', 'Tipo de ocorrência inválido.');
  }

  const nomesTags = [...new Set(dados.tags_comportamento ?? [])];
  const tags = await buscarTagsPorNomes(nomesTags);
  if (tags.length !== nomesTags.length) {
    throw new ErroHttp(400, 'tags_invalidas', 'Tag de comportamento inválida.');
  }

  const registro = await criarOcorrencia({
    aluno_id: dados.aluno_id,
    professor_id: usuario.id,
    coordenador_id: usuario.papel === 'gestao' ? usuario.id : null,
    turma_id: enturmacao.turma_id,
    ano_letivo_id: enturmacao.ano_letivo_id,
    titulo: dados.titulo ?? dados.descricao.slice(0, 100),
    descricao: dados.descricao,
    tipo: tipos,
    exige_presenca_responsavel: dados.exige_presenca_responsavel,
    tags_comportamento: nomesTags,
    notificar_coordenacao: dados.notificar_coordenacao,
    notificar_responsavel: dados.notificar_responsavel,
  });
  publicarEvento({ tabela: 'ocorrencias' });
  return paraOcorrencia(registro, mapaDeTags(tags));
}

export async function atualizar(id: string, dados: AtualizarOcorrencia): Promise<Ocorrencia> {
  const existente = await buscarOcorrenciaPorId(id);
  if (!existente) throw erroNaoEncontrado('Ocorrência não encontrada.');

  const registro = await atualizarOcorrencia(id, dados, new Date());
  publicarEvento({ tabela: 'ocorrencias' });

  const tags = await buscarTagsPorNomes(registro.tags_comportamento);
  return paraOcorrencia(registro, mapaDeTags(tags));
}

export async function listarRegistrosComportamento(
  usuario: PerfilAutenticado,
  consulta: ListarRegistrosComportamento,
): Promise<RegistroComportamento[]> {
  return comEscopo(async () => {
    const alunoIds = await idsDeAlunosVisiveis(usuario);
    const registros = await listarRegistros(alunoIds, consulta);
    return registros.map(paraRegistro);
  });
}

export async function criarRegistroComportamento(
  usuario: PerfilAutenticado,
  dados: CriarRegistroComportamento,
): Promise<RegistroComportamento> {
  await garantirAlunoVisivel(usuario, dados.aluno_id);

  const enturmacao = await buscarEnturmacaoAtiva(dados.aluno_id);
  if (!enturmacao) {
    throw erroValidacao('O aluno não possui enturmação ativa em nenhuma turma.');
  }

  const nomesTags = [...new Set(dados.tags ?? [])];
  const tags = await buscarTagsPorNomes(nomesTags);
  if (tags.length !== nomesTags.length) {
    throw new ErroHttp(400, 'tags_invalidas', 'Tag de comportamento inválida.');
  }

  const registro = await criarRegistro(
    {
      aluno_id: dados.aluno_id,
      professor_id: usuario.id,
      turma_id: enturmacao.turma_id,
      ano_letivo_id: enturmacao.ano_letivo_id,
      descricao: dados.descricao,
    },
    tags.map((tag) => tag.id),
  );
  publicarEvento({ tabela: 'registros_comportamento' });
  return paraRegistro(registro);
}
