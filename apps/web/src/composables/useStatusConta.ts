import { useRouter, type Router } from 'vue-router';
import { Consultas } from '@/servicos/consultas';
import { consultar, recarregar } from '@/servicos/cache';

export type StatusPerfilConta = 'ativo' | 'pendente' | 'inativo';

const ROTA_CONTA_DESATIVADA = '/conta-desativada';

/** Intervalo mínimo entre verificações disparadas por interações do usuário */
const INTERVALO_MINIMO_VERIFICACAO_MS = 20_000;

/** Eventos que disparam uma verificação passiva (sem manter canal WebSocket) */
const EVENTOS_GATILHO = ['click', 'keydown', 'focus', 'visibilitychange'] as const;

let routerAtual: Router | null = null;
let ouvinteRegistrado: ((event: Event) => void) | null = null;
let ultimaVerificacaoEm = 0;
let emVerificacao = false;

/** Consulta o status do perfil autenticado; sessão ausente ou falha transitória devolvem null. */
async function verificarStatus(): Promise<StatusPerfilConta | null> {
  try {
    await recarregar('auth/me', true, 'sessao');
    return consultar(Consultas.authMe()).dados?.perfil?.status ?? null;
  } catch {
    return null;
  }
}

function pararOuvintes() {
  if (!ouvinteRegistrado) return;
  for (const evento of EVENTOS_GATILHO) {
    window.removeEventListener(evento, ouvinteRegistrado, { capture: true });
  }
  ouvinteRegistrado = null;
}

async function verificarEAguardar(): Promise<void> {
  if (emVerificacao) return;
  emVerificacao = true;
  try {
    const status = await verificarStatus();
    if (status === 'inativo') {
      pararOuvintes();
      if (routerAtual) {
        await routerAtual.push(ROTA_CONTA_DESATIVADA);
      }
    }
  } finally {
    emVerificacao = false;
    ultimaVerificacaoEm = Date.now();
  }
}

function aoInteragir(): (event: Event) => void {
  return () => {
    const agora = Date.now();
    if (agora - ultimaVerificacaoEm < INTERVALO_MINIMO_VERIFICACAO_MS) return;
    void verificarEAguardar();
  };
}

export function useStatusConta() {
  const router = useRouter();
  routerAtual = router;

  function iniciar() {
    if (ouvinteRegistrado) return;
    ouvinteRegistrado = aoInteragir();
    for (const evento of EVENTOS_GATILHO) {
      window.addEventListener(evento, ouvinteRegistrado, { capture: true, passive: true });
    }
    void verificarEAguardar();
  }

  function parar() {
    pararOuvintes();
  }

  return {
    verificarStatus,
    iniciar,
    parar,
  };
}
