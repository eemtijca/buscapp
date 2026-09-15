import { prisma } from '../../nucleo/banco/cliente.js';

const INCLUSAO_CONVERSA = {
  perfis: { select: { id: true, nome: true } },
  alunos: { select: { id: true, nome: true } },
  turmas: { select: { id: true, nome_completo: true } },
} as const;

const INCLUSAO_MENSAGEM = {
  perfis: { select: { id: true, nome: true, papel: true } },
} as const;

export interface FiltroConversas {
  responsavel_id?: string;
  turma_id?: { in: string[] };
}

export async function listarConversas(filtro: FiltroConversas) {
  return prisma.conversas.findMany({
    where: filtro,
    include: INCLUSAO_CONVERSA,
    orderBy: [{ ultima_mensagem_em: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
  });
}

export async function buscarConversaPorId(id: string) {
  return prisma.conversas.findUnique({ where: { id }, include: INCLUSAO_CONVERSA });
}

export async function buscarConversaPorPar(responsavelId: string, alunoId: string) {
  return prisma.conversas.findUnique({
    where: { responsavel_id_aluno_id: { responsavel_id: responsavelId, aluno_id: alunoId } },
    include: INCLUSAO_CONVERSA,
  });
}

export interface DadosNovaConversa {
  responsavel_id: string;
  aluno_id: string;
  turma_id: string;
  iniciada_pela_gestao: boolean;
}

export async function criarConversa(dados: DadosNovaConversa) {
  return prisma.conversas.create({ data: dados, include: INCLUSAO_CONVERSA });
}

export async function atualizarConversaAtiva(id: string, ativa: boolean) {
  return prisma.conversas.update({
    where: { id },
    data: { ativa, updated_at: new Date() },
    include: INCLUSAO_CONVERSA,
  });
}

export async function registrarMensagemNaConversa(conversaId: string, agora: Date) {
  return prisma.conversas.update({
    where: { id: conversaId },
    data: { ultima_mensagem_em: agora, ativa: true, updated_at: agora },
  });
}

export async function listarMensagens(conversaId: string) {
  return prisma.mensagens.findMany({
    where: { conversa_id: conversaId, deleted_at: null },
    include: INCLUSAO_MENSAGEM,
    orderBy: { created_at: 'asc' },
  });
}

export async function buscarMensagemPorClientRequestId(clientRequestId: string) {
  return prisma.mensagens.findUnique({
    where: { client_request_id: clientRequestId },
    include: INCLUSAO_MENSAGEM,
  });
}

export interface DadosNovaMensagem {
  conversa_id: string;
  remetente_id: string;
  conteudo: string;
  client_request_id: string | null;
}

export async function criarMensagem(dados: DadosNovaMensagem) {
  return prisma.mensagens.create({ data: dados, include: INCLUSAO_MENSAGEM });
}

export async function marcarMensagensLidas(
  conversaId: string,
  usuarioId: string,
  agora: Date,
): Promise<number> {
  const resultado = await prisma.mensagens.updateMany({
    where: {
      conversa_id: conversaId,
      remetente_id: { not: usuarioId },
      lida_em: null,
      deleted_at: null,
    },
    data: { lida_em: agora },
  });
  return resultado.count;
}

/** Última mensagem visível (não de sistema) de cada conversa, para a prévia da listagem. */
export async function ultimasMensagens(conversaIds: string[]) {
  if (!conversaIds.length) return [];
  return prisma.mensagens.findMany({
    where: {
      conversa_id: { in: conversaIds },
      deleted_at: null,
      is_system_message: false,
    },
    orderBy: { created_at: 'desc' },
    distinct: ['conversa_id'],
    select: { conversa_id: true, conteudo: true, created_at: true },
  });
}

/** Contagem de mensagens não lidas de cada conversa para o usuário informado. */
export async function contarNaoLidas(conversaIds: string[], usuarioId: string) {
  if (!conversaIds.length) return [];
  return prisma.mensagens.groupBy({
    by: ['conversa_id'],
    where: {
      conversa_id: { in: conversaIds },
      deleted_at: null,
      is_system_message: false,
      lida_em: null,
      remetente_id: { not: usuarioId },
    },
    _count: { _all: true },
  });
}

export async function buscarVinculoAtivo(responsavelId: string, alunoId: string) {
  return prisma.vinculos_responsaveis.findFirst({
    where: { responsavel_id: responsavelId, aluno_id: alunoId, ativo: true },
  });
}

export async function buscarContatoPrioritario(alunoId: string) {
  return prisma.vinculos_responsaveis.findFirst({
    where: { aluno_id: alunoId, ativo: true },
    orderBy: [{ contato_prioritario: 'desc' }, { created_at: 'asc' }],
  });
}

export async function buscarEnturmacaoAtiva(alunoId: string) {
  return prisma.enturmacoes.findFirst({
    where: { aluno_id: alunoId, status: 'matriculado' },
    orderBy: { created_at: 'desc' },
    select: { turma_id: true },
  });
}

export async function possuiAtribuicaoAtiva(professorId: string, turmaId: string) {
  const atribuicao = await prisma.atribuicoes_professores.findFirst({
    where: { professor_id: professorId, turma_id: turmaId, ativo: true },
    select: { id: true },
  });
  return Boolean(atribuicao);
}

export async function listarTurmasDoProfessor(professorId: string) {
  const atribuicoes = await prisma.atribuicoes_professores.findMany({
    where: { professor_id: professorId, ativo: true },
    select: { turma_id: true },
  });
  return atribuicoes.map((atribuicao) => atribuicao.turma_id);
}

export async function listarHorariosLetivos() {
  return prisma.horarios_letivos.findMany({
    orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }],
  });
}

export async function buscarMensagemForaHorario() {
  const configuracao = await prisma.configuracoes_sistema.findFirst({
    select: { mensagem_fora_horario: true },
  });
  return configuracao?.mensagem_fora_horario ?? null;
}
