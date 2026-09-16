import { requisitar, type OpcoesRequisicao } from './api';
import type { OpcoesConsulta, ResultadoFetcher } from './cache';
import type {
  AnoLetivo,
  Aluno,
  ConfiguracaoSistema,
  Disciplina,
  HorarioLetivo,
  OpcaoConfiguracao,
  Perfil,
  TagComportamento,
  Turma,
} from '@/tipos/database';
import type {
  AtribuicaoApi,
  ConversaApi,
  CodigoApi,
  EnturmacaoApi,
  JustificativaApi,
  MensagemApi,
  OcorrenciaApi,
  RegistroComportamentoApi,
  RespostaFrequencias,
  UsuarioApi,
  VinculoApi,
} from '@/tipos/api';
import type { Notificacao } from '@/tipos/database';

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

export const TEMPOS = {
  referencia: 5 * MINUTO,
  listas: MINUTO,
  operacional: 15_000,
  chat: 10_000,
} as const;

const TTL_REFERENCIA = 30 * DIA;
const TTL_LISTAS = 7 * DIA;

/** Serializa os parâmetros em uma chave estável, ignorando valores vazios. */
export function chaveConsulta(
  base: string,
  parametros?: Record<string, string | number | boolean | string[] | undefined | null>,
): string {
  if (!parametros) return base;

  const entradas = Object.entries(parametros)
    .filter(([, valor]) => {
      if (valor === undefined || valor === null || valor === '') return false;
      if (Array.isArray(valor) && valor.length === 0) return false;
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  if (!entradas.length) return base;
  return `${base}:${JSON.stringify(entradas)}`;
}

async function buscar<T>(
  caminho: string,
  parametros?: OpcoesRequisicao['parametros'],
  etagAtual?: string | null,
): Promise<ResultadoFetcher<T>> {
  const resposta = await requisitar<T>(caminho, { parametros, ifNoneMatch: etagAtual });
  if (resposta.naoModificado) {
    return { dados: undefined as T, etag: resposta.etag, naoModificado: true };
  }
  return { dados: resposta.dados, etag: resposta.etag };
}

/** Catálogo único de chaves, políticas de frescor e tabelas de invalidação. */
export const Consultas = {
  authMe: (): OpcoesConsulta<{ perfil: Perfil | null }> => ({
    chave: 'auth/me',
    namespace: 'sessao',
    staleTime: MINUTO,
    persistir: true,
    ttl: TTL_REFERENCIA,
    tabelas: ['perfis'],
    executar: (etag) => buscar('/api/auth/me', undefined, etag),
  }),

  configuracoes: (): OpcoesConsulta<{ configuracao: ConfiguracaoSistema }> => ({
    chave: 'configuracoes',
    staleTime: TEMPOS.referencia,
    persistir: true,
    ttl: TTL_REFERENCIA,
    tabelas: ['configuracoes_sistema'],
    executar: (etag) => buscar('/api/configuracoes', undefined, etag),
  }),

  horarios: (): OpcoesConsulta<{ horarios: HorarioLetivo[] }> => ({
    chave: 'horarios',
    staleTime: TEMPOS.referencia,
    persistir: true,
    ttl: TTL_REFERENCIA,
    tabelas: ['horarios_letivos'],
    executar: (etag) => buscar('/api/horarios', undefined, etag),
  }),

  opcoes: (tipo: string): OpcoesConsulta<{ opcoes: OpcaoConfiguracao[] }> => ({
    chave: chaveConsulta('opcoes', { tipo, ativo: 'true' }),
    staleTime: TEMPOS.referencia,
    persistir: true,
    ttl: TTL_REFERENCIA,
    tabelas: ['opcoes_configuracao'],
    executar: (etag) => buscar('/api/opcoes', { tipo, ativo: 'true' }, etag),
  }),

  tags: (): OpcoesConsulta<{ tags: TagComportamento[] }> => ({
    chave: 'tags-comportamento',
    staleTime: TEMPOS.referencia,
    persistir: true,
    ttl: TTL_REFERENCIA,
    tabelas: ['tags_comportamento'],
    executar: (etag) => buscar('/api/tags-comportamento', undefined, etag),
  }),

  turmas: (
    parametros?: Record<string, string | undefined>,
  ): OpcoesConsulta<{ turmas: Turma[] }> => ({
    chave: chaveConsulta('turmas', parametros),
    staleTime: TEMPOS.referencia,
    persistir: true,
    ttl: TTL_REFERENCIA,
    tabelas: ['turmas'],
    executar: (etag) => buscar('/api/turmas', parametros, etag),
  }),

  disciplinas: (
    parametros?: Record<string, string | undefined>,
  ): OpcoesConsulta<{ disciplinas: Disciplina[] }> => ({
    chave: chaveConsulta('disciplinas', parametros),
    staleTime: TEMPOS.referencia,
    persistir: true,
    ttl: TTL_REFERENCIA,
    tabelas: ['disciplinas'],
    executar: (etag) => buscar('/api/disciplinas', parametros, etag),
  }),

  anosLetivos: (): OpcoesConsulta<{ anos_letivos: AnoLetivo[] }> => ({
    chave: 'anos-letivos',
    staleTime: TEMPOS.referencia,
    persistir: true,
    ttl: TTL_REFERENCIA,
    tabelas: ['anos_letivos'],
    executar: (etag) => buscar('/api/anos-letivos', undefined, etag),
  }),

  atribuicoes: (
    parametros?: Record<string, string | undefined>,
  ): OpcoesConsulta<{ atribuicoes: AtribuicaoApi[] }> => ({
    chave: chaveConsulta('atribuicoes', parametros),
    staleTime: TEMPOS.listas,
    tabelas: ['atribuicoes_professores'],
    executar: (etag) => buscar('/api/atribuicoes', parametros, etag),
  }),

  alunos: (
    parametros?: Record<string, string | undefined>,
  ): OpcoesConsulta<{ alunos: Aluno[] }> => ({
    chave: chaveConsulta('alunos', parametros),
    staleTime: TEMPOS.listas,
    persistir: true,
    ttl: TTL_LISTAS,
    tabelas: ['alunos', 'enturmacoes', 'vinculos_responsaveis'],
    executar: (etag) => buscar('/api/alunos', parametros, etag),
  }),

  enturmacoes: (
    parametros?: Record<string, string | undefined>,
  ): OpcoesConsulta<{ enturmacoes: EnturmacaoApi[] }> => ({
    chave: chaveConsulta('enturmacoes', parametros),
    staleTime: TEMPOS.listas,
    persistir: true,
    ttl: TTL_LISTAS,
    tabelas: ['enturmacoes', 'turmas'],
    executar: (etag) => buscar('/api/enturmacoes', parametros, etag),
  }),

  usuarios: (
    parametros?: Record<string, string | undefined>,
  ): OpcoesConsulta<{ usuarios: UsuarioApi[] }> => ({
    chave: chaveConsulta('usuarios', parametros),
    staleTime: TEMPOS.listas,
    tabelas: ['perfis'],
    executar: (etag) => buscar('/api/usuarios', parametros, etag),
  }),

  vinculos: (
    parametros?: Record<string, string | undefined>,
  ): OpcoesConsulta<{ vinculos: VinculoApi[] }> => ({
    chave: chaveConsulta('vinculos', parametros),
    staleTime: TEMPOS.listas,
    tabelas: ['vinculos_responsaveis'],
    executar: (etag) => buscar('/api/vinculos', parametros, etag),
  }),

  frequencias: (
    parametros: Record<string, string | string[] | undefined>,
  ): OpcoesConsulta<RespostaFrequencias> => ({
    chave: chaveConsulta('frequencias', parametros),
    staleTime: TEMPOS.operacional,
    tabelas: ['frequencias'],
    executar: (etag) => buscar('/api/frequencias', parametros, etag),
  }),

  ocorrencias: (
    parametros?: Record<string, string | undefined>,
  ): OpcoesConsulta<{ ocorrencias: OcorrenciaApi[] }> => ({
    chave: chaveConsulta('ocorrencias', parametros),
    staleTime: TEMPOS.operacional,
    tabelas: ['ocorrencias'],
    executar: (etag) => buscar('/api/ocorrencias', parametros, etag),
  }),

  justificativas: (
    parametros?: Record<string, string | undefined>,
  ): OpcoesConsulta<{ justificativas: JustificativaApi[] }> => ({
    chave: chaveConsulta('justificativas', parametros),
    staleTime: TEMPOS.operacional,
    tabelas: ['justificativas_faltas'],
    executar: (etag) => buscar('/api/justificativas', parametros, etag),
  }),

  registrosComportamento: (
    parametros: Record<string, string | undefined>,
  ): OpcoesConsulta<{ registros: RegistroComportamentoApi[] }> => ({
    chave: chaveConsulta('registros-comportamento', parametros),
    staleTime: TEMPOS.operacional,
    tabelas: ['registros_comportamento'],
    executar: (etag) => buscar('/api/registros-comportamento', parametros, etag),
  }),

  conversas: (): OpcoesConsulta<{ conversas: ConversaApi[] }> => ({
    chave: 'conversas',
    staleTime: TEMPOS.operacional,
    tabelas: ['conversas', 'mensagens'],
    executar: (etag) => buscar('/api/conversas', undefined, etag),
  }),

  mensagens: (conversaId: string): OpcoesConsulta<{ mensagens: MensagemApi[] }> => ({
    chave: chaveConsulta('mensagens', { conversaId }),
    staleTime: TEMPOS.chat,
    escopo: { conversa_id: conversaId },
    tabelas: ['mensagens'],
    executar: (etag) => buscar(`/api/conversas/${conversaId}/mensagens`, undefined, etag),
  }),

  notificacoes: (
    parametros?: Record<string, string | number | undefined>,
  ): OpcoesConsulta<{ notificacoes: Notificacao[]; nao_lidas: number }> => ({
    chave: chaveConsulta('notificacoes', parametros),
    staleTime: TEMPOS.operacional,
    persistir: true,
    ttl: TTL_LISTAS,
    tabelas: ['notificacoes'],
    executar: (etag) => buscar('/api/notificacoes', parametros, etag),
  }),

  codigos: (): OpcoesConsulta<{ codigos: CodigoApi[] }> => ({
    chave: 'codigos',
    staleTime: TEMPOS.operacional,
    tabelas: ['codigos_redefinicao'],
    executar: (etag) => buscar('/api/codigos', undefined, etag),
  }),
};
