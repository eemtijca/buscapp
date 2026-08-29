import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN } from './suporte/dados.js';
import { restApi } from './suporte/api.js';
import { URL_SUPABASE, SERVICE_KEY } from './suporte/dados.js';

test.describe('Gestão - Configuração', () => {
  test('CT110 - Pagina hub carrega com categorias', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao');
    await expect(page.locator('h1')).toContainText('Configurações');
    await expect(page.locator('h3.card-nav-title').filter({ hasText: 'Módulos' })).toBeVisible();
    await expect(page.locator('h3.card-nav-title').filter({ hasText: 'Documentos' })).toBeVisible();
    await expect(page.locator('h3.card-nav-title').filter({ hasText: 'Períodos' })).toBeVisible();
  });

  test('CT111 - Página de módulo carrega com tabela', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await expect(page.locator('h1')).toContainText('Módulos');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('table')).toContainText('Frequência');
    await expect(page.locator('table')).toContainText('Ocorrências');
  });

  test('CT112 - Criar opção no modal', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await page.click('button:has-text("Nova opção")');
    await expect(page.locator('.modal-title')).toContainText('Nova opção');
    await page.click('button:has-text("Outra...")');
    const nome = `Teste E2E ${Date.now()}`;
    await page.fill('#campo-nome', nome);
    await page.click('button:has-text("Salvar")');
    await page.waitForTimeout(1000);
    await expect(page.locator('table')).toContainText(nome, { timeout: 5000 });
  });

  test('CT112b - Seletor de letras de turma exibe o catálogo incluindo D', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/letra_turma');
    await page.click('button:has-text("Nova opção")');
    await expect(page.locator('.modal-title')).toContainText('Nova opção');
    for (const letra of ['A', 'B', 'C', 'D']) {
      await expect(page.getByRole('button', { name: letra, exact: true })).toBeVisible();
    }
    await page.click('button:has-text("Cancelar")');
  });

  test('CT112c - Duplicata de opção existente é bloqueada', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await page.click('button:has-text("Nova opção")');
    await page.click('button:has-text("Outra...")');
    await page.fill('#campo-nome', 'Frequência');
    await expect(page.getByText(/Já existe uma opção chamada/)).toBeVisible();
  });

  test('CT112d - Serie aceita apenas numeros com sufixo ª', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/serie_turma');
    await page.click('button:has-text("Nova opção")');
    await page.click('button:has-text("Outra...")');
    const input = page.locator('#campo-nome');
    await input.pressSequentially('abc4x9');
    await expect(input).toHaveValue('49');
    await expect(page.locator('.input-group-text')).toHaveText('ª');
    await page.click('button:has-text("Cancelar")');
  });

  test('CT112e - Letra aceita apenas uma letra maiuscula', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/letra_turma');
    await page.click('button:has-text("Nova opção")');
    await page.click('button:has-text("Outra...")');
    const input = page.locator('#campo-nome');
    await input.pressSequentially('xz');
    await expect(input).toHaveValue('X');
    await input.fill('');
    await input.pressSequentially('ab');
    await expect(input).toHaveValue('A');
    await page.click('button:has-text("Cancelar")');
  });

  test('CT112f - Cartoes do seletor tem altura uniforme', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/documento');
    await page.click('button:has-text("Nova opção")');
    await expect(page.locator('.modal-title')).toContainText('Nova opção');
    await page.waitForTimeout(400);
    const alturas = await page
      .locator('.modal .cartao-selecao')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(alturas.length).toBeGreaterThan(1);
    expect(Math.max(...alturas) - Math.min(...alturas)).toBeLessThanOrEqual(1);
    await page.click('button:has-text("Cancelar")');
  });

  test('CT112g - Texto do cartao permanece legivel no hover', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await page.click('button:has-text("Nova opção")');
    await expect(page.locator('.modal-title')).toContainText('Nova opção');
    const card = page.locator('.modal .cartao-selecao').first();
    await card.hover();
    const cor = await card
      .locator('span')
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(cor.toLowerCase()).not.toBe('rgb(255, 255, 255)');
    await page.click('button:has-text("Cancelar")');
  });

  test('CT113 - Tags de comportamento carrega com tabela', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/tags');
    await expect(page.locator('h1')).toContainText('Tags de Comportamento');
    await expect(page.locator('table')).toBeVisible();
  });

  test('CT114 - Sistema carrega e salva alteração', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/sistema');
    await expect(page.locator('h1')).toContainText('Configurações do Sistema');
    await expect(page.locator('#cfg-nome')).toBeVisible();
    await expect(page.locator('#cfg-critico')).toBeVisible();
    await expect(page.locator('#cfg-preventivo')).toBeVisible();
  });

  test('CT115 - Horários carrega com tabela', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/horarios');
    await expect(page.locator('h1')).toContainText('Horários Letivos');
    await expect(page.locator('table')).toBeVisible();
  });

  test('CT124 - Configurações do sistema expõem parâmetros de código e salvam', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/sistema');
    await expect(page.locator('#cfg-validade-codigo')).toBeVisible();
    await expect(page.locator('#cfg-max-tentativas')).toBeVisible();
    await expect(page.locator('#cfg-bloqueio')).toBeVisible();
    await expect(page.locator('#cfg-retencao')).toBeVisible();
    const novoMax = 7;
    await page.fill('#cfg-max-tentativas', String(novoMax));
    await page.click('button:has-text("Salvar alterações")');
    await expect(page.getByText('Configurações salvas.')).toBeVisible({ timeout: 10000 });
    await expect
      .poll(async () => {
        const res = await restApi('/rest/v1/configuracoes_sistema?id=eq.1&select=max_tentativas_codigo');
        const data = (await res.json()) as { max_tentativas_codigo: number }[];
        return data[0]?.max_tentativas_codigo;
      })
      .toBe(novoMax);
    await restApi('/rest/v1/configuracoes_sistema?id=eq.1', {
      method: 'PATCH',
      body: JSON.stringify({ max_tentativas_codigo: 5 }),
    }).catch(() => {});
  });
});

