import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN } from './suporte/dados.js';

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
