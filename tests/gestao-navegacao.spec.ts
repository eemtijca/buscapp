import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN } from './suporte/dados.js';

test.describe('Gestão - Home', () => {
  test('CT06 - Página inicial do gestor mostra cards de navegação', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await expect(page.locator('h3.card-nav-title').first()).toHaveText('Ranking de risco');
    await expect(page.locator('h3.card-nav-title').nth(1)).toHaveText('Ocorrências graves');
    await expect(page.locator('h3.card-nav-title').nth(2)).toHaveText('Infrequências');
    await expect(page.locator('h3.card-nav-title').nth(3)).toHaveText('Justificativas');
    await expect(page.locator('h3.card-nav-title').nth(4)).toHaveText('Usuários');
    await expect(page.locator('h3.card-nav-title').nth(5)).toHaveText('Alunos');
    await expect(page.locator('h3.card-nav-title').nth(6)).toHaveText('Códigos');
    await expect(page.locator('h3.card-nav-title').nth(8)).toHaveText('Anos letivos');
    await expect(page.locator('h3.card-nav-title').nth(12)).toHaveText('Configurações');
  });

  test('CT07 - Notificação de código aparece no header', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    const bell = page.locator(
      'button[aria-label="Notificações"] i.bi-bell, a[aria-label="Notificações"] i.bi-bell',
    );
    await expect(bell.first()).toBeVisible();
  });
});
