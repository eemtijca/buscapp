import { ref, type Ref } from 'vue';
import { supabaseClient, decodificarToken, armazenamento } from '@/servicos/supabase';
import type { Perfil, PapelUsuario } from '@/tipos/database';

const usuario: Ref<Perfil | null> = ref(null);
const carregando: Ref<boolean> = ref(true);

/**
 * Recurso alternativo para tokens emitidos antes do Custom Access Token Hook.
 * Em operação normal as claims do JWT já contêm nome e papel.
 */
async function carregarPerfil() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session?.user?.id) {
    usuario.value = null;
    return;
  }

  const { data } = await supabaseClient
    .from('perfis')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (data) {
    usuario.value = data as unknown as Perfil;
  }
}

/**
 * Ouvinte global registrado UMA vez no escopo de módulo.
 * Reage a INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED e SIGNED_OUT
 * sem necessidade de onMounted ou verificação periódica.
 */
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    if (session?.access_token) {
      const claims = decodificarToken(session.access_token);

      if (claims?.papel && claims?.nome) {
        usuario.value = {
          id: claims.sub,
          nome: claims.nome,
          papel: claims.papel as PapelUsuario,
          email: claims.email ?? null,
          telefone: null,
          cargo: null,
          notificacoes_ativas: true,
          acesso_modulos: ['frequencia'],
          permissoes: [],
          status: 'ativo',
          ultimo_acesso_em: null,
          created_at: '',
          updated_at: '',
        };
      } else {
        carregarPerfil();
      }
    }
    carregando.value = false;
  } else if (event === 'INITIAL_SESSION') {
    if (session?.access_token) {
      const claims = decodificarToken(session.access_token);
      if (claims?.papel && claims?.nome) {
        usuario.value = {
          id: claims.sub,
          nome: claims.nome,
          papel: claims.papel as PapelUsuario,
          email: claims.email ?? null,
          telefone: null,
          cargo: null,
          notificacoes_ativas: true,
          acesso_modulos: ['frequencia'],
          permissoes: [],
          status: 'ativo',
          ultimo_acesso_em: null,
          created_at: '',
          updated_at: '',
        };
      }
    }
    carregando.value = false;
  } else if (event === 'SIGNED_OUT') {
    usuario.value = null;
    carregando.value = false;
    supabaseClient.removeAllChannels();
  }
});

export function useAutenticacao() {
  /**
   * Autentica com email/senha. O ouvinte onAuthStateChange
   * preenche usuario.value automaticamente via JWT.
   */
  async function login(email: string, senha: string) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) throw error;

    if (!usuario.value) {
      await carregarPerfil();
    }

    return data;
  }

  /** Encerra a sessão atual (scope: 'local' = não afeta outras abas). */
  async function logout() {
    supabaseClient.removeAllChannels();
    await supabaseClient.auth.signOut({ scope: 'local' });
    armazenamento.limparTudo();
    usuario.value = null;
  }

  async function verificarSessao(): Promise<boolean> {
    return !!usuario.value;
  }

  async function solicitarCodigoRedefinicao(email: string) {
    const funcaoUrl =
      import.meta.env.VITE_EDGE_FUNCTIONS_URL ??
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
    const url = `${funcaoUrl}/solicitar-codigo`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const resultado = await response.json();
    if (!response.ok) {
      throw new Error(resultado.error ?? 'Erro ao solicitar código.');
    }
    return resultado;
  }

  async function redefinirSenhaComCodigo(email: string, codigo: string, novaSenha: string) {
    const funcaoUrl =
      import.meta.env.VITE_EDGE_FUNCTIONS_URL ??
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
    const url = `${funcaoUrl}/redefinir-senha-codigo`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, codigo, novaSenha }),
    });

    const resultado = await response.json();
    if (!response.ok) {
      throw new Error(resultado.error ?? 'Erro ao redefinir senha.');
    }
    return resultado;
  }

  return {
    usuario,
    carregando,
    login,
    logout,
    verificarSessao,
    carregarPerfil,
    solicitarCodigoRedefinicao,
    redefinirSenhaComCodigo,
  };
}
