import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_RESP, SENHA_ADMIN, SENHA_PROF } from './suporte/dados.js';
import { restApi } from './suporte/api.js';

test.describe('Notificações — 403 regression', () => {
  const RESP_ID = 'a0000000-0000-0000-0000-000000000005';
  const ALUNO_ID = 'e0000000-0000-0000-0000-000000000001';

  async function limpar() {
    await restApi(`/rest/v1/notificacoes?destinatario_id=eq.${RESP_ID}`, { method: 'DELETE' });
  }

  test.beforeEach(async () => {
    await limpar();
  });
  test.afterEach(async () => {
    await limpar();
  });

  test('Responsável clica em notificação de ocorrência e vai para alertas com deep-link', async ({ page }) => {
    const titulo = `Teste 403 ${Date.now()}`;
    await restApi('/rest/v1/notificacoes', {
      method: 'POST',
      body: JSON.stringify({
        destinatario_id: RESP_ID,
        tipo: 'ocorrencia',
        titulo,
        corpo: 'Novo alerta do aluno João Miguel',
        metadados: { aluno_id: ALUNO_ID },
      }),
    });

    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await page.locator('button[aria-label="Notificações"]').click();
    const item = page.locator('.notif-menu').getByText(titulo);
    await expect(item).toBeVisible({ timeout: 10000 });
    await item.click();
    await expect(page).toHaveURL(/\/responsavel\/alertas\?aluno=/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Alertas');
    await expect(page).not.toHaveURL(/\/403/);
    // deep-link: deve estar em alertas e não em 403
    await expect(page.locator('.notif-menu')).toHaveCount(0);
  });

  test('Responsável clica em notificação de ausência e vai para alertas', async ({ page }) => {
    const titulo = `Ausência ${Date.now()}`;
    await restApi('/rest/v1/notificacoes', {
      method: 'POST',
      body: JSON.stringify({
        destinatario_id: RESP_ID,
        tipo: 'ausencia_aula',
        titulo,
        corpo: 'Falta detectada',
        metadados: { aluno_id: ALUNO_ID },
      }),
    });
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await page.locator('button[aria-label="Notificações"]').click();
    const item = page.locator('.notif-menu').getByText(titulo);
    await expect(item).toBeVisible({ timeout: 10000 });
    await item.click();
    await expect(page).toHaveURL(/\/responsavel\/alertas/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/403/);
  });

  test('Responsável clica em justificativa e vai para justificativa', async ({ page }) => {
    const titulo = `Justificativa ${Date.now()}`;
    await restApi('/rest/v1/notificacoes', {
      method: 'POST',
      body: JSON.stringify({
        destinatario_id: RESP_ID,
        tipo: 'justificativa',
        titulo,
        corpo: 'Justificativa respondida',
        metadados: { aluno_id: ALUNO_ID },
      }),
    });
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await page.locator('button[aria-label="Notificações"]').click();
    const item = page.locator('.notif-menu').getByText(titulo);
    await expect(item).toBeVisible({ timeout: 10000 });
    await item.click();
    await expect(page).toHaveURL(/\/responsavel\/justificativa/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/403/);
  });

  test('Professor clica em notificação de ocorrência e vai para sua página sem 403', async ({ page }) => {
    const PROF_ID = 'a0000000-0000-0000-0000-000000000002';
    const titulo = `Ocorr Prof ${Date.now()}`;
    await restApi('/rest/v1/notificacoes', {
      method: 'POST',
      body: JSON.stringify({
        destinatario_id: PROF_ID,
        tipo: 'ocorrencia',
        titulo,
        corpo: 'Ocorrência para professor',
        metadados: { aluno_id: ALUNO_ID },
      }),
    });
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor');
    await page.locator('button[aria-label="Notificações"]').click();
    const item = page.locator('.notif-menu').getByText(titulo);
    await expect(item).toBeVisible({ timeout: 10000 });
    await item.click();
    await expect(page).toHaveURL(/\/professor\/ocorrencia/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/403/);
    await restApi(`/rest/v1/notificacoes?destinatario_id=eq.${PROF_ID}&titulo=eq.${encodeURIComponent(titulo)}`, { method: 'DELETE' });
  });

  test('Gestão clica em ocorrência e vai para gestão sem 403', async ({ page }) => {
    const GESTAO_ID = 'a0000000-0000-0000-0000-000000000001';
    const titulo = `Ocorr Gestao ${Date.now()}`;
    await restApi('/rest/v1/notificacoes', {
      method: 'POST',
      body: JSON.stringify({
        destinatario_id: GESTAO_ID,
        tipo: 'ocorrencia',
        titulo,
        corpo: 'Ocorrência para gestão',
        metadados: { aluno_id: ALUNO_ID },
      }),
    });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await page.locator('button[aria-label="Notificações"]').click();
    const item = page.locator('.notif-menu').getByText(titulo);
    await expect(item).toBeVisible({ timeout: 10000 });
    await item.click();
    await expect(page).toHaveURL(/\/gestao\/ocorrencias/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/403/);
    await restApi(`/rest/v1/notificacoes?destinatario_id=eq.${GESTAO_ID}&titulo=eq.${encodeURIComponent(titulo)}`, { method: 'DELETE' });
  });
});
