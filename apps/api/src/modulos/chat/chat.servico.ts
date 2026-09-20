import type {
  AtualizarConversa,
  Conversa,
  CriarConversa,
  EnviarMensagem,
  Mensagem,
  PapelAutorMensagem,
} from '@buscapp/contratos';
import type { PerfilAutenticado } from '../../nucleo/autenticacao/tipos.js';
import { ambiente } from '../../ambiente.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { publicarEvento } from '../../nucleo/eventos/barramento.js';
import { partesNaEscola } from '../../nucleo/tempo/fuso.js';
import {
  ErroHttp,
  erroNaoAutorizado,
  erroNaoEncontrado,
  erroValidacao,
} from '../../nucleo/http/erros.js';
import {
  atualizarConversaAtiva,
  buscarContatoPrioritario,
  buscarConversaPorId,
  buscarConversaPorPar,
  buscarEnturmacaoAtiva,
  buscarMensagemForaHorario,
  buscarMensagemPorClientRequestId,
  buscarVinculoAtivo,
  contarNaoLidas,
  criarConversa,
  criarMensagem,
  listarConversas,
  listarHorariosLetivos,
  listarMensagens as buscarMensagens,
  listarTurmasDoProfessor,
  marcarMensagensLidas,
  possuiAtribuicaoAtiva,
  registrarMensagemNaConversa,
  ultimasMensagens,
} from './chat.repositorio.js';

const MENSAGEM_FORA_HORARIO_PADRAO =
  'O canal de diálogo está fora do horário escolar. Mensagens enviadas agora serão respondidas quando a coordenação estiver disponível.';

/** Janela escolar padrão quando não há nenhum horário cadastrado (espelha o frontend). */
const HORARIO_PADRAO = {
  inicio: 7 * 60,
  fim: 17 * 60,
  dias: [1, 2, 3, 4, 5],
};

export interface ConversaBruta {
  id: string;
  responsavel_id: string;
  aluno_id: string;
  turma_id: string;
  ativa: boolean;
  iniciada_pela_gestao: boolean;
  ultima_mensagem_em: Date | null;
  alunos: { id: string; nome: string };
  perfis: { id: string; nome: string };
  turmas: { id: string; nome_completo: string };
}

export interface MensagemBruta {
  id: string;
  conversa_id: string;
  remetente_id: string;
  conteudo: string;
  is_system_message: boolean;
  lida_em: Date | null;
  created_at: Date;
  perfis: { id: string; nome: string; papel: PapelAutorMensagem };
}

export interface HorarioBruto {
  dia_semana: number;
  hora_inicio: Date;
  hora_fim: Date;
  ativo: boolean;
}

interface UltimaMensagemBruta {
  conversa_id: string;
  conteudo: string;
  created_at: Date;
}

function erroDeChaveUnica(erro: unknown): boolean {
  const tipado = erro as { code?: string; cause?: { code?: string } };
  return tipado.cause?.code === 'P2002' || tipado.code === 'P2002';
}

/** Minutos do horário letivo armazenado (coluna `time` lida como 1970-01-01 em UTC). */
function minutosDoHorario(data: Date): number {
  return data.getUTCHours() * 60 + data.getUTCMinutes();
}

/**
 * Verifica se o horário atual no fuso da escola está dentro de alguma janela ativa.
 * Sem nenhum horário cadastrado assume a janela escolar padrão; com janelas cadastradas
 * mas todas inativas o canal fica sempre bloqueado.
 */
export function horarioPermitido(
  horarios: HorarioBruto[],
  agora: Date = new Date(),
  fuso: string = ambiente.TZ_ESCOLA,
): boolean {
  const { diaSemana, minutos } = partesNaEscola(agora, fuso);

  if (!horarios.length) {
    return (
      HORARIO_PADRAO.dias.includes(diaSemana) &&
      minutos >= HORARIO_PADRAO.inicio &&
      minutos <= HORARIO_PADRAO.fim
    );
  }

  return horarios.some(
    (horario) =>
      horario.ativo &&
      horario.dia_semana === diaSemana &&
      minutos >= minutosDoHorario(horario.hora_inicio) &&
      minutos <= minutosDoHorario(horario.hora_fim),
  );
}

function paraConversa(
  conversa: ConversaBruta,
  ultima: UltimaMensagemBruta | null,
  naoLidas: number,
): Conversa {
  return {
    id: conversa.id,
    responsavel: { id: conversa.perfis.id, nome: conversa.perfis.nome },
    aluno: { id: conversa.alunos.id, nome: conversa.alunos.nome },
    turma: { id: conversa.turmas.id, nome_completo: conversa.turmas.nome_completo },
    ultima_mensagem_em: conversa.ultima_mensagem_em?.toISOString() ?? null,
    ultima_mensagem: ultima
      ? { conteudo: ultima.conteudo, created_at: ultima.created_at.toISOString() }
      : null,
    nao_lidas: naoLidas,
    ativa: conversa.ativa,
    iniciada_pela_gestao: conversa.iniciada_pela_gestao,
  };
}

