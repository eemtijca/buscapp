import { test, expect } from '@playwright/test';
import { login, logout } from './suporte/sessao.js';
import { SENHA_ADMIN, SENHA_RESP } from './suporte/dados.js';
import { restApi } from './suporte/api.js';

test.describe('Chat da coordenação via ranking', () => {
  test.describe.configure({ mode: 'serial' });
  const LUCAS_ID = 'e0000000-0000-0000-0000-000000000005';
  const JOAO_SANTOS_ID = 'a0000000-0000-0000-0000-000000000006';

  async function fecharJanelaLetiva() {
    await restApi('/rest/v1/horarios_letivos?ativo=eq.true', { method: 'PATCH', body: JSON.stringify({ ativo: false }) });
  }
  async function reabrirJanelaLetiva() {
    await restApi('/rest/v1/horarios_letivos?ativo=eq.false', { method: 'PATCH', body: JSON.stringify({ ativo: true }) });
  }

  test('CT144 - Ranking: conversa nova visível e gestão envia fora do horário', async ({ page }) => {
    await restApi(`/rest/v1/conversas?aluno_id=eq.${LUCAS_ID}`, { method: 'DELETE' });
    await fecharJanelaLetiva();
    let conversaId = '';
    try {
      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/ranking');
      const cardLucas = page.locator('.card').filter({ hasText: 'Lucas Eduardo Pereira' }).first();
      await cardLucas.locator('button[title="Abrir conversa com o responsável"]').click();
      await page.waitForURL(/\/gestao\/chat/, { timeout: 15000 });
      conversaId = new URL(page.url()).searchParams.get('conversa') ?? '';
      expect(conversaId).not.toBe('');
      await expect(page.locator('.chat-header').getByText('João Santos')).toBeVisible({ timeout: 10000 });
      const largura = (await page.viewportSize())?.width ?? 1280;
      if (largura >= 768) {
        await expect(page.locator('.chat-sidebar button').filter({ hasText: 'João Santos' }).filter({ hasText: 'Nenhuma mensagem ainda' }).first()).toBeVisible({ timeout: 10000 });
      }
      const textarea = page.locator('textarea');
      await expect(textarea).toBeEnabled({ timeout: 10000 });
      await textarea.fill('Primeiro contato da coordenação.');
      await page.locator('button[aria-label="Enviar mensagem"]').click();
      await expect(page.locator('.chat-messages').getByText('Primeiro contato da coordenação.')).toBeVisible({ timeout: 10000 });
      await expect.poll(async () => {
        const res = await restApi(`/rest/v1/notificacoes?select=id&destinatario_id=eq.${JOAO_SANTOS_ID}&metadados->>conversa_id=eq.${conversaId}`);
        return ((await res.json()) as { id: string }[]).length;
      }, { timeout: 10000 }).toBeGreaterThanOrEqual(1);
    } finally {
      await reabrirJanelaLetiva();
      if (conversaId) { await restApi(`/rest/v1/notificacoes?metadados->>conversa_id=eq.${conversaId}`, { method: 'DELETE' }).catch(() => {}); }
      await restApi(`/rest/v1/conversas?aluno_id=eq.${LUCAS_ID}`, { method: 'DELETE' }).catch(() => {});
    }
  });

  test('CT145 - Responsável recebe a conversa iniciada pela coordenação', async ({ page }) => {
    await restApi(`/rest/v1/conversas?aluno_id=eq.${LUCAS_ID}`, { method: 'DELETE' });
    await fecharJanelaLetiva();
    let conversaId = '';
    try {
      await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
      await page.goto('/gestao/ranking');
      const cardLucas = page.locator('.card').filter({ hasText: 'Lucas Eduardo Pereira' }).first();
      await cardLucas.locator('button[title="Abrir conversa com o responsável"]').click();
      await page.waitForURL(/\/gestao\/chat/, { timeout: 15000 });
      conversaId = new URL(page.url()).searchParams.get('conversa') ?? '';
      expect(conversaId).not.toBe('');
      await logout(page);
      await login(page, 'resp2@email.com', SENHA_RESP);
      await page.goto('/responsavel/chat');
      const item = page.locator('.chat-sidebar button').filter({ hasText: 'Lucas Eduardo Pereira' }).first();
      await expect(item).toBeVisible({ timeout: 10000 });
      await item.click();
      await expect(page.locator('.chat-messages').getByText('Conversa iniciada pela coordenação')).toBeVisible({ timeout: 10000 });
      const textarea = page.locator('textarea');
      if ((await textarea.count()) > 0) { await expect(textarea).toBeDisabled(); }
    } finally {
      await reabrirJanelaLetiva();
      if (conversaId) { await restApi(`/rest/v1/notificacoes?metadados->>conversa_id=eq.${conversaId}`, { method: 'DELETE' }).catch(() => {}); }
      await restApi(`/rest/v1/conversas?aluno_id=eq.${LUCAS_ID}`, { method: 'DELETE' }).catch(() => {});
    }
  });
});
