import { ref, type Ref } from 'vue';
import { supabaseClient } from '@/servicos/supabase';

export type StatusConexao = 'conectado' | 'desconectado';

export interface ConfiguracaoEvento {
  tabela: string;
  evento?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filtro?: string;
}

const ATRASO_DEBOUNCE_MS = 500;
const ATRASO_MAXIMO_RECONEXAO_MS = 15000;

let contadorCanais = 0;

export function useRealtimeRefresh() {
  const ultimaAtualizacao: Ref<Date | null> = ref(null);
  const estaAtualizando: Ref<boolean> = ref(false);
  const statusConexao: Ref<StatusConexao> = ref('desconectado');

  let canal: ReturnType<typeof supabaseClient.channel> | null = null;
  let configsAtuais: ConfiguracaoEvento[] = [];
  let fnRecarga: (() => Promise<void>) | null = null;
  let timerDebounce: ReturnType<typeof setTimeout> | null = null;
  let timerReconexao: ReturnType<typeof setTimeout> | null = null;
  let tentativasReconexao = 0;
  let ativo = false;

  function marcarConectado() {
    statusConexao.value = 'conectado';
  }

  function marcarDesconectado() {
    statusConexao.value = 'desconectado';
  }

  function aoConectar(fn: () => Promise<void>) {
    return async (status: string) => {
      if (status === 'SUBSCRIBED') {
        statusConexao.value = 'conectado';
        await fn();
        ultimaAtualizacao.value = new Date();
      } else {
        statusConexao.value = 'desconectado';
      }
    };
  }

  async function atualizar(fn: () => Promise<void>) {
    estaAtualizando.value = true;
    try {
      await fn();
      ultimaAtualizacao.value = new Date();
    } finally {
      estaAtualizando.value = false;
    }
  }

  async function garantirTokenRealtime() {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (session?.access_token) {
      supabaseClient.realtime.setAuth(session.access_token);
    }
  }

  async function dispararRecarga() {
    if (!fnRecarga || !ativo) return;
    estaAtualizando.value = true;
    try {
      await fnRecarga();
      ultimaAtualizacao.value = new Date();
    } finally {
      estaAtualizando.value = false;
    }
  }

  function recarregarDebounced() {
    if (timerDebounce) return;
    timerDebounce = setTimeout(() => {
      timerDebounce = null;
      void dispararRecarga();
    }, ATRASO_DEBOUNCE_MS);
  }

  function aoMudarVisibilidade() {
    if (document.visibilityState === 'visible' && ativo && canal) {
      void dispararRecarga();
    }
  }

  function desinscreverCanal() {
    if (canal) {
      const c = canal;
      canal = null;
      void supabaseClient.removeChannel(c);
    }
  }

  function agendarReconexao() {
    if (!ativo || timerReconexao) return;
    const atraso = Math.min(1000 * 2 ** tentativasReconexao, ATRASO_MAXIMO_RECONEXAO_MS);
    tentativasReconexao += 1;
    timerReconexao = setTimeout(() => {
      timerReconexao = null;
      if (!ativo) return;
      desinscreverCanal();
      void inscrever(configsAtuais);
    }, atraso);
  }

  async function inscrever(
    configs: ConfiguracaoEvento[],
    recarregar?: () => Promise<void>,
  ): Promise<void> {
    ativo = false;
    if (timerDebounce) {
      clearTimeout(timerDebounce);
      timerDebounce = null;
    }
    if (timerReconexao) {
      clearTimeout(timerReconexao);
      timerReconexao = null;
    }
    desinscreverCanal();

    if (!configs.length) return;

    configsAtuais = configs;
    if (recarregar) fnRecarga = recarregar;
    ativo = true;
    tentativasReconexao = 0;

    await garantirTokenRealtime();

    contadorCanais += 1;
    let construtor = supabaseClient.channel(`realtime-refresh-${contadorCanais}`);
    for (const cfg of configs) {
      construtor = construtor.on(
        'postgres_changes',
        {
          event: cfg.evento ?? '*',
          schema: 'public',
          table: cfg.tabela,
          ...(cfg.filtro ? { filter: cfg.filtro } : {}),
        },
        recarregarDebounced,
      );
    }

    canal = construtor.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        tentativasReconexao = 0;
        marcarConectado();
        void dispararRecarga();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        marcarDesconectado();
        if (status !== 'CLOSED') agendarReconexao();
      }
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', aoMudarVisibilidade);
    }
  }

  function encerrar() {
    ativo = false;
    configsAtuais = [];
    fnRecarga = null;
    if (timerDebounce) {
      clearTimeout(timerDebounce);
      timerDebounce = null;
    }
    if (timerReconexao) {
      clearTimeout(timerReconexao);
      timerReconexao = null;
    }
    desinscreverCanal();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    }
    marcarDesconectado();
  }

  return {
    ultimaAtualizacao,
    estaAtualizando,
    statusConexao,
    aoConectar,
    atualizar,
    inscrever,
    encerrar,
    marcarConectado,
    marcarDesconectado,
  };
}
