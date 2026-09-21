import { expect, test, type Page } from '@playwright/test';
import { login, logout } from '../suporte/sessao.js';
import { GESTAO_ID, SENHA_ADMIN, SENHA_PROF } from '../suporte/dados.js';

interface RegistroCache {
  chave: string;
  namespace: string;
}

/** Lê os registros persistidos da loja `consultas` do IndexedDB. */
async function lerConsultas(page: Page): Promise<RegistroCache[]> {
  return page.evaluate(
    () =>
      new Promise<RegistroCache[]>((resolver) => {
        const requisicao = indexedDB.open('buscapp-cache');
        requisicao.onsuccess = () => {
          const banco = requisicao.result;
          const transacao = banco.transaction('consultas', 'readonly');
          const listagem = transacao.objectStore('consultas').getAll();
          listagem.onsuccess = () => resolver(listagem.result as RegistroCache[]);
          listagem.onerror = () => resolver([]);
        };
        requisicao.onerror = () => resolver([]);
      }),
  );
}

test.describe('Cache - purga de sessão', () => {
  test('CT-Purga-1: logout limpa o IndexedDB e não vaza dados entre contas', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/anos-letivos');
    await expect(page.locator('table')).toBeVisible();
    await expect
      .poll(
        async () =>
          (await lerConsultas(page)).some((registro) => registro.chave.includes('anos-letivos')),
        {
          timeout: 15_000,
        },
      )
      .toBe(true);

    await logout(page);
    await expect.poll(async () => (await lerConsultas(page)).length, { timeout: 10_000 }).toBe(0);

    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await expect(page.getByText('Registrar frequência')).toBeVisible();

    await expect
      .poll(async () => (await lerConsultas(page)).length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    const registros = await lerConsultas(page);
    expect(registros.some((registro) => registro.namespace === GESTAO_ID)).toBe(false);
  });
});
