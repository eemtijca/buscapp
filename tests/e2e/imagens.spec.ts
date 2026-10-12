// Capturas do README: gera as imagens de docs/imagens com massa sintética e sem dados reais.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { SENHA_ADMIN, SENHA_PROF, SENHA_RESP } from '../suporte/dados.js';
import { consultar, executar } from '../suporte/banco.js';
import { login } from '../suporte/sessao.js';

const pastaImagens = path.resolve(process.cwd(), 'docs/imagens');

/**
 * Abre o horário letivo por agora e restaura ao final, para a captura do chat
 * não depender da hora em que as imagens foram geradas.
 */
async function comHorarioLetivoAberto<T>(acao: () => Promise<T>): Promise<T> {
  const janelas = await consultar<{ id: string; hora_inicio: string; hora_fim: string }>(
    'select id, hora_inicio::text as hora_inicio, hora_fim::text as hora_fim from public.horarios_letivos where ativo = true',
  );
  await executar(
    "update public.horarios_letivos set hora_inicio = '00:00', hora_fim = '23:59' where ativo = true",
  );
  try {
    return await acao();
  } finally {
    for (const janela of janelas) {
      await executar(
        'update public.horarios_letivos set hora_inicio = $1, hora_fim = $2 where id = $3',
        [janela.hora_inicio, janela.hora_fim, janela.id],
      );
    }
  }
}

/**
 * As capturas dependem da massa do seed. Sem ela, falha com orientação explícita
 * em vez de gravar imagens vazias no README.
 */
function exigirMassa(condicao: boolean, descricao: string): void {
  if (!condicao) {
    throw new Error(
      `Massa do seed ausente: ${descricao}. Rode "pnpm --filter @buscapp/api run seed" antes das capturas.`,
    );
  }
}

test.describe('Capturas do README', () => {
  test('painel da gestão no desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Captura de desktop apenas no Chromium.');
    await mkdir(pastaImagens, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ranking');
    await expect(page.getByText('Ranking de priorização de risco')).toBeVisible();
    const cartoes = page.locator('.card').filter({ hasText: 'Matrícula' });
    await expect(cartoes.first()).toBeVisible({ timeout: 15000 });
    exigirMassa(
      (await cartoes.count()) >= 20,
      'o ranking precisa das turmas e dos alunos do seed',
    );
    await expect(cartoes.filter({ hasText: 'João Miguel da Silva' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(pastaImagens, 'painel-gestao-desktop.png'),
      animations: 'disabled',
    });
  });

  test('chamada do professor no celular', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'Mobile Chrome',
      'Captura de celular apenas no Mobile Chrome.',
    );
    await mkdir(pastaImagens, { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await expect(page.getByText('Registrar frequência')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    const alunos = page.locator('.card-body .card');
    await expect(alunos.first()).toBeVisible({ timeout: 15000 });
    exigirMassa(
      (await alunos.count()) >= 20,
      'a chamada do professor precisa dos alunos do seed',
    );
    await expect(page.getByRole('button', { name: /João Miguel da Silva/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(pastaImagens, 'chamada-professor-mobile.png'),
      animations: 'disabled',
    });
  });

  test('ocorrências da gestão no desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Captura de desktop apenas no Chromium.');
    await mkdir(pastaImagens, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ocorrencias');
    await expect(page.getByText('Ocorrências graves e suspensões')).toBeVisible();
    const registros = page.locator('article');
    await expect(registros.first()).toBeVisible({ timeout: 15000 });
    exigirMassa(
      (await registros.count()) >= 3,
      'a central de ocorrências precisa das ocorrências do seed',
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(pastaImagens, 'ocorrencias-gestao-desktop.png'),
      animations: 'disabled',
    });
  });

  test('chat do responsável no celular', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'Mobile Chrome',
      'Captura de celular apenas no Mobile Chrome.',
    );
    await mkdir(pastaImagens, { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'resp1@email.com', SENHA_RESP);
    await comHorarioLetivoAberto(async () => {
      await page.goto('/responsavel/chat');
      const contatos = page.locator('.chat-sidebar button');
      await expect(contatos.first()).toBeVisible({ timeout: 15000 });
      exigirMassa(
        (await contatos.count()) >= 1,
        'o chat do responsável precisa das conversas do seed',
      );
      await contatos.first().click();
      const mensagens = page.locator('.chat-messages .rounded-3');
      await expect(mensagens.first()).toBeVisible({ timeout: 15000 });
      exigirMassa(
        (await mensagens.count()) >= 1,
        'o chat do responsável precisa das mensagens do seed',
      );
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: path.join(pastaImagens, 'chat-responsavel-mobile.png'),
        animations: 'disabled',
      });
    });
  });
});
