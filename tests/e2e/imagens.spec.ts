// Capturas do README: gera as imagens de docs/imagens com massa sintética e sem dados reais.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { SENHA_ADMIN, SENHA_PROF } from '../suporte/dados.js';
import { login } from '../suporte/sessao.js';

const pastaImagens = path.resolve(process.cwd(), 'docs/imagens');

test.describe('Capturas do README', () => {
  test('painel da gestão no desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Captura de desktop apenas no Chromium.');
    await mkdir(pastaImagens, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ranking');
    await expect(page.getByText('Ranking de priorização de risco')).toBeVisible();
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
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(pastaImagens, 'chamada-professor-mobile.png'),
      animations: 'disabled',
    });
  });
});
