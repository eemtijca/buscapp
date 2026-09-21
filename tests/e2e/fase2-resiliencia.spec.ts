import { expect, test } from '@playwright/test';
import { API_URL, SENHA_ADMIN } from '../suporte/dados.js';
import { login } from '../suporte/sessao.js';

/**
 * Resiliência da fase 2: sessão expirada, reset de scroll e estado de erro
 * quando a API falha. Os testes não dependem da ordem da suíte.
 */

test.describe('Resiliência do front', () => {
  test('CT150 - Sessão expirada redireciona ao login guardando o destino', async ({
    page,
    context,
  }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/alunos');
    await expect(page.getByRole('heading', { name: /alunos/i }).first()).toBeVisible();

    // Mantém o estado em memória e invalida apenas o cookie de sessão.
    await context.addCookies([{ name: 'buscapp_sessao', value: 'token-invalido', url: API_URL }]);

    await page
      .getByRole('button', { name: /atualizar/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/\?destino=%2Fgestao%2Falunos/, { timeout: 15_000 });

    // Após autenticar, volta para a rota de origem.
    await page.fill('input[type="email"]', 'gestao@escola.edu.br');
    await page.fill('input[type="password"]', SENHA_ADMIN);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/gestao\/alunos/, { timeout: 15_000 });
  });

  test('CT151 - Navegação reseta o scroll do conteúdo', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/auditoria');
    await expect(page.getByRole('heading', { name: /auditoria/i }).first()).toBeVisible();

    const principal = page.locator('#conteudoPrincipal');
    await principal.evaluate((elemento) => elemento.scrollTo({ top: 600 }));

    await page
      .getByRole('link', { name: /início/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/gestao$/);
    await expect.poll(async () => principal.evaluate((elemento) => elemento.scrollTop)).toBe(0);
  });

  test('CT152 - Falha da API mostra estado de erro com tentar novamente', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);

    await page.route('**/api/alunos**', (rota) => rota.abort());
    await page.goto('/gestao/alunos');

    const alerta = page.getByRole('alert').filter({ hasText: /não foi possível carregar/i });
    await expect(alerta).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /tentar novamente/i })).toBeVisible();

    // Ao restabelecer a API, o botão recarrega e a lista aparece.
    await page.unroute('**/api/alunos**');
    await page.getByRole('button', { name: /tentar novamente/i }).click();
    await expect(alerta).toBeHidden({ timeout: 20_000 });
  });
});
