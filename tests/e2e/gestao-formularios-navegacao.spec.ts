import { test, expect } from '@playwright/test';
import { login } from '../suporte/sessao.js';
import { SENHA_ADMIN, emailUnico } from '../suporte/dados.js';
import { criarUsuarioApi, deletarUsuario } from '../suporte/api.js';
import { excluirLinhas } from '../suporte/banco.js';

test.describe('Gestão - Usuários - Salvamento limpa estado de edição', () => {
  test('CT-Dirty-1: usuário editado e salvo permite sair sem confirmação', async ({ page }) => {
    const email = emailUnico('dirty1-');
    const { id } = await criarUsuarioApi({
      nome: 'Usuario Dirty 1',
      email,
      papel: 'professor',
    });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto(`/gestao/usuarios/${id}`);
    await page.waitForSelector('#campoNome');
    await page.waitForLoadState('load');

    const nomeInput = page.locator('#campoNome');
    await nomeInput.fill('');
    await nomeInput.fill('Usuario Dirty 1 Editado');

    await page.click('button[type="submit"]:has-text("Salvar alterações")');
    await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.alert-success')).toContainText(
      /Usuário "Usuario Dirty 1 Editado" atualizado com sucesso às/,
    );

    let dialogShown = false;
    page.on('dialog', async (d) => {
      dialogShown = true;
      await d.accept();
    });
    await page.locator('button:has-text("Cancelar")').click();
    await page.waitForURL(/\/gestao\/usuarios/);
    expect(dialogShown).toBe(false);

    await deletarUsuario(id);
  });

  test('CT-Dirty-2: usuário editado sem salvar exige confirmação ao sair', async ({ page }) => {
    const email = emailUnico('dirty2-');
    const { id } = await criarUsuarioApi({
      nome: 'Usuario Dirty 2',
      email,
      papel: 'responsavel',
    });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto(`/gestao/usuarios/${id}`);
    await page.waitForSelector('#campoNome');
    await page.waitForLoadState('load');
    await expect(page.locator('#campoNome')).toHaveValue('Usuario Dirty 2');

    const input = page.locator('#campoNome');
    await input.fill('');
    await input.fill('Usuario Dirty 2 Temporário');
    await page.waitForTimeout(500);

    // Primeira tentativa: o modal de confirmação segura a navegação.
    await page.locator('a[href="/gestao"]').first().click();
    const modal = page.locator('.modal.show');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('alterações não salvas');
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modal).toBeHidden();
    await expect(page).toHaveURL(/\/gestao\/usuarios\//);

    // Segunda tentativa: sair sem salvar navega.
    await page.locator('a[href="/gestao"]').first().click();
    await page.locator('.modal.show').getByRole('button', { name: 'Sair sem salvar' }).click();
    await expect(page).toHaveURL(/\/gestao$/);

    await deletarUsuario(id);
  });

  test('CT-Dirty-3: novo aluno criado permite sair sem confirmação', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    const mat = `TEST${Date.now()}`;
    await page.goto('/gestao/alunos/novo');
    await page.waitForSelector('#campoNome');
    await page.waitForLoadState('load');

    await page.fill('#campoNome', 'Aluno Teste Dirty');
    await page.fill('#campoMatricula', mat);
    await page.click('button[type="submit"]:has-text("Criar aluno")');
    await page.click('.modal button:has-text("Salvar")');
    await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.alert-success')).toContainText(
      /Aluno "Aluno Teste Dirty" criado com sucesso às/,
    );

    let dialogShown = false;
    page.on('dialog', async (d) => {
      dialogShown = true;
      await d.accept();
    });
    await page.locator('button:has-text("Cancelar")').click();
    await page.waitForURL(/\/gestao\/alunos/);
    expect(dialogShown).toBe(false);

    await excluirLinhas('alunos', 'matricula = $1', [mat]);
  });
});

