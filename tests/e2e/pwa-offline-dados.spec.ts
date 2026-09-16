import { expect, test } from '@playwright/test';
import { login } from '../suporte/sessao.js';
import { SENHA_ADMIN } from '../suporte/dados.js';

/** Verifica se o registro de uma consulta já foi gravado no IndexedDB. */
async function consultaPersistida(page: import('@playwright/test').Page, trecho: string) {
  return page.evaluate(async (alvo) => {
    const abrir = () =>
      new Promise<IDBDatabase | null>((resolver) => {
        const requisicao = indexedDB.open('buscapp-cache');
        requisicao.onsuccess = () => resolver(requisicao.result);
        requisicao.onerror = () => resolver(null);
      });
    const banco = await abrir();
    if (!banco) return false;
    return new Promise<boolean>((resolver) => {
      const transacao = banco.transaction('consultas', 'readonly');
      const requisicao = transacao.objectStore('consultas').getAll();
      requisicao.onsuccess = () => {
        const registros = requisicao.result as Array<{ chave: string }>;
        resolver(registros.some((registro) => registro.chave.includes(alvo)));
      };
      requisicao.onerror = () => resolver(false);
    });
  }, trecho);
}

test.describe('PWA - dados persistidos', () => {
  test('abre a rota com dados do cache e aviso de offline', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Anos letivos' })).toBeVisible();

    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => consultaPersistida(page, 'anos-letivos'), { timeout: 15_000 }).toBe(true);

    await page.context().setOffline(true);
    await page.reload();

    await expect(page.getByText('Sem conexão')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Anos letivos' })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toBeVisible();

    await page.context().setOffline(false);
  });

  test('revalida com 304 e mantém os dados retidos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await expect(page.locator('table')).toBeVisible();

    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => consultaPersistida(page, 'anos-letivos'), { timeout: 15_000 }).toBe(true);

    const status: number[] = [];
    page.on('response', (resposta) => {
      if (resposta.url().includes('/api/anos-letivos')) status.push(resposta.status());
    });

    await page.reload();
    await expect(page.locator('table')).toBeVisible();
    await expect.poll(() => status.includes(304), { timeout: 15_000 }).toBe(true);
  });
});