function paraMensagem(mensagem: MensagemBruta): Mensagem {
  return {
    id: mensagem.id,
    conversa_id: mensagem.conversa_id,
    remetente_id: mensagem.remetente_id,
    autor: {
      id: mensagem.perfis.id,
      nome: mensagem.perfis.nome,
      papel: mensagem.perfis.papel,
    },
    conteudo: mensagem.conteudo,
    is_system_message: mensagem.is_system_message,
    lida_em: mensagem.lida_em?.toISOString() ?? null,
    created_at: mensagem.created_at.toISOString(),
  };
}

/** Enriquece conversas com a prévia da última mensagem e a contagem de não lidas do usuário. */
async function hidratar(conversas: ConversaBruta[], usuarioId: string): Promise<Conversa[]> {
  if (!conversas.length) return [];

  const ids = conversas.map((conversa) => conversa.id);
  const [ultimas, contagens] = await Promise.all([
    ultimasMensagens(ids),
    contarNaoLidas(ids, usuarioId),
  ]);

  const mapaUltimas = new Map(ultimas.map((mensagem) => [mensagem.conversa_id, mensagem]));
  const mapaContagens = new Map(contagens.map((item) => [item.conversa_id, item._count._all]));

  return conversas.map((conversa) =>
    paraConversa(
      conversa,
      mapaUltimas.get(conversa.id) ?? null,
      mapaContagens.get(conversa.id) ?? 0,
    ),
  );
}

/** Participantes da conversa (responsável, gestão ativa e professores da turma). */
async function destinatariosDaConversa(conversa: ConversaBruta): Promise<string[]> {
  const [gestao, professores] = await Promise.all([
    prisma.perfis.findMany({
      where: { papel: 'gestao', status: 'ativo' },
      select: { id: true },
    }),
    prisma.atribuicoes_professores.findMany({
      where: { turma_id: conversa.turma_id, ativo: true },
      select: { professor_id: true },
    }),
  ]);

  return [
    ...new Set([
      conversa.responsavel_id,
      ...gestao.map((perfil) => perfil.id),
      ...professores.map((atribuicao) => atribuicao.professor_id),
    ]),
  ];
}

async function participa(usuario: PerfilAutenticado, conversa: ConversaBruta): Promise<boolean> {
  if (usuario.papel === 'gestao') return true;
  if (usuario.papel === 'responsavel') return conversa.responsavel_id === usuario.id;
  return possuiAtribuicaoAtiva(usuario.id, conversa.turma_id);
}

async function garantirParticipacao(
  usuario: PerfilAutenticado,
  conversa: ConversaBruta,
): Promise<void> {
  // Fora do escopo responde 404 para não revelar a existência da conversa.
  if (!(await participa(usuario, conversa))) throw erroNaoEncontrado('Conversa não encontrada.');
}

async function garantirHorarioDoResponsavel(): Promise<void> {
  const horarios = await listarHorariosLetivos();
  if (horarioPermitido(horarios)) return;

  const mensagem = await buscarMensagemForaHorario();
  throw new ErroHttp(403, 'fora_horario', mensagem ?? MENSAGEM_FORA_HORARIO_PADRAO);
}

async function resolverResponsavel(
  usuario: PerfilAutenticado,
  dados: CriarConversa,
): Promise<string> {
  if (usuario.papel === 'gestao') {
    if (dados.responsavel_id) return dados.responsavel_id;
    const contato = await buscarContatoPrioritario(dados.aluno_id);
    if (!contato) throw erroValidacao('O aluno não possui responsável vinculado.');
    return contato.responsavel_id;
  }

  if (usuario.papel !== 'responsavel') {
    throw erroNaoAutorizado('Apenas gestão e responsáveis podem iniciar conversas.');
  }

  if (dados.responsavel_id && dados.responsavel_id !== usuario.id) {
    throw erroNaoAutorizado('Você só pode iniciar conversas em seu próprio nome.');
  }

  const vinculo = await buscarVinculoAtivo(usuario.id, dados.aluno_id);
  if (!vinculo) throw erroNaoAutorizado('Aluno fora do seu escopo de acesso.');

  return usuario.id;
}

export async function listar(usuario: PerfilAutenticado): Promise<Conversa[]> {
  const filtro =
    usuario.papel === 'gestao'
      ? {}
      : usuario.papel === 'responsavel'
        ? { responsavel_id: usuario.id }
        : { turma_id: { in: await listarTurmasDoProfessor(usuario.id) } };

  const conversas = await listarConversas(filtro);
  return hidratar(conversas, usuario.id);
}

export interface ResultadoCriacaoConversa {
  conversa: Conversa;
  criada: boolean;
}

