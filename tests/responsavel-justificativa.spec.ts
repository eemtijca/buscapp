import { test, expect, type Page } from '@playwright/test';
import { login, logout } from './suporte/sessao.js';
import { SENHA_RESP } from './suporte/dados.js';

test.describe('Responsável — Anexo da justificativa por arrastar e soltar', () => {
  async function dataTransferComArquivo(page: Page, nome: string, tipo: string) {
    return page.evaluateHandle(([nomeArg, tipoArg]) => {
      const dt = new DataTransfer();
      dt.items.add(new File(['conteudo de teste'], nomeArg, { type: tipoArg }));
      return dt;
    }, [nome, tipo]);
  }

  test('CT146 - Anexo aceito por arrastar e soltar e tipo inválido rejeitado', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/justificativa');
    const zona = page.locator('.border-dashed');
    await expect(zona).toBeVisible({ timeout: 10000 });
    const pdf = await dataTransferComArquivo(page, 'atestado.pdf', 'application/pdf');
    await zona.dispatchEvent('drop', { dataTransfer: pdf });
    await expect(page.locator('.alert-success').filter({ hasText: 'atestado.pdf' })).toBeVisible();
    await page.getByRole('button', { name: 'Remover arquivo selecionado' }).click();
    await expect(zona).toBeVisible();
    const txt = await dataTransferComArquivo(page, 'nota.txt', 'text/plain');
    await zona.dispatchEvent('drop', { dataTransfer: txt });
    await expect(page.getByText('Formato não aceito. Envie uma imagem ou um PDF.')).toBeVisible();
    await expect(page.locator('.alert-success').filter({ hasText: 'nota.txt' })).toHaveCount(0);
    await logout(page);
  });
});