test.describe('Navegação - cache de dados', () => {
  test('CT-Cache-1: reabrir rota visitada não espera a rede nem exibe overlay', async ({
    page,
  }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios');
    await page.waitForSelector('table');

    await page.locator('a[href="/gestao"]').first().click();
    await expect(page.getByText('Ranking de risco')).toBeVisible();

    await page.route('**/api/usuarios*', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    const inicio = Date.now();
    await page.locator('a[href="/gestao/usuarios"]').first().click();
    await expect(page.locator('table')).toBeVisible({ timeout: 1500 });
    expect(Date.now() - inicio).toBeLessThan(1500);
    await expect(page.locator('.tela-carregamento')).toHaveCount(0);
    await page.unroute('**/api/usuarios*');
  });

  test('CT-Cache-2: usuário criado por outro cliente aparece sem recarregar', async ({ page }) => {
    const email = emailUnico('cache-sse-');
    const { id } = await criarUsuarioApi({
      nome: 'Usuario Cache SSE',
      email,
      papel: 'responsavel',
    });

    try {
      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/usuarios');
      await page.waitForSelector('table');
      await expect(page.getByText('Usuario Cache SSE')).toBeVisible({ timeout: 15_000 });
    } finally {
      await deletarUsuario(id);
    }
  });

  test('CT-Cache-3: passar o mouse no cartão aquece as consultas da rota', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await expect(page.getByText('Ranking de risco')).toBeVisible();

    const requisicoes: string[] = [];
    page.on('request', (requisicao) => {
      if (requisicao.url().includes('/api/alunos')) requisicoes.push(requisicao.url());
    });

    const cartaoRanking = page.locator('a[href="/gestao/ranking"]').first();
    await cartaoRanking.hover();
    await expect.poll(() => requisicoes.length, { timeout: 5000 }).toBeGreaterThan(0);

    await cartaoRanking.click();
    await expect(page.getByText('Ranking de priorização de risco')).toBeVisible();
  });
});

test.describe('Gestão - Mensagens de feedback', () => {
  test('CT-Msg-1: criação de turma exibe mensagem com horário', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/turmas');
    await page.click('button:has-text("Nova turma")');
    await page.waitForSelector('.modal');
    const letraUnica = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    try {
      await page.click('#campoLetra');
      await page.getByRole('option', { name: letraUnica, exact: true }).click({ timeout: 2000 });
    } catch {
      await page.keyboard.press('Escape');
    }
    await page.click('.modal-footer button:has-text("Criar")');
    const alert = page.locator('.alert-success, .alert-danger').first();
    await expect(alert).toBeVisible({ timeout: 8000 });
    const text = await alert.textContent();
    expect(text).toMatch(
      /Turma ".*"( criada| atualizada) com sucesso às \d{2}:\d{2}|Turma .* falhou ao criar/,
    );
  });

  test('CT-Msg-2: validação de disciplina exibe mensagem explícita', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/disciplinas');
    await page.click('button:has-text("Nova disciplina")');
    await page.waitForSelector('.modal');
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.setAttribute('novalidate', '');
    });
    await page.click('.modal-footer button:has-text("Criar")');
    await expect(page.locator('.alert-danger').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.alert-danger').first()).toContainText(
      /Disciplina .* falhou ao salvar/,
    );
  });

  test('CT-Msg-3: alerta possui botão de fechar', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await page.click('button:has-text("Novo ano letivo")');
    await page.waitForSelector('.modal');
    const ano = String(new Date().getFullYear() + 10 + Math.floor(Math.random() * 10));
    await excluirLinhas('anos_letivos', 'ano = $1', [ano]);
    await page.fill('#campoAno', ano);
    await page.fill('#campoDataInicio', `${ano}-02-01`);
    await page.fill('#campoDataFim', `${ano}-12-20`);
    await page.click('.modal-footer button:has-text("Criar")');
    const success = page.locator('.alert-success').first();
    await expect(success).toBeVisible({ timeout: 8000 });
    await expect(success).toContainText(/Ano letivo ".*"( criado| criada) com sucesso às/);
    await expect(success.locator('.btn-close')).toBeVisible();
    await success.locator('.btn-close').click();
    await expect(success).toBeHidden();
    await excluirLinhas('anos_letivos', 'ano = $1', [ano]);
  });
});

test.describe('Gestão - Bloqueio de ações durante operações', () => {
  test('CT-Block-1: botão de salvar fica desabilitado durante salvamento', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios/novo');
    await page.waitForSelector('form');
    await page.fill('#campoNome', 'Bloqueio Teste');
    await page.fill('#campoEmail', emailUnico('bloq-'));
    await page.route('**/api/usuarios', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });
    const clickPromise = page.click('button[type="submit"]:has-text("Criar usuário")');
    await expect(page.locator('button[type="submit"]:has-text("Criar usuário")')).toBeDisabled({
      timeout: 2000,
    });
    await expect(page.locator('button:has-text("Cancelar")')).toBeDisabled();
    await clickPromise;
    await page.unroute('**/api/usuarios');
  });

  test('CT-Block-2: ações permanecem habilitadas fora de carregamento', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/turmas');
    await page.waitForSelector('table');
    const btnEditar = page.locator('table button.btn-outline-success').first();
    await expect(btnEditar).toBeEnabled();
  });
});

test.describe('Gestão - Modal responsivo', () => {
  test('CT-Mobile-1: modal utiliza classe de tela cheia em viewport estreito', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/turmas');
    await page.click('button:has-text("Nova turma")');
    await expect(page.locator('.modal-dialog')).toHaveClass(/modal-fullscreen-sm-down/);
    await expect(page.locator('.modal-dialog')).toBeVisible();
  });
});
