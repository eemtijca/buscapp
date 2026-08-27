import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN, SENHA_RESP, SERVICE_KEY, URL_SUPABASE } from './suporte/dados.js';

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
    const res = await fetch(`${URL_SUPABASE}${url}`, { headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'resolution=merge-duplicates,return=representation' }, ...options });
    if (!res.ok) throw new Error(`Setup ${options.method ?? 'GET'} ${url}: ${res.status}`);
    return res;
  }

  test.beforeAll(async () => {
    const loginRes = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY }, body: JSON.stringify({ email: 'resp1@email.com', password: SENHA_RESP }) });
    if (!loginRes.ok) throw new Error(`Setup login resp1: ${loginRes.status}`);
    const { access_token: tokenResp } = (await loginRes.json()) as { access_token: string };
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const upload = await fetch(`${URL_SUPABASE}/storage/v1/object/justificativas/${STORAGE_PATH}`, { method: 'POST', headers: { 'Content-Type': 'image/png', apikey: SERVICE_KEY, Authorization: `Bearer ${tokenResp}` }, body: png });
    if (!upload.ok) throw new Error(`Setup upload anexo: ${upload.status}`);
    await seedApi('/rest/v1/anexos?on_conflict=id', { method: 'POST', body: JSON.stringify({ id: ANEXO_ID, storage_path: STORAGE_PATH, nome_arquivo: NOME_ARQUIVO, mime_type: 'image/png', tamanho_bytes: png.length, criado_por: RESP_ID }) });
    await seedApi('/rest/v1/justificativas_faltas?on_conflict=id', { method: 'POST', body: JSON.stringify({ id: JUST_ID, responsavel_id: RESP_ID, aluno_id: ALUNO_ID, data_falta: DATA_FALTA, motivo: 'Anexo para testes do visualizador (blob).' }) });
    await seedApi('/rest/v1/justificativa_anexos?on_conflict=justificativa_id,anexo_id', { method: 'POST', body: JSON.stringify({ justificativa_id: JUST_ID, anexo_id: ANEXO_ID }) });
    await seedApi(`/rest/v1/frequencias?aluno_id=eq.${ALUNO_ID}&data_aula=eq.${DATA_FALTA}&periodo=eq.${PERIODO}&tipo_registro=eq.${TIPO_REGISTRO}`, { method: 'DELETE' });
    await seedApi('/rest/v1/frequencias?on_conflict=client_request_id', { method: 'POST', body: JSON.stringify({ id: FREQ_ID, client_request_id: FREQ_ID, aluno_id: ALUNO_ID, professor_id: PROF_ID, turma_id: TURMA_ID, ano_letivo_id: ANO_ID, data_aula: DATA_FALTA, periodo: PERIODO, tipo_registro: TIPO_REGISTRO, status: 'ausente' }) });
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
