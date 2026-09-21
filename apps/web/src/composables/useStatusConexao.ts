import { ref, type Ref } from 'vue';
import { api } from '@/servicos/api';

export type StatusConexao = 'verificando' | 'conectado' | 'desconectado';

const INTERVALO_VERIFICACAO_MS = 30_000;

const status: Ref<StatusConexao> = ref('verificando');
let timerVerificacao: ReturnType<typeof setInterval> | null = null;
let controladorAtual: AbortController | null = null;

async function verificar(): Promise<void> {
  // Cancela a verificação anterior antes de iniciar outra.
  controladorAtual?.abort();
  const controlador = new AbortController();
  controladorAtual = controlador;

  try {
    const resposta = await api<{ status: string }>('/api/saude', { signal: controlador.signal });
    status.value = resposta.status === 'ok' ? 'conectado' : 'desconectado';
  } catch {
    status.value = 'desconectado';
  } finally {
    if (controladorAtual === controlador) controladorAtual = null;
  }
}

function iniciarVerificacao(): void {
  if (timerVerificacao) return;
  void verificar();
  timerVerificacao = setInterval(() => void verificar(), INTERVALO_VERIFICACAO_MS);
}

/** Interrompe o polling e a requisição pendente (usado ao desmontar o layout). */
export function pararVerificacao(): void {
  if (timerVerificacao) {
    clearInterval(timerVerificacao);
    timerVerificacao = null;
  }
  controladorAtual?.abort();
  controladorAtual = null;
}

export function useStatusConexao() {
  iniciarVerificacao();

  return { status };
}
