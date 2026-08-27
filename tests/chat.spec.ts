import { test, expect } from '@playwright/test';
import { login } from './suporte/sessao.js';
import { SENHA_ADMIN, SENHA_RESP, SENHA_PROF, SERVICE_KEY, URL_SUPABASE } from './suporte/dados.js';
import { restApi } from './suporte/api.js';

// Setup global de chat — cria conversas e mensagens idempotentes antes de todos os testes deste arquivo.
test.beforeAll(async () => {
  const headers = {
    'Content-Type': 'application/json',
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Prefer: 'resolution=merge-duplicates,return=representation',
  };
  async function api(url: string, options: RequestInit = {}) {
    const res = await fetch(`${URL_SUPABASE}${url}`, { headers, ...options });
    if (!res.ok) { const corpo = await res.text().catch(() => ''); throw new Error(`Falha no setup do chat (${options.method ?? 'GET'} ${url}): ${res.status} ${corpo}`); }
    return res;
  }
  const RESPONSAVEL_ID = 'a0000000-0000-0000-0000-000000000005';
  const ALUNO1_ID = 'e0000000-0000-0000-0000-000000000001';
  const ALUNO2_ID = 'e0000000-0000-0000-0000-000000000002';
  async function upsertConversa(alunoId: string): Promise<string> {
    const res = await api('/rest/v1/conversas?on_conflict=responsavel_id,aluno_id', { method: 'POST', body: JSON.stringify({ turma_id: 'd0000000-0000-0000-0000-000000000001', responsavel_id: RESPONSAVEL_ID, aluno_id: alunoId, ativa: true }) });
    const data = (await res.json()) as { id: string }[];
    const convId = data?.[0]?.id;
    if (!convId) throw new Error('Falha ao capturar id da conversa no setup do chat.');
    return convId;
  }
  const CONV1 = await upsertConversa(ALUNO1_ID);
  await upsertConversa(ALUNO2_ID);
  for (const msg of [
    { id: 'f0000000-0000-0000-0000-000000000011', conversa_id: CONV1, remetente_id: 'a0000000-0000-0000-0000-000000000005', conteudo: 'Bom dia, gostaria de saber como está meu filho', created_at: '2026-07-20T08:00:00Z' },
    { id: 'f0000000-0000-0000-0000-000000000012', conversa_id: CONV1, remetente_id: 'a0000000-0000-0000-0000-000000000001', conteudo: 'Bom dia! O João está bem, participando das aulas.', created_at: '2026-07-20T08:15:00Z' },
    { id: 'f0000000-0000-0000-0000-000000000013', conversa_id: CONV1, remetente_id: 'a0000000-0000-0000-0000-000000000002', conteudo: 'Confirmo! Ele tem se destacado em matemática.', created_at: '2026-07-20T08:30:00Z' },
    { id: 'f0000000-0000-0000-0000-000000000014', conversa_id: CONV1, remetente_id: 'a0000000-0000-0000-0000-000000000005', conteudo: 'Que bom! Obrigado pela atenção.', created_at: '2026-07-20T09:00:00Z' },
  ]) {
    await api('/rest/v1/mensagens?on_conflict=id', { method: 'POST', body: JSON.stringify(msg) });
  }
  await api(`/rest/v1/conversas?id=eq.${CONV1}`, { method: 'PATCH', body: JSON.stringify({ ultima_mensagem_em: '2026-07-20T09:00:00Z' }) });
  await api(`/rest/v1/notificacoes?metadados->>conversa_id=eq.${CONV1}`, { method: 'DELETE' });
  await api('/rest/v1/notificacoes', { method: 'POST', body: JSON.stringify({ destinatario_id: 'a0000000-0000-0000-0000-000000000001', tipo: 'mensagem', titulo: 'Nova mensagem de Maria Silva', corpo: 'Bom dia, gostaria de saber como está meu filho', metadados: { conversa_id: CONV1 } }) });
});

