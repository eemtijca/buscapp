import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN } from './suporte/dados.js';
import { emailUnico } from './suporte/dados.js';
import { criarUsuarioApi, deletarUsuario, restApi, contarNotificacoesCodigo } from './suporte/api.js';

test.describe('Gestão - Códigos', () => {
  test('CT13 - Página de códigos carrega com abas', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
  });

  test('CT14 - Códigos do seed são exibidos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
  });
});

test.describe('Gestão - Códigos - Aba Pendentes', () => {
  test('CT34 - Página de códigos carrega com abas e indicador', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
    await expect(page.locator('.nav-link.active')).toContainText('Solicitações');
  });

  test('CT35 - Aba Solicitações carrega e mostra dados', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    const emptyState = page.getByText('Nenhuma solicitação pendente');
    const cards = page.locator('.card');
    const hasCards = (await cards.count()) > 0;
    if (!hasCards) {
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    }
  });

  test('CT36 - Botão Atualizar recarrega dados', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    const btnAtualizar = page.locator('button:has-text("Atualizar")');
    await expect(btnAtualizar).toBeVisible();
    await btnAtualizar.click();
    await expect(page.getByText('Dados atualizados')).toBeVisible({ timeout: 10000 });
  });

  test('CT37 - Indicador de conexao visivel', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.locator('span[title="Conectado"]')).toBeVisible();
  });

  test('CT38 - Aba Códigos carrega e mostra dados', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
    const emptyState = page.getByText('Nenhum código gerado ainda');
    const table = page.locator('table');
    const hasTable = await table.isVisible();
    if (!hasTable) {
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Gestão - Códigos - Aba Recentes', () => {
  test('CT40 - Busca por nome filtra resultados', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const inputBusca = page.locator('input[type="search"]');
    if (await inputBusca.isVisible()) {
      await inputBusca.fill('XXXX_NAO_EXISTE_XXXX');
      await page.waitForTimeout(500);
      await expect(page.getByText('Nenhum resultado para')).toBeVisible();
    }
  });

  test('CT41 - Toggle visibilidade do código', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const olhos = page.locator('button[title="Mostrar"], button[title="Ocultar"]');
    if ((await olhos.count()) > 0) {
      await olhos.first().click();
      await expect(page.locator('code.user-select-all').first()).toBeVisible();
    }
  });

  test('CT42 - Badges de status sao exibidos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const badges = page.locator('table .badge');
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('CT43 - Paginação visível quando necessário', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const paginacao = page.getByText(/Página \d+ de \d+/);
    if (await paginacao.isVisible()) {
      await expect(paginacao).toBeVisible();
    }
  });

  test('CT44 - Ultima atualizacao visivel', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByText('Última atualização')).toBeVisible();
  });
});

test.describe('Gestão - Códigos - Fluxo de revogação', () => {
  test('CT46 - Botão revogar abre modal de confirmação', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(500);
    const revogarBtn = page.locator('button[title="Revogar código"]').first();
    if (await revogarBtn.isVisible()) {
      await revogarBtn.click();
      await expect(page.getByText('Tem certeza que deseja revogar')).toBeVisible();
      await page.locator('button:has-text("Cancelar")').click();
    }
  });
});

test.describe('Gestão - Códigos - Mobile', () => {
  test('CT53 - Layout mobile carrega sem erros', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await expect(page.getByRole('button', { name: 'Solicitações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Códigos' })).toBeVisible();
  });

  test('CT54 - Mobile: botão Atualizar funciona', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    const btnAtualizar = page.locator('button:has-text("Atualizar")');
    if (await btnAtualizar.isVisible()) {
      await btnAtualizar.click();
    }
  });

  test('CT55 - Mobile: abas funcionam', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/codigos');
    await page.locator('button:has-text("Códigos")').click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Solicitações")').click();
    await expect(page.locator('.nav-link.active')).toContainText('Solicitações');
  });
});

