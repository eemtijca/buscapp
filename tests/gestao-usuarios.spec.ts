import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN } from './suporte/dados.js';
import { RESP1_ID } from './suporte/dados.js';

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
    await page.waitForSelector('form');
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.setAttribute('novalidate', '');
    });
    await page.click('button[type="submit"]');
    await expect(page.locator('.alert-danger')).toBeVisible({ timeout: 5000 });
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

test.describe('Módulos de acesso - formulário para todos os papéis', () => {
  test('CT-N6 - Novo usuário (qualquer papel) inicia com todos os módulos marcados', async ({
    page,
  }) => {
    page.on('dialog', (d) => d.accept());
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios/novo');

    await expect(page.getByText('Módulos de acesso')).toBeVisible();
    await expect(page.locator('label[for="modulo-frequencia"]')).toContainText('Frequência');
    await expect(page.locator('label[for="modulo-ocorrencias"]')).toContainText('Ocorrências');
    await expect(page.locator('#modulo-frequencia')).toBeChecked();
    await expect(page.locator('#modulo-ocorrencias')).toBeChecked();
  });

  test('CT-N7 - Edição de usuário responsável permite alterar módulos', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto(`/gestao/usuarios/${RESP1_ID}`);

    await expect(page.locator('h1')).toContainText('Editar usuário');
    await expect(page.getByText('Módulos de acesso')).toBeVisible();
    await expect(page.locator('#modulo-alertas')).toBeChecked();
    await expect(page.locator('#modulo-termometro')).toBeChecked();
    await expect(page.locator('#modulo-justificativa')).toBeChecked();
    await expect(page.locator('#modulo-chat')).toBeChecked();
  });
});

test.describe('Gestão - Confirmação de ativar/desativar usuário', () => {
  test('CT-N5 - Desativar e reativar usuário exigem confirmação em modal', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios');

    const linhaBruno = page.locator('tr', { hasText: 'Bruno Professor' });
    await expect(linhaBruno).toBeVisible({ timeout: 15000 });

    await linhaBruno.getByTitle('Desativar').click();
    let modal = page.getByRole('dialog');
    await expect(modal).toContainText('Desativar usuário');
    await expect(modal).toContainText('acesso ao sistema será bloqueado');
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(linhaBruno.getByTitle('Desativar')).toBeVisible();

    await linhaBruno.getByTitle('Desativar').click();
    modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: 'Desativar', exact: true }).click();
    await expect(page.locator('.alert-success')).toContainText('Usuário desativado.');
    await expect(linhaBruno.getByTitle('Ativar')).toBeVisible();

    await linhaBruno.getByTitle('Ativar').click();
    modal = page.getByRole('dialog');
    await expect(modal).toContainText('Ativar usuário');
    await modal.getByRole('button', { name: 'Ativar', exact: true }).click();
    await expect(page.locator('.alert-success')).toContainText('Usuário ativado.');
    await expect(linhaBruno.getByTitle('Desativar')).toBeVisible();
  });
});
