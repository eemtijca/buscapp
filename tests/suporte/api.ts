// Helpers de API REST / Auth — uso em beforeAll e em testes de RLS.

import { SERVICE_KEY, URL_SUPABASE } from './dados.js';
import { SENHA_ADMIN } from './dados.js';

/** Obtém access_token via GoTrue (grant_type=password). */
export async function obterToken(email: string, senha: string): Promise<string> {
  const res = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!res.ok) throw new Error(`Setup login ${email}: ${res.status}`);
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

/** Chamada REST autenticada como service_role. */
export async function restApi(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${URL_SUPABASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    ...options,
  });
  if (!res.ok) throw new Error(`Setup ${options.method ?? 'GET'} ${url}: ${res.status}`);
  return res;
}

/** Cria usuário via edge function criar-usuario (requer token de gestão). */
export async function criarUsuarioApi(
  nome: string,
  email: string,
): Promise<{ id: string; codigo: string }> {
  const token = await obterToken('gestao@escola.edu.br', SENHA_ADMIN);
  const res = await fetch(`${URL_SUPABASE}/functions/v1/criar-usuario`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ nome, email, papel: 'responsavel' }),
  });
  if (!res.ok) throw new Error(`Setup criar-usuario: ${res.status}`);
  return (await res.json()) as { id: string; codigo: string };
}

/** Remove usuário do Auth (best-effort). */
export async function deletarUsuario(id: string): Promise<void> {
  await fetch(`${URL_SUPABASE}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  }).catch(() => {});
}

/** Conta notificações de código não lidas para um perfil. */
export async function contarNotificacoesCodigo(perfilId: string): Promise<number> {
  const res = await restApi(
    `/rest/v1/notificacoes?select=id&tipo=eq.codigo_redefinicao&lida=eq.false&metadados->>perfil_id=eq.${perfilId}`,
  );
  const data = (await res.json()) as { id: string }[];
  return data.length;
}

/** Seed helper para anexos/justificativas (merge-duplicates). */
export async function seedApi(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${URL_SUPABASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    ...options,
  });
  if (!res.ok) throw new Error(`Setup ${options.method ?? 'GET'} ${url}: ${res.status}`);
  return res;
}

/** Limpa frequências de teste por client_request_id. */
export async function limparFrequenciasTeste(clientRequestId: string): Promise<void> {
  await fetch(`${URL_SUPABASE}/rest/v1/frequencias?client_request_id=eq.${clientRequestId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}