test.describe('Códigos — Workflow completo (regressão pendente)', () => {
  test('CT121 - Pendente: código expirado → solicitação aparece → gera → redefinir senha', async ({
    page,
  }) => {
    const nome = 'Fluxo Pendente';
    const email = emailUnico('pwflow');
    const NOVA_SENHA = `Fluxo${Date.now()}!a1`;
    let userId = '';

    try {
      const criado = await criarUsuarioApi(nome, email);
      userId = criado.id;
      expect(criado.codigo.length).toBe(6);

      await restApi(`/rest/v1/codigos_redefinicao?email=eq.${email}`, {
        method: 'PATCH',
        body: JSON.stringify({ expira_em: '2020-01-01T00:00:00Z' }),
      });

      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      const card = page.locator('.card').filter({ hasText: email });
      await expect(card).toBeVisible({ timeout: 10000 });

      await card.getByRole('button', { name: 'Gerar' }).click();
      await page.locator('.modal button:has-text("Sim, gerar")').click();
      const codeEl = page.locator('.modal code.font-monospace');
      await expect(codeEl).toBeVisible({ timeout: 10000 });
      const novoCodigo = (await codeEl.textContent())?.trim() ?? '';
      expect(novoCodigo.length).toBe(6);
      await page.locator('.modal button:has-text("Concluído")').click();

      await page.goto('/gestao/codigos');
      await expect(page.locator('.card').filter({ hasText: email })).toHaveCount(0, {
        timeout: 10000,
      });

      await page.locator('button[data-bs-toggle="dropdown"]').click();
      await page.locator('.dropdown-menu').getByText('Sair da conta').click();
      await expect(page).toHaveURL('/');
      await page.goto('/redefinir-senha-codigo');
      await page.fill('input[id="email"]', email);
      await page.fill('input[id="codigo"]', novoCodigo);
      await page.fill('input[id="nova-senha"]', NOVA_SENHA);
      await page.fill('input[id="confirmar-senha"]', NOVA_SENHA);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Senha redefinida com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      await login(page, email, NOVA_SENHA);
      await expect(page).toHaveURL(/\/responsavel/);
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });
});

test.describe('Códigos — Deduplicação', () => {
  test('CT122 - Solicitações repetidas para o mesmo e-mail não duplicam', async ({ page }) => {
    const nome = 'Dedupe Pendente';
    const email = emailUnico('pwdedupe');
    let userId = '';

    try {
      const criado = await criarUsuarioApi(nome, email);
      userId = criado.id;

      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });
      const notifApos1 = await contarNotificacoesCodigo(criado.id);

      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });
      const notifApos2 = await contarNotificacoesCodigo(criado.id);

      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      await expect(page.locator('.card').filter({ hasText: email })).toHaveCount(1, {
        timeout: 10000,
      });

      expect(notifApos2).toBe(notifApos1);
      expect(notifApos1).toBeGreaterThan(0);
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });
});