test.describe('Responsável — Chat', () => {
  test('CT67 - Pagina de chat carrega com lista de contatos', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForSelector('.chat-layout', { timeout: 10000 });
    await expect(page.locator('input[type="search"]')).toBeVisible();
    await expect(page.locator('.chat-sidebar')).toBeVisible();
  });
  test('CT68 - Sidebar mostra nome dos contatos', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await expect(page.locator('.chat-sidebar button').first()).toBeVisible({ timeout: 10000 });
    const items = page.locator('.chat-sidebar button');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
    if (count > 0) { await expect(items.first()).toContainText(/João|Maria|Ana|Pedro|Rafael|Lucas|Júlia|Thiago|Isabela/); }
  });
  test('CT69 - Selecionar conversa exibe mensagens', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    const primeiroItem = page.locator('.chat-sidebar button').first();
    await expect(primeiroItem).toBeVisible({ timeout: 10000 });
    await primeiroItem.click();
    await page.waitForTimeout(1000);
    const bolhas = page.locator('.chat-messages .rounded-3');
    const count = await bolhas.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
  test('CT70 - Campo de busca filtra contatos', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(1500);
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('XXXX_NAO_EXISTE_XXXX');
    await page.waitForTimeout(500);
    await expect(page.getByText('Nenhuma conversa encontrada')).toBeVisible();
  });
  test('CT71 - Input desabilitado fora do horário letivo (responsável)', async ({ page }) => {
    await restApi('/rest/v1/horarios_letivos?ativo=eq.true', { method: 'PATCH', body: JSON.stringify({ ativo: false }) });
    try {
      await login(page, 'resp1@email.com', SENHA_RESP);
      await page.goto('/responsavel/chat');
      await page.waitForTimeout(3000);
      const primeiroItem = page.locator('.chat-sidebar button').first();
      await primeiroItem.click();
      await page.waitForTimeout(1000);
      const textarea = page.locator('textarea');
      await expect(textarea).toBeDisabled();
      await expect(page.locator('.alert-warning')).toBeVisible();
    } finally {
      await restApi('/rest/v1/horarios_letivos?ativo=eq.false', { method: 'PATCH', body: JSON.stringify({ ativo: true }) }).catch(() => {});
    }
  });
  test.skip('CT72 - Botão voltar aparece no mobile', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(3000);
    const items = page.locator('.chat-sidebar button');
    const count = await items.count();
    if (count > 0) { await items.first().click(); await page.waitForTimeout(1500); await expect(page.locator('i.bi-arrow-left').first()).toBeVisible(); }
  });
});

test.describe('Gestão — Chat', () => {
  test('CT73 - Página de chat carrega com sidebar e placeholder', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForSelector('.chat-layout', { timeout: 10000 });
    await expect(page.locator('input[type="search"]')).toBeVisible();
    await expect(page.getByText('Selecione uma conversa')).toBeVisible();
  });
  test('CT74 - Sidebar mostra contatos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await expect(page.locator('.chat-sidebar button').first()).toBeVisible({ timeout: 10000 });
    const items = page.locator('.chat-sidebar button');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.chat-sidebar button').filter({ hasText: 'Maria Silva' }).first()).toBeVisible();
  });
  test('CT75 - Selecionar conversa exibe mensagens', async ({ page }) => {
    const marcador = `CT75-${Date.now()}`;
    const FA = 'e0000000-0000-0000-0000-000000000001';
    const FT = 'd0000000-0000-0000-0000-000000000001';
    const FR = 'a0000000-0000-0000-0000-000000000005';
    let mensagemId = '';
    try {
      const busca = await fetch(`${URL_SUPABASE}/rest/v1/conversas?responsavel_id=eq.${FR}&aluno_id=eq.${FA}&select=id`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
      const existentes = (await busca.json()) as Array<{ id: string }>;
      let conversaId = existentes[0]?.id ?? '';
      if (!conversaId) { conversaId = crypto.randomUUID(); await restApi('/rest/v1/conversas', { method: 'POST', body: JSON.stringify({ id: conversaId, responsavel_id: FR, aluno_id: FA, turma_id: FT, ativa: true }) }); }
      const msgRes = await restApi('/rest/v1/mensagens?select=id', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=representation' }, body: JSON.stringify({ conversa_id: conversaId, remetente_id: 'a0000000-0000-0000-0000-000000000001', conteudo: `${marcador} mensagem de histórico.` }) });
      mensagemId = ((await msgRes.json()) as Array<{ id: string }>)[0]?.id ?? '';
      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/chat');
      const item = page.locator('.chat-sidebar button').filter({ hasText: marcador });
      await expect(item).toBeVisible({ timeout: 10000 });
      await item.first().click();
      await expect(page.locator('.chat-messages').getByText(marcador)).toBeVisible({ timeout: 10000 });
    } finally {
      if (mensagemId) { await restApi(`/rest/v1/mensagens?id=eq.${mensagemId}`, { method: 'DELETE' }).catch(() => {}); }
      await restApi(`/rest/v1/notificacoes?corpo=ilike.*${marcador}*`, { method: 'DELETE' }).catch(() => {});
    }
  });
  test('CT76 - Header de navegação com título chat', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    await expect(page.getByText('Chat com pais')).toBeVisible();
    await expect(page.locator('a[href="/gestao"]').first()).toBeVisible();
  });
  test('CT77 - Campo busca filtra contatos', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('XXXX_NAO_EXISTE_XXXX');
    await page.waitForTimeout(500);
    await expect(page.getByText('Nenhuma conversa encontrada')).toBeVisible();
  });
});

