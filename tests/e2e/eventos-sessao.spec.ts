import { test, expect } from '@playwright/test';
import { login, logout } from '../suporte/sessao.js';
import { SENHA_ADMIN } from '../suporte/dados.js';

/** Coleta os instantes das requisições ao stream SSE. */
function observarStream(page: import('@playwright/test').Page): number[] {
  const instantes: number[] = [];
  page.on('request', (requisicao) => {
    if (requisicao.url().includes('/api/eventos')) instantes.push(Date.now());
  });
  return instantes;
}

test.describe('Tempo real - ciclo de vida do stream', () => {
  test('CT-SSE-1: tela de login anônima não abre o stream', async ({ page }) => {
    const instantes = observarStream(page);

    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Entrar');
    await page.waitForTimeout(4000);

    expect(instantes).toHaveLength(0);
  });

  test('CT-SSE-2: login abre o stream e logout encerra a conexão', async ({ page }) => {
    const instantes = observarStream(page);

    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await expect.poll(() => instantes.length, { timeout: 8000 }).toBeGreaterThan(0);

    await logout(page);
    const aposLogout = Date.now();
    await page.waitForTimeout(4000);

    expect(instantes.filter((instante) => instante > aposLogout)).toHaveLength(0);

    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await expect
      .poll(() => instantes.filter((instante) => instante > aposLogout + 100).length, {
        timeout: 8000,
      })
      .toBeGreaterThan(0);
  });
});
