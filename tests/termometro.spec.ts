import { test, expect } from '@playwright/test';
import { login, logout } from './suporte/sessao.js';
import { SENHA_RESP, SENHA_ADMIN, ALUNO_JOAO_ID, TURMA_1A_ID, ANO_LETIVO_ID } from './suporte/dados.js';
import { restApi } from './suporte/api.js';

const PROF_ID = 'a0000000-0000-0000-0000-000000000002';
const ALUNO_TERM_ID = ALUNO_JOAO_ID; // João Miguel — filho de resp1

async function limparTermometro() {
  await restApi(`/rest/v1/frequencias?aluno_id=eq.${ALUNO_TERM_ID}`, { method: 'DELETE' });
  await restApi(`/rest/v1/justificativas_faltas?aluno_id=eq.${ALUNO_TERM_ID}`, { method: 'DELETE' });
  await restApi(`/rest/v1/ocorrencias?aluno_id=eq.${ALUNO_TERM_ID}`, { method: 'DELETE' });
}

async function criarFaltas(qtd: number, inicio: string) {
  const base = new Date(inicio + 'T00:00:00');
  for (let i = 0; i < qtd; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    await restApi('/rest/v1/frequencias', {
      method: 'POST',
      body: JSON.stringify({
        aluno_id: ALUNO_TERM_ID,
        professor_id: PROF_ID,
        turma_id: TURMA_1A_ID,
        ano_letivo_id: ANO_LETIVO_ID,
        data_aula: iso,
        periodo: 'Manhã',
        tipo_registro: 'chamada_aula',
        status: 'ausente',
        client_request_id: crypto.randomUUID(),
      }),
    });
  }
}

test.describe('Termômetro de atenção - textos e cabeçalho', () => {
  test('CT-N1 - Card não repete o título da página e cita faltas e ocorrências', async ({ page }) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/termometro');
    await expect(page.locator('h1')).toContainText('Termômetro de atenção');
    await expect(page.locator('h2')).toHaveCount(0);
    const card = page.locator('.card').first();
    await expect(card).toBeVisible();
    await expect(card.getByText(/falta\(s\)/).first()).toBeVisible();
    await expect(card.getByText(/ocorrência\(s\)/).first()).toBeVisible();
    await logout(page);
  });
});

