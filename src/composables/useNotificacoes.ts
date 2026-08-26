import { ref, type Ref } from 'vue';
import { supabaseClient } from '@/servicos/supabase';
import { timestampRelativo } from '@/utils/chatUtils';
import type { Notificacao } from '@/tipos/database';
import type { NotificacaoItem } from '@/tipos/componentes';

const naoLidasMensagens: Ref<number> = ref(0);
const naoLidasOutros: Ref<number> = ref(0);
const notificacoes: Ref<NotificacaoItem[]> = ref([]);
const carregando: Ref<boolean> = ref(false);

const ATRASO_DEBOUNCE_MS = 500;
const ATRASO_MAXIMO_RECONEXAO_MS = 15000;

let canal: ReturnType<typeof supabaseClient.channel> | null = null;
let usuarioId: string | null = null;
let timerRecarga: ReturnType<typeof setTimeout> | null = null;
let timerReconexao: ReturnType<typeof setTimeout> | null = null;
let tentativasReconexao = 0;
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

function rotaPorTipo(tipo: string, _metadados?: Record<string, unknown> | null): string {
  const papel = (window as unknown as Record<string, unknown>).__papel__ as string | undefined;
  if (tipo === 'mensagem') {
    if (papel === 'responsavel') return '/responsavel/chat';
    if (papel === 'gestao') return '/gestao/chat';
  }
  if (tipo === 'ausencia_portao' || tipo === 'ausencia_aula') {
    if (papel === 'responsavel') return '/responsavel/alertas';
    return '/gestao/ranking';
  }
  if (tipo === 'ocorrencia') return '/gestao/ocorrencias';
  if (tipo === 'justificativa') return '/gestao/justificativas';
  if (tipo === 'codigo_redefinicao') return '/gestao/codigos';
  return papel ? `/${papel}` : '/';
}

async function carregar() {
  if (!usuarioId) return;
  carregando.value = true;
  try {
    const { data } = await supabaseClient
      .from('notificacoes')
      .select('*')
      .eq('destinatario_id', usuarioId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!data) {
      notificacoes.value = [];
      naoLidasMensagens.value = 0;
      naoLidasOutros.value = 0;
      return;
    }

    const items = (data as unknown as Notificacao[]).map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      corpo: n.corpo,
      tempoRelativo: timestampRelativo(n.created_at),
      lida: n.lida,
      rota: rotaPorTipo(n.tipo, n.metadados as Record<string, unknown> | null),
    }));

    naoLidasMensagens.value = items.filter((n) => n.tipo === 'mensagem' && !n.lida).length;
    naoLidasOutros.value = items.filter((n) => n.tipo !== 'mensagem' && !n.lida).length;
    notificacoes.value = items.filter((n) => n.tipo !== 'mensagem');
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

async function garantirTokenRealtime() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (session?.access_token) {
    supabaseClient.realtime.setAuth(session.access_token);
  }
}

function aoMudarVisibilidade() {
  if (document.visibilityState === 'visible' && usuarioId) {
    void carregar();
  }
}

function agendarReconexao() {
  if (!usuarioId || timerReconexao) return;
  const atraso = Math.min(1000 * 2 ** tentativasReconexao, ATRASO_MAXIMO_RECONEXAO_MS);
  tentativasReconexao += 1;
  timerReconexao = setTimeout(() => {
    timerReconexao = null;
    if (!usuarioId) return;
    const id = usuarioId;
    desinscreverCanal();
    void inscrever(id);
  }, atraso);
}

function desinscreverCanal() {
  if (canal) {
    supabaseClient.removeChannel(canal);
    canal = null;
  }
}

async function inscrever(userId: string) {
  if (canal && usuarioId === userId) return;
  usuarioId = userId;
  tentativasReconexao = 0;

  await garantirTokenRealtime();

  canal = supabaseClient
    .channel('notificacoes-global')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notificacoes',
        filter: `destinatario_id=eq.${userId}`,
      },
      recarregarDebounced,
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        tentativasReconexao = 0;
        void carregar();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        agendarReconexao();
      }
    });
}

async function iniciar(userId: string) {
  if (canal && usuarioId === userId) return;
  desinscreverCanal();
  usuarioId = userId;
  carregar();

  if (!ouvinteVisibilidadeRegistrado && typeof document !== 'undefined') {
    ouvinteVisibilidadeRegistrado = true;
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
  }

  await inscrever(userId);
}

function parar() {
  if (timerRecarga) {
    clearTimeout(timerRecarga);
    timerRecarga = null;
  }
  if (timerReconexao) {
    clearTimeout(timerReconexao);
    timerReconexao = null;
  }
  desinscreverCanal();
  usuarioId = null;
  tentativasReconexao = 0;
  naoLidasMensagens.value = 0;
  naoLidasOutros.value = 0;
  notificacoes.value = [];
}

async function marcarTodasComoLidas() {
  if (!usuarioId) return;
  await supabaseClient
    .from('notificacoes')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('destinatario_id', usuarioId)
    .eq('lida', false);
  await carregar();
}

async function limparTodas() {
  if (!usuarioId) return;
  await supabaseClient.from('notificacoes').delete().eq('destinatario_id', usuarioId);
  await carregar();
}

async function marcarLida(id: string) {
  await supabaseClient
    .from('notificacoes')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('id', id);
  await carregar();
}

/** Limpa as notificações de mensagem de uma conversa lida; o banco propaga o resto. */
async function marcarNotificacoesConversaLidas(conversaId: string) {
  if (!usuarioId) return;
  await supabaseClient
    .from('notificacoes')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('destinatario_id', usuarioId)
    .eq('tipo', 'mensagem')
    .eq('lida', false)
    .eq('metadados->>conversa_id', conversaId);
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