/** Retorna a conversa existente do par (responsável, aluno) ou cria uma nova. */
export async function criar(
  usuario: PerfilAutenticado,
  dados: CriarConversa,
): Promise<ResultadoCriacaoConversa> {
  const responsavelId = await resolverResponsavel(usuario, dados);

  const existente = await buscarConversaPorPar(responsavelId, dados.aluno_id);
  if (existente) {
    const [conversa] = await hidratar([existente], usuario.id);
    return { conversa: conversa!, criada: false };
  }

  const enturmacao = await buscarEnturmacaoAtiva(dados.aluno_id);
  if (!enturmacao) {
    throw erroValidacao('O aluno não possui enturmação ativa em nenhuma turma.');
  }

  try {
    const nova = await criarConversa({
      responsavel_id: responsavelId,
      aluno_id: dados.aluno_id,
      turma_id: enturmacao.turma_id,
      iniciada_pela_gestao: usuario.papel === 'gestao',
    });
    publicarEvento({ tabela: 'conversas' });
    return { conversa: paraConversa(nova, null, 0), criada: true };
  } catch (erro) {
    if (erroDeChaveUnica(erro)) {
      // Corrida com outro pedido: devolve a conversa criada concorrentemente.
      const concorrente = await buscarConversaPorPar(responsavelId, dados.aluno_id);
      if (concorrente) {
        const [conversa] = await hidratar([concorrente], usuario.id);
        return { conversa: conversa!, criada: false };
      }
    }
    throw erro;
  }
}

export async function listarMensagens(
  usuario: PerfilAutenticado,
  conversaId: string,
): Promise<Mensagem[]> {
  const conversa = await buscarConversaPorId(conversaId);
  if (!conversa) throw erroNaoEncontrado('Conversa não encontrada.');

  await garantirParticipacao(usuario, conversa);
  const mensagens = await buscarMensagens(conversaId);
  return mensagens.map(paraMensagem);
}

export interface ResultadoEnvioMensagem {
  mensagem: Mensagem;
  criada: boolean;
}

export async function enviarMensagem(
  usuario: PerfilAutenticado,
  conversaId: string,
  dados: EnviarMensagem,
): Promise<ResultadoEnvioMensagem> {
  const conversa = await buscarConversaPorId(conversaId);
  if (!conversa) throw erroNaoEncontrado('Conversa não encontrada.');

  await garantirParticipacao(usuario, conversa);

  if (dados.client_request_id) {
    const existente = await buscarMensagemPorClientRequestId(dados.client_request_id);
    if (existente) {
      if (existente.remetente_id !== usuario.id) {
        throw new ErroHttp(409, 'mensagem_duplicada', 'Identificador de mensagem já utilizado.');
      }
      return { mensagem: paraMensagem(existente), criada: false };
    }
  }

  // O horário protegido vale apenas para o responsável; gestão e professores enviam a qualquer hora.
  if (usuario.papel === 'responsavel') await garantirHorarioDoResponsavel();

  try {
    const mensagem = await criarMensagem({
      conversa_id: conversaId,
      remetente_id: usuario.id,
      conteudo: dados.conteudo,
      client_request_id: dados.client_request_id ?? null,
    });

    await registrarMensagemNaConversa(conversaId, new Date());

    const destinatarios = await destinatariosDaConversa(conversa);
    publicarEvento({ tabela: 'mensagens', escopo: { conversa_id: conversaId }, destinatarios });
    publicarEvento({ tabela: 'conversas', destinatarios });

    return { mensagem: paraMensagem(mensagem), criada: true };
  } catch (erro) {
    if (erroDeChaveUnica(erro) && dados.client_request_id) {
      // O trigger do banco já garante a unicidade; aqui devolvemos a mensagem vencedora.
      const existente = await buscarMensagemPorClientRequestId(dados.client_request_id);
      if (existente && existente.remetente_id === usuario.id) {
        return { mensagem: paraMensagem(existente), criada: false };
      }
    }
    throw erro;
  }
}

export async function marcarLidas(usuario: PerfilAutenticado, conversaId: string): Promise<number> {
  const conversa = await buscarConversaPorId(conversaId);
  if (!conversa) throw erroNaoEncontrado('Conversa não encontrada.');

  await garantirParticipacao(usuario, conversa);

  const atualizadas = await marcarMensagensLidas(conversaId, usuario.id, new Date());
  if (atualizadas > 0) {
    publicarEvento({
      tabela: 'mensagens',
      escopo: { conversa_id: conversaId },
      destinatarios: await destinatariosDaConversa(conversa),
    });
  }
  return atualizadas;
}

/** Oculta ou reexibe uma conversa para os participantes (e para a gestão). */
export async function atualizar(
  usuario: PerfilAutenticado,
  conversaId: string,
  dados: AtualizarConversa,
): Promise<Conversa> {
  const conversa = await buscarConversaPorId(conversaId);
  if (!conversa) throw erroNaoEncontrado('Conversa não encontrada.');

  await garantirParticipacao(usuario, conversa);

  const atualizada = await atualizarConversaAtiva(conversaId, dados.ativa);
  publicarEvento({ tabela: 'conversas', destinatarios: await destinatariosDaConversa(conversa) });

  const [hidratada] = await hidratar([atualizada], usuario.id);
  return hidratada!;
}
