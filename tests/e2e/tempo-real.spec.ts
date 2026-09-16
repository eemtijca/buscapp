import { test, expect } from '@playwright/test';
import { login } from '../suporte/sessao.js';
import { SENHA_ADMIN, SENHA_RESP, SENHA_PROF } from '../suporte/dados.js';
import { apiFetch, loginApi } from '../suporte/api.js';
import { excluirLinhas, executar, inserirLinhas } from '../suporte/banco.js';

test.describe('Tempo real — Atualizações sem reload', () => {
  const GESTAO_ID = 'a0000000-0000-0000-0000-000000000001';
  const ALUNO_ID = 'e0000000-0000-0000-0000-000000000001';

  /** Remove frequências e justificativas vinculadas para o aluno/data. */
  async function limparFrequencias(alunoId: string, data: string) {
    await executar(
      `delete from public.justificativas_faltas
        where frequencia_id in (
          select id from public.frequencias where aluno_id = $1 and data_aula = $2
        )`,
      [alunoId, data],
    );
    await excluirLinhas('frequencias', 'aluno_id = $1 and data_aula = $2', [alunoId, data]);
  }

  test('CT140 - Alertas do responsável aparecem em tempo real', async ({ page }) => {
    const DATA = '2026-12-05';
    const FREQ_ID = '30000000-0000-0000-0000-000000001401';
    await limparFrequencias(ALUNO_ID, DATA);
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/alertas');
    await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible();
    await page.waitForTimeout(2500);
    await expect(page.locator('.card').filter({ hasText: '05/12/2026' })).toHaveCount(0);
    try {
      const { cookie } = await loginApi('prof1@escola.edu.br', SENHA_PROF);
      const res = await apiFetch('/api/frequencias', {
        metodo: 'POST',
        cookie,
        corpo: {
          aluno_id: ALUNO_ID,
          data_aula: DATA,
          periodo: 'Manhã',
          tipo_registro: 'chamada_aula',
          client_request_id: FREQ_ID,
        },
      });
      if (!res.ok) throw new Error(`Setup frequência: ${res.status} ${await res.text()}`);
      await expect(page.locator('.card').filter({ hasText: '05/12/2026' })).toBeVisible({
        timeout: 15000,
      });
    } finally {
      await limparFrequencias(ALUNO_ID, DATA);
    }
  });

  test('CT141 - Notificações chegam em tempo real no sino', async ({ page }) => {
    const TITULO = `E2E Realtime ${Date.now()}`;
    const NOTIF_ID = crypto.randomUUID();
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao');
    await expect(page.getByText('Ranking de risco')).toBeVisible();
    await page.waitForTimeout(2500);
    await page.locator('button[aria-label="Notificações"]').click();
    const notifMenu = page.locator('.notif-menu');
    await expect(notifMenu).toBeVisible();
    try {
      await inserirLinhas('notificacoes', [
        {
          id: NOTIF_ID,
          destinatario_id: GESTAO_ID,
          tipo: 'sistema',
          titulo: TITULO,
          corpo: 'Teste de chegada em tempo real.',
        },
      ]);
      // A inserção direta não passa pelo serviço; a marcação como lida dispara o SSE.
      const { cookie } = await loginApi('gestao@escola.edu.br', SENHA_ADMIN);
      const res = await apiFetch(`/api/notificacoes/${NOTIF_ID}/lida`, {
        metodo: 'PATCH',
        cookie,
      });
      if (!res.ok) throw new Error(`Disparo SSE: ${res.status} ${await res.text()}`);
      await expect(notifMenu.getByText(TITULO)).toBeVisible({ timeout: 15000 });
    } finally {
      await excluirLinhas('notificacoes', 'id = $1', [NOTIF_ID]).catch(() => {});
    }
  });

  test('CT142 - Ocorrências da gestão atualizam em tempo real', async ({ page }) => {
    const TITULO = 'E2E Realtime';
    const DESCRICAO = `Fluxo em tempo real ${Date.now()}`;
    await excluirLinhas('ocorrencias', 'titulo = $1', [TITULO]);
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ocorrencias');
    await expect(page.getByText('Ocorrências graves e suspensões')).toBeVisible();
    await page.waitForTimeout(2500);
    await expect(page.locator('article').filter({ hasText: DESCRICAO })).toHaveCount(0);
    try {
      const { cookie } = await loginApi('prof1@escola.edu.br', SENHA_PROF);
      const res = await apiFetch('/api/ocorrencias', {
        metodo: 'POST',
        cookie,
        corpo: {
          aluno_id: ALUNO_ID,
          titulo: TITULO,
          descricao: DESCRICAO,
          tipo: ['grave'],
          tags_comportamento: [],
        },
      });
      if (!res.ok) throw new Error(`Setup ocorrência: ${res.status} ${await res.text()}`);
      await expect(page.locator('article').filter({ hasText: DESCRICAO })).toBeVisible({
        timeout: 15000,
      });
    } finally {
      await excluirLinhas('ocorrencias', 'titulo = $1', [TITULO]);
    }
  });

  test('CT143 - Lista de frequência do professor atualiza em tempo real', async ({ page }) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await page.goto('/professor/frequencia');
    await page.waitForSelector('.card-body .card');
    const DATA = await page.locator('input[type="date"]').inputValue();
    await limparFrequencias(ALUNO_ID, DATA);
    await page.reload();
    await page.waitForSelector('.card-body .card');
    await page.waitForTimeout(2500);
    const btnAusenteJoao = page.getByRole('button', {
      name: 'Marcar João Miguel da Silva como ausente',
    });
    await expect(btnAusenteJoao).toBeVisible();
    try {
      const { cookie } = await loginApi('prof1@escola.edu.br', SENHA_PROF);
      const res = await apiFetch('/api/frequencias', {
        metodo: 'POST',
        cookie,
        corpo: {
          aluno_id: ALUNO_ID,
          data_aula: DATA,
          periodo: 'Manhã',
          tipo_registro: 'chamada_aula',
          client_request_id: crypto.randomUUID(),
        },
      });
      if (!res.ok) throw new Error(`Setup frequência do professor: ${res.status}`);
      await expect(
        page.getByRole('button', { name: 'Marcar João Miguel da Silva como presente' }),
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await limparFrequencias(ALUNO_ID, DATA);
    }
  });

  test('CT144 - Alunos criados por outro cliente aparecem na listagem em tempo real', async ({
    page,
  }) => {
    const marcador = Date.now();
    const nome = `Aluno RT ${marcador}`;
    const matricula = `RT${marcador}`;
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/alunos');
    await page.waitForSelector('table');

    try {
      const { cookie } = await loginApi('gestao@escola.edu.br', SENHA_ADMIN);
      const res = await apiFetch('/api/alunos', {
        metodo: 'POST',
        cookie,
        corpo: { nome, matricula },
      });
      if (!res.ok) throw new Error(`Setup aluno: ${res.status} ${await res.text()}`);
      await expect(page.getByText(nome)).toBeVisible({ timeout: 15_000 });
    } finally {
      await excluirLinhas('alunos', 'matricula = $1', [matricula]);
    }
  });

  test('CT145 - Disciplinas criadas por outro cliente aparecem na listagem em tempo real', async ({
    page,
  }) => {
    const nome = `Disciplina RT ${Date.now()}`;
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/disciplinas');
    await page.waitForSelector('table');

    try {
      const { cookie } = await loginApi('gestao@escola.edu.br', SENHA_ADMIN);
      const res = await apiFetch('/api/disciplinas', {
        metodo: 'POST',
        cookie,
        corpo: { nome },
      });
      if (!res.ok) throw new Error(`Setup disciplina: ${res.status} ${await res.text()}`);
      await expect(page.getByText(nome)).toBeVisible({ timeout: 15_000 });
    } finally {
      await excluirLinhas('disciplinas', 'nome = $1', [nome]);
    }
  });

  test.beforeAll(async () => {
    await excluirLinhas('notificacoes', 'destinatario_id = $1 and titulo like $2', [
      GESTAO_ID,
      'E2E Realtime%',
    ]);
  });
});

test.afterAll(async () => {
  await excluirLinhas('notificacoes', 'titulo like $1', ['E2E Realtime%']);
});