test.describe('Termômetro — Barra segmentada inteligente', () => {
  test.beforeEach(async () => {
    await limparTermometro();
  });
  test.afterEach(async () => {
    await limparTermometro();
  });

  test('CT-T1 - Barra móvel única colorida por nível (verde/amarelo/vermelho) com score', async ({ page }) => {
    await criarFaltas(2, '2026-02-01');
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/termometro');
    const card = page.locator('.card').first();
    await expect(card).toBeVisible();
    const progress = page.locator('.progress[role="progressbar"]');
    await expect(progress).toBeVisible();
    // Barra móvel: apenas 1 segmento visível, cor depende do nível
    await expect(progress.locator('.progress-bar')).toHaveCount(1);
    await expect(progress.locator('.progress-bar')).toBeVisible();
    await expect(progress.locator('.progress-bar.bg-success, .progress-bar.bg-warning, .progress-bar.bg-danger')).toBeVisible();
    // Largura reflete o score (aria-valuenow)
    const score = await progress.getAttribute('aria-valuenow');
    expect(score).toMatch(/^\d+$/);
    await expect(progress.locator('.progress-bar')).toHaveAttribute('style', new RegExp(`${score}%`));
    await expect(progress).toHaveAttribute('aria-valuenow', /^\d+$/);
    await expect(progress).toHaveAttribute('aria-valuetext', /(Tudo certo|Atenção|Risco alto)/);
    // Marcadores sutis de limiar
    await expect(progress.locator('.termometro-marcador')).toHaveCount(2);
    await expect(card.getByText(/\d+\/100/)).toBeVisible();
    // Detalhe colapsável organizado em tabela
    await expect(card.getByText('Como é calculado?')).toBeVisible();
    const details = card.locator('details');
    await expect(details).toContainText(/Atenção/);
    await expect(details).toContainText(/Amarelo/);
    await expect(details).toContainText(/A partir de/);
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
    await expect(details.locator('table')).toBeVisible();
    await expect(details.locator('table')).toContainText(/Limite configurado/);
  });

  test('CT-T2 - 9 faltas fica no verde e 10 faltas cruza para amarelo', async ({ page }) => {
    // 9 faltas -> nível baixo (Tudo certo)
    await criarFaltas(9, '2026-03-01');
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/termometro');
    await expect(page.getByText('Tudo certo')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.progress[role="progressbar"]')).toHaveAttribute('aria-valuetext', /Tudo certo/);
    await logout(page);
    await limparTermometro();
    // 10 faltas -> nível médio (Atenção)
    await criarFaltas(10, '2026-03-01');
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/termometro');
    await expect(page.getByText('Atenção')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.progress[role="progressbar"]')).toHaveAttribute('aria-valuetext', /Atenção/);
  });

  test('CT-T3 - Ocorrência crítica ou exige presença força nível alto', async ({ page }) => {
    // garante tag crítica de teste (limpa antes para evitar 409)
    await restApi('/rest/v1/tags_comportamento?nome=eq.TesteCriticoE2E', { method: 'DELETE' });
    await restApi('/rest/v1/tags_comportamento', {
      method: 'POST',
      body: JSON.stringify({ nome: 'TesteCriticoE2E', categoria: 'critico', peso_pontuacao: 20, ativo: true }),
    });
    await criarFaltas(1, '2026-04-01');
    // ocorrência sem gatilho crítico -> não deve ser alto
    await restApi('/rest/v1/ocorrencias', {
      method: 'POST',
      body: JSON.stringify({
        aluno_id: ALUNO_TERM_ID,
        professor_id: PROF_ID,
        turma_id: TURMA_1A_ID,
        ano_letivo_id: ANO_LETIVO_ID,
        titulo: 'Ocorrência leve',
        descricao: 'Teste leve',
        tipo: ['grave'],
        tags_comportamento: [],
        exige_presenca_responsavel: false,
      }),
    });
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/termometro');
    await expect(page.getByText('Tudo certo')).toBeVisible({ timeout: 10000 });
    await logout(page);
    await restApi(`/rest/v1/ocorrencias?aluno_id=eq.${ALUNO_TERM_ID}`, { method: 'DELETE' });
    // agora com tag crítica + exige presença -> alto
    await restApi('/rest/v1/ocorrencias', {
      method: 'POST',
      body: JSON.stringify({
        aluno_id: ALUNO_TERM_ID,
        professor_id: PROF_ID,
        turma_id: TURMA_1A_ID,
        ano_letivo_id: ANO_LETIVO_ID,
        titulo: 'Ocorrência crítica',
        descricao: 'Teste crítico E2E',
        tipo: ['grave'],
        tags_comportamento: ['TesteCriticoE2E'],
        exige_presenca_responsavel: true,
      }),
    });
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/termometro');
    await expect(page.getByText('Risco alto')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.progress[role="progressbar"]')).toHaveAttribute('aria-valuetext', /Risco alto/);
    // limpeza da tag de teste
    await restApi('/rest/v1/tags_comportamento?nome=eq.TesteCriticoE2E', { method: 'DELETE' });
  });

  test('CT-T4 - Falta justificada é abatida do score', async ({ page }) => {
    // 10 faltas injustificadas -> médio
    await criarFaltas(10, '2026-05-01');
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/termometro');
    await expect(page.getByText('Atenção')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.card').first().getByText(/10 falta\(s\) injust/).first()).toBeVisible();
    await logout(page);
    // cria justificativa aceita para 2026-05-01 (abate 1) -> volta para 9 -> baixo
    const respId = 'a0000000-0000-0000-0000-000000000005';
    await restApi('/rest/v1/justificativas_faltas', {
      method: 'POST',
      body: JSON.stringify({ responsavel_id: respId, aluno_id: ALUNO_TERM_ID, data_falta: '2026-05-01', motivo: 'Atestado E2E T4', status: 'aceita' }),
    });
    await login(page, 'resp1@email.com', SENHA_RESP);
    await page.goto('/responsavel/termometro');
    await expect(page.getByText('Tudo certo')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.card').first().getByText(/9 falta\(s\) injust/).first()).toBeVisible();
    await expect(page.locator('.card').first().getByText(/1 justificada/).first()).toBeVisible();
  });

  test('CT-T5 - Edição de pesos na gestão persiste e afeta a barra', async ({ page }) => {
    // salva valores originais
    const cfgRes = await restApi('/rest/v1/configuracoes_sistema?id=eq.1&select=peso_falta,peso_ocorrencia,peso_recencia,janela_recencia_dias,limite_score_medio,limite_score_alto');
    const orig = (await cfgRes.json()) as Record<string, number>[];
    const o = orig[0];
    // altera pesos via UI
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/configuracao/sistema');
    await expect(page.locator('#cfg-peso-falta')).toBeVisible();
    await page.fill('#cfg-peso-falta', '1.5');
    await page.fill('#cfg-peso-oco', '0.5');
    await page.fill('#cfg-limite-medio', '30');
    await page.fill('#cfg-limite-alto', '60');
    await page.click('button:has-text("Salvar alterações")');
    await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.alert-success')).toContainText(/salva com sucesso/);
    // verifica persistência
    await expect.poll(async () => {
      const r = await restApi('/rest/v1/configuracoes_sistema?id=eq.1&select=peso_falta,limite_score_medio');
      const d = (await r.json()) as { peso_falta: number; limite_score_medio: number }[];
      return `${d[0].peso_falta}-${d[0].limite_score_medio}`;
    }).toBe('1.5-30');
    // verifica prévia da barra reflete novos limites
    await expect(page.locator('.progress .progress-bar.bg-success')).toBeVisible();
    // restaura
    await restApi('/rest/v1/configuracoes_sistema?id=eq.1', {
      method: 'PATCH',
      body: JSON.stringify({ peso_falta: o.peso_falta, peso_ocorrencia: o.peso_ocorrencia, peso_recencia: o.peso_recencia, janela_recencia_dias: o.janela_recencia_dias, limite_score_medio: o.limite_score_medio, limite_score_alto: o.limite_score_alto }),
    });
  });
});
