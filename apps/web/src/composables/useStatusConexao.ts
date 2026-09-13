import { ref, type Ref } from 'vue';

export type StatusConexao = 'verificando' | 'conectado' | 'desconectado';

const status: Ref<StatusConexao> = ref('verificando');
let iniciado = false;

async function verificar(): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url) {
    status.value = 'desconectado';
    return;
  }

  try {
    const resposta = await fetch(`${url}/auth/v1/health`, {
      headers: anonKey ? { apikey: anonKey } : undefined,
      signal: AbortSignal.timeout(5000),
    });
    status.value = resposta.ok ? 'conectado' : 'desconectado';
  } catch {
    status.value = 'desconectado';
  }
}

function iniciarVerificacao(): void {
  if (iniciado) return;
  iniciado = true;
  verificar();
  setInterval(verificar, 30000);
}

export function useStatusConexao() {
  iniciarVerificacao();

  return { status };
}
