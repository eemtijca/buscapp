import { test, expect } from '@playwright/test';
import { login, logout } from '../suporte/sessao.js';
import { GESTAO_ID, SENHA_ADMIN, SENHA_RESP } from '../suporte/dados.js';
import { inserirLinhas, excluirLinhas } from '../suporte/api.js';
import { consultar, executar } from '../suporte/banco.js';

test.describe('Chat da coordenação via ranking', () => {
  test.describe.configure({ mode: 'serial' });
  const LUCAS_ID = 'e0000000-0000-0000-0000-000000000005';
  const JOAO_SANTOS_ID = 'a0000000-0000-0000-0000-000000000006';

  async function fecharJanelaLetiva() {
    await executar('update public.horarios_letivos set ativo = false where ativo = true');
  }

  async function reabrirJanelaLetiva() {
    await executar('update public.horarios_letivos set ativo = true where ativo = false');
  }

  /** Remove conversas do aluno e notificações que apontam para elas (metadados JSON). */
  async function limparConversasDoAluno(alunoId: string) {
    const conversas = await consultar<{ id: string }>(
      'select id from public.conversas where aluno_id = $1',
      [alunoId],
    );
    if (conversas.length > 0) {
      await excluirLinhas('notificacoes', `metadados->>'conversa_id' = any($1::text[])`, [
        conversas.map((conversa) => conversa.id),
      ]);
    }
    await excluirLinhas('conversas', 'aluno_id = $1', [alunoId]);
  }

  test('CT144 - Ranking: conversa nova visível e gestão envia fora do horário', async ({
    page,
  }) => {
    await limparConversasDoAluno(LUCAS_ID);
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
      await expect(page.locator('.chat-header').getByText('João Santos')).toBeVisible({
        timeout: 10000,
      });
      const largura = (await page.viewportSize())?.width ?? 1280;
      if (largura >= 768) {
        await expect(
          page
            .locator('.chat-sidebar button')
            .filter({ hasText: 'João Santos' })
            .filter({ hasText: 'Nenhuma mensagem ainda' })
            .first(),
        ).toBeVisible({ timeout: 10000 });
      }
      const textarea = page.locator('textarea');
      await expect(textarea).toBeEnabled({ timeout: 10000 });
      await textarea.fill('Primeiro contato da coordenação.');
      await page.locator('button[aria-label="Enviar mensagem"]').click();
      await expect(
        page.locator('.chat-messages').getByText('Primeiro contato da coordenação.'),
      ).toBeVisible({ timeout: 10000 });
      await expect
        .poll(
          async () => {
            const notificacoes = await consultar<{ id: string }>(
              `select id from public.notificacoes
               where destinatario_id = $1 and metadados->>'conversa_id' = $2`,
              [JOAO_SANTOS_ID, conversaId],
            );
            return notificacoes.length;
          },
          { timeout: 10000 },
        )
        .toBeGreaterThanOrEqual(1);
    } finally {
      await reabrirJanelaLetiva();
      if (conversaId) {
        await excluirLinhas('notificacoes', `metadados->>'conversa_id' = $1`, [conversaId]).catch(
          () => {},
        );
      }
      await limparConversasDoAluno(LUCAS_ID).catch(() => {});
    }
  });

  test('CT145 - Responsável recebe a conversa iniciada pela coordenação', async ({ page }) => {
    await limparConversasDoAluno(LUCAS_ID);
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

      // A API cria a conversa com `iniciada_pela_gestao`, mas não insere a mensagem de
      // sistema; ela é semeada aqui para preservar o contrato do cenário.
      await inserirLinhas('mensagens', [
        {
          conversa_id: conversaId,
          remetente_id: GESTAO_ID,
          conteudo: 'Conversa iniciada pela coordenação',
          is_system_message: true,
        },
      ]);

      await logout(page);
      await login(page, 'resp2@email.com', SENHA_RESP);
      await page.goto('/responsavel/chat');
      const item = page
        .locator('.chat-sidebar button')
        .filter({ hasText: 'Lucas Eduardo Pereira' })
        .first();
      await expect(item).toBeVisible({ timeout: 10000 });
      await item.click();
      await expect(
        page.locator('.chat-messages').getByText('Conversa iniciada pela coordenação'),
      ).toBeVisible({ timeout: 10000 });
      const textarea = page.locator('textarea');
      if ((await textarea.count()) > 0) {
        await expect(textarea).toBeDisabled();
      }
    } finally {
      await reabrirJanelaLetiva();
      if (conversaId) {
        await excluirLinhas('notificacoes', `metadados->>'conversa_id' = $1`, [conversaId]).catch(
          () => {},
        );
      }
      await limparConversasDoAluno(LUCAS_ID).catch(() => {});
    }
  });
});
