import { test, expect } from '@playwright/test';
import { login } from '../suporte/sessao.js';
import { SENHA_ADMIN, SENHA_RESP } from '../suporte/dados.js';
import { apiFetch, loginApi, inserirLinhas, excluirLinhas } from '../suporte/api.js';

test.describe('Gestão/Responsável — Visualizador de anexo (blob)', () => {
  const FREQ_ID = '30000000-0000-0000-0000-000000000001';
  const ALUNO_ID = 'e0000000-0000-0000-0000-000000000001';
  const TURMA_ID = 'd0000000-0000-0000-0000-000000000001';
  const PROF_ID = 'a0000000-0000-0000-0000-000000000002';
  const ANO_ID = 'b0000000-0000-0000-0000-000000000001';
  const DATA_FALTA = '2026-09-15';
  const PERIODO = 'Manhã';
  const TIPO_REGISTRO = 'chamada_aula';
  const NOME_ARQUIVO = 'comprovante.png';
  const MOTIVO = 'Anexo para testes do visualizador (blob).';

  test.beforeAll(async () => {
    // Remove fixtures de execuções anteriores para o visualizador não listar duplicatas.
    await excluirLinhas('justificativas_faltas', 'aluno_id = $1 and data_falta = $2', [
      ALUNO_ID,
      DATA_FALTA,
    ]);
    await excluirLinhas(
      'frequencias',
      'aluno_id = $1 and data_aula = $2 and periodo = $3 and tipo_registro = $4',
      [ALUNO_ID, DATA_FALTA, PERIODO, TIPO_REGISTRO],
    );

    const { cookie } = await loginApi('resp1@email.com', SENHA_RESP);

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const formData = new FormData();
    formData.append('arquivo', new Blob([png], { type: 'image/png' }), NOME_ARQUIVO);

    const upload = await apiFetch('/api/anexos', { metodo: 'POST', formData, cookie });
    if (!upload.ok) throw new Error(`Setup upload anexo: ${upload.status} ${await upload.text()}`);
    const { anexo } = (await upload.json()) as { anexo: { id: string } };

    const justificativa = await apiFetch('/api/justificativas', {
      metodo: 'POST',
      cookie,
      corpo: {
        aluno_id: ALUNO_ID,
        data_falta: DATA_FALTA,
        motivo: MOTIVO,
        anexo_ids: [anexo.id],
      },
    });
    if (!justificativa.ok) {
      throw new Error(`Setup justificativa: ${justificativa.status} ${await justificativa.text()}`);
    }

    await inserirLinhas('frequencias', [
      {
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
      },
    ]);
  });

  test('CT22A - Gestão: Ver anexo abre modal com imagem via blob (sem token)', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/justificativas');
    const item = page.locator('article').filter({ hasText: MOTIVO });
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
    const item = page.locator('article').filter({ hasText: MOTIVO });
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
    const item = page.locator('article').filter({ hasText: MOTIVO });
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
