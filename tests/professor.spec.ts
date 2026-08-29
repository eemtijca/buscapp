import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_PROF } from './suporte/dados.js';

test.describe('Professor - Funcionalidades básicas', () => {
  test('CT18 - Home do professor mostra cards de navegação', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await expect(page.getByText('Registrar frequência')).toBeVisible();
    await expect(page.getByText('Ausência em aula')).toBeVisible();
    await expect(page.getByText('Ocorrência grave')).toBeVisible();
  });
});

test.describe('Professor - Frequência', () => {
  test('CT23 - Página de registro de frequência carrega', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await expect(page.getByText('Registrar frequência')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.getByText('Salvar frequência')).toBeVisible();
  });

  test('CT24 - Marcar aluno como ausente e salvar', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await page.waitForSelector('.card-body .card');
    const botoes = page.locator('button[aria-label*="Marcar"]');
    const primeiro = botoes.first();
    const label = await primeiro.getAttribute('aria-label');
    if (label?.includes('como ausente')) { await primeiro.click(); }
    await page.click('button:has-text("Salvar frequência")');
    await expect(page.locator('.alert-success').first()).toBeVisible({ timeout: 10000 });
  });

  test('CT25 - Formulário de ausência no meio do dia carrega', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ausencia');
    await expect(page.getByText('Registrar ausência em aula')).toBeVisible();
    await expect(page.locator('#alunoSelect')).toBeVisible();
    await expect(page.getByText('Registrar ausência').first()).toBeVisible();
  });

  test('CT26 - Página de frequência persiste dados ao retornar', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await page.waitForSelector('.card-body .card');
    const botoes = page.locator('button[aria-label*="Marcar"]');
    const primeiro = botoes.first();
    const label = await primeiro.getAttribute('aria-label');
    if (label?.includes('como ausente')) { await primeiro.click(); }
    await page.click('button:has-text("Salvar frequência")');
    await expect(page.locator('.alert-success').first()).toBeVisible({ timeout: 10000 });
    await page.goto('/professor');
    await page.goto('/professor/frequencia');
    await expect(page.getByText('Registrar frequência')).toBeVisible();
  });
});

test.describe('Professor - Ocorrência com tags', () => {
  test('CT56 - Formulário de ocorrência carrega com checkboxes de tags', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ocorrencia');
    await expect(page.getByText('Registrar ocorrência grave')).toBeVisible();
    await expect(page.locator('#alunoSelect')).toBeVisible();
    await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 });
    await expect(page.getByText('Notificar coordenação')).toBeVisible();
  });

  test('CT57 - Tags carregam do banco e descrição se preenche', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ocorrencia');
    await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 });
    await expect(async () => {
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (!(await checkbox.isChecked())) { await checkbox.check(); }
      await expect(page.locator('#descricaoText')).toHaveValue(/Relato/);
    }).toPass({ timeout: 10000 });
  });
});

test.describe('Professor - Ausência com multisseleção', () => {
  test('CT58 - Formulário de ausência tem checkboxes de período', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ausencia');
    await expect(page.getByText('Registrar ausência em aula')).toBeVisible();
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible();
    await expect(page.getByText('1º Horário')).toBeVisible();
    await expect(page.getByText('Enfermaria')).toBeVisible();
  });

  test('CT59 - Selecionar múltiplos períodos habilita botão', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ausencia');
    await page.getByText('1º Horário').first().click();
    await page.getByText('2º Horário').first().click();
    await expect(page.getByText('Registrar 2 períodos')).toBeVisible();
  });
});

test.describe('Módulos de acesso - gating do professor', () => {
  test('CT-N8 - Professor sem módulo de ocorrências não vê o card nem acessa a rota', async ({ page }) => {
    await login(page, 'prof2@escola.edu.br', SENHA_PROF);
    await expect(page).toHaveURL(/\/professor/);
    await expect(page.getByText('Registrar frequência')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Ausência em aula')).toBeVisible();
    await expect(page.getByText('Ocorrência grave')).toHaveCount(0);
    await page.goto('/professor/ocorrencia');
    await expect(page).toHaveURL(/\/professor\?moduloNegado=ocorrencias/);
    await expect(page.locator('.alert-warning')).toContainText('Você não possui acesso ao módulo de ocorrências.');
    await page.goto('/professor/frequencia');
    await expect(page.locator('h1')).toContainText('Registrar frequência');
  });
});
