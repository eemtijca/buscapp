import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN } from './suporte/dados.js';

test.describe('Gestão - Turmas - Modal', () => {
  test('CT64 - Modal de criar turma abre e tem campos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/turmas');
    await page.click('button:has-text("Nova turma")');
    await expect(page.locator('.modal-title')).toContainText('Nova turma');
    await expect(page.locator('#campoSerie')).toBeVisible();
    await expect(page.locator('#campoLetra')).toBeVisible();
    await expect(page.locator('#campoAtivo')).toBeVisible();
    await page.click('button:has-text("Cancelar")');
  });

  test('CT64b - Select serie/letra populados do banco', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/turmas');
    await page.click('button:has-text("Nova turma")');
    await page.waitForSelector('#campoSerie');
    // Abre o combobox de série e verifica as opções disponíveis
    await page.click('#campoSerie');
    await expect(page.getByRole('option', { name: '1ª' })).toBeVisible();
    await expect(page.getByRole('option', { name: '2ª' })).toBeVisible();
    const serieCount = await page.locator('#campoSerie-lista [role="option"]').count();
    expect(serieCount).toBeGreaterThanOrEqual(3);
    await page.keyboard.press('Escape');
    // Abre o combobox de letra e verifica
    await page.click('#campoLetra');
    await expect(page.getByRole('option', { name: 'A', exact: true })).toBeVisible();
    const letraCount = await page.locator('#campoLetra-lista [role="option"]').count();
    expect(letraCount).toBeGreaterThanOrEqual(3);
    await page.keyboard.press('Escape');
    await page.click('button:has-text("Cancelar")');
  });
});

test.describe('Gestão - Disciplinas - Modal', () => {
  test('CT65 - Modal de criar disciplina abre e tem campos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/disciplinas');
    await page.click('button:has-text("Nova disciplina")');
    await expect(page.locator('.modal-title')).toContainText('Nova disciplina');
    await expect(page.locator('#campoNome')).toBeVisible();
    await expect(page.locator('#campoCodigoSige')).toBeVisible();
    await expect(page.locator('#campoCargaHoraria')).toBeVisible();
    await page.click('button:has-text("Cancelar")');
  });
});

test.describe('Gestão - Atribuições - Modal', () => {
  test('CT66 - Modal de criar atribuição abre e tem campos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/atribuicoes');
    await page.click('button:has-text("Nova atribuição")');
    await expect(page.locator('.modal-title')).toContainText('Nova atribuição');
    await expect(page.locator('#campoProfessor')).toBeVisible();
    await expect(page.locator('#campoTurma')).toBeVisible();
    await expect(page.locator('#campoDataInicio')).toBeVisible();
    await page.click('button:has-text("Cancelar")');
  });
});

test.describe('Gestão - Anos Letivos', () => {
  const ANO_CORRENTE = new Date().getFullYear();
  const ANO_TESTE = ANO_CORRENTE + 1;
  async function limparAnoTeste() {
    const { restApi } = await import('./suporte/api.js');
    await restApi(`/rest/v1/anos_letivos?ano=eq.${ANO_TESTE}`, { method: 'DELETE' });
  }
  test.beforeAll(async () => { await limparAnoTeste(); });
  test.afterAll(async () => {
    const { restApi } = await import('./suporte/api.js');
    const { URL_SUPABASE, SERVICE_KEY } = await import('./suporte/dados.js');
    const res = await restApi(`/rest/v1/anos_letivos?ano=eq.${ANO_TESTE}&select=id,status,ativo`);
    const anos = (await res.json()) as { id: string; status: string; ativo: boolean }[];
    const ano = anos[0];
    if (ano && ano.status === 'ativo' && ano.ativo) {
      const resSeed = await restApi(`/rest/v1/anos_letivos?ano=eq.${ANO_CORRENTE}&select=id`);
      const corrente = ((await resSeed.json()) as { id: string }[])[0];
      if (corrente) {
        await fetch(`${URL_SUPABASE}/rest/v1/rpc/ativar_ano_letivo`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, body: JSON.stringify({ p_ano_id: corrente.id }) });
      }
    }
    await limparAnoTeste();
  });
  test('CT130 - Card Anos letivos na home navega para a página', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.locator('.card', { hasText: 'Anos letivos' }).click();
    await page.waitForURL(/\/gestao\/anos-letivos/);
    await expect(page.locator('h1')).toContainText('Anos letivos');
  });
  test('CT131 - Página lista o ano corrente como Ativo', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    const linhaCorrente = page.locator('tr').filter({ hasText: String(new Date().getFullYear()) });
    await expect(linhaCorrente).toBeVisible();
    await expect(linhaCorrente.locator('.badge')).toHaveText(/Ativo/i);
  });

  test('CT132 - Modal de novo ano letivo abre e cria ano Planejado', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await page.click('button:has-text("Novo ano letivo")');
    await expect(page.locator('.modal-title')).toContainText('Novo ano letivo');
    await expect(page.locator('#campoAno')).toBeVisible();
    await expect(page.locator('#campoDataInicio')).toBeVisible();
    await expect(page.locator('#campoDataFim')).toBeVisible();

    await page.fill('#campoAno', String(ANO_TESTE));
    await page.fill('#campoDataInicio', `${ANO_TESTE}-02-01`);
    await page.fill('#campoDataFim', `${ANO_TESTE}-12-20`);
    await page.click('.modal-footer button:has-text("Criar")');

    const linha = page.locator('tr').filter({ hasText: String(ANO_TESTE) });
    await expect(linha).toBeVisible({ timeout: 5000 });
    await expect(linha.locator('.badge')).toHaveText(/Planejado/i);
  });

  test('CT133 - Virada de ano: ativar arquiva o vigente e ativa o novo', async ({ page }) => {
    test.info().annotations.push({ type: 'depends', description: 'CT132' });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await page.waitForSelector('tbody tr');

    page.on('dialog', (d) => d.accept());
    const linhaNova = page.locator('tr').filter({ hasText: String(ANO_TESTE) });
    await linhaNova.locator('button[title="Ativar (virada de ano)"]').click();

    await expect(linhaNova.locator('.badge')).toHaveText(/Ativo/i, { timeout: 5000 });
    const linhaAnterior = page
      .locator('tr')
      .filter({ hasText: String(new Date().getFullYear()) });
    await expect(linhaAnterior.locator('.badge')).toHaveText(/Arquivado/i);
  });

  test('CT134 - Virada de retorno restaura o ano corrente', async ({ page }) => {
    test.info().annotations.push({ type: 'depends', description: 'CT133' });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await page.waitForSelector('tbody tr');

    page.on('dialog', (d) => d.accept());
    const linhaCorrente = page
      .locator('tr')
      .filter({ hasText: String(new Date().getFullYear()) });
    await linhaCorrente.locator('button[title="Ativar (virada de ano)"]').click();

    await expect(linhaCorrente.locator('.badge')).toHaveText(/Ativo/i, { timeout: 5000 });
    await expect(
      page.locator('tr').filter({ hasText: String(ANO_TESTE) }).locator('.badge'),
    ).toHaveText(/Arquivado/i);
  });

  test('CT135 - Botão de ativar fica desabilitado para o ano já ativo', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await page.waitForSelector('tbody tr');
    const linhaCorrente = page
      .locator('tr')
      .filter({ hasText: String(new Date().getFullYear()) });
    await expect(linhaCorrente.locator('.badge')).toHaveText(/Ativo/i);
    await expect(linhaCorrente.locator('button[title="Ativar (virada de ano)"]')).toBeDisabled();
  });
});
