import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN, SENHA_PROF } from './suporte/dados.js';
import { garantirFuncoes, encerrarFuncoes, restaurarSenha } from './suporte/sessao.js';

test.beforeAll(async () => {
  await restaurarSenha('a0000000-0000-0000-0000-000000000002', SENHA_PROF);
  await restaurarSenha('a0000000-0000-0000-0000-000000000003', SENHA_PROF);
  await restaurarSenha('a0000000-0000-0000-0000-000000000005', process.env.SEED_SENHA_RESP!);
  await garantirFuncoes();
});

test.afterAll(() => {
  encerrarFuncoes();
});

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
