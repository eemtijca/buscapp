import { ref, type Ref } from 'vue';
import { inscreverEventos, inscreverStatus, type StatusStream } from '@/servicos/eventos';

export type StatusConexao = 'conectado' | 'desconectado';

export interface ConfiguracaoEvento {
  tabela: string;
  evento?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filtro?: string;
}

const ATRASO_DEBOUNCE_MS = 500;

export function useRealtimeRefresh() {
  const ultimaAtualizacao: Ref<Date | null> = ref(null);
  const estaAtualizando: Ref<boolean> = ref(false);
  const statusConexao: Ref<StatusConexao> = ref('desconectado');

  let fnRecarga: (() => Promise<void>) | null = null;
  let timerDebounce: ReturnType<typeof setTimeout> | null = null;
  let ativo = false;
  let cancelarEventos: (() => void) | null = null;
  let cancelarStatus: (() => void) | null = null;

  function marcarConectado() {
    statusConexao.value = 'conectado';
  }

  function marcarDesconectado() {
    statusConexao.value = 'desconectado';
  }

  /** Compatibilidade com inscrições legadas que informam o status da conexão. */
  function aoConectar(fn: () => Promise<void>) {
    return async (status: string) => {
      if (status === 'SUBSCRIBED') {
        marcarConectado();
        await fn();
        ultimaAtualizacao.value = new Date();
      } else {
        marcarDesconectado();
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
    if (document.visibilityState === 'visible' && ativo) {
      void dispararRecarga();
    }
  }

  function cancelarInscricoes() {
    if (cancelarEventos) {
      cancelarEventos();
      cancelarEventos = null;
    }
    if (cancelarStatus) {
      cancelarStatus();
      cancelarStatus = null;
    }
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
    cancelarInscricoes();

    if (!configs.length) return;

    if (recarregar) fnRecarga = recarregar;
    ativo = true;

    const tabelas = new Set(configs.map((cfg) => cfg.tabela));

    // O EventSource é único e reconecta sozinho; sinalizamos a recarga ao (re)abrir o stream.
    cancelarStatus = inscreverStatus((novoStatus: StatusStream) => {
      if (novoStatus === 'conectado') {
        marcarConectado();
        void dispararRecarga();
      } else {
        marcarDesconectado();
      }
    });

    cancelarEventos = inscreverEventos((tabela) => {
      if (tabelas.has(tabela)) recarregarDebounced();
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', aoMudarVisibilidade);
    }
  }

  function encerrar() {
    ativo = false;
    fnRecarga = null;
    if (timerDebounce) {
      clearTimeout(timerDebounce);
      timerDebounce = null;
    }
    cancelarInscricoes();
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
