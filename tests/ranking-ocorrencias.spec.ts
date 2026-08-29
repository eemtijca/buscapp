import { test, expect } from '@playwright/test';
import { login, logout } from './suporte/sessao.js';
import { SENHA_ADMIN, SERVICE_KEY, URL_SUPABASE } from './suporte/dados.js';

test.describe('Gestão - Ranking e Ocorrências', () => {
  test('CT20 - Pagina de ranking de risco carrega', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ranking');
    await expect(page.getByText('Ranking de priorização de risco')).toBeVisible();
  });

  test('CT20b - Botão Chat abre conversa com o responsável', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ranking');
    const cardJoao = page.locator('.card').filter({ hasText: 'João Miguel da Silva' });
    await cardJoao.locator('button[title="Abrir conversa com o responsável"]').click();
    await page.waitForURL(/\/gestao\/chat/, { timeout: 10000 });
    await expect(page.locator('.chat-header').getByText('Maria Silva').first()).toBeVisible({ timeout: 10000 });
  });

  test('CT21 - Página de ocorrências carrega', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ocorrencias');
    await expect(page.getByText('Ocorrências graves e suspensões')).toBeVisible();
  });

  test('CT22 - Pagina de justificativas carrega', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/justificativas');
    await expect(page.getByText('Validação de justificativas')).toBeVisible();
  });
});

test.describe('Gestão - Registro de infrequências', () => {
  test('CT-N2 - Home exibe o card e a página abre com as duas abas', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    const cardInfreq = page.getByRole('link', { name: /Infrequências/ });
    await expect(cardInfreq).toBeVisible();
    await cardInfreq.click();
    await expect(page).toHaveURL(/\/gestao\/infrequencias/);
    await expect(page.locator('h1')).toContainText('Registrar infrequências');
    await expect(page.getByRole('button', { name: 'Chamada por turma' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registro individual' })).toBeVisible();
    await expect(page.locator('#seletorTurma')).toBeVisible();
    await logout(page);
  });

  test('CT-N3 - Chamada por turma registra faltas com confirmação', async ({ page }) => {
    const limparFaltasDeHoje = () => fetch(`${URL_SUPABASE}/rest/v1/frequencias?data_aula=eq.${new Date().toISOString().slice(0, 10)}&tipo_registro=eq.chamada_aula`, { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    await limparFaltasDeHoje();
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/infrequencias');
    await expect(page.locator('#seletorTurma')).toBeVisible();
    try {
      const botaoAusente = page.getByRole('button', { name: /Marcar .+ como ausente/ }).first();
      await expect(botaoAusente).toBeVisible({ timeout: 15000 });
      await botaoAusente.click();
      await expect(page.getByRole('button', { name: /Marcar .+ como presente/ }).first()).toContainText('Ausente');
      await expect(page.getByText(/ausente\(s\)/)).toBeVisible();
      await page.getByRole('button', { name: 'Salvar chamada' }).click();
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await expect(modal).toContainText('Salvar chamada');
      await modal.getByRole('button', { name: 'Registrar faltas' }).click();
      await expect(page.locator('.alert-success')).toContainText('ausência(s) registrada(s)', { timeout: 15000 });
    } finally { await limparFaltasDeHoje(); }
    await logout(page);
  });

  test('CT-N4 - Botão Falta no ranking abre o registro individual pré-selecionado', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ranking');
    const botaoFalta = page.getByTitle('Registrar falta').first();
    await expect(botaoFalta).toBeVisible({ timeout: 15000 });
    await botaoFalta.click();
    await expect(page).toHaveURL(/\/gestao\/infrequencias\?aluno=/);
    const abaIndividual = page.getByRole('button', { name: 'Registro individual' });
    await expect(abaIndividual).toHaveClass(/btn-success/);
    // O combobox exibe o rótulo (nome — turma) em vez do UUID; basta garantir que há seleção.
    await expect(page.locator('#alunoIndividual')).not.toHaveValue('');
    const valor = await page.locator('#alunoIndividual').inputValue();
    expect(valor.trim().length).toBeGreaterThan(3);
    await logout(page);
  });
});
