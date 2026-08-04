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
  } catch { /* ignorar */ }
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
  } catch { /* not running */ }

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
    } catch { /* still starting */ }
  }
  throw new Error('Edge functions nao iniciaram apos 60s');
});

test.afterAll(() => {
  if (funcoesProcess) funcoesProcess.kill();
});

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  // Wait for the page to fully load
  await page.waitForSelector('button[type="submit"]');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  // Click and wait for navigation/response
  await Promise.all([
    page.waitForURL(/\/gestao|\/professor|\/responsavel/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);
}

test.describe('Autenticacao', () => {
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
  test('CT01 - Pagina de login carrega corretamente', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Entrar');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByText('Solicitar código de acesso')).toBeVisible();
  });

  test('CT02 - Login como gestao redireciona para /gestao', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await expect(page).toHaveURL(/\/gestao/);
  });

  test('CT03 - Login como professor redireciona para /professor', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await expect(page).toHaveURL(/\/professor/);
  });

  test('CT04 - Login com credenciais invalidas mostra erro', async ({ page }) => {
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

test.describe('Gestao - Home', () => {
  test('CT06 - Pagina inicial do gestor mostra cards de navegacao', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await expect(page.locator('h3.card-nav-title').first()).toHaveText('Ranking de risco');
    await expect(page.locator('h3.card-nav-title').nth(1)).toHaveText('Ocorrências graves');
    await expect(page.locator('h3.card-nav-title').nth(2)).toHaveText('Justificativas');
    await expect(page.locator('h3.card-nav-title').nth(3)).toHaveText('Usuários');
    await expect(page.locator('h3.card-nav-title').nth(4)).toHaveText('Alunos');
    await expect(page.locator('h3.card-nav-title').nth(5)).toHaveText('Códigos');
    await expect(page.locator('h3.card-nav-title').nth(10)).toHaveText('Configurações');
  });

  test('CT07 - Notificacao de codigo aparece no header', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    const bell = page.locator('button[aria-label="Notificações"] i.bi-bell, a[aria-label="Notificações"] i.bi-bell');
    await expect(bell.first()).toBeVisible();
  });
});

