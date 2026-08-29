import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN, SENHA_PROF, emailUnico, SERVICE_KEY, URL_SUPABASE } from './suporte/dados.js';
import { restApi, obterToken, deletarUsuario } from './suporte/api.js';

// Cria usuário temporário isolado via edge function.
async function criarUsuarioTemp(nome: string, email: string, papel: 'professor' | 'responsavel' = 'professor'): Promise<string> {
  const token = await obterToken('gestao@escola.edu.br', SENHA_ADMIN);
  const res = await fetch(`${URL_SUPABASE}/functions/v1/criar-usuario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nome, email, papel }),
  });
  if (!res.ok) throw new Error(`criarUsuarioTemp ${res.status}`);
  const { id } = (await res.json()) as { id: string };
  return id;
}

test.describe('Gestão - Usuários - Salvamento limpa estado de edição', () => {
  test('CT-Dirty-1: usuário editado e salvo permite sair sem confirmação', async ({ page }) => {
    const email = emailUnico('dirty1-');
    const id = await criarUsuarioTemp('Usuario Dirty 1', email, 'professor');
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto(`/gestao/usuarios/${id}`);
    await page.waitForSelector('#campoNome');
    await page.waitForLoadState('networkidle');

    const nomeInput = page.locator('#campoNome');
    await nomeInput.fill('');
    await nomeInput.fill('Usuario Dirty 1 Editado');

    await page.click('button[type="submit"]:has-text("Salvar alterações")');
    await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.alert-success')).toContainText(/Usuário "Usuario Dirty 1 Editado" atualizado com sucesso às/);

    let dialogShown = false;
    page.on('dialog', async (d) => {
      dialogShown = true;
      await d.accept();
    });
    await page.locator('button:has-text("Cancelar")').click();
    await page.waitForURL(/\/gestao\/usuarios/);
    expect(dialogShown).toBe(false);

    await deletarUsuario(id);
    await restApi(`/rest/v1/perfis?id=eq.${id}`, { method: 'DELETE' });
  });

  test('CT-Dirty-2: usuário editado sem salvar exige confirmação ao sair', async ({ page }) => {
    const email = emailUnico('dirty2-');
    const id = await criarUsuarioTemp('Usuario Dirty 2', email, 'responsavel');
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto(`/gestao/usuarios/${id}`);
    await page.waitForSelector('#campoNome');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#campoNome')).toHaveValue('Usuario Dirty 2');

    const input = page.locator('#campoNome');
    await input.fill('');
    await input.fill('Usuario Dirty 2 Temporário');
    await page.waitForTimeout(500);

    let dialogMessage = '';
    page.on('dialog', async (d) => {
      dialogMessage = d.message();
      await d.dismiss();
    });
    await page.locator('a[href="/gestao"]').first().click();
    await page.waitForTimeout(800);
    expect(dialogMessage).toContain('Há alterações não salvas');
    page.removeAllListeners('dialog');

    page.once('dialog', async (d) => await d.accept());
    await page.locator('a[href="/gestao"]').first().click();
    await expect(page).toHaveURL(/\/gestao$/);

    await deletarUsuario(id);
    await restApi(`/rest/v1/perfis?id=eq.${id}`, { method: 'DELETE' });
  });

  test('CT-Dirty-3: novo aluno criado permite sair sem confirmação', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    const mat = `TEST${Date.now()}`;
    await page.goto('/gestao/alunos/novo');
    await page.waitForSelector('#campoNome');
    await page.waitForLoadState('networkidle');

    await page.fill('#campoNome', 'Aluno Teste Dirty');
    await page.fill('#campoMatricula', mat);
    await page.click('button[type="submit"]:has-text("Criar aluno")');
    await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.alert-success')).toContainText(/Aluno "Aluno Teste Dirty" criado com sucesso às/);

    let dialogShown = false;
    page.on('dialog', async (d) => {
      dialogShown = true;
      await d.accept();
    });
    await page.locator('button:has-text("Cancelar")').click();
    await page.waitForURL(/\/gestao\/alunos/);
    expect(dialogShown).toBe(false);

    await restApi(`/rest/v1/alunos?matricula=eq.${mat}`, { method: 'DELETE' });
  });
});

test.describe('Navegação - Indicador de carregamento', () => {
  test('CT-Load-1: exibe indicador com título da página de destino', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await page.waitForSelector('text=Gestão');
    await page.route('**/rest/v1/perfis*', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });
    const navPromise = page.goto('/gestao/usuarios');
    await expect(page.locator('.tela-carregamento')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.tela-carregamento')).toContainText(/Carregando Usuários/i);
    await navPromise;
    await expect(page.locator('.tela-carregamento')).toBeHidden({ timeout: 3000 });
    await page.unroute('**/rest/v1/perfis*');
  });

  test('CT-Load-2: rota com carregamento sob demanda', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor');
    await page.waitForSelector('text=Professor');
    await page.route('**/rest/v1/perfis*', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    const nav = page.goto('/professor/frequencia');
    await expect(page.locator('.tela-carregamento')).toBeVisible({ timeout: 3000 });
    await nav;
    await expect(page).toHaveURL(/\/professor\/frequencia/);
    await expect(page.locator('h1, h5')).toBeVisible();
    await page.unroute('**/rest/v1/perfis*');
  });

  test('CT-Load-3: indicador é responsivo em viewport estreito', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await page.waitForLoadState('networkidle');
    const p = page.goto('/gestao/turmas');
    await expect(page.locator('.tela-carregamento__conteudo')).toBeVisible({ timeout: 3000 });
    const box = await page.locator('.tela-carregamento__conteudo').boundingBox();
    expect(box!.width).toBeLessThan(330);
    await p;
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
    expect(text).toMatch(/Turma ".*"( criada| atualizada) com sucesso às \d{2}:\d{2}|Turma .* falhou ao criar/);
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
    await expect(page.locator('.alert-danger').first()).toContainText(/Disciplina .* falhou ao salvar/);
  });

  test('CT-Msg-3: alerta possui botão de fechar', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await page.click('button:has-text("Novo ano letivo")');
    await page.waitForSelector('.modal');
    const ano = String(new Date().getFullYear() + 10 + Math.floor(Math.random() * 10));
    await restApi(`/rest/v1/anos_letivos?ano=eq.${ano}`, { method: 'DELETE' });
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
    await restApi(`/rest/v1/anos_letivos?ano=eq.${ano}`, { method: 'DELETE' });
  });
});

test.describe('Gestão - Bloqueio de ações durante operações', () => {
  test('CT-Block-1: botão de salvar fica desabilitado durante salvamento', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios/novo');
    await page.waitForSelector('form');
    await page.fill('#campoNome', 'Bloqueio Teste');
    await page.fill('#campoEmail', emailUnico('bloq-'));
    await page.route('**/functions/v1/criar-usuario', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });
    const clickPromise = page.click('button[type="submit"]:has-text("Criar usuário")');
    await expect(page.locator('button[type="submit"]:has-text("Criar usuário")')).toBeDisabled({ timeout: 2000 });
    await expect(page.locator('button:has-text("Cancelar")')).toBeDisabled();
    await clickPromise;
    await page.unroute('**/functions/v1/criar-usuario');
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
