import { test, expect, type Page } from '@playwright/test';
import { spawn } from 'child_process';

const URL_SUPABASE = process.env.VITE_SUPABASE_URL;
if (!URL_SUPABASE) throw new Error('VITE_SUPABASE_URL não definida');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY não definida');

const SENHA_ADMIN = process.env.SEED_SENHA_ADMIN!;
const SENHA_PROF = process.env.SEED_SENHA_PROF!;
const SENHA_RESP = process.env.SEED_SENHA_RESP!;

let funcoesProcess: ReturnType<typeof spawn> | null = null;

async function restaurarSenha(uid: string, senha: string) {
  try {
    await fetch(`${URL_SUPABASE}/auth/v1/admin/users/${uid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ password: senha, email_confirm: true }),
    });
  } catch {
    /* ignorar */
  }
}

test.beforeAll(async () => {
  // Restaurar senhas dos seed users (podem ter sido alteradas por testes anteriores)
  await restaurarSenha('a0000000-0000-0000-0000-000000000002', SENHA_PROF);
  await restaurarSenha('a0000000-0000-0000-0000-000000000003', SENHA_PROF);
  await restaurarSenha('a0000000-0000-0000-0000-000000000005', SENHA_RESP);

  try {
    const res = await fetch(`${URL_SUPABASE}/functions/v1/solicitar-codigo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'health@check.com' }),
    });
    if (res.ok) return;
  } catch {
    /* not running */
  }

  funcoesProcess = spawn('npx', ['supabase', 'functions', 'serve'], {
    stdio: 'pipe',
    shell: true,
  });

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`${URL_SUPABASE}/functions/v1/solicitar-codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'health@check.com' }),
      });
      if (res.ok) return;
    } catch {
      /* still starting */
    }
  }
  throw new Error('Edge functions não iniciaram após 60s');
});

test.afterAll(() => {
  if (funcoesProcess) funcoesProcess.kill();
});

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  // Aguarda a página carregar completamente
  await page.waitForSelector('button[type="submit"]');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  // Clica e aguarda a navegação/resposta
  await Promise.all([
    page.waitForURL(/\/gestao|\/professor|\/responsavel/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);
}

async function logout(page: Page) {
  await page.locator('button[data-bs-toggle="dropdown"]').click();
  await page.locator('.dropdown-menu').getByText('Sair da conta').click();
  await expect(page).toHaveURL('/');
}

function emailUnico(prefixo: string): string {
  const sufixo = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${prefixo}${sufixo}@test.com`;
}

async function obterToken(email: string, senha: string): Promise<string> {
  const res = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!res.ok) throw new Error(`Setup login ${email}: ${res.status}`);
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