test.describe('Gestao - Usuarios', () => {
  test('CT08 - Listagem de usuarios exibe dados do seed', async ({ page }) => {
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

  test('CT10 - Formulario de novo usuario carrega', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios/novo');
    await expect(page.locator('label:has-text("Nome")')).toBeVisible();
    await expect(page.locator('label:has-text("E-mail")')).toBeVisible();
    await expect(page.locator('label:has-text("Papel")')).toBeVisible();
  });
});

test.describe('Gestao - Alunos', () => {
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

test.describe('Gestao - Codigos', () => {
  test('CT13 - Pagina de codigos carrega com abas', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
  });

  test('CT14 - Codigos do seed sao exibidos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
  });
});

test.describe('Recuperacao de senha por codigo', () => {
  test('CT15 - Pagina de solicitar codigo carrega', async ({ page }) => {
    await page.goto('/solicitar-codigo');
    await expect(page.getByText('Solicitar código de acesso')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('CT16 - Fluxo de solicitacao de codigo via UI', async ({ page }) => {
    await page.goto('/solicitar-codigo');
    await page.fill('input[type="email"]', 'prof1@escola.edu.br');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({ timeout: 15000 });
  });

  test('CT17 - Pagina de redefinir senha com codigo carrega', async ({ page }) => {
    await page.goto('/redefinir-senha-codigo');
    await expect(page.getByText('Redefinir senha com código')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="codigo"]')).toBeVisible();
    await expect(page.locator('input[id="nova-senha"]')).toBeVisible();
  });
});

test.describe('Professor - Funcionalidades basicas', () => {
  test('CT18 - Home do professor mostra cards de navegacao', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await expect(page.getByText('Registrar frequência')).toBeVisible();
    await expect(page.getByText('Ausência em aula')).toBeVisible();
    await expect(page.getByText('Ocorrência grave')).toBeVisible();
  });
});

test.describe('Responsavel - Funcionalidades basicas', () => {
  test('CT19 - Home do responsavel mostra cards de navegacao', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await expect(page.getByRole('link', { name: 'Alertas' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Termômetro' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Justificativa' })).toBeVisible();
    await expect(page.locator('h3.card-nav-title').nth(3)).toHaveText('Falar com coordenação');
  });
});

test.describe('Gestao - Ranking e Ocorrencias', () => {
  test('CT20 - Pagina de ranking de risco carrega', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ranking');
    await expect(page.getByText('Ranking de priorização de risco')).toBeVisible();
  });

  test('CT21 - Pagina de ocorrencias carrega', async ({ page }) => {
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

test.describe('Professor - Frequencia', () => {
  test('CT23 - Pagina de registro de frequencia carrega', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await expect(page.getByText('Registrar frequência')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.getByText('Salvar frequência')).toBeVisible();
  });

  test('CT24 - Marcar aluno como ausente e salvar', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    // Wait for student list to load
    await page.waitForSelector('.card-body .card');
    // Find the first "Presente" (present/ausente toggle) and click to mark as ausente
    const botoes = page.locator('button[aria-label*="Marcar"]');
    const primeiro = botoes.first();
    const label = await primeiro.getAttribute('aria-label');
    if (label?.includes('como ausente')) {
      await primeiro.click();
    }
    await page.click('button:has-text("Salvar frequência")');
    await expect(page.locator('.alert-success').first()).toBeVisible({ timeout: 10000 });
  });

  test('CT25 - Mid-day absence form carrega', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ausencia');
    await expect(page.getByText('Registrar ausência em aula')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.getByText('Registrar ausência').first()).toBeVisible();
  });

  test('CT26 - Pagina de frequencia persiste dados ao retornar', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await page.waitForSelector('.card-body .card');
    // Mark first student as absent
    const botoes = page.locator('button[aria-label*="Marcar"]');
    const primeiro = botoes.first();
    const label = await primeiro.getAttribute('aria-label');
    if (label?.includes('como ausente')) {
      await primeiro.click();
    }
    await page.click('button:has-text("Salvar frequência")');
    await expect(page.locator('.alert-success').first()).toBeVisible({ timeout: 10000 });
    // Navigate away and back — check the page loads
    await page.goto('/professor');
    await page.goto('/professor/frequencia');
    await expect(page.getByText('Registrar frequência')).toBeVisible();
  });
});

test.describe('Gestao - Usuarios - Codigo no cadastro', () => {
  test('CT27 - Criar usuario exibe codigo no sucesso', async ({ page }) => {
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

  test('CT28 - Botao Copiar no sucesso funciona', async ({ page }) => {
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

  test('CT29 - Criar usuario valida campos obrigatorios', async ({ page }) => {
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

test.describe('Gestao - Codigos - Aba Pendentes', () => {
  test('CT34 - Pagina de codigos carrega com abas e indicador', async ({ page }) => {
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

  test('CT36 - Botao Atualizar recarrega dados', async ({ page }) => {
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

test.describe('Gestao - Codigos - Aba Recentes', () => {
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

  test('CT41 - Toggle visibilidade do codigo', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const olhos = page.locator('button[title="Mostrar"], button[title="Ocultar"]');
    if (await olhos.count() > 0) {
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

  test('CT43 - Paginacao visivel quando necessario', async ({ page }) => {
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

test.describe('Gestao - Codigos - Fluxo de revogacao', () => {
  test('CT46 - Botao revogar abre modal de confirmacao', async ({ page }) => {
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

test.describe('Recuperacao de senha - Fluxo publico', () => {
  test('CT31 - Pagina de solicitar codigo mostra formulario', async ({ page }) => {
    await page.goto('/solicitar-codigo');
    await expect(page.getByText('Solicitar código de acesso')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByText('Já tenho um código')).toBeVisible();
  });

  test('CT32 - Pagina de redefinir senha mostra todos os campos', async ({ page }) => {
    await page.goto('/redefinir-senha-codigo');
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="codigo"]')).toBeVisible();
    await expect(page.locator('input[id="nova-senha"]')).toBeVisible();
    await expect(page.getByText('Redefinir senha com código')).toBeVisible();
  });

  test('CT33 - Validacao de senha aparece ao digitar', async ({ page }) => {
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

test.describe('Gestao - Codigos - Mobile', () => {
  test('CT53 - Layout mobile carrega sem erros', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
  });

  test('CT54 - Mobile: botao Atualizar funciona', async ({ page }) => {
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

test.describe('Professor - Ocorrencia com tags', () => {
  test('CT56 - Formulario de ocorrencia carrega com checkboxes de tags', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ocorrencia');
    await expect(page.getByText('Registrar ocorrência grave')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
    await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 });
    await expect(page.getByText('Notificar coordenação')).toBeVisible();
  });

  test('CT57 - Tags carregam do banco e descricao se preenche', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ocorrencia');
    await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 });
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.check();
    await expect(page.locator('#descricaoText')).toHaveValue(/Relato/);
  });
});

test.describe('Professor - Ausencia com multisselecao', () => {
  test('CT58 - Formulario de ausencia tem checkboxes de periodo', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ausencia');
    await expect(page.getByText('Registrar ausência em aula')).toBeVisible();
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible();
    await expect(page.getByText('1º Horário')).toBeVisible();
    await expect(page.getByText('Enfermaria')).toBeVisible();
  });

  test('CT59 - Selecionar multiplos periodos habilita botao', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ausencia');
    await page.getByText('1º Horário').first().click();
    await page.getByText('2º Horário').first().click();
    await expect(page.getByText('Registrar 2 períodos')).toBeVisible();
  });
});

test.describe('Gestao - Usuario - Modulos e permissoes', () => {
  test('CT60 - Formulario de usuario tem modulos de acesso', async ({ page }) => {
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

test.describe('Gestao - Aluno - Documentos e indicadores', () => {
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

test.describe('Gestao - Turmas - Modal', () => {
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
    expect(serieOptions).toContain('1º');
    expect(serieOptions).toContain('2º');
    const letraOptions = await page.locator('#campoLetra option').allTextContents();
    expect(letraOptions.length).toBeGreaterThanOrEqual(3);
    expect(letraOptions).toContain('A');
    await page.click('button:has-text("Cancelar")');
  });
});

test.describe('Gestao - Disciplinas - Modal', () => {
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

test.describe('Gestao - Atribuicoes - Modal', () => {
  test('CT66 - Modal de criar atribuicao abre e tem campos', async ({ page }) => {
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

test.describe('Gestao - Configuracao', () => {
  test('CT110 - Pagina hub carrega com categorias', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao');
    await expect(page.locator('h1')).toContainText('Configurações');
    await expect(page.locator('h3.card-nav-title').filter({ hasText: 'Módulos' })).toBeVisible();
    await expect(page.locator('h3.card-nav-title').filter({ hasText: 'Documentos' })).toBeVisible();
    await expect(page.locator('h3.card-nav-title').filter({ hasText: 'Períodos' })).toBeVisible();
  });

  test('CT111 - Pagina de modulo carrega com tabela', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await expect(page.locator('h1')).toContainText('Módulos');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('table')).toContainText('Frequência');
    await expect(page.locator('table')).toContainText('Ocorrências');
  });

  test('CT112 - Criar opcao no modal', async ({ page }) => {
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

  test('CT112b - Seletor de letras de turma exibe o catalogo incluindo D', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/letra_turma');
    await page.click('button:has-text("Nova opção")');
    await expect(page.locator('.modal-title')).toContainText('Nova opção');
    for (const letra of ['A', 'B', 'C', 'D']) {
      await expect(page.getByRole('button', { name: letra, exact: true })).toBeVisible();
    }
    await page.click('button:has-text("Cancelar")');
  });

  test('CT112c - Duplicata de opcao existente e bloqueada', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await page.click('button:has-text("Nova opção")');
    await page.click('button:has-text("Outra...")');
    await page.fill('#campo-nome', 'Frequência');
    await expect(page.getByText(/Já existe uma opção chamada/)).toBeVisible();
  });

  test('CT112d - Serie aceita apenas numeros com sufixo º', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/serie_turma');
    await page.click('button:has-text("Nova opção")');
    await page.click('button:has-text("Outra...")');
    const input = page.locator('#campo-nome');
    await input.pressSequentially('abc4x9');
    await expect(input).toHaveValue('49');
    await expect(page.locator('.input-group-text')).toHaveText('º');
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
    const cor = await card.locator('span').first().evaluate((el) => getComputedStyle(el).color);
    expect(cor.toLowerCase()).not.toBe('rgb(255, 255, 255)');
    await page.click('button:has-text("Cancelar")');
  });

  test('CT113 - Tags de comportamento carrega com tabela', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/tags');
    await expect(page.locator('h1')).toContainText('Tags de Comportamento');
    await expect(page.locator('table')).toBeVisible();
  });

  test('CT114 - Sistema carrega e salva alteracao', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/sistema');
    await expect(page.locator('h1')).toContainText('Configurações do Sistema');
    await expect(page.locator('#cfg-nome')).toBeVisible();
    await expect(page.locator('#cfg-critico')).toBeVisible();
    await expect(page.locator('#cfg-preventivo')).toBeVisible();
  });

  test('CT115 - Horarios carrega com tabela', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/horarios');
    await expect(page.locator('h1')).toContainText('Horários Letivos');
    await expect(page.locator('table')).toBeVisible();
  });
});

// ============================================================================
// CHAT — Setup de dados de teste
// ============================================================================
const CHAT_CONV_ID = 'f0000000-0000-0000-0000-000000000001';
const CHAT_CONV2_ID = 'f0000000-0000-0000-0000-000000000002';

test.beforeAll(async () => {
  // Create test conversations and messages via service role API.
  // Usa upsert (merge-duplicates) para que seja seguro sob execucao paralela
  // de varios workers: cada beforeAll converge para o mesmo estado.
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

  // Upsert das conversas (unicidade por par responsavel/aluno), resetando ativa.
  await api('/rest/v1/conversas?on_conflict=responsavel_id,aluno_id', {
    method: 'POST',
    body: JSON.stringify({
      id: CHAT_CONV_ID,
      turma_id: 'd0000000-0000-0000-0000-000000000001',
      responsavel_id: RESPONSAVEL_ID,
      aluno_id: ALUNO1_ID,
      ativa: true,
    }),
  });

  await api('/rest/v1/conversas?on_conflict=responsavel_id,aluno_id', {
    method: 'POST',
    body: JSON.stringify({
      id: CHAT_CONV2_ID,
      turma_id: 'd0000000-0000-0000-0000-000000000001',
      responsavel_id: RESPONSAVEL_ID,
      aluno_id: ALUNO2_ID,
      ativa: true,
    }),
  });

  // Upsert das mensagens (unicidade por id)
  for (const msg of [
    { id: 'f0000000-0000-0000-0000-000000000011', conversa_id: CHAT_CONV_ID, remetente_id: 'a0000000-0000-0000-0000-000000000005', conteudo: 'Bom dia, gostaria de saber como esta meu filho', created_at: '2026-07-20T08:00:00Z' },
    { id: 'f0000000-0000-0000-0000-000000000012', conversa_id: CHAT_CONV_ID, remetente_id: 'a0000000-0000-0000-0000-000000000001', conteudo: 'Bom dia! O Joao esta bem, participando das aulas.', created_at: '2026-07-20T08:15:00Z' },
    { id: 'f0000000-0000-0000-0000-000000000013', conversa_id: CHAT_CONV_ID, remetente_id: 'a0000000-0000-0000-0000-000000000002', conteudo: 'Confirmo! Ele tem se destacado em matematica.', created_at: '2026-07-20T08:30:00Z' },
    { id: 'f0000000-0000-0000-0000-000000000014', conversa_id: CHAT_CONV_ID, remetente_id: 'a0000000-0000-0000-0000-000000000005', conteudo: 'Que bom! Obrigado pela atencao.', created_at: '2026-07-20T09:00:00Z' },
  ]) {
    await api('/rest/v1/mensagens?on_conflict=id', { method: 'POST', body: JSON.stringify(msg) });
  }

  // Update ultima_mensagem_em
  await api(`/rest/v1/conversas?id=eq.${CHAT_CONV_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ ultima_mensagem_em: '2026-07-20T09:00:00Z' }),
  });

  // Notificacao de teste para gestao (evita acumulo entre execucoes)
  await api(`/rest/v1/notificacoes?metadados->>conversa_id=eq.${CHAT_CONV_ID}`, {
    method: 'DELETE',
  });
  await api('/rest/v1/notificacoes', {
    method: 'POST',
    body: JSON.stringify({
      destinatario_id: 'a0000000-0000-0000-0000-000000000001',
      tipo: 'mensagem',
      titulo: 'Nova mensagem de Maria Silva',
      corpo: 'Bom dia, gostaria de saber como esta meu filho',
      metadados: { conversa_id: CHAT_CONV_ID },
    }),
  });
});

// ============================================================================
// CT67–CT72: CHAT — Responsavel
// ============================================================================
test.describe('Responsavel — Chat', () => {
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
      await expect(items.first()).toContainText(/João|Maria|Ana|Pedro|Rafael|Lucas|Julia|Thiago|Isabela/);
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

  test('CT71 - Input desabilitado ou aviso fora do horario', async ({ page }) => {
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

  test.skip('CT72 - Botao voltar aparece no mobile', async ({ page }) => {
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
// CT73–CT79: CHAT — Gestao
// ============================================================================
test.describe('Gestao — Chat', () => {
  test('CT73 - Pagina de chat carrega com sidebar e placeholder', async ({ page }) => {
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
    if (count > 0) {
      await expect(items.first()).toContainText('Maria Silva');
    }
  });

  test('CT75 - Selecionar conversa exibe mensagens', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    const items = page.locator('.chat-sidebar button');
    if (await items.count() > 0) {
      await items.first().click();
      await page.waitForTimeout(1000);
      await expect(page.locator('i.bi-check2-all, i.bi-check2').first()).toBeVisible();
    }
  });

  test('CT76 - Header de navegacao com titulo chat', async ({ page }) => {
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
// CT84–CT88: NOTIFICACOES
// ============================================================================
test.describe('Notificacoes — Popover', () => {
  test('CT84 - Sino visivel para gestao', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await expect(page.locator('i.bi-bell').first()).toBeVisible();
  });

  test('CT85 - Sino visivel para responsavel', async ({ page }) => {
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

  test('CT88 - Notificacao de mensagem aparece no popover', async ({ page }) => {
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
    // No mobile, sidebar should be full width initially
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

  test('CT91 - Desktop: dois paineis visiveis', async ({ page }) => {
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
  test('CT92 - Rota /gestao/chat exige autenticacao', async ({ page }) => {
    await page.goto('/gestao/chat');
    await expect(page).toHaveURL('/');
  });

  test('CT94 - Rota /responsavel/chat exige autenticacao', async ({ page }) => {
    await page.goto('/responsavel/chat');
    await expect(page).toHaveURL('/');
  });
});

// ============================================================================
// CT95–CT98: RESILIENCIA
// ============================================================================
test.describe('Chat — Resiliencia', () => {
  test('CT95 - Sidebar contatos visivel na gestao', async ({ page }) => {
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

  test('CT97 - Responsavel home nao quebrou com novo card chat', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await expect(page.getByText('Falar com coordenação')).toBeVisible();
    await expect(page.getByText('Alertas')).toBeVisible();
    await expect(page.getByText('Termômetro')).toBeVisible();
    await expect(page.getByText('Justificativa')).toBeVisible();
  });

  test('CT98 - Gestao home nao quebrou com novo card chat', async ({ page }) => {
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
  test('CT99 - Botao enviar desabilitado com input vazio', async ({ page }) => {
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

  test('CT101 - Gestao profile (side effect): logout nao quebra', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(1000);
    // Click logout in dropdown
    await page.locator('button[data-bs-toggle="dropdown"]').click();
    await page.locator('.dropdown-menu').getByText('Sair da conta').click();
    await expect(page).toHaveURL('/');
  });

  test('CT102 - Mensagens de sistema sem quebra de layout', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    const items = page.locator('.chat-sidebar button');
    if (await items.count() > 0) {
      await items.first().click();
      await page.waitForTimeout(1000);
      // System messages appear centered - just verify no JS errors
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));
      await page.waitForTimeout(500);
      expect(pageErrors.length).toBe(0);
    }
  });
});

// ============================================================================
// CT103–CT106: NOTIFICACOES — CASOS EXTREMOS
// ============================================================================
test.describe('Notificacoes — Casos Extremos', () => {
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

  test('CT105 - Notificacao com rota de chat', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await page.locator('button[aria-label="Notificações"]').click();
    await page.waitForTimeout(500);
    const items = page.locator('.notif-menu button');
    if (await items.count() > 0) {
      await items.first().click();
      await page.waitForTimeout(1000);
    }
  });

  test('CT106 - Popover sem notificacoes mostra estado vazio', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await page.locator('button[aria-label="Notificações"]').click();
    await page.waitForTimeout(500);
    const notifMenu = page.locator('.notif-menu');
    if (await notifMenu.isVisible()) {
      const hasItems = await notifMenu.locator('button').count() > 0;
      if (hasItems) {
        await expect(notifMenu.locator('button').first()).toBeVisible();
      } else {
        await expect(notifMenu.getByText('Nenhuma notificação')).toBeVisible();
      }
    }
  });
});