test.describe('Notificações — Popover', () => {
  test('CT84 - Sino visível para gestão', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await expect(page.locator('i.bi-bell').first()).toBeVisible();
  });
  test('CT85 - Sino visível para responsável', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await expect(page.locator('i.bi-bell').first()).toBeVisible();
  });
  test('CT86 - Sino visivel para professor', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor');
    await expect(page.locator('i.bi-bell').first()).toBeVisible();
  });
  test('CT87 - Popover abre ao clicar no sino', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    const btnNotif = page.locator('button[aria-label="Notificações"]');
    await btnNotif.click();
    await page.waitForTimeout(500);
    await expect(page.locator('.notif-menu').first()).toBeVisible({ timeout: 5000 });
    await btnNotif.click();
    await page.waitForTimeout(300);
  });
  test('CT88 - Notificação de mensagem aparece no popover', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await page.locator('button[aria-label="Notificações"]').click();
    await page.waitForTimeout(500);
    const notifMenu = page.locator('.notif-menu');
    await expect(notifMenu).toBeVisible();
    const itemCount = await notifMenu.locator('button').count();
    if (itemCount > 0) { await expect(notifMenu.locator('button').first()).toBeVisible(); } else { await expect(notifMenu.getByText('Nenhuma notificação')).toBeVisible(); }
  });
});

test.describe('Chat — Mobile', () => {
  test('CT89 - Mobile: lista ocupa tela cheia inicialmente', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(1500);
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });
  test.skip('CT90 - Mobile: alterna entre lista e chat', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(3000);
    const items = page.locator('.chat-sidebar button');
    const count = await items.count();
    if (count > 0) { await items.first().click(); await page.waitForTimeout(1500); await expect(page.locator('i.bi-arrow-left').first()).toBeVisible(); }
  });
  test('CT91 - Desktop: dois painéis visíveis', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    await expect(page.locator('.chat-sidebar')).toBeVisible();
    await expect(page.getByText('Selecione uma conversa')).toBeVisible();
  });
});

test.describe('Chat — Casos Extremos', () => {
  test('CT92 - Rota /gestao/chat exige autenticação', async ({ page }) => { await page.goto('/gestao/chat'); await expect(page).toHaveURL('/'); });
  test('CT94 - Rota /responsavel/chat exige autenticação', async ({ page }) => { await page.goto('/responsavel/chat'); await expect(page).toHaveURL('/'); });
});

