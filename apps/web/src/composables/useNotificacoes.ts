import { ref, type Ref } from 'vue';
import { api } from '@/servicos/api';
import { inscreverEventos } from '@/servicos/eventos';
import { timestampRelativo } from '@/utils/chatUtils';
import type { Notificacao } from '@/tipos/database';
import type { NotificacaoItem } from '@/tipos/componentes';
import { useAutenticacao } from '@/composables/useAutenticacao';

const naoLidasMensagens: Ref<number> = ref(0);
const naoLidasOutros: Ref<number> = ref(0);
const notificacoes: Ref<NotificacaoItem[]> = ref([]);
const carregando: Ref<boolean> = ref(false);

const ATRASO_DEBOUNCE_MS = 500;
const INTERVALO_POLLING_MS = 30_000;
const LIMITE_NOTIFICACOES = 20;

interface RespostaNotificacoes {
  notificacoes: Notificacao[];
  nao_lidas: number;
}

let usuarioId: string | null = null;
let timerRecarga: ReturnType<typeof setTimeout> | null = null;
let timerPolling: ReturnType<typeof setInterval> | null = null;
let cancelarEventos: (() => void) | null = null;
let ouvinteVisibilidadeRegistrado = false;

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

/** Obtém o papel do usuário logado para roteamento de notificações (Opção A). */
function obterPapel(): string | undefined {
  const usuario = useAutenticacao().usuario.value;
  if (usuario?.papel) return usuario.papel;
  return undefined;
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
    // Professor não tem chat; cai no home
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
    if (papel === 'professor') return `/professor`;
    return `/gestao/justificativas${qsAluno}`;
  }
  if (tipo === 'codigo_redefinicao') return '/gestao/codigos';
  return papel ? `/${papel}` : '/';
}

async function carregar() {
  if (!usuarioId) return;
  carregando.value = true;
  try {
    const resposta = await api<RespostaNotificacoes>('/api/notificacoes', {
      parametros: { limite: LIMITE_NOTIFICACOES },
    });

    const itens: NotificacaoItem[] = resposta.notificacoes.map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      corpo: n.corpo,
      tempoRelativo: timestampRelativo(n.created_at),
      lida: n.lida,
      rota: rotaPorTipo(n.tipo, n.metadados),
    }));

    const naoLidas = itens.filter((n) => !n.lida);
    if (resposta.nao_lidas === 0) {
      naoLidasMensagens.value = 0;
      naoLidasOutros.value = 0;
    } else {
      naoLidasMensagens.value = naoLidas.filter((n) => n.tipo === 'mensagem').length;
      naoLidasOutros.value = naoLidas.filter((n) => n.tipo !== 'mensagem').length;
    }
    notificacoes.value = itens.filter((n) => n.tipo !== 'mensagem');
  } catch {
    /* Falha transitória: o SSE e o polling de segurança tentam novamente. */
  } finally {
    carregando.value = false;
  }
}

function recarregarDebounced() {
  if (!usuarioId || timerRecarga) return;
  timerRecarga = setTimeout(() => {
    timerRecarga = null;
    void carregar();
  }, ATRASO_DEBOUNCE_MS);
}

function aoMudarVisibilidade() {
  if (document.visibilityState === 'visible' && usuarioId) {
    void carregar();
  }
}

function cancelarInscricoes() {
  if (timerRecarga) {
    clearTimeout(timerRecarga);
    timerRecarga = null;
  }
  if (timerPolling) {
    clearInterval(timerPolling);
    timerPolling = null;
  }
  if (cancelarEventos) {
    cancelarEventos();
    cancelarEventos = null;
  }
}

async function iniciar(userId: string) {
  if (cancelarEventos && usuarioId === userId) return;

  cancelarInscricoes();
  usuarioId = userId;

  if (!ouvinteVisibilidadeRegistrado && typeof document !== 'undefined') {
    ouvinteVisibilidadeRegistrado = true;
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
  }

  await carregar();

  // Atualização em tempo real por SSE mais polling de segurança.
  cancelarEventos = inscreverEventos((tabela) => {
    if (tabela === 'notificacoes') recarregarDebounced();
  });
  timerPolling = setInterval(() => {
    if (usuarioId) void carregar();
  }, INTERVALO_POLLING_MS);
}

function parar() {
  cancelarInscricoes();
  usuarioId = null;
  naoLidasMensagens.value = 0;
  naoLidasOutros.value = 0;
  notificacoes.value = [];
}

async function marcarTodasComoLidas() {
  if (!usuarioId) return;
  try {
    await api('/api/notificacoes/lidas', { metodo: 'PATCH' });
  } catch {
    /* A recarga abaixo reconcilia o estado real. */
  }
  await carregar();
}

async function limparTodas() {
  if (!usuarioId) return;
  try {
    await api('/api/notificacoes', { metodo: 'DELETE' });
  } catch {
    /* A recarga abaixo reconcilia o estado real. */
  }
  await carregar();
}

async function marcarLida(id: string) {
  try {
    await api(`/api/notificacoes/${id}/lida`, { metodo: 'PATCH' });
  } catch {
    /* A recarga abaixo reconcilia o estado real. */
  }
  await carregar();
}

/** Limpa as notificações de mensagem de uma conversa lida; a API propaga o restante. */
async function marcarNotificacoesConversaLidas(conversaId: string) {
  if (!usuarioId) return;
  try {
    await api(`/api/notificacoes/conversa/${conversaId}/lidas`, { metodo: 'PATCH' });
  } catch {
    /* A recarga abaixo reconcilia o estado real. */
  }
  await carregar();
}

export function useNotificacoes() {
  return {
    naoLidasMensagens,
    naoLidasOutros,
    notificacoes,
    carregando,
    iniciar,
    parar,
    carregar,
    marcarTodasComoLidas,
    limparTodas,
    marcarLida,
    marcarNotificacoesConversaLidas,
    ICONE_TIPO,
  };
}
