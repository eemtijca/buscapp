import { expect, test } from '@playwright/test';

test.describe('PWA - artefatos servidos pelo build', () => {
  test('manifest com Content-Type correto e metadados essenciais', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/manifest+json');

    const manifest = await res.json();
    expect(manifest.name).toBe('BuscApp');
    expect(manifest.short_name).toBe('BuscApp');
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('pt-BR');
    expect(String(manifest.theme_color).toLowerCase()).toBe('#008241');

    const tamanhos = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(tamanhos).toContain('192x192');
    expect(tamanhos).toContain('512x512');
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });

  test('service worker servido como JavaScript no escopo raiz', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/javascript/i);
  });

  test('index.html referencia manifest, theme-color e apple-touch-icon', async ({ request }) => {
    const html = await (await request.get('/')).text();
    expect(html).toContain('rel="manifest"');
    expect(html).toMatch(/<meta name="theme-color" content="#008241"/i);
    expect(html).toContain('apple-touch-icon');
  });

  test('todos os ícones declarados respondem com PNG', async ({ request }) => {
    const { icons } = await (await request.get('/manifest.webmanifest')).json();
    for (const icone of icons) {
      const res = await request.get(icone.src as string);
      expect(res.status(), icone.src).toBe(200);
      expect(res.headers()['content-type'], icone.src).toBe('image/png');
    }
  });
});

test.describe('PWA - service worker ativo', () => {
  test('registra o service worker e serve a tela de login offline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Entrar');

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            navigator.serviceWorker.getRegistrations().then((r) => r[0]?.active?.state ?? 'none'),
          { timeout: 15_000 },
        ),
      )
      .toBe('activated');

    await page.reload();
    await expect(page.locator('h1')).toContainText('Entrar');

    await page.context().setOffline(true);
    await page.reload();
    await expect(page.locator('h1')).toContainText('Entrar');
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await page.context().setOffline(false);
  });

  test('navegação offline para rota profunda cai no app shell', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);

    await page.context().setOffline(true);
    await page.goto('/solicitar-codigo');
    await expect(page.getByText('Solicitar código de acesso')).toBeVisible();
    await page.context().setOffline(false);
  });
});