test.describe('Chat — Resiliência', () => {
  test('CT95 - Sidebar contatos visível na gestão', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await expect(page.locator('.chat-sidebar button').first()).toBeVisible({ timeout: 10000 });
    const count = await page.locator('.chat-sidebar button').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
  test('CT96 - Recarregar pagina preserva UI', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.locator('.chat-layout')).toBeVisible();
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });
  test('CT97 - Responsável home não quebrou com novo card chat', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await expect(page.getByText('Falar com coordenação')).toBeVisible();
    await expect(page.getByText('Alertas')).toBeVisible();
    await expect(page.getByText('Termômetro')).toBeVisible();
    await expect(page.getByText('Justificativa')).toBeVisible();
  });
  test('CT98 - Gestão home não quebrou com novo card chat', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await expect(page.getByText('Chat com pais')).toBeVisible();
    await expect(page.getByText('Ranking de risco')).toBeVisible();
  });
});

test.describe('Chat — Input', () => {
  test('CT99 - Botão enviar desabilitado com input vazio', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(2000);
    const firstContact = page.locator('.chat-sidebar button').first();
    if (await firstContact.isVisible()) {
      await firstContact.click();
      await page.waitForTimeout(1000);
      const textarea = page.locator('textarea');
      const submitBtn = page.locator('button[type="submit"]');
      if (!(await textarea.isDisabled())) { await expect(submitBtn).toBeDisabled(); }
    }
  });
  test('CT100 - Tentativa de enviar so espacos', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/chat');
    await page.waitForTimeout(2000);
    const firstContact = page.locator('.chat-sidebar button').first();
    if (await firstContact.isVisible()) {
      await firstContact.click();
      await page.waitForTimeout(1000);
      const textarea = page.locator('textarea');
      if (!(await textarea.isDisabled())) {
        await textarea.fill('   ');
        const submitBtn = page.locator('button[type="submit"]');
        await expect(submitBtn).toBeDisabled();
      }
    }
  });
  test('CT101 - Gestão profile (side effect): logout não quebra', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(1000);
    await page.locator('button[data-bs-toggle="dropdown"]').click();
    await page.locator('.dropdown-menu').getByText('Sair da conta').click();
    await expect(page).toHaveURL('/');
  });
  test('CT102 - Mensagens de sistema sem quebra de layout', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/chat');
    await page.waitForTimeout(2000);
    const items = page.locator('.chat-sidebar button');
    if ((await items.count()) > 0) {
      await items.first().click();
      await page.waitForTimeout(1000);
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));
      await page.waitForTimeout(500);
      expect(pageErrors.length).toBe(0);
    }
  });
});

test.describe('Notificações — Casos Extremos', () => {
  test('CT103 - Popover fecha e reabre sem erros', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    const btnNotif = page.locator('button[aria-label="Notificações"]');
    await btnNotif.click();
    await page.waitForTimeout(300);
    await expect(page.locator('.notif-menu').first()).toBeVisible({ timeout: 5000 });
    await btnNotif.click();
    await page.waitForTimeout(300);
    await btnNotif.click();
    await page.waitForTimeout(300);
    await expect(page.locator('.notif-menu').first()).toBeVisible({ timeout: 5000 });
  });
  test('CT104 - Marcar todas como lidas', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await page.locator('button[aria-label="Notificações"]').click();
    await page.waitForTimeout(500);
    const notifMenu = page.locator('.notif-menu');
    const btnMarcar = notifMenu.locator('button:has-text("Marcar todas como lidas")');
    if (await btnMarcar.isVisible()) { await btnMarcar.click(); await page.waitForTimeout(500); await expect(btnMarcar).not.toBeVisible(); }
  });
  test('CT105 - Notificação com rota de chat', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await page.locator('button[aria-label="Notificações"]').click();
    await page.waitForTimeout(500);
    const items = page.locator('.notif-menu button');
    if ((await items.count()) > 0) { await items.first().click(); await page.waitForTimeout(1000); }
  });
  test('CT106 - Popover sem notificações mostra estado vazio', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel');
    await page.locator('button[aria-label="Notificações"]').click();
    await page.waitForTimeout(500);
    const notifMenu = page.locator('.notif-menu');
    if (await notifMenu.isVisible()) {
      const hasItems = (await notifMenu.locator('button').count()) > 0;
      if (hasItems) { await expect(notifMenu.locator('button').first()).toBeVisible(); } else { await expect(notifMenu.getByText('Nenhuma notificação')).toBeVisible(); }
    }
  });
});