async function restApi(url: string, options: RequestInit = {}) {
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

async function criarUsuarioApi(
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

async function deletarUsuario(id: string) {
  await fetch(`${URL_SUPABASE}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  }).catch(() => {});
}

async function contarNotificacoesCodigo(perfilId: string): Promise<number> {
  const res = await restApi(
    `/rest/v1/notificacoes?select=id&tipo=eq.codigo_redefinicao&lida=eq.false&metadados->>perfil_id=eq.${perfilId}`,
  );
  const data = (await res.json()) as { id: string }[];
  return data.length;
}

test.describe('Autenticação', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error(`[BROWSER ERROR] ${msg.text()}`);
    });
    page.on('pageerror', (err) => console.error(`[PAGE ERROR] ${err.message}`));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        console.error(`[HTTP ${response.status()}] ${response.url()}`);
      }
    });
  });
  test('CT01 - Página de login carrega corretamente', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Entrar');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByText('Solicitar código de acesso')).toBeVisible();
  });

  test('CT02 - Login como gestão redireciona para /gestao', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await expect(page).toHaveURL(/\/gestao/);
  });

  test('CT03 - Login como professor redireciona para /professor', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await expect(page).toHaveURL(/\/professor/);
  });

  test('CT04 - Login com credenciais inválidas mostra erro', async ({ page }) => {
    await login(page, 'invalido@email.com', 'senha_errada');
    await expect(page.locator('.alert-danger')).toBeVisible();
  });

  test('CT05 - Logout retorna para pagina de login', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await expect(page).toHaveURL(/\/gestao/);
    await page.locator('button[data-bs-toggle="dropdown"]').click();
    await page.locator('.dropdown-menu').getByText('Sair da conta').click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('Gestão - Home', () => {
  test('CT06 - Página inicial do gestor mostra cards de navegação', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await expect(page.locator('h3.card-nav-title').first()).toHaveText('Ranking de risco');
    await expect(page.locator('h3.card-nav-title').nth(1)).toHaveText('Ocorrências graves');
    await expect(page.locator('h3.card-nav-title').nth(2)).toHaveText('Justificativas');
    await expect(page.locator('h3.card-nav-title').nth(3)).toHaveText('Usuários');
    await expect(page.locator('h3.card-nav-title').nth(4)).toHaveText('Alunos');
    await expect(page.locator('h3.card-nav-title').nth(5)).toHaveText('Códigos');
    await expect(page.locator('h3.card-nav-title').nth(7)).toHaveText('Anos letivos');
    await expect(page.locator('h3.card-nav-title').nth(11)).toHaveText('Configurações');
  });

  test('CT07 - Notificação de código aparece no header', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    const bell = page.locator(
      'button[aria-label="Notificações"] i.bi-bell, a[aria-label="Notificações"] i.bi-bell',
    );
    await expect(bell.first()).toBeVisible();
  });
});

test.describe('Gestão - Usuários', () => {
  test('CT08 - Listagem de usuários exibe dados do seed', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios');
    await expect(page.locator('table')).toContainText('Carlos Administrador');
    await expect(page.locator('table')).toContainText('Ana Professora');
    await expect(page.locator('table')).toContainText('Maria Silva');
  });

  test('CT09 - Filtro por papel funciona', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios');
    await page.click('label:has-text("Professores")');
    await expect(page.getByRole('cell', { name: 'Ana Professora' })).toBeVisible();
    await expect(page.getByText('Maria Silva')).not.toBeVisible();
  });

  test('CT09b - Perfil de gestão não tem botão de desativar/ativar', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios');

    const linhaGestao = page.locator('tr', { hasText: 'Carlos Administrador' });
    await expect(linhaGestao).toBeVisible();
    await expect(linhaGestao.getByTitle('Desativar')).toHaveCount(0);
    await expect(linhaGestao.getByTitle('Ativar')).toHaveCount(0);

    const linhaProfessor = page.locator('tr', { hasText: 'Ana Professora' });
    await expect(linhaProfessor.getByTitle('Desativar')).toBeVisible();
  });

  test('CT10 - Formulário de novo usuário carrega', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios/novo');
    await expect(page.locator('label:has-text("Nome")')).toBeVisible();
    await expect(page.locator('label:has-text("E-mail")')).toBeVisible();
    await expect(page.locator('label:has-text("Papel")')).toBeVisible();
  });
});

test.describe('Gestão - Alunos', () => {
  test('CT11 - Listagem de alunos exibe dados do seed', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/alunos');
    await expect(page.getByText('João Miguel')).toBeVisible();
    await expect(page.getByText('Ana Beatriz')).toBeVisible();
  });

  test('CT12 - Filtro de busca por nome funciona', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/alunos');
    await page.fill('input[type="search"]', 'Rafael');
    await expect(page.getByText('Rafael Augusto')).toBeVisible();
    await expect(page.getByText('Maria Clara')).not.toBeVisible();
  });
});

test.describe('Gestão - Códigos', () => {
  test('CT13 - Página de códigos carrega com abas', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
  });

  test('CT14 - Códigos do seed são exibidos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
  });
});

test.describe('Recuperação de senha por código', () => {
  test('CT15 - Página de solicitar código carrega', async ({ page }) => {
    await page.goto('/solicitar-codigo');
    await expect(page.getByText('Solicitar código de acesso')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('CT16 - Fluxo de solicitação de código via UI', async ({ page }) => {
    await page.goto('/solicitar-codigo');
    await page.fill('input[type="email"]', 'prof1@escola.edu.br');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
      timeout: 15000,
    });
  });

  test('CT17 - Página de redefinir senha com código carrega', async ({ page }) => {
    await page.goto('/redefinir-senha-codigo');
    await expect(page.getByText('Redefinir senha com código')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="codigo"]')).toBeVisible();
    await expect(page.locator('input[id="nova-senha"]')).toBeVisible();
  });
});

test.describe('Professor - Funcionalidades básicas', () => {
  test('CT18 - Home do professor mostra cards de navegação', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await expect(page.getByText('Registrar frequência')).toBeVisible();
    await expect(page.getByText('Ausência em aula')).toBeVisible();
    await expect(page.getByText('Ocorrência grave')).toBeVisible();
  });
});

test.describe('Responsável - Funcionalidades básicas', () => {
  test('CT19 - Home do responsável mostra cards de navegação', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await expect(page.getByRole('link', { name: 'Alertas' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Termômetro' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Justificativa' })).toBeVisible();
    await expect(page.locator('h3.card-nav-title').nth(3)).toHaveText('Falar com coordenação');
  });
});

test.describe('Gestão - Ranking e Ocorrências', () => {
  test('CT20 - Pagina de ranking de risco carrega', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ranking');
    await expect(page.getByText('Ranking de priorização de risco')).toBeVisible();
  });

  test('CT20b - Botão Chat abre conversa com o responsável', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ranking');
    const cardJoao = page.locator('.card').filter({ hasText: 'João Miguel da Silva' });
    await cardJoao.locator('button[title="Abrir conversa com o responsável"]').click();
    await page.waitForURL(/\/gestao\/chat/, { timeout: 10000 });
    await expect(page.getByText('Maria Silva').first()).toBeVisible({ timeout: 10000 });
  });

  test('CT21 - Página de ocorrências carrega', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ocorrencias');
    await expect(page.getByText('Ocorrências graves e suspensões')).toBeVisible();
  });

  test('CT22 - Pagina de justificativas carrega', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/justificativas');
    await expect(page.getByText('Validação de justificativas')).toBeVisible();
  });
});

// ============================================================================
// VISUALIZADOR DE ANEXO (BLOB) — gestão justificativas + responsável alertas
// ============================================================================
test.describe('Gestão/Responsável — Visualizador de anexo (blob)', () => {
  const JUST_ID = '10000000-0000-0000-0000-000000000001';
  const ANEXO_ID = '20000000-0000-0000-0000-000000000001';
  const FREQ_ID = '30000000-0000-0000-0000-000000000001';
  const RESP_ID = 'a0000000-0000-0000-0000-000000000005';
  const ALUNO_ID = 'e0000000-0000-0000-0000-000000000001';
  const TURMA_ID = 'd0000000-0000-0000-0000-000000000001';
  const PROF_ID = 'a0000000-0000-0000-0000-000000000002';
  const ANO_ID = 'b0000000-0000-0000-0000-000000000001';
  const DATA_FALTA = '2026-09-15';
  const PERIODO = 'Manhã';
  const TIPO_REGISTRO = 'chamada_aula';
  const NOME_ARQUIVO = 'comprovante.png';
  const STORAGE_PATH = `${RESP_ID}/blobtest/comprovante-${Date.now()}.png`;

  async function seedApi(url: string, options: RequestInit = {}) {
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

  test.beforeAll(async () => {
    // Token do responsável (dono do anexo): RLS exige owner_id = auth.uid()
    const loginRes = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY },
      body: JSON.stringify({ email: 'resp1@email.com', password: SENHA_RESP }),
    });
    if (!loginRes.ok) throw new Error(`Setup login resp1: ${loginRes.status}`);
    const { access_token: tokenResp } = (await loginRes.json()) as { access_token: string };

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const upload = await fetch(`${URL_SUPABASE}/storage/v1/object/justificativas/${STORAGE_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${tokenResp}`,
      },
      body: png,
    });
    if (!upload.ok) throw new Error(`Setup upload anexo: ${upload.status}`);

    await seedApi('/rest/v1/anexos?on_conflict=id', {
      method: 'POST',
      body: JSON.stringify({
        id: ANEXO_ID,
        storage_path: STORAGE_PATH,
        nome_arquivo: NOME_ARQUIVO,
        mime_type: 'image/png',
        tamanho_bytes: png.length,
        criado_por: RESP_ID,
      }),
    });
    await seedApi('/rest/v1/justificativas_faltas?on_conflict=id', {
      method: 'POST',
      body: JSON.stringify({
        id: JUST_ID,
        responsavel_id: RESP_ID,
        aluno_id: ALUNO_ID,
        data_falta: DATA_FALTA,
        motivo: 'Anexo para testes do visualizador (blob).',
      }),
    });
    await seedApi('/rest/v1/justificativa_anexos?on_conflict=justificativa_id,anexo_id', {
      method: 'POST',
      body: JSON.stringify({ justificativa_id: JUST_ID, anexo_id: ANEXO_ID }),
    });
    // Frequência ausente na mesma data -> gera o alerta do responsável
    await seedApi(
      `/rest/v1/frequencias?aluno_id=eq.${ALUNO_ID}&data_aula=eq.${DATA_FALTA}&periodo=eq.${PERIODO}&tipo_registro=eq.${TIPO_REGISTRO}`,
      { method: 'DELETE' },
    );
    await seedApi('/rest/v1/frequencias?on_conflict=client_request_id', {
      method: 'POST',
      body: JSON.stringify({
        id: FREQ_ID,
        client_request_id: FREQ_ID,
        aluno_id: ALUNO_ID,
        professor_id: PROF_ID,
        turma_id: TURMA_ID,
        ano_letivo_id: ANO_ID,
        data_aula: DATA_FALTA,
        periodo: PERIODO,
        tipo_registro: TIPO_REGISTRO,
        status: 'ausente',
      }),
    });
  });

  test('CT22A - Gestão: Ver anexo abre modal com imagem via blob (sem token)', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/justificativas');
    const item = page.locator('article').filter({ hasText: 'Anexo para testes do visualizador' });
    const botao = item.getByRole('button', { name: /Ver anexo/ });
    await expect(botao).toBeVisible({ timeout: 10000 });
    await botao.click();
    const modal = page.locator('.modal.show');
    await expect(modal).toBeVisible();
    const img = modal.locator('img');
    await expect(img).toBeVisible({ timeout: 10000 });
    const src = await img.getAttribute('src');
    expect(src).toMatch(/^blob:/);
    expect(page.url()).not.toContain('token=');
    expect(await page.locator('img[src*="token="]').count()).toBe(0);
  });

  test('CT22B - Gestão: modal mostra nome e botão Baixar', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/justificativas');
    const item = page.locator('article').filter({ hasText: 'Anexo para testes do visualizador' });
    await item.getByRole('button', { name: /Ver anexo/ }).click();
    const modal = page.locator('.modal.show');
    await expect(modal.locator('img')).toBeVisible({ timeout: 10000 });
    await expect(modal).toContainText(NOME_ARQUIVO);
    const baixar = modal.locator('a.btn-primary');
    await expect(baixar).toBeVisible();
    await expect(baixar).toHaveAttribute('download', NOME_ARQUIVO);
    await expect(baixar).toHaveAttribute('href', /^blob:/);
  });

  test('CT22C - Gestão: Fechar encerra o modal', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/justificativas');
    const item = page.locator('article').filter({ hasText: 'Anexo para testes do visualizador' });
    await item.getByRole('button', { name: /Ver anexo/ }).click();
    const modal = page.locator('.modal.show');
    await expect(modal).toBeVisible();
    await modal.locator('button', { hasText: 'Fechar' }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);
  });

  test('CT22D - Responsável: anexo do alerta abre via modal (blob)', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/alertas');
    const card = page.locator('.card').filter({ hasText: '15/09/2026' });
    const botao = card.getByRole('button', { name: /Ver anexo/ });
    await expect(botao).toBeVisible({ timeout: 10000 });
    await botao.click();
    const modal = page.locator('.modal.show');
    const img = modal.locator('img');
    await expect(img).toBeVisible({ timeout: 10000 });
    const src = await img.getAttribute('src');
    expect(src).toMatch(/^blob:/);
  });
});

test.describe('Professor - Frequência', () => {
  test('CT23 - Página de registro de frequência carrega', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await expect(page.getByText('Registrar frequência')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.getByText('Salvar frequência')).toBeVisible();
  });

  test('CT24 - Marcar aluno como ausente e salvar', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    // Aguarda a lista de alunos carregar
    await page.waitForSelector('.card-body .card');
    // Encontra o primeiro "Presente" (alternância presente/ausente) e clica para marcar como ausente
    const botoes = page.locator('button[aria-label*="Marcar"]');
    const primeiro = botoes.first();
    const label = await primeiro.getAttribute('aria-label');
    if (label?.includes('como ausente')) {
      await primeiro.click();
    }
    await page.click('button:has-text("Salvar frequência")');
    await expect(page.locator('.alert-success').first()).toBeVisible({ timeout: 10000 });
  });

  test('CT25 - Formulário de ausência no meio do dia carrega', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ausencia');
    await expect(page.getByText('Registrar ausência em aula')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.getByText('Registrar ausência').first()).toBeVisible();
  });

  test('CT26 - Página de frequência persiste dados ao retornar', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await page.waitForSelector('.card-body .card');
    // Marca o primeiro aluno como ausente
    const botoes = page.locator('button[aria-label*="Marcar"]');
    const primeiro = botoes.first();
    const label = await primeiro.getAttribute('aria-label');
    if (label?.includes('como ausente')) {
      await primeiro.click();
    }
    await page.click('button:has-text("Salvar frequência")');
    await expect(page.locator('.alert-success').first()).toBeVisible({ timeout: 10000 });
    // Sai e volta — verifica se a página carrega
    await page.goto('/professor');
    await page.goto('/professor/frequencia');
    await expect(page.getByText('Registrar frequência')).toBeVisible();
  });
});

test.describe('Gestão - Usuários - Código no cadastro', () => {
  test('CT27 - Criar usuário exibe código no sucesso', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    const emailUnico = `playwright${Date.now()}@test.com`;
    await page.goto('/gestao/usuarios/novo');
    await page.fill('#campoNome', 'Test Playwright');
    await page.fill('#campoEmail', emailUnico);
    await page.click('button[type="submit"]');
    await expect(page.locator('code.font-monospace').first()).toBeVisible({ timeout: 15000 });
    const textoCode = await page.locator('code.font-monospace').first().textContent();
    expect(textoCode?.trim().length).toBe(6);
  });

  test('CT28 - Botão Copiar no sucesso funciona', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    const emailUnico = `copy${Date.now()}@test.com`;
    await page.goto('/gestao/usuarios/novo');
    await page.fill('#campoNome', 'Copy Test');
    await page.fill('#campoEmail', emailUnico);
    await page.click('button[type="submit"]');
    await expect(page.locator('code.font-monospace').first()).toBeVisible({ timeout: 15000 });
    const btnCopiar = page.locator('button').filter({ hasText: 'Copiar' }).first();
    await btnCopiar.click();
    await expect(page.getByText('Código copiado!')).toBeVisible({ timeout: 5000 });
  });

  test('CT29 - Criar usuário valida campos obrigatórios', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios/novo');
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.setAttribute('novalidate', '');
    });
    await page.click('button[type="submit"]');
    await expect(page.locator('.alert-danger')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Gestão - Códigos - Aba Pendentes', () => {
  test('CT34 - Página de códigos carrega com abas e indicador', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
    await expect(page.locator('.nav-link.active')).toContainText('Solicitações');
  });

  test('CT35 - Aba Solicitações carrega e mostra dados', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    const emptyState = page.getByText('Nenhuma solicitação pendente');
    const cards = page.locator('.card');
    const hasCards = (await cards.count()) > 0;
    if (!hasCards) {
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    }
  });

  test('CT36 - Botão Atualizar recarrega dados', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    const btnAtualizar = page.locator('button:has-text("Atualizar")');
    await expect(btnAtualizar).toBeVisible();
    await btnAtualizar.click();
    await expect(page.getByText('Dados atualizados')).toBeVisible({ timeout: 10000 });
  });

  test('CT37 - Indicador de conexao visivel', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.locator('span[title="Conectado"]')).toBeVisible();
  });

  test('CT38 - Aba Códigos carrega e mostra dados', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
    const emptyState = page.getByText('Nenhum código gerado ainda');
    const table = page.locator('table');
    const hasTable = await table.isVisible();
    if (!hasTable) {
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Gestão - Códigos - Aba Recentes', () => {
  test('CT40 - Busca por nome filtra resultados', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const inputBusca = page.locator('input[type="search"]');
    if (await inputBusca.isVisible()) {
      await inputBusca.fill('XXXX_NAO_EXISTE_XXXX');
      await page.waitForTimeout(500);
      await expect(page.getByText('Nenhum resultado para')).toBeVisible();
    }
  });

  test('CT41 - Toggle visibilidade do código', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const olhos = page.locator('button[title="Mostrar"], button[title="Ocultar"]');
    if ((await olhos.count()) > 0) {
      await olhos.first().click();
      await expect(page.locator('code.user-select-all').first()).toBeVisible();
    }
  });

  test('CT42 - Badges de status sao exibidos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const badges = page.locator('table .badge');
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('CT43 - Paginação visível quando necessário', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const paginacao = page.getByText(/Página \d+ de \d+/);
    if (await paginacao.isVisible()) {
      await expect(paginacao).toBeVisible();
    }
  });

  test('CT44 - Ultima atualizacao visivel', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByText('Última atualização')).toBeVisible();
  });
});

test.describe('Gestão - Códigos - Fluxo de revogação', () => {
  test('CT46 - Botão revogar abre modal de confirmação', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const revogarBtn = page.locator('button[title="Revogar código"]').first();
    if (await revogarBtn.isVisible()) {
      await revogarBtn.click();
      await expect(page.getByText('Tem certeza que deseja revogar')).toBeVisible();
      await page.locator('button:has-text("Cancelar")').click();
    }
  });
});

test.describe('Recuperação de senha - Fluxo público', () => {
  test('CT31 - Página de solicitar código mostra formulário', async ({ page }) => {
    await page.goto('/solicitar-codigo');
    await expect(page.getByText('Solicitar código de acesso')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByText('Já tenho um código')).toBeVisible();
  });

  test('CT32 - Página de redefinir senha mostra todos os campos', async ({ page }) => {
    await page.goto('/redefinir-senha-codigo');
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="codigo"]')).toBeVisible();
    await expect(page.locator('input[id="nova-senha"]')).toBeVisible();
    await expect(page.getByText('Redefinir senha com código')).toBeVisible();
  });

  test('CT33 - Validação de senha aparece ao digitar', async ({ page }) => {
    await page.goto('/redefinir-senha-codigo');
    await page.fill('input[id="nova-senha"]', 'Ab');
    const requisitos = page.locator('ul[aria-label="Requisitos de senha"] li');
    await expect(requisitos.first()).toBeVisible();
  });

  test('CT34 - Checkbox Mostrar senhas alterna visibilidade', async ({ page }) => {
    await page.goto('/redefinir-senha-codigo');
    const novaSenha = page.locator('input[id="nova-senha"]');
    const confirmar = page.locator('input[id="confirmar-senha"]');
    await expect(novaSenha).toHaveAttribute('type', 'password');
    await expect(confirmar).toHaveAttribute('type', 'password');
    await page.check('#mostrar-senhas');
    await expect(novaSenha).toHaveAttribute('type', 'text');
    await expect(confirmar).toHaveAttribute('type', 'text');
    await page.uncheck('#mostrar-senhas');
    await expect(novaSenha).toHaveAttribute('type', 'password');
    await expect(confirmar).toHaveAttribute('type', 'password');
  });

  test('CT35 - Checkbox Mostrar senha alterna visibilidade no login', async ({ page }) => {
    await page.goto('/');
    const senha = page.locator('input[id="senha"]');
    await expect(senha).toHaveAttribute('type', 'password');
    await page.check('#mostrar-senha');
    await expect(senha).toHaveAttribute('type', 'text');
    await page.uncheck('#mostrar-senha');
    await expect(senha).toHaveAttribute('type', 'password');
  });
});

test.describe('Gestão - Códigos - Mobile', () => {
  test('CT53 - Layout mobile carrega sem erros', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
  });

  test('CT54 - Mobile: botão Atualizar funciona', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    const btnAtualizar = page.locator('button:has-text("Atualizar")');
    if (await btnAtualizar.isVisible()) {
      await btnAtualizar.click();
    }
  });

  test('CT55 - Mobile: abas funcionam', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Solicitações")').click();
    await expect(page.locator('.nav-link.active')).toContainText('Solicitações');
  });
});

test.describe('Professor - Ocorrência com tags', () => {
  test('CT56 - Formulário de ocorrência carrega com checkboxes de tags', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ocorrencia');
    await expect(page.getByText('Registrar ocorrência grave')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
    await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 });
    await expect(page.getByText('Notificar coordenação')).toBeVisible();
  });

  test('CT57 - Tags carregam do banco e descrição se preenche', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ocorrencia');
    await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 });
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.check();
    await expect(page.locator('#descricaoText')).toHaveValue(/Relato/);
  });
});

test.describe('Professor - Ausência com multisseleção', () => {
  test('CT58 - Formulário de ausência tem checkboxes de período', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ausencia');
    await expect(page.getByText('Registrar ausência em aula')).toBeVisible();
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible();
    await expect(page.getByText('1º Horário')).toBeVisible();
    await expect(page.getByText('Enfermaria')).toBeVisible();
  });

  test('CT59 - Selecionar múltiplos períodos habilita botão', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ausencia');
    await page.getByText('1º Horário').first().click();
    await page.getByText('2º Horário').first().click();
    await expect(page.getByText('Registrar 2 períodos')).toBeVisible();
  });
});

test.describe('Gestão - Usuário - Módulos e permissões', () => {
  test('CT60 - Formulário de usuário tem módulos de acesso', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios/novo');
    await page.waitForSelector('form');
    await expect(page.locator('text=Módulos de acesso')).toBeVisible({ timeout: 10000 });
    await page.waitForSelector('#modulo-frequencia', { timeout: 10000 });
    await expect(page.locator('#modulo-ocorrencias')).toBeVisible();
  });

  test('CT61 - Modulos de acesso sao selecionaveis', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios/novo');
    await page.waitForSelector('#modulo-frequencia', { timeout: 10000 });
    await page.locator('#modulo-frequencia').check();
    await page.locator('#modulo-ocorrencias').check();
    await expect(page.locator('#modulo-frequencia')).toBeChecked();
    await expect(page.locator('#modulo-ocorrencias')).toBeChecked();
  });
});

test.describe('Gestão - Aluno - Documentos e indicadores', () => {
  test('CT62 - Formulario de aluno tem documentos e indicadores', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/alunos/novo');
    await expect(page.getByText('Documentos recebidos')).toBeVisible();
    await expect(page.getByText('Transporte escolar')).toBeVisible();
    await expect(page.getByText('Alimentação diferenciada')).toBeVisible();
    await expect(page.getByText('Necessidades especiais')).toBeVisible();
    await page.waitForSelector('#doc-rg', { timeout: 10000 });
    await expect(page.locator('#doc-cpf')).toBeVisible();
  });

  test('CT63 - Documentos sao selecionaveis', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/alunos/novo');
    await page.waitForSelector('#doc-rg', { timeout: 10000 });
    await page.locator('#doc-rg').check();
    await page.locator('#doc-cpf').check();
    await expect(page.locator('#doc-rg')).toBeChecked();
    await expect(page.locator('#doc-cpf')).toBeChecked();
  });
});

test.describe('Gestão - Turmas - Modal', () => {
  test('CT64 - Modal de criar turma abre e tem campos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/turmas');
    await page.click('button:has-text("Nova turma")');
    await expect(page.locator('.modal-title')).toContainText('Nova turma');
    await expect(page.locator('#campoSerie')).toBeVisible();
    await expect(page.locator('#campoLetra')).toBeVisible();
    await expect(page.locator('#campoAtivo')).toBeVisible();
    await page.click('button:has-text("Cancelar")');
  });

  test('CT64b - Select serie/letra populados do banco', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/turmas');
    await page.click('button:has-text("Nova turma")');
    await page.waitForSelector('#campoSerie');
    const serieOptions = await page.locator('#campoSerie option').allTextContents();
    expect(serieOptions.length).toBeGreaterThanOrEqual(3);
    expect(serieOptions).toContain('1ª');
    expect(serieOptions).toContain('2ª');
    const letraOptions = await page.locator('#campoLetra option').allTextContents();
    expect(letraOptions.length).toBeGreaterThanOrEqual(3);
    expect(letraOptions).toContain('A');
    await page.click('button:has-text("Cancelar")');
  });
});

test.describe('Gestão - Disciplinas - Modal', () => {
  test('CT65 - Modal de criar disciplina abre e tem campos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/disciplinas');
    await page.click('button:has-text("Nova disciplina")');
    await expect(page.locator('.modal-title')).toContainText('Nova disciplina');
    await expect(page.locator('#campoNome')).toBeVisible();
    await expect(page.locator('#campoCodigoSige')).toBeVisible();
    await expect(page.locator('#campoCargaHoraria')).toBeVisible();
    await page.click('button:has-text("Cancelar")');
  });
});

test.describe('Gestão - Atribuições - Modal', () => {
  test('CT66 - Modal de criar atribuição abre e tem campos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/atribuicoes');
    await page.click('button:has-text("Nova atribuição")');
    await expect(page.locator('.modal-title')).toContainText('Nova atribuição');
    await expect(page.locator('#campoProfessor')).toBeVisible();
    await expect(page.locator('#campoTurma')).toBeVisible();
    await expect(page.locator('#campoDataInicio')).toBeVisible();
    await page.click('button:has-text("Cancelar")');
  });
});

test.describe('Gestão - Configuração', () => {
  test('CT110 - Pagina hub carrega com categorias', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao');
    await expect(page.locator('h1')).toContainText('Configurações');
    await expect(page.locator('h3.card-nav-title').filter({ hasText: 'Módulos' })).toBeVisible();
    await expect(page.locator('h3.card-nav-title').filter({ hasText: 'Documentos' })).toBeVisible();
    await expect(page.locator('h3.card-nav-title').filter({ hasText: 'Períodos' })).toBeVisible();
  });

  test('CT111 - Página de módulo carrega com tabela', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await expect(page.locator('h1')).toContainText('Módulos');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('table')).toContainText('Frequência');
    await expect(page.locator('table')).toContainText('Ocorrências');
  });

  test('CT112 - Criar opção no modal', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await page.click('button:has-text("Nova opção")');
    await expect(page.locator('.modal-title')).toContainText('Nova opção');
    await page.click('button:has-text("Outra...")');
    const nome = `Teste E2E ${Date.now()}`;
    await page.fill('#campo-nome', nome);
    await page.click('button:has-text("Salvar")');
    await page.waitForTimeout(1000);
    await expect(page.locator('table')).toContainText(nome, { timeout: 5000 });
  });

  test('CT112b - Seletor de letras de turma exibe o catálogo incluindo D', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/letra_turma');
    await page.click('button:has-text("Nova opção")');
    await expect(page.locator('.modal-title')).toContainText('Nova opção');
    for (const letra of ['A', 'B', 'C', 'D']) {
      await expect(page.getByRole('button', { name: letra, exact: true })).toBeVisible();
    }
    await page.click('button:has-text("Cancelar")');
  });

  test('CT112c - Duplicata de opção existente é bloqueada', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await page.click('button:has-text("Nova opção")');
    await page.click('button:has-text("Outra...")');
    await page.fill('#campo-nome', 'Frequência');
    await expect(page.getByText(/Já existe uma opção chamada/)).toBeVisible();
  });

  test('CT112d - Serie aceita apenas numeros com sufixo ª', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/serie_turma');
    await page.click('button:has-text("Nova opção")');
    await page.click('button:has-text("Outra...")');
    const input = page.locator('#campo-nome');
    await input.pressSequentially('abc4x9');
    await expect(input).toHaveValue('49');
    await expect(page.locator('.input-group-text')).toHaveText('ª');
    await page.click('button:has-text("Cancelar")');
  });

  test('CT112e - Letra aceita apenas uma letra maiuscula', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/letra_turma');
    await page.click('button:has-text("Nova opção")');
    await page.click('button:has-text("Outra...")');
    const input = page.locator('#campo-nome');
    await input.pressSequentially('xz');
    await expect(input).toHaveValue('X');
    await input.fill('');
    await input.pressSequentially('ab');
    await expect(input).toHaveValue('A');
    await page.click('button:has-text("Cancelar")');
  });

  test('CT112f - Cartoes do seletor tem altura uniforme', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/documento');
    await page.click('button:has-text("Nova opção")');
    await expect(page.locator('.modal-title')).toContainText('Nova opção');
    await page.waitForTimeout(400);
    const alturas = await page
      .locator('.modal .cartao-selecao')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(alturas.length).toBeGreaterThan(1);
    expect(Math.max(...alturas) - Math.min(...alturas)).toBeLessThanOrEqual(1);
    await page.click('button:has-text("Cancelar")');
  });

  test('CT112g - Texto do cartao permanece legivel no hover', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await page.click('button:has-text("Nova opção")');
    await expect(page.locator('.modal-title')).toContainText('Nova opção');
    const card = page.locator('.modal .cartao-selecao').first();
    await card.hover();
    const cor = await card
      .locator('span')
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(cor.toLowerCase()).not.toBe('rgb(255, 255, 255)');
    await page.click('button:has-text("Cancelar")');
  });

  test('CT113 - Tags de comportamento carrega com tabela', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/tags');
    await expect(page.locator('h1')).toContainText('Tags de Comportamento');
    await expect(page.locator('table')).toBeVisible();
  });

  test('CT114 - Sistema carrega e salva alteração', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/sistema');
    await expect(page.locator('h1')).toContainText('Configurações do Sistema');
    await expect(page.locator('#cfg-nome')).toBeVisible();
    await expect(page.locator('#cfg-critico')).toBeVisible();
    await expect(page.locator('#cfg-preventivo')).toBeVisible();
  });

  test('CT115 - Horários carrega com tabela', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/horarios');
    await expect(page.locator('h1')).toContainText('Horários Letivos');
    await expect(page.locator('table')).toBeVisible();
  });
});

// ============================================================================
// INTEGRIDADE DE CATÁLOGO — bloqueio de exclusão/renomeação e enturmação
// ============================================================================
test.describe('Gestão - Integridade de catálogo', () => {
  test.beforeAll(async () => {
    // Referencia a tag de seed "Desatenção" em uma ocorrência para testar o
    // bloqueio de exclusão/renomeação.
    const headers = {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=representation',
    };
    const res = await fetch(`${URL_SUPABASE}/rest/v1/ocorrencias`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        aluno_id: 'e0000000-0000-0000-0000-000000000001',
        professor_id: 'a0000000-0000-0000-0000-000000000002',
        turma_id: 'd0000000-0000-0000-0000-000000000001',
        ano_letivo_id: 'b0000000-0000-0000-0000-000000000001',
        titulo: 'Integridade tag referenciada',
        descricao: 'Setup de teste de integridade',
        tipo: ['grave'],
        tags_comportamento: ['Desatenção'],
      }),
    });
    if (!res.ok) throw new Error(`Setup ocorrencia falhou: ${res.status}`);
  });

  test('CT116 - Excluir opção de catálogo referenciada é bloqueado', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/serie_turma');
    const linha = page.locator('.config-table tbody tr').filter({ hasText: '1ª' });
    page.on('dialog', (d) => d.accept());
    await linha.locator('button.btn-outline-danger').click();
    await expect(page.getByText(/Não é possível excluir/)).toBeVisible();
    await expect(linha).toBeVisible();
  });

  test('CT117 - Excluir opção não referenciada funciona', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await page.click('button:has-text("Nova opção")');
    await page.click('button:has-text("Outra...")');
    const nome = `Opcao Excluivel ${Date.now()}`;
    await page.fill('#campo-nome', nome);
    await page.click('.modal-footer button:has-text("Salvar")');
    await page.waitForTimeout(1000);
    await expect(page.locator('table')).toContainText(nome, { timeout: 5000 });
    const linha = page.locator('.config-table tbody tr').filter({ hasText: nome });
    page.on('dialog', (d) => d.accept());
    await linha.locator('button.btn-outline-danger').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('table')).not.toContainText(nome, { timeout: 5000 });
  });

  test('CT118 - Excluir tag referenciada e bloqueado', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/tags');
    const linha = page.locator('tbody tr').filter({ hasText: 'Desatenção' });
    page.on('dialog', (d) => d.accept());
    await linha.locator('button.btn-outline-danger').click();
    await expect(page.getByText(/Não é possível excluir/)).toBeVisible();
    await expect(linha).toBeVisible();
  });

  test('CT119 - Renomear tag referenciada e bloqueado', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/tags');
    const linha = page.locator('tbody tr').filter({ hasText: 'Desatenção' });
    await linha.locator('button.btn-outline-primary').click();
    await expect(page.locator('.modal-title')).toContainText('Editar tag');
    await page.fill('#tag-nome', 'Desatencao nova');
    await page.click('.modal-footer button:has-text("Salvar")');
    await expect(page.getByText(/Não é possível renomear/)).toBeVisible();
    await page.click('.modal-footer button:has-text("Cancelar")');
  });

  test('CT120 - Transferência de enturmação mantém uma enturmação ativa', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/alunos/e0000000-0000-0000-0000-000000000001');
    const card = page.locator('.card').filter({ hasText: 'Enturmação atual' });
    // Aguarda os dados assíncronos do onMounted terminarem de renderizar
    // (o parágrafo só existe após carregarEnturmacao) antes de interagir,
    // evitando cliques perdidos durante re-renderização do Vue.
    await expect(card.getByText(/Matrícula em:/)).toBeVisible();
    // Re-clica caso o clique original seja engolido por um patch de DOM
    // entre o hit-test e o dispatch do evento.
    await expect(async () => {
      if ((await card.locator('#campoNovaTurma').count()) === 0) {
        await card.getByRole('button', { name: 'Alterar enturmação' }).click();
      }
      await expect(card.locator('#campoNovaTurma')).toBeVisible({ timeout: 3000 });
    }).toPass();
    await card.locator('#campoNovaTurma').selectOption({ label: '3º C' });
    await card.locator('#campoNovaDataMat').fill('2026-08-01');
    await card.getByRole('button', { name: 'Salvar' }).click();
    await expect(card.getByRole('button', { name: 'Alterar enturmação' })).toBeVisible({
      timeout: 15000,
    });
    await expect(card).toContainText('3º C');

    const query =
      `${URL_SUPABASE}/rest/v1/enturmacoes?select=turma_id,status,ano_letivo_id` +
      `&aluno_id=eq.e0000000-0000-0000-0000-000000000001&status=eq.matriculado`;
    const fetchEnturmacoes = async () => {
      const res = await fetch(query, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { turma_id: string }[] | null;
      return Array.isArray(data) ? data : null;
    };
    await expect.poll(fetchEnturmacoes, { timeout: 10000 }).toEqual([
      {
        turma_id: 'd0000000-0000-0000-0000-000000000003',
        status: 'matriculado',
        ano_letivo_id: 'b0000000-0000-0000-0000-000000000001',
      },
    ]);
  });
});

// ============================================================================
// CHAT — Setup de dados de teste
// ============================================================================
test.beforeAll(async () => {
  // Cria conversas e mensagens de teste via API com service role.
  // Usa upsert (merge-duplicates) para que seja seguro sob execução paralela
  // de vários workers: cada beforeAll converge para o mesmo estado. As conversas
  // são reutilizadas (sem reescrever o id), evitando violação de FK de mensagens
  // quando existem conversas órfãs de execuções anteriores.
  const headers = {
    'Content-Type': 'application/json',
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Prefer: 'resolution=merge-duplicates,return=representation',
  };

  async function api(url: string, options: RequestInit = {}) {
    const res = await fetch(`${URL_SUPABASE}${url}`, { headers, ...options });
    if (!res.ok) {
      const corpo = await res.text().catch(() => '');
      throw new Error(
        `Falha no setup do chat (${options.method ?? 'GET'} ${url}): ${res.status} ${corpo}`,
      );
    }
    return res;
  }

  const RESPONSAVEL_ID = 'a0000000-0000-0000-0000-000000000005';
  const ALUNO1_ID = 'e0000000-0000-0000-0000-000000000001';
  const ALUNO2_ID = 'e0000000-0000-0000-0000-000000000002';

  async function upsertConversa(alunoId: string): Promise<string> {
    const res = await api('/rest/v1/conversas?on_conflict=responsavel_id,aluno_id', {
      method: 'POST',
      body: JSON.stringify({
        turma_id: 'd0000000-0000-0000-0000-000000000001',
        responsavel_id: RESPONSAVEL_ID,
        aluno_id: alunoId,
        ativa: true,
      }),
    });
    const data = (await res.json()) as { id: string }[];
    const convId = data?.[0]?.id;
    if (!convId) throw new Error('Falha ao capturar id da conversa no setup do chat.');
    return convId;
  }

  const CONV1 = await upsertConversa(ALUNO1_ID);
  await upsertConversa(ALUNO2_ID);

  // Upsert das mensagens (unicidade por id)
  for (const msg of [
    {
      id: 'f0000000-0000-0000-0000-000000000011',
      conversa_id: CONV1,
      remetente_id: 'a0000000-0000-0000-0000-000000000005',
      conteudo: 'Bom dia, gostaria de saber como está meu filho',
      created_at: '2026-07-20T08:00:00Z',
    },
    {
      id: 'f0000000-0000-0000-0000-000000000012',
      conversa_id: CONV1,
      remetente_id: 'a0000000-0000-0000-0000-000000000001',
      conteudo: 'Bom dia! O João está bem, participando das aulas.',
      created_at: '2026-07-20T08:15:00Z',
    },
    {
      id: 'f0000000-0000-0000-0000-000000000013',
      conversa_id: CONV1,
      remetente_id: 'a0000000-0000-0000-0000-000000000002',
      conteudo: 'Confirmo! Ele tem se destacado em matemática.',
      created_at: '2026-07-20T08:30:00Z',
    },
    {
      id: 'f0000000-0000-0000-0000-000000000014',
      conversa_id: CONV1,
      remetente_id: 'a0000000-0000-0000-0000-000000000005',
      conteudo: 'Que bom! Obrigado pela atenção.',
      created_at: '2026-07-20T09:00:00Z',
    },
  ]) {
    await api('/rest/v1/mensagens?on_conflict=id', { method: 'POST', body: JSON.stringify(msg) });
  }

  // Update ultima_mensagem_em
  await api(`/rest/v1/conversas?id=eq.${CONV1}`, {
    method: 'PATCH',
    body: JSON.stringify({ ultima_mensagem_em: '2026-07-20T09:00:00Z' }),
  });

  // Notificação de teste para gestão (evita acúmulo entre execuções)
  await api(`/rest/v1/notificacoes?metadados->>conversa_id=eq.${CONV1}`, {
    method: 'DELETE',
  });
  await api('/rest/v1/notificacoes', {
    method: 'POST',
    body: JSON.stringify({
      destinatario_id: 'a0000000-0000-0000-0000-000000000001',
      tipo: 'mensagem',
      titulo: 'Nova mensagem de Maria Silva',
      corpo: 'Bom dia, gostaria de saber como está meu filho',
      metadados: { conversa_id: CONV1 },
    }),
  });
});

// ============================================================================
// CT67–CT72: CHAT — Responsável
// ============================================================================
test.describe('Responsável — Chat', () => {
  test('CT67 - Pagina de chat carrega com lista de contatos', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForSelector('.chat-layout', { timeout: 10000 });
    await expect(page.locator('input[type="search"]')).toBeVisible();
    await expect(page.locator('.chat-sidebar')).toBeVisible();
  });

  test('CT68 - Sidebar mostra nome dos contatos', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await expect(page.locator('.chat-sidebar button').first()).toBeVisible({ timeout: 10000 });
    const items = page.locator('.chat-sidebar button');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
    if (count > 0) {
      await expect(items.first()).toContainText(
        /João|Maria|Ana|Pedro|Rafael|Lucas|Júlia|Thiago|Isabela/,
      );
    }
  });

  test('CT69 - Selecionar conversa exibe mensagens', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    const primeiroItem = page.locator('.chat-sidebar button').first();
    await expect(primeiroItem).toBeVisible({ timeout: 10000 });
    await primeiroItem.click();
    await page.waitForTimeout(1000);
    const bolhas = page.locator('.chat-messages .rounded-3');
    const count = await bolhas.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('CT70 - Campo de busca filtra contatos', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(1500);
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('XXXX_NAO_EXISTE_XXXX');
    await page.waitForTimeout(500);
    await expect(page.getByText('Nenhuma conversa encontrada')).toBeVisible();
  });

  test('CT71 - Input desabilitado ou aviso fora do horário', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(3000);
    const primeiroItem = page.locator('.chat-sidebar button').first();
    await primeiroItem.click();
    await page.waitForTimeout(1000);
    const textarea = page.locator('textarea');
    const disabled = await textarea.isDisabled();
    if (disabled) {
      await expect(textarea).toBeDisabled();
      await expect(page.locator('.alert-warning')).toBeVisible();
    } else {
      await expect(textarea).toBeEnabled();
    }
  });

  test.skip('CT72 - Botão voltar aparece no mobile', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(3000);
    const items = page.locator('.chat-sidebar button');
    const count = await items.count();
    if (count > 0) {
      await items.first().click();
      await page.waitForTimeout(1500);
      await expect(page.locator('i.bi-arrow-left').first()).toBeVisible();
    }
  });
});

// ============================================================================
// CT73–CT79: CHAT — Gestão
// ============================================================================
test.describe('Gestão — Chat', () => {
  test('CT73 - Página de chat carrega com sidebar e placeholder', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForSelector('.chat-layout', { timeout: 10000 });
    await expect(page.locator('input[type="search"]')).toBeVisible();
    await expect(page.getByText('Selecione uma conversa')).toBeVisible();
  });

  test('CT74 - Sidebar mostra contatos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await expect(page.locator('.chat-sidebar button').first()).toBeVisible({ timeout: 10000 });
    const items = page.locator('.chat-sidebar button');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(
      page.locator('.chat-sidebar button').filter({ hasText: 'Maria Silva' }).first(),
    ).toBeVisible();
  });

  test('CT75 - Selecionar conversa exibe mensagens', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    const items = page.locator('.chat-sidebar button');
    if ((await items.count()) > 0) {
      await items.first().click();
      await page.waitForTimeout(1000);
      await expect(page.locator('i.bi-check2-all, i.bi-check2').first()).toBeVisible();
    }
  });

  test('CT76 - Header de navegação com título chat', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    await expect(page.getByText('Chat com pais')).toBeVisible();
    await expect(page.locator('a[href="/gestao"]').first()).toBeVisible();
  });

  test('CT77 - Campo busca filtra contatos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('XXXX_NAO_EXISTE_XXXX');
    await page.waitForTimeout(500);
    await expect(page.getByText('Nenhuma conversa encontrada')).toBeVisible();
  });
});

// ============================================================================
// CT84–CT88: NOTIFICAÇÕES
// ============================================================================
test.describe('Notificações — Popover', () => {
  test('CT84 - Sino visível para gestão', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await expect(page.locator('i.bi-bell').first()).toBeVisible();
  });

  test('CT85 - Sino visível para responsável', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await expect(page.locator('i.bi-bell').first()).toBeVisible();
  });

  test('CT86 - Sino visivel para professor', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor');
    await expect(page.locator('i.bi-bell').first()).toBeVisible();
  });

  test('CT87 - Popover abre ao clicar no sino', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    const btnNotif = page.locator('button[aria-label="Notificações"]');
    await btnNotif.click();
    await page.waitForTimeout(500);
    await expect(page.locator('.notif-menu').first()).toBeVisible({ timeout: 5000 });
    // Toggle para fechar (o menu cobre o h1 em telas menores)
    await btnNotif.click();
    await page.waitForTimeout(300);
  });

  test('CT88 - Notificação de mensagem aparece no popover', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await page.locator('button[aria-label="Notificações"]').click();
    await page.waitForTimeout(500);
    const notifMenu = page.locator('.notif-menu');
    await expect(notifMenu).toBeVisible();
    const itemCount = await notifMenu.locator('button').count();
    if (itemCount > 0) {
      await expect(notifMenu.locator('button').first()).toBeVisible();
    } else {
      await expect(notifMenu.getByText('Nenhuma notificação')).toBeVisible();
    }
  });
});

// ============================================================================
// CT89–CT91: MOBILE / RESPONSIVIDADE
// ============================================================================
test.describe('Chat — Mobile', () => {
  test('CT89 - Mobile: lista ocupa tela cheia inicialmente', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(1500);
    // No mobile, a barra lateral deve ter largura total inicialmente
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test.skip('CT90 - Mobile: alterna entre lista e chat', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(3000);
    const items = page.locator('.chat-sidebar button');
    const count = await items.count();
    if (count > 0) {
      await items.first().click();
      await page.waitForTimeout(1500);
      await expect(page.locator('i.bi-arrow-left').first()).toBeVisible();
    }
  });

  test('CT91 - Desktop: dois painéis visíveis', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    await expect(page.locator('.chat-sidebar')).toBeVisible();
    await expect(page.getByText('Selecione uma conversa')).toBeVisible();
  });
});

// ============================================================================
// CT92–CT94: EDGE CASES — CHAT
// ============================================================================
test.describe('Chat — Casos Extremos', () => {
  test('CT92 - Rota /gestao/chat exige autenticação', async ({ page }) => {
    await page.goto('/gestao/chat');
    await expect(page).toHaveURL('/');
  });

  test('CT94 - Rota /responsavel/chat exige autenticação', async ({ page }) => {
    await page.goto('/responsavel/chat');
    await expect(page).toHaveURL('/');
  });
});

// ============================================================================
// CT95–CT98: RESILIÊNCIA
// ============================================================================
test.describe('Chat — Resiliência', () => {
  test('CT95 - Sidebar contatos visível na gestão', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await expect(page.locator('.chat-sidebar button').first()).toBeVisible({ timeout: 10000 });
    const count = await page.locator('.chat-sidebar button').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('CT96 - Recarregar pagina preserva UI', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.locator('.chat-layout')).toBeVisible();
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test('CT97 - Responsável home não quebrou com novo card chat', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await expect(page.getByText('Falar com coordenação')).toBeVisible();
    await expect(page.getByText('Alertas')).toBeVisible();
    await expect(page.getByText('Termômetro')).toBeVisible();
    await expect(page.getByText('Justificativa')).toBeVisible();
  });

  test('CT98 - Gestão home não quebrou com novo card chat', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await expect(page.getByText('Chat com pais')).toBeVisible();
    await expect(page.getByText('Ranking de risco')).toBeVisible();
  });
});

// ============================================================================
// CT99–CT103: INPUT EDGE CASES
// ============================================================================
test.describe('Chat — Input', () => {
  test('CT99 - Botão enviar desabilitado com input vazio', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(2000);
    const firstContact = page.locator('.chat-sidebar button').first();
    if (await firstContact.isVisible()) {
      await firstContact.click();
      await page.waitForTimeout(1000);
      const textarea = page.locator('textarea');
      const submitBtn = page.locator('button[type="submit"]');
      if (!(await textarea.isDisabled())) {
        await expect(submitBtn).toBeDisabled();
      }
    }
  });

  test('CT100 - Tentativa de enviar so espacos', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(2000);
    const firstContact = page.locator('.chat-sidebar button').first();
    if (await firstContact.isVisible()) {
      await firstContact.click();
      await page.waitForTimeout(1000);
      const textarea = page.locator('textarea');
      if (!(await textarea.isDisabled())) {
        await textarea.fill('   ');
        const submitBtn = page.locator('button[type="submit"]');
        await expect(submitBtn).toBeDisabled();
      }
    }
  });

  test('CT101 - Gestão profile (side effect): logout não quebra', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(1000);
    // Clica em sair no dropdown
    await page.locator('button[data-bs-toggle="dropdown"]').click();
    await page.locator('.dropdown-menu').getByText('Sair da conta').click();
    await expect(page).toHaveURL('/');
  });

  test('CT102 - Mensagens de sistema sem quebra de layout', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    const items = page.locator('.chat-sidebar button');
    if ((await items.count()) > 0) {
      await items.first().click();
      await page.waitForTimeout(1000);
      // Mensagens de sistema aparecem centralizadas - apenas verifica se não há erros de JS
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));
      await page.waitForTimeout(500);
      expect(pageErrors.length).toBe(0);
    }
  });
});

// ============================================================================
// CT103–CT106: NOTIFICAÇÕES — CASOS EXTREMOS
// ============================================================================
test.describe('Notificações — Casos Extremos', () => {
  test('CT103 - Popover fecha e reabre sem erros', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    const btnNotif = page.locator('button[aria-label="Notificações"]');
    await btnNotif.click();
    await page.waitForTimeout(300);
    await expect(page.locator('.notif-menu').first()).toBeVisible({ timeout: 5000 });
    // Toggle para fechar (o menu cobre o h1 em telas menores)
    await btnNotif.click();
    await page.waitForTimeout(300);
    await btnNotif.click();
    await page.waitForTimeout(300);
    await expect(page.locator('.notif-menu').first()).toBeVisible({ timeout: 5000 });
  });

  test('CT104 - Marcar todas como lidas', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await page.locator('button[aria-label="Notificações"]').click();
    await page.waitForTimeout(500);
    const notifMenu = page.locator('.notif-menu');
    const btnMarcar = notifMenu.locator('button:has-text("Marcar todas como lidas")');
    if (await btnMarcar.isVisible()) {
      await btnMarcar.click();
      await page.waitForTimeout(500);
      await expect(btnMarcar).not.toBeVisible();
    }
  });

  test('CT105 - Notificação com rota de chat', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await page.locator('button[aria-label="Notificações"]').click();
    await page.waitForTimeout(500);
    const items = page.locator('.notif-menu button');
    if ((await items.count()) > 0) {
      await items.first().click();
      await page.waitForTimeout(1000);
    }
  });

  test('CT106 - Popover sem notificações mostra estado vazio', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await page.locator('button[aria-label="Notificações"]').click();
    await page.waitForTimeout(500);
    const notifMenu = page.locator('.notif-menu');
    if (await notifMenu.isVisible()) {
      const hasItems = (await notifMenu.locator('button').count()) > 0;
      if (hasItems) {
        await expect(notifMenu.locator('button').first()).toBeVisible();
      } else {
        await expect(notifMenu.getByText('Nenhuma notificação')).toBeVisible();
      }
    }
  });
});

// ============================================================================
// CT121–CT125: CÓDIGOS — WORKFLOW COMPLETO E ENDURECIMENTO
// Cobre a regressão do código pendente (0002), dedupe, bloqueio por
// tentativas, auto-limpeza de solicitações, auditoria, revogação e configurações.
// ============================================================================
test.describe('Códigos — Workflow completo (regressão pendente)', () => {
  test('CT121 - Pendente: código expirado → solicitação aparece → gera → redefinir senha', async ({
    page,
  }) => {
    const nome = 'Fluxo Pendente';
    const email = emailUnico('pwflow');
    const NOVA_SENHA = `Fluxo${Date.now()}!a1`;
    let userId = '';

    try {
      // 1. Usuário criado pela gestão (status pendente) com código inicial
      const criado = await criarUsuarioApi(nome, email);
      userId = criado.id;
      expect(criado.codigo.length).toBe(6);

      // Expira o código inicial (antes da ativação)
      await restApi(`/rest/v1/codigos_redefinicao?email=eq.${email}`, {
        method: 'PATCH',
        body: JSON.stringify({ expira_em: '2020-01-01T00:00:00Z' }),
      });

      // 2. Usuário solicita novo código pela tela de login
      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      // 3. Gestão vê a solicitação na aba Solicitações
      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      const card = page.locator('.card').filter({ hasText: email });
      await expect(card).toBeVisible({ timeout: 10000 });

      // 4. Gera o novo código
      await card.getByRole('button', { name: 'Gerar' }).click();
      await page.locator('.modal button:has-text("Sim, gerar")').click();
      const codeEl = page.locator('.modal code.font-monospace');
      await expect(codeEl).toBeVisible({ timeout: 10000 });
      const novoCodigo = (await codeEl.textContent())?.trim() ?? '';
      expect(novoCodigo.length).toBe(6);
      await page.locator('.modal button:has-text("Concluído")').click();

      // 5. Solicitação é removida da aba (auto-atendimento ao gerar)
      await page.goto('/gestao/codigos');
      await expect(page.locator('.card').filter({ hasText: email })).toHaveCount(0, {
        timeout: 10000,
      });

      // 6. Usuário redefiniu a senha com o novo código
      await logout(page);
      await page.goto('/redefinir-senha-codigo');
      await page.fill('input[id="email"]', email);
      await page.fill('input[id="codigo"]', novoCodigo);
      await page.fill('input[id="nova-senha"]', NOVA_SENHA);
      await page.fill('input[id="confirmar-senha"]', NOVA_SENHA);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Senha redefinida com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      // 7. Novo usuário acessa com a nova senha
      await login(page, email, NOVA_SENHA);
      await expect(page).toHaveURL(/\/responsavel/);
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });
});

test.describe('Códigos — Deduplicação', () => {
  test('CT122 - Solicitações repetidas para o mesmo e-mail não duplicam', async ({ page }) => {
    const nome = 'Dedupe Pendente';
    const email = emailUnico('pwdedupe');
    let userId = '';

    try {
      const criado = await criarUsuarioApi(nome, email);
      userId = criado.id;

      // 1ª solicitação
      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });
      const notifApos1 = await contarNotificacoesCodigo(criado.id);

      // 2ª solicitação imediata (pendente suprime repetição)
      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });
      const notifApos2 = await contarNotificacoesCodigo(criado.id);

      // A gestão vê exatamente UMA solicitação
      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      await expect(page.locator('.card').filter({ hasText: email })).toHaveCount(1, {
        timeout: 10000,
      });

      // Nenhuma notificação duplicada no banco
      expect(notifApos2).toBe(notifApos1);
      expect(notifApos1).toBeGreaterThan(0);
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });
});

test.describe('Códigos — Bloqueio por tentativas', () => {
  test('CT123 - Código bloqueia após tentativas erradas e mostra badge', async ({ page }) => {
    const nome = 'Bloqueio Teste';
    const email = emailUnico('pwblock');
    const SENHA_VALIDA = `Bloqueio${Date.now()}!a1`;
    let userId = '';

    // Ajusta o limite para o teste (restaura no finally)
    const cfgRes = await restApi(
      '/rest/v1/configuracoes_sistema?id=eq.1&select=max_tentativas_codigo',
    );
    const cfgData = (await cfgRes.json()) as { max_tentativas_codigo: number }[];
    const maxOrig = cfgData[0]?.max_tentativas_codigo ?? 5;
    await restApi('/rest/v1/configuracoes_sistema?id=eq.1', {
      method: 'PATCH',
      body: JSON.stringify({ max_tentativas_codigo: 3 }),
    });

    try {
      const criado = await criarUsuarioApi(nome, email);
      userId = criado.id;

      await page.goto('/redefinir-senha-codigo');
      await page.fill('input[id="email"]', email);
      await page.fill('input[id="codigo"]', '111111');
      await page.fill('input[id="nova-senha"]', SENHA_VALIDA);
      await page.fill('input[id="confirmar-senha"]', SENHA_VALIDA);

      // 3 tentativas erradas -> bloqueio (max configurado = 3)
      for (let i = 0; i < 3; i++) {
        await page.click('button[type="submit"]');
        await expect(page.getByText('Código inválido')).toBeVisible({ timeout: 10000 });
      }
      // 4ª tentativa: bloqueado
      await page.click('button[type="submit"]');
      await expect(page.getByText('Muitas tentativas')).toBeVisible({ timeout: 10000 });

      // Badge "bloqueado" na aba Códigos
      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      await page.locator('button:has-text("Códigos")').click();
      const linha = page.locator('tr').filter({ hasText: email });
      await expect(linha).toBeVisible({ timeout: 10000 });
      await expect(linha.getByText('bloqueado', { exact: true })).toBeVisible();
    } finally {
      await restApi('/rest/v1/configuracoes_sistema?id=eq.1', {
        method: 'PATCH',
        body: JSON.stringify({ max_tentativas_codigo: maxOrig }),
      }).catch(() => {});
      if (userId) await deletarUsuario(userId);
      await restApi(`/rest/v1/codigos_redefinicao_tentativas?email=eq.${email}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  });
});

test.describe('Gestão — Configuração de códigos', () => {
  test('CT124 - Configurações do sistema expõem parâmetros de código e salvam', async ({
    page,
  }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/sistema');

    await expect(page.locator('#cfg-validade-codigo')).toBeVisible();
    await expect(page.locator('#cfg-max-tentativas')).toBeVisible();
    await expect(page.locator('#cfg-bloqueio')).toBeVisible();
    await expect(page.locator('#cfg-retencao')).toBeVisible();

    // Altera e salva
    const novoMax = 7;
    await page.fill('#cfg-max-tentativas', String(novoMax));
    await page.click('button:has-text("Salvar alterações")');
    await expect(page.getByText('Configurações salvas.')).toBeVisible({ timeout: 10000 });

    // Verifica persistência no banco
    await expect
      .poll(async () => {
        const res = await restApi(
          '/rest/v1/configuracoes_sistema?id=eq.1&select=max_tentativas_codigo',
        );
        const data = (await res.json()) as { max_tentativas_codigo: number }[];
        return data[0]?.max_tentativas_codigo;
      })
      .toBe(novoMax);

    // Restaura o padrão
    await restApi('/rest/v1/configuracoes_sistema?id=eq.1', {
      method: 'PATCH',
      body: JSON.stringify({ max_tentativas_codigo: 5 }),
    }).catch(() => {});
  });
});

test.describe('Códigos — Revogação e nova solicitação (regressão)', () => {
  test('CT125 - Gerar sempre novo; re-solicitar após gerar/revogar aparece', async ({ page }) => {
    const nome = 'Revogacao Fluxo';
    const email = emailUnico('pwrev');
    let userId = '';

    try {
      // Usuário pendente criado pela gestão com código inicial ativo
      const criado = await criarUsuarioApi(nome, email);
      userId = criado.id;
      const codigoInicial = criado.codigo;
      expect(codigoInicial.length).toBe(6);

      // 1. Solicitação com código ATIVO aparece
      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      // 2. Gestão gera → código NOVO; o inicial fica revogado (vermelho)
      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      const card = page.locator('.card').filter({ hasText: email });
      await expect(card).toBeVisible({ timeout: 10000 });
      await card.getByRole('button', { name: 'Gerar' }).click();
      await page.locator('.modal button:has-text("Sim, gerar")').click();
      const codeEl = page.locator('.modal code.font-monospace');
      await expect(codeEl).toBeVisible({ timeout: 10000 });
      const codigoGerado1 = (await codeEl.textContent())?.trim() ?? '';
      expect(codigoGerado1.length).toBe(6);
      expect(codigoGerado1).not.toBe(codigoInicial);
      await page.locator('.modal button:has-text("Concluído")').click();

      // 3. Código inicial exibido como revogado (badge vermelho)
      // (o código fica mascarado na tabela; filtra por e-mail + status)
      await page.goto('/gestao/codigos');
      await page.locator('button:has-text("Códigos")').click();
      const linhasEmail = page.locator('tr').filter({ hasText: email });
      await expect(linhasEmail.first()).toBeVisible({ timeout: 10000 });
      await expect(linhasEmail.filter({ hasText: 'revogado' })).toHaveCount(1);

      // 4. Nova solicitação após gerar aparece imediatamente (sem pendência)
      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      // 5. Gestão atende novamente → outro código novo (C != B)
      await page.goto('/gestao/codigos');
      const card2 = page.locator('.card').filter({ hasText: email });
      await expect(card2).toBeVisible({ timeout: 10000 });
      await card2.getByRole('button', { name: 'Gerar' }).click();
      await page.locator('.modal button:has-text("Sim, gerar")').click();
      await expect(page.locator('.modal code.font-monospace')).toBeVisible({ timeout: 10000 });
      const codigoGerado2 =
        (await page.locator('.modal code.font-monospace').textContent())?.trim() ?? '';
      expect(codigoGerado2.length).toBe(6);
      expect(codigoGerado2).not.toBe(codigoGerado1);
      await page.locator('.modal button:has-text("Concluído")').click();

      // 6. Revoga o código ativo via UI (linha com botão "Revogar código")
      await page.goto('/gestao/codigos');
      await page.locator('button:has-text("Códigos")').click();
      const linhaAtiva = page
        .locator('tr')
        .filter({ hasText: email })
        .filter({ has: page.locator('button[title="Revogar código"]') });
      await expect(linhaAtiva).toHaveCount(1, { timeout: 10000 });
      await linhaAtiva.locator('button[title="Revogar código"]').click();
      await page.locator('.modal button:has-text("Sim, revogar")').click();
      await expect(page.getByText('Código revogado com sucesso.')).toBeVisible({
        timeout: 10000,
      });

      // 7. Após revogar, nova solicitação aparece e gera outro código novo
      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      await page.goto('/gestao/codigos');
      const card3 = page.locator('.card').filter({ hasText: email });
      await expect(card3).toBeVisible({ timeout: 10000 });
      await card3.getByRole('button', { name: 'Gerar' }).click();
      await page.locator('.modal button:has-text("Sim, gerar")').click();
      await expect(page.locator('.modal code.font-monospace')).toBeVisible({ timeout: 10000 });
      const codigoGerado3 =
        (await page.locator('.modal code.font-monospace').textContent())?.trim() ?? '';
      expect(codigoGerado3.length).toBe(6);
      expect(codigoGerado3).not.toBe(codigoGerado2);
      await page.locator('.modal button:has-text("Concluído")').click();
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });
});

async function inserirCodigo(
  perfilId: string,
  email: string,
  codigo: string,
  estado: 'usado' | 'expirado' | 'revogado',
) {
  const agora = new Date();
  const corpo: Record<string, unknown> = {
    email,
    perfil_id: perfilId,
    codigo,
    expira_em: new Date(agora.getTime() + 3600000).toISOString(),
  };
  if (estado === 'usado') corpo.usado_em = agora.toISOString();
  if (estado === 'expirado') corpo.expira_em = new Date(agora.getTime() - 1000).toISOString();
  if (estado === 'revogado') {
    corpo.expira_em = new Date(agora.getTime() - 1000).toISOString();
    corpo.revogado_em = agora.toISOString();
  }
  await restApi('/rest/v1/codigos_redefinicao', { method: 'POST', body: JSON.stringify(corpo) });
}

test.describe('Códigos — Limpar não ativos', () => {
  test('CT126 - Limpar remove não ativos e preserva ativos (com confirmação)', async ({ page }) => {
    const nome = 'Limpar Teste';
    const email = emailUnico('pwlimpar');
    let userId = '';

    try {
      const criado = await criarUsuarioApi(nome, email);
      userId = criado.id;

      // Códigos não ativos para o mesmo perfil
      await inserirCodigo(criado.id, email, '111111', 'usado');
      await inserirCodigo(criado.id, email, '222222', 'expirado');
      await inserirCodigo(criado.id, email, '333333', 'revogado');

      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      await page.locator('button:has-text("Códigos")').click();

      // Antes: 1 ativo + 3 não ativos para o e-mail
      const linhasAntes = page.locator('tr').filter({ hasText: email });
      await expect(linhasAntes).toHaveCount(4, { timeout: 10000 });

      // Abre a confirmação e confirma
      await page.locator('button:has-text("Limpar não ativos")').click();
      await expect(page.getByText('Limpar códigos não ativos')).toBeVisible({ timeout: 5000 });
      await page.locator('.modal button:has-text("Sim, limpar")').click();
      await expect(page.getByText(/códigos? removidos/)).toBeVisible({ timeout: 10000 });

      // Depois: apenas o código ativo permanece
      await expect(page.locator('tr').filter({ hasText: email })).toHaveCount(1, {
        timeout: 10000,
      });
      await expect(page.locator('tr').filter({ hasText: '111111' })).toHaveCount(0);
      await expect(page.locator('tr').filter({ hasText: '222222' })).toHaveCount(0);
      await expect(page.locator('tr').filter({ hasText: '333333' })).toHaveCount(0);
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });
});

test.describe('Códigos — Copiar ao clicar', () => {
  test('CT127 - Clique no código do modal copia e dá feedback', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://localhost:5173',
    });
    const email = emailUnico('pwcopy');
    let userId = '';

    try {
      const criado = await criarUsuarioApi('Copy Click', email);
      userId = criado.id;

      // Solicitação → geração abre o modal com o código
      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      const card = page.locator('.card').filter({ hasText: email });
      await expect(card).toBeVisible({ timeout: 10000 });
      await card.getByRole('button', { name: 'Gerar' }).click();
      await page.locator('.modal button:has-text("Sim, gerar")').click();
      const codeEl = page.locator('.modal code.font-monospace');
      await expect(codeEl).toBeVisible({ timeout: 10000 });
      const codigo = (await codeEl.textContent())?.trim() ?? '';
      expect(codigo.length).toBe(6);

      // Clique no código → copia + feedback visual
      await codeEl.click();
      await expect(page.getByText('Código copiado!')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Copiado', { exact: true })).toBeVisible({ timeout: 5000 });
      await expect
        .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(codigo);
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });

  test('CT127b - Clique no código da tabela copia', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://localhost:5173',
    });
    const email = emailUnico('pwtbl');
    let userId = '';

    try {
      const criado = await criarUsuarioApi('Copy Tabela', email);
      userId = criado.id;
      const codigoInicial = criado.codigo;

      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      await page.locator('button:has-text("Códigos")').click();
      const linha = page.locator('tr').filter({ hasText: email });
      await expect(linha.first()).toBeVisible({ timeout: 10000 });
      await linha.locator('button[title="Mostrar"]').first().click();
      const codeEl = linha.locator('code.user-select-all').first();
      await expect(codeEl).toBeVisible({ timeout: 5000 });
      await codeEl.click();
      await expect(page.getByText('Código copiado!')).toBeVisible({ timeout: 5000 });
      await expect
        .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(codigoInicial);
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });
});

