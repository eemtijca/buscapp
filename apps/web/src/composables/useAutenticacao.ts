import { ref, type Ref } from 'vue';
import { api, ErroApi } from '@/servicos/api';
import { Consultas } from '@/servicos/consultas';
import {
  consultar,
  definirDados,
  definirNamespace,
  hidratar,
  limparTudo,
  recarregar,
} from '@/servicos/cache';
import type { Perfil } from '@/tipos/database';

const usuario: Ref<Perfil | null> = ref(null);
const carregando: Ref<boolean> = ref(true);
/** Indica que a sessão não pôde ser verificada e o perfil veio do cache local. */
const offline: Ref<boolean> = ref(false);

/** Evita requisições concorrentes ao mesmo endpoint durante o boot da aplicação. */
let carregamentoEmAndamento: Promise<void> | null = null;

/** Indica que o servidor já respondeu de forma definitiva sobre a sessão atual. */
let sessaoVerificada = false;

function aplicarPerfil(perfil: Perfil | null): void {
  usuario.value = perfil;
  if (perfil) definirNamespace(perfil.id);
}

/** Busca o perfil autenticado; `perfil: null` (ou 401 legado) significa sessão ausente ou expirada. */
function carregarPerfil(): Promise<void> {
  if (carregamentoEmAndamento) return carregamentoEmAndamento;

  carregamentoEmAndamento = (async () => {
    const opcoes = Consultas.authMe();
    // A leitura do IndexedDB precisa terminar antes de decidir entre offline e login.
    await hidratar('sessao');
    const inicial = consultar(opcoes);
    aplicarPerfil(inicial.dados?.perfil ?? null);

    try {
      await recarregar('auth/me', true, 'sessao');
      // Em falha de rede, o perfil persistido pode entrar durante a requisição.
      await hidratar('sessao');
      const estado = consultar(opcoes);
      // Perfil hidratado do IndexedDB com falha de rede: segue em modo offline.
      offline.value = Boolean(estado.erro) && Boolean(estado.dados?.perfil);
      aplicarPerfil(estado.dados?.perfil ?? null);
      if (!estado.erro) sessaoVerificada = true;
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) {
        aplicarPerfil(null);
        sessaoVerificada = true;
      }
      // Falha de rede mantém o estado hidratado para tentativa futura.
    } finally {
      carregando.value = false;
      carregamentoEmAndamento = null;
    }
  })();

  return carregamentoEmAndamento;
}

// Busca a sessão uma única vez no carregamento do módulo; a guarda de rotas aguarda esse resultado.
void carregarPerfil();

/** Reage a um 401 em qualquer consulta: limpa o cache local e derruba o usuário. */
export async function tratarSessaoExpirada(): Promise<void> {
  await limparTudo(false);
  definirNamespace('anon');
  usuario.value = null;
  offline.value = false;
  sessaoVerificada = true;
  carregando.value = false;
}

export function useAutenticacao() {
  /** Autentica com email e senha; o cookie de sessão é definido pela API. */
  async function login(email: string, senha: string, lembrar = false): Promise<Perfil> {
    const { perfil } = await api<{ perfil: Perfil }>('/api/auth/login', {
      metodo: 'POST',
      corpo: { email, senha, lembrar },
    });

    definirNamespace(perfil.id);
    definirDados('auth/me', { perfil }, 'sessao');
    aplicarPerfil(perfil);
    offline.value = false;
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
      await limparTudo();
      definirNamespace('anon');
      usuario.value = null;
      offline.value = false;
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
    offline,
    login,
    logout,
    verificarSessao,
    garantirUsuario,
    carregarPerfil,
    solicitarCodigoRedefinicao,
    redefinirSenhaComCodigo,
  };
}
