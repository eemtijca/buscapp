import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN, SENHA_PROF } from './suporte/dados.js';

test.describe('Combobox - todos os dropdowns viraram combobox', () => {
  test('CT-CB01 - Gestao tolera digitação para filtrar turma no novo aluno', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/alunos/novo');
    await expect(page.locator('#campoTurma')).toBeVisible();
    await page.click('#campoTurma');
    await expect(page.locator('#campoTurma-lista [role="option"]').first()).toBeVisible();
    // Filtra por "3ª"
    await page.fill('#campoTurma', '3ª');
    await expect(page.locator('#campoTurma-lista [role="option"]')).toContainText('3ª');
    await page.keyboard.press('Escape');
  });

  test('CT-CB02 - Combobox de responsável existente no novo aluno permite pesquisar e selecionar', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/alunos/novo');
    // Garante que o radio "Selecionar existente" está ativo por padrão
    await expect(page.locator('#vinculoExistente')).toBeChecked();
    const comboboxResp = page.locator('#campoRespEmail');
    await expect(comboboxResp).toBeVisible({ timeout: 10000 });
    // Abre e verifica que há opções de responsáveis carregadas
    await comboboxResp.click();
    await expect(page.locator('#campoRespEmail-lista [role="option"]').first()).toBeVisible({ timeout: 10000 });
    // Pesquisa por nome parcial (Maria -> Maria Silva do seed)
    await comboboxResp.fill('');
    await comboboxResp.pressSequentially('Maria', { delay: 40 });
    await expect(page.locator('#campoRespEmail-lista [role="option"]', { hasText: 'Maria' }).first()).toBeVisible({ timeout: 8000 });
    // Seleciona o primeiro resultado
    await page.locator('#campoRespEmail-lista [role="option"]', { hasText: 'Maria' }).first().click();
    // O input deve exibir "Nome — email"
    await expect(comboboxResp).toHaveValue(/Maria.*@.*\..*/);
    // Alternar para "Criar novo" mostra campos adicionais e esconde combobox de busca
    await page.locator('label[for="vinculoNovo"]').click();
    await expect(page.locator('#campoRespNome')).toBeVisible();
    await expect(page.locator('#campoTipoVinculo')).toBeVisible();
    // Voltar para existente mantém combobox
    await page.locator('label[for="vinculoExistente"]').click();
    await expect(page.locator('#campoRespEmail')).toBeVisible();
  });

  test('CT-CB03 - Combobox de série/letra em Turmas filtra ao digitar', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/turmas');
    await page.click('button:has-text("Nova turma")');
    await page.waitForSelector('#campoSerie');
    await page.click('#campoSerie');
    await page.fill('#campoSerie', '2ª');
    await expect(page.locator('#campoSerie-lista [role="option"]', { hasText: '2ª' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.click('#campoLetra');
    await page.fill('#campoLetra', 'B');
    await expect(page.locator('#campoLetra-lista [role="option"]', { hasText: 'B' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.click('button:has-text("Cancelar")');
  });

  test('CT-CB04 - Combobox de aluno em Ocorrência do professor filtra por nome', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/ocorrencia');
    const input = page.locator('#alunoSelect');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.click();
    await expect(page.locator('#alunoSelect-lista [role="option"]').first()).toBeVisible({ timeout: 10000 });
    // Digita parte do nome de aluno do seed
    await input.fill('João');
    await expect(page.locator('#alunoSelect-lista [role="option"]', { hasText: 'João' }).first()).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
  });

  test('CT-CB05 - Combobox de turma em Atribuições permite limpar e reselecionar', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/atribuicoes');
    await page.click('button:has-text("Nova atribuição")');
    await expect(page.locator('#campoProfessor')).toBeVisible();
    await page.click('#campoProfessor');
    await expect(page.locator('#campoProfessor-lista [role="option"]').first()).toBeVisible({ timeout: 10000 });
    const primeiraOpcao = await page.locator('#campoProfessor-lista [role="option"]').first().textContent();
    await page.locator('#campoProfessor-lista [role="option"]').first().click();
    await expect(page.locator('#campoProfessor')).not.toHaveValue('');
    // Limpar via botão X
    await page.locator('.combobox-wrapper').filter({ has: page.locator('#campoProfessor') }).locator('button[aria-label="Limpar seleção"]').click();
    await expect(page.locator('#campoProfessor')).toHaveValue('');
    // Reseleciona para garantir que ainda funciona
    await page.click('#campoProfessor');
    await expect(page.locator('#campoProfessor-lista [role="option"]', { hasText: primeiraOpcao?.trim().slice(0, 5) ?? '' }).first()).toBeVisible({ timeout: 8000 });
    await page.click('button:has-text("Cancelar")');
  });

  test('CT-CB06 - Teclado: ArrowDown + Enter seleciona opção', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/turmas');
    await page.click('button:has-text("Nova turma")');
    await page.waitForSelector('#campoSerie');
    await page.click('#campoSerie');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    // Deve ter selecionado 2ª
    await expect(page.locator('#campoSerie')).toHaveValue(/2ª/);
    await page.click('button:has-text("Cancelar")');
  });
});