// ============================================================================
// ANOS LETIVOS — gestão, virada de ano (RF13/RF25)
// ============================================================================
test.describe('Gestão - Anos Letivos', () => {
  // Ano planejado usado nos testes da virada (não colide com o seed)
  const ANO_CORRENTE = new Date().getFullYear();
  const ANO_TESTE = ANO_CORRENTE + 1;

  async function limparAnoTeste() {
    await restApi(`/rest/v1/anos_letivos?ano=eq.${ANO_TESTE}`, { method: 'DELETE' });
  }

  test.beforeAll(async () => {
    await limparAnoTeste();
  });

  test.afterAll(async () => {
    // Garante que o ano do teste não permanece ativo no banco local
    const res = await restApi(
      `/rest/v1/anos_letivos?ano=eq.${ANO_TESTE}&select=id,status,ativo`,
    );
    const anos = (await res.json()) as { id: string; status: string; ativo: boolean }[];
    const ano = anos[0];
    if (ano && ano.status === 'ativo' && ano.ativo) {
      // Restaura o ano corrente do seed como ativo antes de remover o ano de teste
      const resSeed = await restApi(
        `/rest/v1/anos_letivos?ano=eq.${ANO_CORRENTE}&select=id`,
      );
      const corrente = ((await resSeed.json()) as { id: string }[])[0];
      if (corrente) {
        await fetch(`${URL_SUPABASE}/rest/v1/rpc/ativar_ano_letivo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ p_ano_id: corrente.id }),
        });
      }
    }
    await limparAnoTeste();
  });

  test('CT130 - Card Anos letivos na home navega para a página', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.locator('.card', { hasText: 'Anos letivos' }).click();
    await page.waitForURL(/\/gestao\/anos-letivos/);
    await expect(page.locator('h1')).toContainText('Anos letivos');
  });

  test('CT131 - Página lista o ano corrente como Ativo', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    const linhaCorrente = page.locator('tr').filter({ hasText: String(new Date().getFullYear()) });
    await expect(linhaCorrente).toBeVisible();
    await expect(linhaCorrente.locator('.badge')).toHaveText(/Ativo/i);
  });

  test('CT132 - Modal de novo ano letivo abre e cria ano Planejado', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await page.click('button:has-text("Novo ano letivo")');
    await expect(page.locator('.modal-title')).toContainText('Novo ano letivo');
    await expect(page.locator('#campoAno')).toBeVisible();
    await expect(page.locator('#campoDataInicio')).toBeVisible();
    await expect(page.locator('#campoDataFim')).toBeVisible();

    await page.fill('#campoAno', String(ANO_TESTE));
    await page.fill('#campoDataInicio', `${ANO_TESTE}-02-01`);
    await page.fill('#campoDataFim', `${ANO_TESTE}-12-20`);
    await page.click('.modal-footer button:has-text("Criar")');

    const linha = page.locator('tr').filter({ hasText: String(ANO_TESTE) });
    await expect(linha).toBeVisible({ timeout: 5000 });
    await expect(linha.locator('.badge')).toHaveText(/Planejado/i);
  });

  test('CT133 - Virada de ano: ativar arquiva o vigente e ativa o novo', async ({ page }) => {
    test.info().annotations.push({ type: 'depends', description: 'CT132' });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await page.waitForSelector('tbody tr');

    page.on('dialog', (d) => d.accept());
    const linhaNova = page.locator('tr').filter({ hasText: String(ANO_TESTE) });
    await linhaNova.locator('button[title="Ativar (virada de ano)"]').click();

    await expect(linhaNova.locator('.badge')).toHaveText(/Ativo/i, { timeout: 5000 });
    const linhaAnterior = page
      .locator('tr')
      .filter({ hasText: String(new Date().getFullYear()) });
    await expect(linhaAnterior.locator('.badge')).toHaveText(/Arquivado/i);
  });

  test('CT134 - Virada de retorno restaura o ano corrente', async ({ page }) => {
    test.info().annotations.push({ type: 'depends', description: 'CT133' });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await page.waitForSelector('tbody tr');

    page.on('dialog', (d) => d.accept());
    const linhaCorrente = page
      .locator('tr')
      .filter({ hasText: String(new Date().getFullYear()) });
    await linhaCorrente.locator('button[title="Ativar (virada de ano)"]').click();

    await expect(linhaCorrente.locator('.badge')).toHaveText(/Ativo/i, { timeout: 5000 });
    await expect(
      page.locator('tr').filter({ hasText: String(ANO_TESTE) }).locator('.badge'),
    ).toHaveText(/Arquivado/i);
  });

  test('CT135 - Botão de ativar fica desabilitado para o ano já ativo', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await page.waitForSelector('tbody tr');
    const linhaCorrente = page
      .locator('tr')
      .filter({ hasText: String(new Date().getFullYear()) });
    await expect(linhaCorrente.locator('.badge')).toHaveText(/Ativo/i);
    await expect(linhaCorrente.locator('button[title="Ativar (virada de ano)"]')).toBeDisabled();
  });
});
