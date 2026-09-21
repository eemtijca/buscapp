import type {
  AvaliarJustificativa,
  Justificativa,
  ListarJustificativas,
  CriarJustificativa,
} from '@buscapp/contratos';
import type { Prisma } from '../../../generated/prisma/client.js';
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
  avaliarJustificativaPendente,
  buscarAnexosPorIds,
  buscarJustificativaPorId,
  criarJustificativa,
  INCLUSAO_JUSTIFICATIVA,
  listarDestinatarios,
  listarJustificativas,
  paraData,
  removerJustificativa,
  vincularAnexos,
} from './justificativas.repositorio.js';

type JustificativaBruta = Prisma.justificativas_faltasGetPayload<{
  include: typeof INCLUSAO_JUSTIFICATIVA;
}>;

/** Dias civis são serializados em `yyyy-mm-dd` para não sofrer deslocamento de fuso. */
function dataCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function paraJustificativa(registro: JustificativaBruta): Justificativa {
  return {
    id: registro.id,
    responsavel_id: registro.responsavel_id,
    aluno_id: registro.aluno_id,
    frequencia_id: registro.frequencia_id,
    data_falta: dataCivil(registro.data_falta),
    data_fim: registro.data_fim ? dataCivil(registro.data_fim) : null,
    motivo: registro.motivo,
    status: registro.status,
    avaliado_por: registro.avaliado_por,
    avaliado_em: registro.avaliado_em?.toISOString() ?? null,
    parecer: registro.parecer,
    aluno: { id: registro.alunos.id, nome: registro.alunos.nome },
    responsavel: {
      id: registro.perfis_justificativas_faltas_responsavel_idToperfis.id,
      nome: registro.perfis_justificativas_faltas_responsavel_idToperfis.nome,
    },
    anexos: registro.justificativa_anexos.map((vinculo) => ({
      id: vinculo.anexos.id,
      nome_arquivo: vinculo.anexos.nome_arquivo,
      mime_type: vinculo.anexos.mime_type,
      storage_path: vinculo.anexos.storage_path,
    })),
    created_at: registro.created_at.toISOString(),
    updated_at: registro.updated_at.toISOString(),
  };
}

/** Notifica os responsáveis do aluno e a gestão ativa para invalidar os painéis. */
async function publicarAtualizacao(alunoId: string): Promise<void> {
  let destinatarios: string[] = [];
  try {
    destinatarios = await listarDestinatarios(alunoId);
  } catch {
    // Sem consulta de destinatários o evento vira broadcast para os autenticados.
  }
  publicarEvento({
    tabela: 'justificativas_faltas',
    ...(destinatarios.length ? { destinatarios } : {}),
  });
}

export async function listar(
  usuario: PerfilAutenticado,
  consulta: ListarJustificativas,
): Promise<Justificativa[]> {
  return comEscopo(async () => {
    const alunoIds = await idsDeAlunosVisiveis(usuario);
    const registros = await listarJustificativas({
      alunoIds,
      alunoId: consulta.aluno_id,
      status: consulta.status,
      dataInicio: consulta.data_inicio ? paraData(consulta.data_inicio) : undefined,
      dataFim: consulta.data_fim ? paraData(consulta.data_fim) : undefined,
      limite: consulta.limite,
      offset: consulta.offset,
    });
    return registros.map(paraJustificativa);
  });
}

export async function obter(usuario: PerfilAutenticado, id: string): Promise<Justificativa> {
  const registro = await buscarJustificativaPorId(id);
  if (!registro || !(await podeVerAluno(usuario, registro.aluno_id))) {
    // Fora do escopo responde 404 para não revelar a existência do registro.
    throw erroNaoEncontrado('Justificativa não encontrada.');
  }
  return paraJustificativa(registro);
}

/** Valida que todos os anexos existem e pertencem a quem está enviando (gestão dispensa posse). */
async function validarAnexos(usuario: PerfilAutenticado, anexoIds: string[]): Promise<void> {
  if (!anexoIds.length) return;

  const anexos = await buscarAnexosPorIds(anexoIds);
  const porId = new Map(anexos.map((anexo) => [anexo.id, anexo]));
  const invalido = anexoIds.some((anexoId) => {
    const anexo = porId.get(anexoId);
    if (!anexo) return true;
    return usuario.papel !== 'gestao' && anexo.criado_por !== usuario.id;
  });

  if (invalido) {
    throw erroValidacao('Um ou mais anexos são inválidos para este envio.');
  }
}

export async function criar(
  usuario: PerfilAutenticado,
  dados: CriarJustificativa,
): Promise<Justificativa> {
  await garantirAlunoVisivel(usuario, dados.aluno_id);

  if (dados.data_fim && dados.data_fim < dados.data_falta) {
    throw erroValidacao('A data final não pode ser anterior à data da falta.');
  }

  const anexoIds = [...new Set(dados.anexo_ids ?? [])];
  await validarAnexos(usuario, anexoIds);

  const criada = await criarJustificativa({
    responsavel_id: usuario.id,
    aluno_id: dados.aluno_id,
    data_falta: paraData(dados.data_falta),
    data_fim: dados.data_fim ? paraData(dados.data_fim) : null,
    motivo: dados.motivo,
  });

  if (anexoIds.length) {
    try {
      await vincularAnexos(criada.id, anexoIds);
    } catch (erro) {
      // Compensação: sem os vínculos a justificativa não pode ficar órfã.
      await removerJustificativa(criada.id).catch(() => undefined);
      throw erro;
    }
  }

  const registro = await buscarJustificativaPorId(criada.id);
  if (!registro) throw erroNaoEncontrado('Justificativa não encontrada.');

  await publicarAtualizacao(registro.aluno_id);
  return paraJustificativa(registro);
}

export async function avaliar(
  usuario: PerfilAutenticado,
  id: string,
  dados: AvaliarJustificativa,
): Promise<Justificativa> {
  const atualizada = await avaliarJustificativaPendente(id, usuario.id, dados.status, new Date());
  if (!atualizada) {
    const registro = await buscarJustificativaPorId(id);
    if (!registro) throw erroNaoEncontrado('Justificativa não encontrada.');
    throw new ErroHttp(
      409,
      'justificativa_ja_avaliada',
      'Esta justificativa já foi avaliada e não pode ser alterada.',
    );
  }

  // O trigger `trg_auto_justificar_frequencias` marca as ausências do período.
  await publicarAtualizacao(atualizada.aluno_id);
  return paraJustificativa(atualizada);
}
