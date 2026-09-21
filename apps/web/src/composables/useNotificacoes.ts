import { ref, type Ref } from 'vue';
import { api } from '@/servicos/api';
import { Consultas } from '@/servicos/consultas';
import {
  invalidarChave,
  observar,
  recarregar,
  tempoRealAtivo,
  type SnapshotConsulta,
} from '@/servicos/cache';
import { timestampRelativo } from '@/utils/chatUtils';
import type { Notificacao } from '@/tipos/database';
import type { NotificacaoItem } from '@/tipos/componentes';
import { useAutenticacao } from '@/composables/useAutenticacao';

const naoLidasMensagens: Ref<number> = ref(0);
const naoLidasOutros: Ref<number> = ref(0);
const notificacoes: Ref<NotificacaoItem[]> = ref([]);
const carregando: Ref<boolean> = ref(false);

const INTERVALO_POLLING_MS = 30_000;
const LIMITE_NOTIFICACOES = 20;

let usuarioId: string | null = null;
let timerPolling: ReturnType<typeof setInterval> | null = null;
let cancelarObservacao: (() => void) | null = null;

const OPCOES = Consultas.notificacoes({ limite: LIMITE_NOTIFICACOES });

const ICONE_TIPO: Record<string, string> = {
  mensagem: 'chat-dots',
  ausencia_portao: 'door-open',
  ausencia_aula: 'book-x',
  monitoramento: 'person-lines-fill',
  ocorrencia: 'shield-exclamation',
  justificativa: 'clipboard-check',
  sistema: 'gear',
  codigo_redefinicao: 'key',
};

/** Obtém o papel do usuário logado para roteamento de notificações. */
function obterPapel(): string | undefined {
  const usuario = useAutenticacao().usuario.value;
  return usuario?.papel ?? undefined;
}

function rotaPorTipo(tipo: string, metadados?: Record<string, unknown> | null): string {
  const papel = obterPapel();
  const alunoId = (metadados?.aluno_id as string | undefined) ?? null;
  const conversaId = (metadados?.conversa_id as string | undefined) ?? null;
  const qsAluno = alunoId ? `?aluno=${alunoId}` : '';
  const qsConversa = conversaId ? `?conversa=${conversaId}` : '';

  if (tipo === 'mensagem') {
    if (papel === 'responsavel') return `/responsavel/chat${qsConversa}`;
    if (papel === 'gestao') return `/gestao/chat${qsConversa}`;
    return papel ? `/${papel}` : '/';
  }
  if (tipo === 'ausencia_portao' || tipo === 'ausencia_aula' || tipo === 'monitoramento') {
    if (papel === 'responsavel') return `/responsavel/alertas${qsAluno}`;
    if (papel === 'professor') return `/professor/frequencia${qsAluno}`;
    return `/gestao/ranking${qsAluno}`;
  }
  if (tipo === 'ocorrencia') {
    if (papel === 'responsavel') return `/responsavel/alertas${qsAluno}`;
    if (papel === 'professor') return `/professor/ocorrencia${qsAluno}`;
    return `/gestao/ocorrencias${qsAluno}`;
  }
  if (tipo === 'justificativa') {
    if (papel === 'responsavel') return `/responsavel/justificativa${qsAluno}`;
    if (papel === 'professor') return '/professor';
    return `/gestao/justificativas${qsAluno}`;
  }
  if (tipo === 'codigo_redefinicao') return '/gestao/codigos';
  return papel ? `/${papel}` : '/';
}

function aplicar(
  estado: SnapshotConsulta<{ notificacoes: Notificacao[]; nao_lidas: number }>,
): void {
  const lista = estado.dados?.notificacoes ?? [];

  const itens: NotificacaoItem[] = lista.map((notificacao) => ({
    id: notificacao.id,
    tipo: notificacao.tipo,
    titulo: notificacao.titulo,
    corpo: notificacao.corpo,
    tempoRelativo: timestampRelativo(notificacao.created_at),
    lida: notificacao.lida,
    rota: rotaPorTipo(notificacao.tipo, notificacao.metadados),
  }));

  const naoLidas = itens.filter((item) => !item.lida);
  if ((estado.dados?.nao_lidas ?? 0) === 0) {
    naoLidasMensagens.value = 0;
    naoLidasOutros.value = 0;
  } else {
    naoLidasMensagens.value = naoLidas.filter((item) => item.tipo === 'mensagem').length;
    naoLidasOutros.value = naoLidas.filter((item) => item.tipo !== 'mensagem').length;
  }

  notificacoes.value = itens.filter((item) => item.tipo !== 'mensagem');
  carregando.value = estado.pendente || estado.atualizando;
}

async function iniciar(userId: string): Promise<void> {
  if (cancelarObservacao && usuarioId === userId) return;

  parar();
  usuarioId = userId;

  cancelarObservacao = observar(OPCOES, aplicar);
  // O cache já recebe o SSE de `notificacoes`; o polling cobre instâncias sem barramento.
  // Com o stream ativo ou a aba oculta, o polling é dispensável.
  timerPolling = setInterval(() => {
    if (!usuarioId || document.hidden || tempoRealAtivo()) return;
    void recarregar(OPCOES.chave, true);
  }, INTERVALO_POLLING_MS);
  document.addEventListener('visibilitychange', aoVoltarParaAba);

  await recarregar(OPCOES.chave);
}

/** Ao voltar para a aba, revalida uma vez para não exibir dados parados. */
function aoVoltarParaAba(): void {
  if (document.hidden || !usuarioId) return;
  void recarregar(OPCOES.chave, true);
}

function parar(): void {
  if (timerPolling) {
    clearInterval(timerPolling);
    timerPolling = null;
  }
  document.removeEventListener('visibilitychange', aoVoltarParaAba);
  if (cancelarObservacao) {
    cancelarObservacao();
    cancelarObservacao = null;
  }
  usuarioId = null;
  naoLidasMensagens.value = 0;
  naoLidasOutros.value = 0;
  notificacoes.value = [];
  carregando.value = false;
}

async function marcarTodasComoLidas(): Promise<void> {
  try {
    await api('/api/notificacoes/lidas', { metodo: 'PATCH' });
  } catch {
    /* A invalidação abaixo reconcilia o estado real. */
  }
  invalidarChave('notificacoes');
}

async function limparTodas(): Promise<void> {
  try {
    await api('/api/notificacoes', { metodo: 'DELETE' });
  } catch {
    /* A invalidação abaixo reconcilia o estado real. */
  }
  invalidarChave('notificacoes');
}

async function marcarLida(id: string): Promise<void> {
  try {
    await api(`/api/notificacoes/${id}/lida`, { metodo: 'PATCH' });
  } catch {
    /* A invalidação abaixo reconcilia o estado real. */
  }
  invalidarChave('notificacoes');
}

/** Limpa as notificações de mensagem de uma conversa lida; a API propaga o restante. */
async function marcarNotificacoesConversaLidas(conversaId: string): Promise<void> {
  if (!usuarioId) return;
  try {
    await api(`/api/notificacoes/conversa/${conversaId}/lidas`, { metodo: 'PATCH' });
  } catch {
    /* A invalidação abaixo reconcilia o estado real. */
  }
  invalidarChave('notificacoes');
}

export function useNotificacoes() {
  return {
    naoLidasMensagens,
    naoLidasOutros,
    notificacoes,
    carregando,
    iniciar,
    parar,
    carregar: () => recarregar(OPCOES.chave, true),
    marcarTodasComoLidas,
    limparTodas,
    marcarLida,
    marcarNotificacoesConversaLidas,
    ICONE_TIPO,
  };
}