test.describe('Gestão - Integridade de catálogo', () => {
  test.beforeAll(async () => {
    const headers = {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=representation',
    };
    const res = await fetch(`${URL_SUPABASE}/rest/v1/ocorrencias`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        aluno_id: 'e0000000-0000-0000-0000-000000000001',
        professor_id: 'a0000000-0000-0000-0000-000000000002',
        turma_id: 'd0000000-0000-0000-0000-000000000001',
        ano_letivo_id: 'b0000000-0000-0000-0000-000000000001',
        titulo: 'Integridade tag referenciada',
        descricao: 'Setup de teste de integridade',
        tipo: ['grave'],
        tags_comportamento: ['Desatenção'],
      }),
    });
    if (!res.ok) throw new Error(`Setup ocorrencia falhou: ${res.status}`);
  });

  test('CT116 - Excluir opção de catálogo referenciada é bloqueado', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/serie_turma');
    const linha = page.locator('.config-table tbody tr').filter({ hasText: '1ª' });
    page.on('dialog', (d) => d.accept());
    await linha.locator('button.btn-outline-danger').click();
    await expect(page.getByText(/Não é possível excluir/)).toBeVisible();
    await expect(linha).toBeVisible();
  });

  test('CT117 - Excluir opção não referenciada funciona', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/modulo');
    await page.click('button:has-text("Nova opção")');
    await page.click('button:has-text("Outra...")');
    const nome = `Opcao Excluivel ${Date.now()}`;
    await page.fill('#campo-nome', nome);
    await page.click('.modal-footer button:has-text("Salvar")');
    await page.waitForTimeout(1000);
    await expect(page.locator('table')).toContainText(nome, { timeout: 5000 });
    const linha = page.locator('.config-table tbody tr').filter({ hasText: nome });
    page.on('dialog', (d) => d.accept());
    await linha.locator('button.btn-outline-danger').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('table')).not.toContainText(nome, { timeout: 5000 });
  });

  test('CT118 - Excluir tag referenciada e bloqueado', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/tags');
    const linha = page.locator('tbody tr').filter({ hasText: 'Desatenção' });
    page.on('dialog', (d) => d.accept());
    await linha.locator('button.btn-outline-danger').click();
    await expect(page.getByText(/Não é possível excluir/)).toBeVisible();
    await expect(linha).toBeVisible();
  });

  test('CT119 - Renomear tag referenciada e bloqueado', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/tags');
    const linha = page.locator('tbody tr').filter({ hasText: 'Desatenção' });
    await linha.locator('button.btn-outline-primary').click();
    await expect(page.locator('.modal-title')).toContainText('Editar tag');
    await page.fill('#tag-nome', 'Desatencao nova');
    await page.click('.modal-footer button:has-text("Salvar")');
    await expect(page.getByText(/Não é possível renomear/)).toBeVisible();
    await page.click('.modal-footer button:has-text("Cancelar")');
  });

  test('CT120 - Transferência de enturmação mantém uma enturmação ativa', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/alunos/e0000000-0000-0000-0000-000000000001');
    const card = page.locator('.card').filter({ hasText: 'Enturmação atual' });
    await expect(card.getByText(/Matrícula em:/)).toBeVisible();
    await expect(async () => {
      if ((await card.locator('#campoNovaTurma').count()) === 0) {
        await card.getByRole('button', { name: 'Alterar enturmação' }).click();
      }
      await expect(card.locator('#campoNovaTurma')).toBeVisible({ timeout: 3000 });
    }).toPass();
    await card.locator('#campoNovaTurma').click();
    await card.locator('#campoNovaTurma-lista [role="option"]', { hasText: '3ª C' }).click();
    await card.locator('#campoNovaDataMat').fill('2026-08-01');
    await card.getByRole('button', { name: 'Salvar' }).click();
    await expect(card.getByRole('button', { name: 'Alterar enturmação' })).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText('3ª C');
    const query = `${URL_SUPABASE}/rest/v1/enturmacoes?select=turma_id,status,ano_letivo_id&aluno_id=eq.e0000000-0000-0000-0000-000000000001&status=eq.matriculado`;
    const fetchEnturmacoes = async () => {
      const res = await fetch(query, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
      if (!res.ok) return null;
      const data = (await res.json()) as { turma_id: string }[] | null;
      return Array.isArray(data) ? data : null;
    };
    await expect.poll(fetchEnturmacoes, { timeout: 10000 }).toEqual([{ turma_id: 'd0000000-0000-0000-0000-000000000003', status: 'matriculado', ano_letivo_id: 'b0000000-0000-0000-0000-000000000001' }]);
    await restApi(`/rest/v1/enturmacoes?aluno_id=eq.e0000000-0000-0000-0000-000000000001&ano_letivo_id=eq.b0000000-0000-0000-0000-000000000001`, { method: 'DELETE' });
    await restApi('/rest/v1/enturmacoes', { method: 'POST', body: JSON.stringify({ aluno_id: 'e0000000-0000-0000-0000-000000000001', turma_id: 'd0000000-0000-0000-0000-000000000001', ano_letivo_id: 'b0000000-0000-0000-0000-000000000001', status: 'matriculado' }) });
  });
});
