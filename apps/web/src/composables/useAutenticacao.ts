import { ref, type Ref } from 'vue';
import { api, ErroApi } from '@/servicos/api';
import { useMonitoramento } from '@/composables/useMonitoramento';
import type { Perfil } from '@/tipos/database';

const usuario: Ref<Perfil | null> = ref(null);
const carregando: Ref<boolean> = ref(true);

/** Evita requisições concorrentes ao mesmo endpoint durante o boot da aplicação. */
let carregamentoEmAndamento: Promise<void> | null = null;

/** Indica que o servidor já respondeu de forma definitiva sobre a sessão atual. */
let sessaoVerificada = false;

/** Busca o perfil autenticado; 401 significa sessão ausente ou expirada. */
function carregarPerfil(): Promise<void> {
  if (carregamentoEmAndamento) return carregamentoEmAndamento;

  carregamentoEmAndamento = (async () => {
    try {
      const { perfil } = await api<{ perfil: Perfil }>('/api/auth/me');
      usuario.value = perfil;
      sessaoVerificada = true;
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) {
        usuario.value = null;
        sessaoVerificada = true;
      }
      // Falha de rede mantém o estado atual para uma nova tentativa futura.
    } finally {
      carregando.value = false;
      carregamentoEmAndamento = null;
    }
  })();

  return carregamentoEmAndamento;
}

// Busca a sessão uma única vez no carregamento do módulo; a guarda de rotas aguarda esse resultado.
void carregarPerfil();

export function useAutenticacao() {
  /** Autentica com email e senha; o cookie de sessão é definido pela API. */
  async function login(email: string, senha: string, lembrar = false): Promise<Perfil> {
    const { perfil } = await api<{ perfil: Perfil }>('/api/auth/login', {
      metodo: 'POST',
      corpo: { email, senha, lembrar },
    });

    usuario.value = perfil;
    sessaoVerificada = true;
    carregando.value = false;
    return perfil;
  }

  /** Encerra a sessão no servidor e zera o estado local, mesmo em caso de falha de rede. */
  async function logout(): Promise<void> {
    try {
      await api('/api/auth/logout', { metodo: 'POST' });
    } catch {
      /* Sessão local é encerrada de qualquer forma. */
    } finally {
      useMonitoramento().limparCachesGlobais();
      usuario.value = null;
      sessaoVerificada = true;
      carregando.value = false;
    }
  }

  async function verificarSessao(): Promise<boolean> {
    return !!usuario.value;
  }

  /** Garante usuario populado para a sessão atual; evita views montando antes da guarda. */
  async function garantirUsuario(): Promise<void> {
    if (usuario.value || sessaoVerificada) return;
    await carregarPerfil();
  }

  async function solicitarCodigoRedefinicao(email: string) {
    return api<{ ok: true }>('/api/auth/solicitar-codigo', {
      metodo: 'POST',
      corpo: { email },
    });
  }

  async function redefinirSenhaComCodigo(email: string, codigo: string, novaSenha: string) {
    return api<{ ok: true }>('/api/auth/redefinir-senha', {
      metodo: 'POST',
      corpo: { email, codigo, novaSenha },
    });
  }

  return {
    usuario,
    carregando,
    login,
    logout,
    verificarSessao,
    garantirUsuario,
    carregarPerfil,
    solicitarCodigoRedefinicao,
    redefinirSenhaComCodigo,
  };
}
