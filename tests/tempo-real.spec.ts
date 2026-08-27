import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN, SENHA_RESP, SENHA_PROF, SERVICE_KEY, URL_SUPABASE } from './suporte/dados.js';

test.describe('Tempo real — Atualizações sem reload', () => {
  const GESTAO_ID = 'a0000000-0000-0000-0000-000000000001';
  const ALUNO_ID = 'e0000000-0000-0000-0000-000000000001';
  const TURMA_ID = 'd0000000-0000-0000-0000-000000000001';
  const PROF_ID = 'a0000000-0000-0000-0000-000000000002';
  const ANO_ID = 'b0000000-0000-0000-0000-000000000001';

  async function apiSeed(url: string, options: RequestInit = {}) {
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

  test('CT140 - Alertas do responsável aparecem em tempo real', async ({ page }) => {
    const DATA = '2026-12-05';
    const FREQ_ID = '30000000-0000-0000-0000-000000001401';
    await apiSeed(`/rest/v1/frequencias?aluno_id=eq.${ALUNO_ID}&data_aula=eq.${DATA}`, { method: 'DELETE' });
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/alertas');
    await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible();
    await page.waitForTimeout(2500);
    await expect(page.locator('.card').filter({ hasText: '05/12/2026' })).toHaveCount(0);
    try {
      await apiSeed('/rest/v1/frequencias?on_conflict=client_request_id', {
        method: 'POST',
        body: JSON.stringify({ id: FREQ_ID, client_request_id: FREQ_ID, aluno_id: ALUNO_ID, professor_id: PROF_ID, turma_id: TURMA_ID, ano_letivo_id: ANO_ID, data_aula: DATA, periodo: 'Manhã', tipo_registro: 'chamada_aula', status: 'ausente' }),
      });
      await expect(page.locator('.card').filter({ hasText: '05/12/2026' })).toBeVisible({ timeout: 15000 });
    } finally {
      await apiSeed(`/rest/v1/frequencias?id=eq.${FREQ_ID}&aluno_id=eq.${ALUNO_ID}&data_aula=eq.${DATA}`, { method: 'DELETE' });
    }
  });

  test('CT141 - Notificações chegam em tempo real no sino', async ({ page }) => {
    const TITULO = `E2E Realtime ${Date.now()}`;
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await expect(page.getByText('Ranking de risco')).toBeVisible();
    await page.waitForTimeout(2500);
    await page.locator('button[aria-label="Notificações"]').click();
    const notifMenu = page.locator('.notif-menu');
    await expect(notifMenu).toBeVisible();
    try {
      await apiSeed('/rest/v1/notificacoes', { method: 'POST', body: JSON.stringify({ destinatario_id: GESTAO_ID, tipo: 'sistema', titulo: TITULO, corpo: 'Teste de chegada em tempo real.' }) });
      await expect(notifMenu.getByText(TITULO)).toBeVisible({ timeout: 15000 });
    } finally {
      await apiSeed(`/rest/v1/notificacoes?titulo=eq.${encodeURIComponent(TITULO)}`, { method: 'DELETE' }).catch(() => {});
    }
  });

  test('CT142 - Ocorrências da gestão atualizam em tempo real', async ({ page }) => {
    const TITULO = 'E2E Realtime';
    const DESCRICAO = `Fluxo em tempo real ${Date.now()}`;
    await apiSeed(`/rest/v1/ocorrencias?titulo=eq.${TITULO}`, { method: 'DELETE' });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ocorrencias');
    await expect(page.getByText('Ocorrências graves e suspensões')).toBeVisible();
    await page.waitForTimeout(2500);
    await expect(page.locator('article').filter({ hasText: DESCRICAO })).toHaveCount(0);
    try {
      await apiSeed('/rest/v1/ocorrencias', { method: 'POST', body: JSON.stringify({ aluno_id: ALUNO_ID, professor_id: PROF_ID, turma_id: TURMA_ID, ano_letivo_id: ANO_ID, titulo: TITULO, descricao: DESCRICAO, tipo: ['grave'], tags_comportamento: [] }) });
      await expect(page.locator('article').filter({ hasText: DESCRICAO })).toBeVisible({ timeout: 15000 });
    } finally {
      await apiSeed(`/rest/v1/ocorrencias?titulo=eq.${TITULO}`, { method: 'DELETE' });
    }
  });

  test('CT143 - Lista de frequência do professor atualiza em tempo real', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await page.waitForSelector('.card-body .card');
    const DATA = await page.locator('input[type="date"]').inputValue();
    await apiSeed(`/rest/v1/frequencias?aluno_id=eq.${ALUNO_ID}&data_aula=eq.${DATA}&tipo_registro=eq.chamada_aula`, { method: 'DELETE' });
    await page.reload();
    await page.waitForSelector('.card-body .card');
    await page.waitForTimeout(2500);
    const btnAusenteJoao = page.getByRole('button', { name: 'Marcar João Miguel da Silva como ausente' });
    await expect(btnAusenteJoao).toBeVisible();
    try {
      const novoId = crypto.randomUUID();
      await apiSeed('/rest/v1/frequencias?on_conflict=client_request_id', {
        method: 'POST',
        body: JSON.stringify({ id: novoId, client_request_id: novoId, aluno_id: ALUNO_ID, professor_id: PROF_ID, turma_id: TURMA_ID, ano_letivo_id: ANO_ID, data_aula: DATA, periodo: 'Manhã', tipo_registro: 'chamada_aula', status: 'ausente' }),
      });
      await expect(page.getByRole('button', { name: 'Marcar João Miguel da Silva como presente' })).toBeVisible({ timeout: 15000 });
    } finally {
      await apiSeed(`/rest/v1/frequencias?aluno_id=eq.${ALUNO_ID}&data_aula=eq.${DATA}&tipo_registro=eq.chamada_aula`, { method: 'DELETE' });
    }
  });
});
