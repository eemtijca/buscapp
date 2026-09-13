import { ref, type Ref } from 'vue';
import { api } from '@/servicos/api';

export type StatusConexao = 'verificando' | 'conectado' | 'desconectado';

const INTERVALO_VERIFICACAO_MS = 30_000;
const TIMEOUT_VERIFICACAO_MS = 5_000;

const status: Ref<StatusConexao> = ref('verificando');
let iniciado = false;

/** Rejeita a promessa após o limite de tempo para manter o indicador responsivo. */
function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolver, rejeitar) => {
    const timer = setTimeout(() => rejeitar(new Error('Tempo limite excedido.')), ms);
    promessa.then(
      (valor) => {
        clearTimeout(timer);
        resolver(valor);
      },
      (erro: unknown) => {
        clearTimeout(timer);
        rejeitar(erro);
      },
    );
  });
}

async function verificar(): Promise<void> {
  try {
    const resposta = await comTimeout(
      api<{ status: string }>('/api/saude'),
      TIMEOUT_VERIFICACAO_MS,
    );
    status.value = resposta.status === 'ok' ? 'conectado' : 'desconectado';
  } catch {
    status.value = 'desconectado';
  }
}

function iniciarVerificacao(): void {
  if (iniciado) return;
  iniciado = true;
  void verificar();
  setInterval(() => void verificar(), INTERVALO_VERIFICACAO_MS);
}

export function useStatusConexao() {
  iniciarVerificacao();

  return { status };
}