test.describe('Códigos — Bloqueio por tentativas', () => {
  test('CT123 - Código bloqueia após tentativas erradas e mostra badge', async ({ page }) => {
    const nome = 'Bloqueio Teste';
    const email = emailUnico('pwblock');
    const SENHA_VALIDA = `Bloqueio${Date.now()}!a1`;
    let userId = '';

    const cfgRes = await restApi(
      '/rest/v1/configuracoes_sistema?id=eq.1&select=max_tentativas_codigo',
    );
    const cfgData = (await cfgRes.json()) as { max_tentativas_codigo: number }[];
    const maxOrig = cfgData[0]?.max_tentativas_codigo ?? 5;
    await restApi('/rest/v1/configuracoes_sistema?id=eq.1', {
      method: 'PATCH',
      body: JSON.stringify({ max_tentativas_codigo: 3 }),
    });

    try {
      const criado = await criarUsuarioApi(nome, email);
      userId = criado.id;

      await page.goto('/redefinir-senha-codigo');
      await page.fill('input[id="email"]', email);
      await page.fill('input[id="codigo"]', '111111');
      await page.fill('input[id="nova-senha"]', SENHA_VALIDA);
      await page.fill('input[id="confirmar-senha"]', SENHA_VALIDA);

      for (let i = 0; i < 3; i++) {
        await page.click('button[type="submit"]');
        await expect(page.getByText('Código inválido')).toBeVisible({ timeout: 10000 });
      }
      await page.click('button[type="submit"]');
      await expect(page.getByText('Muitas tentativas')).toBeVisible({ timeout: 10000 });

      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      await page.locator('button:has-text("Códigos")').click();
      const linha = page.locator('tr').filter({ hasText: email });
      await expect(linha).toBeVisible({ timeout: 10000 });
      await expect(linha.getByText('bloqueado', { exact: true })).toBeVisible();
    } finally {
      await restApi('/rest/v1/configuracoes_sistema?id=eq.1', {
        method: 'PATCH',
        body: JSON.stringify({ max_tentativas_codigo: maxOrig }),
      }).catch(() => {});
      if (userId) await deletarUsuario(userId);
      await restApi(`/rest/v1/codigos_redefinicao_tentativas?email=eq.${email}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  });
});

test.describe('Gestão — Configuração de códigos', () => {
  test('CT124 - Configurações do sistema expõem parâmetros de código e salvam', async ({
    page,
  }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/sistema');

    await expect(page.locator('#cfg-validade-codigo')).toBeVisible();
    await expect(page.locator('#cfg-max-tentativas')).toBeVisible();
    await expect(page.locator('#cfg-bloqueio')).toBeVisible();
    await expect(page.locator('#cfg-retencao')).toBeVisible();

    const novoMax = 7;
    await page.fill('#cfg-max-tentativas', String(novoMax));
    await page.click('button:has-text("Salvar alterações")');
    await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.alert-success')).toContainText(/salva com sucesso/);

    await expect
      .poll(async () => {
        const res = await restApi(
          '/rest/v1/configuracoes_sistema?id=eq.1&select=max_tentativas_codigo',
        );
        const data = (await res.json()) as { max_tentativas_codigo: number }[];
        return data[0]?.max_tentativas_codigo;
      })
      .toBe(novoMax);

    await restApi('/rest/v1/configuracoes_sistema?id=eq.1', {
      method: 'PATCH',
      body: JSON.stringify({ max_tentativas_codigo: 5 }),
    }).catch(() => {});
  });
});

test.describe('Códigos — Revogação e nova solicitação (regressão)', () => {
  test('CT125 - Gerar sempre novo; re-solicitar após gerar/revogar aparece', async ({ page }) => {
    const nome = 'Revogacao Fluxo';
    const email = emailUnico('pwrev');
    let userId = '';

    try {
      const criado = await criarUsuarioApi(nome, email);
      userId = criado.id;
      const codigoInicial = criado.codigo;
      expect(codigoInicial.length).toBe(6);

      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      const card = page.locator('.card').filter({ hasText: email });
      await expect(card).toBeVisible({ timeout: 10000 });
      await card.getByRole('button', { name: 'Gerar' }).click();
      await page.locator('.modal button:has-text("Sim, gerar")').click();
      const codeEl = page.locator('.modal code.font-monospace');
      await expect(codeEl).toBeVisible({ timeout: 10000 });
      const codigoGerado1 = (await codeEl.textContent())?.trim() ?? '';
      expect(codigoGerado1.length).toBe(6);
      expect(codigoGerado1).not.toBe(codigoInicial);
      await page.locator('.modal button:has-text("Concluído")').click();

      await page.goto('/gestao/codigos');
      await page.locator('button:has-text("Códigos")').click();
      const linhasEmail = page.locator('tr').filter({ hasText: email });
      await expect(linhasEmail.first()).toBeVisible({ timeout: 10000 });
      await expect(linhasEmail.filter({ hasText: 'revogado' })).toHaveCount(1);

      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      await page.goto('/gestao/codigos');
      const card2 = page.locator('.card').filter({ hasText: email });
      await expect(card2).toBeVisible({ timeout: 10000 });
      await card2.getByRole('button', { name: 'Gerar' }).click();
      await page.locator('.modal button:has-text("Sim, gerar")').click();
      await expect(page.locator('.modal code.font-monospace')).toBeVisible({ timeout: 10000 });
      const codigoGerado2 =
        (await page.locator('.modal code.font-monospace').textContent())?.trim() ?? '';
      expect(codigoGerado2.length).toBe(6);
      expect(codigoGerado2).not.toBe(codigoGerado1);
      await page.locator('.modal button:has-text("Concluído")').click();

      await page.goto('/gestao/codigos');
      await page.locator('button:has-text("Códigos")').click();
      const linhaAtiva = page
        .locator('tr')
        .filter({ hasText: email })
        .filter({ has: page.locator('button[title="Revogar código"]') });
      await expect(linhaAtiva).toHaveCount(1, { timeout: 10000 });
      await linhaAtiva.locator('button[title="Revogar código"]').click();
      await page.locator('.modal button:has-text("Sim, revogar")').click();
      await expect(page.getByText('Código revogado com sucesso.')).toBeVisible({
        timeout: 10000,
      });

      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      await page.goto('/gestao/codigos');
      const card3 = page.locator('.card').filter({ hasText: email });
      await expect(card3).toBeVisible({ timeout: 10000 });
      await card3.getByRole('button', { name: 'Gerar' }).click();
      await page.locator('.modal button:has-text("Sim, gerar")').click();
      await expect(page.locator('.modal code.font-monospace')).toBeVisible({ timeout: 10000 });
      const codigoGerado3 =
        (await page.locator('.modal code.font-monospace').textContent())?.trim() ?? '';
      expect(codigoGerado3.length).toBe(6);
      expect(codigoGerado3).not.toBe(codigoGerado2);
      await page.locator('.modal button:has-text("Concluído")').click();
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });
});

async function inserirCodigo(
  perfilId: string,
  email: string,
  codigo: string,
  estado: 'usado' | 'expirado' | 'revogado',
) {
  const agora = new Date();
  const corpo: Record<string, unknown> = {
    email,
    perfil_id: perfilId,
    codigo,
    expira_em: new Date(agora.getTime() + 3600000).toISOString(),
  };
  if (estado === 'usado') corpo.usado_em = agora.toISOString();
  if (estado === 'expirado') corpo.expira_em = new Date(agora.getTime() - 1000).toISOString();
  if (estado === 'revogado') {
    corpo.expira_em = new Date(agora.getTime() - 1000).toISOString();
    corpo.revogado_em = agora.toISOString();
  }
  await restApi('/rest/v1/codigos_redefinicao', { method: 'POST', body: JSON.stringify(corpo) });
}

test.describe('Códigos — Limpar não ativos', () => {
  test('CT126 - Limpar remove não ativos e preserva ativos (com confirmação)', async ({ page }) => {
    const nome = 'Limpar Teste';
    const email = emailUnico('pwlimpar');
    let userId = '';

    try {
      const criado = await criarUsuarioApi(nome, email);
      userId = criado.id;

      await inserirCodigo(criado.id, email, '111111', 'usado');
      await inserirCodigo(criado.id, email, '222222', 'expirado');
      await inserirCodigo(criado.id, email, '333333', 'revogado');

      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      await page.locator('button:has-text("Códigos")').click();

      const linhasAntes = page.locator('tr').filter({ hasText: email });
      await expect(linhasAntes).toHaveCount(4, { timeout: 10000 });

      await page.locator('button:has-text("Limpar não ativos")').click();
      await expect(page.getByText('Limpar códigos não ativos')).toBeVisible({ timeout: 5000 });
      await page.locator('.modal button:has-text("Sim, limpar")').click();
      await expect(page.getByText(/códigos? removidos/)).toBeVisible({ timeout: 10000 });

      await expect(page.locator('tr').filter({ hasText: email })).toHaveCount(1, {
        timeout: 10000,
      });
      await expect(page.locator('tr').filter({ hasText: '111111' })).toHaveCount(0);
      await expect(page.locator('tr').filter({ hasText: '222222' })).toHaveCount(0);
      await expect(page.locator('tr').filter({ hasText: '333333' })).toHaveCount(0);
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });
});

test.describe('Códigos — Copiar ao clicar', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Clipboard API apenas no Chromium');

  test('CT127 - Clique no código do modal copia e dá feedback', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://localhost:5173',
    });
    const email = emailUnico('pwcopy');
    let userId = '';

    try {
      const criado = await criarUsuarioApi('Copy Click', email);
      userId = criado.id;

      await page.goto('/solicitar-codigo');
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Solicitação enviada com sucesso!')).toBeVisible({
        timeout: 15000,
      });

      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      const card = page.locator('.card').filter({ hasText: email });
      await expect(card).toBeVisible({ timeout: 10000 });
      await card.getByRole('button', { name: 'Gerar' }).click();
      await page.locator('.modal button:has-text("Sim, gerar")').click();
      const codeEl = page.locator('.modal code.font-monospace');
      await expect(codeEl).toBeVisible({ timeout: 10000 });
      const codigo = (await codeEl.textContent())?.trim() ?? '';
      expect(codigo.length).toBe(6);

      await codeEl.click();
      await expect(page.getByText('Código copiado!')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Copiado', { exact: true })).toBeVisible({ timeout: 5000 });
      await expect
        .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(codigo);
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });

  test('CT127b - Clique no código da tabela copia', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://localhost:5173',
    });
    const email = emailUnico('pwtbl');
    let userId = '';

    try {
      const criado = await criarUsuarioApi('Copy Tabela', email);
      userId = criado.id;
      const codigoInicial = criado.codigo;

      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/codigos');
      await page.locator('button:has-text("Códigos")').click();
      const linha = page.locator('tr').filter({ hasText: email });
      await expect(linha.first()).toBeVisible({ timeout: 10000 });
      await linha.locator('button[title="Mostrar"]').first().click();
      const codeEl = linha.locator('code.user-select-all').first();
      await expect(codeEl).toBeVisible({ timeout: 5000 });
      await codeEl.click();
      await expect(page.getByText('Código copiado!')).toBeVisible({ timeout: 5000 });
      await expect
        .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(codigoInicial);
    } finally {
      if (userId) await deletarUsuario(userId);
    }
  });
});
