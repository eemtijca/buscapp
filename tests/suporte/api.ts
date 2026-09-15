// Helpers da API própria — login de setup, fetch autenticado e limpeza de dados.

import { consultar, executar } from './banco.js';
import { API_URL, SENHA_ADMIN } from './dados.js';

export { excluirLinhas, inserirLinhas } from './banco.js';

/** Perfil retornado por `/api/auth/login` e `/api/auth/me`. */
export interface PerfilApi {
  id: string;
  nome: string;
  email: string | null;
  papel: 'professor' | 'gestao' | 'responsavel';
  status: 'ativo' | 'pendente' | 'inativo';
  telefone: string | null;
  cargo: string | null;
  notificacoes_ativas: boolean;
  acesso_modulos: string[];
}

/** Corpo aceito por `POST /api/usuarios`. */
export interface DadosUsuarioApi {
  nome: string;
  email: string;
  papel: 'professor' | 'gestao' | 'responsavel';
  telefone?: string | null;
  cargo?: string | null;
  acesso_modulos?: string[];
}

export interface OpcoesApiFetch {
  metodo?: string;
  corpo?: unknown;
  cookie?: string;
  formData?: FormData;
}

const COOKIE_SESSAO = 'buscapp_sessao';

/** Fetch contra a API dedicada, com cookie de sessão opcional. */
export async function apiFetch(caminho: string, opcoes: OpcoesApiFetch = {}): Promise<Response> {
  const cabecalhos: Record<string, string> = {};
  if (opcoes.cookie) cabecalhos.Cookie = opcoes.cookie;

  let corpo: RequestInit['body'];
  if (opcoes.formData) {
    corpo = opcoes.formData;
  } else if (opcoes.corpo !== undefined) {
    cabecalhos['Content-Type'] = 'application/json';
    corpo = JSON.stringify(opcoes.corpo);
  }

  return fetch(`${API_URL}${caminho}`, {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    body: corpo,
    credentials: 'include',
  });
}

/** Autentica via `POST /api/auth/login` e devolve o cookie de sessão. */
export async function loginApi(
  email: string,
  senha: string,
): Promise<{ cookie: string; perfil: PerfilApi }> {
  const res = await apiFetch('/api/auth/login', { metodo: 'POST', corpo: { email, senha } });
  if (!res.ok) throw new Error(`Login ${email} falhou: ${res.status} ${await res.text()}`);

  const corpo = (await res.json()) as { perfil: PerfilApi };
  const setCookies = res.headers.getSetCookie();
  const parSessao = setCookies.find((item) => item.startsWith(`${COOKIE_SESSAO}=`));
  if (!parSessao) throw new Error(`Login ${email}: cookie ${COOKIE_SESSAO} ausente`);

  return { cookie: parSessao.split(';')[0] ?? '', perfil: corpo.perfil };
}

/** Cria usuário de teste: login de gestão + `POST /api/usuarios`. */
export async function criarUsuarioApi(
  dados: DadosUsuarioApi,
): Promise<{ id: string; codigo: string | null }> {
  const { cookie } = await loginApi('gestao@escola.edu.br', SENHA_ADMIN);
  const res = await apiFetch('/api/usuarios', { metodo: 'POST', corpo: dados, cookie });
  if (!res.ok) {
    throw new Error(`Setup criar usuário ${dados.email}: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { usuario: { id: string }; codigo?: string | null };
  return { id: json.usuario.id, codigo: json.codigo ?? null };
}

/** Remove um usuário de teste e suas dependências diretas no banco (ordem de FK). */
export async function deletarUsuario(perfilId: string): Promise<void> {
  const perfis = await consultar<{ email: string | null }>(
    'select email from public.perfis where id = $1',
    [perfilId],
  );
  const email = perfis[0]?.email ?? null;

  // Justificativas que apontam para frequências do professor antes de removê-las.
  await executar(
    `delete from public.justificativas_faltas
      where frequencia_id in (select id from public.frequencias where professor_id = $1)`,
    [perfilId],
  );
  await executar('delete from public.justificativas_faltas where responsavel_id = $1', [perfilId]);
  await executar(
    'update public.justificativas_faltas set avaliado_por = null where avaliado_por = $1',
    [perfilId],
  );

  await executar('delete from public.mensagens where remetente_id = $1', [perfilId]);
  await executar('delete from public.conversas where responsavel_id = $1', [perfilId]);
  await executar('delete from public.vinculos_responsaveis where responsavel_id = $1', [perfilId]);
  await executar('delete from public.notificacoes where destinatario_id = $1', [perfilId]);
  await executar('delete from public.sessoes where perfil_id = $1', [perfilId]);
  await executar('delete from public.codigos_redefinicao where perfil_id = $1 or criado_por = $1', [
    perfilId,
  ]);
  if (email) {
    await executar('delete from public.codigos_redefinicao_tentativas where email = $1', [email]);
  }

  await executar('update public.anexos set criado_por = null where criado_por = $1', [perfilId]);
  await executar('delete from public.auditoria where usuario_id = $1', [perfilId]);
  await executar('delete from public.atribuicoes_professores where professor_id = $1', [perfilId]);
  await executar('delete from public.frequencias where professor_id = $1', [perfilId]);
  await executar('delete from public.registros_comportamento where professor_id = $1', [perfilId]);
  await executar('delete from public.ocorrencias where professor_id = $1 or coordenador_id = $1', [
    perfilId,
  ]);
  await executar(
    'delete from public.monitoramento_acoes where responsavel_id = $1 or realizado_por = $1',
    [perfilId],
  );
  await executar('delete from public.exportacoes where coordenador_id = $1', [perfilId]);
  await executar('delete from public.importacoes_log where coordenador_id = $1', [perfilId]);
  await executar('delete from public.convites where enviado_por = $1', [perfilId]);

  await executar('delete from public.perfis where id = $1', [perfilId]);
}

/** Conta notificações de código de redefinição para um perfil. */
export async function contarNotificacoesCodigo(perfilId: string): Promise<number> {
  const linhas = await consultar<{ total: number }>(
    `select count(*)::int as total from public.notificacoes
     where tipo = 'codigo_redefinicao' and metadados->>'perfil_id' = $1`,
    [perfilId],
  );
  return linhas[0]?.total ?? 0;
}

/**
 * Limpa frequências de teste. Com `alunoIds`, remove apenas as desses alunos;
 * sem ids, remove as frequências criadas por specs (`client_request_id` preenchido).
 */
export async function limparFrequenciasTeste(alunoIds?: string[]): Promise<void> {
  const filtro =
    alunoIds && alunoIds.length > 0
      ? { sql: 'aluno_id = any($1::uuid[])', params: [alunoIds] as unknown[] }
      : { sql: 'client_request_id is not null', params: [] as unknown[] };

  await executar(
    `delete from public.justificativas_faltas
     where frequencia_id in (select id from public.frequencias where ${filtro.sql})`,
    filtro.params,
  );
  await executar(`delete from public.frequencias where ${filtro.sql}`, filtro.params);
}
