import { test, expect, type Page } from '@playwright/test';

const URL_SUPABASE = process.env.VITE_SUPABASE_URL;
if (!URL_SUPABASE) throw new Error('VITE_SUPABASE_URL não definida');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY não definida');
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY não definida');

const SENHA_ADMIN = process.env.SEED_SENHA_ADMIN!;
const SENHA_PROF = process.env.SEED_SENHA_PROF!;

const PROF2_ID = 'a0000000-0000-0000-0000-000000000003';
const RESP1_ID = 'a0000000-0000-0000-0000-000000000005';
const ALUNO_LUCAS_ID = 'e0000000-0000-0000-0000-000000000005';
const TURMA_2B_ID = 'd0000000-0000-0000-0000-000000000002';
const ANO_LETIVO_ID = 'b0000000-0000-0000-0000-000000000001';

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.waitForSelector('button[type="submit"]');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL(/\/gestao|\/professor|\/responsavel/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);
}

async function logout(page: Page) {
  await page.locator('button[data-bs-toggle="dropdown"]').click();
  await page.locator('.dropdown-menu').getByText('Sair da conta').click();
  await expect(page).toHaveURL('/');
}

async function obterToken(email: string, senha: string): Promise<string> {
  const res = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!res.ok) throw new Error(`Login REST ${email}: ${res.status}`);
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

async function limparFrequenciasTeste(clientRequestId: string) {
  await fetch(`${URL_SUPABASE}/rest/v1/frequencias?client_request_id=eq.${clientRequestId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

test.describe('Termômetro de atenção - textos e cabeçalho', () => {
  test('CT-N1 - Card não repete o título da página e cita faltas e ocorrências', async ({
    page,
  }) => {
    await login(page, 'resp1@email.com', process.env.SEED_SENHA_RESP!);
    await page.goto('/responsavel/termometro');

    await expect(page.locator('h1')).toContainText('Termômetro de atenção');
    // O título não deve mais estar duplicado dentro do card
    await expect(page.locator('h2')).toHaveCount(0);

    const card = page.locator('.card').first();
    await expect(card).toBeVisible();
    await expect(card.getByText(/falta\(s\)/)).toBeVisible();
    await expect(card.getByText(/ocorrência\(s\)/)).toBeVisible();

    await logout(page);
  });
});

test.describe('Gestão - Registro de infrequências', () => {
  test('CT-N2 - Home exibe o card e a página abre com as duas abas', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);

    const cardInfreq = page.getByRole('link', { name: /Infrequências/ });
    await expect(cardInfreq).toBeVisible();
    await cardInfreq.click();

    await expect(page).toHaveURL(/\/gestao\/infrequencias/);
    await expect(page.locator('h1')).toContainText('Registrar infrequências');
    await expect(page.getByRole('button', { name: 'Chamada por turma' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registro individual' })).toBeVisible();
    await expect(page.locator('#seletorTurma')).toBeVisible();

    await logout(page);
  });

  test('CT-N3 - Chamada por turma registra faltas com confirmação', async ({ page }) => {
    // Remove faltas de hoje antes e depois do teste para estado determinístico.
    const limparFaltasDeHoje = () =>
      fetch(
        `${URL_SUPABASE}/rest/v1/frequencias?data_aula=eq.${new Date()
          .toISOString()
          .slice(0, 10)}&tipo_registro=eq.chamada_aula`,
        {
          method: 'DELETE',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        },
      );
    await limparFaltasDeHoje();

    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/infrequencias');

    await expect(page.locator('#seletorTurma')).toBeVisible();

    try {
      // A turma padrão sempre tem alunos; evita depender de aluno específico porque outros testes movem enturmações.
      const botaoAusente = page.getByRole('button', { name: /Marcar .+ como ausente/ }).first();
      await expect(botaoAusente).toBeVisible({ timeout: 15000 });
      await botaoAusente.click();
      await expect(
        page.getByRole('button', { name: /Marcar .+ como presente/ }).first(),
      ).toContainText('Ausente');
      await expect(page.getByText(/ausente\(s\)/)).toBeVisible();

      await page.getByRole('button', { name: 'Salvar chamada' }).click();
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await expect(modal).toContainText('Salvar chamada');

      await modal.getByRole('button', { name: 'Registrar faltas' }).click();
      await expect(page.locator('.alert-success')).toContainText(
        'ausência(s) registrada(s)',
        { timeout: 15000 },
      );
    } finally {
      await limparFaltasDeHoje();
    }

    await logout(page);
  });

  test('CT-N4 - Botão Falta no ranking abre o registro individual pré-selecionado', async ({
    page,
  }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/ranking');

    const botaoFalta = page.getByTitle('Registrar falta').first();
    await expect(botaoFalta).toBeVisible({ timeout: 15000 });
    await botaoFalta.click();

    await expect(page).toHaveURL(/\/gestao\/infrequencias\?aluno=/);
    const abaIndividual = page.getByRole('button', { name: 'Registro individual' });
    await expect(abaIndividual).toHaveClass(/active/);

    await expect(page.locator('#alunoIndividual')).toHaveValue(/^[0-9a-f-]{36}$/);
    await logout(page);
  });
});

test.describe('Gestão - Confirmação de ativar/desativar usuário', () => {
  test('CT-N5 - Desativar e reativar usuário exigem confirmação em modal', async ({ page }) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios');

    const linhaBruno = page.locator('tr', { hasText: 'Bruno Professor' });
    await expect(linhaBruno).toBeVisible({ timeout: 15000 });

    // Desativar: cancelar primeiro mantém o status
    await linhaBruno.getByTitle('Desativar').click();
    let modal = page.getByRole('dialog');
    await expect(modal).toContainText('Desativar usuário');
    await expect(modal).toContainText('acesso ao sistema será bloqueado');
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(linhaBruno.getByTitle('Desativar')).toBeVisible();

    // Desativar: confirmar executa a ação
    await linhaBruno.getByTitle('Desativar').click();
    modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: 'Desativar', exact: true }).click();
    await expect(page.locator('.alert-success')).toContainText('Usuário desativado.');
    await expect(linhaBruno.getByTitle('Ativar')).toBeVisible();

    // Reativar: confirma e restaura o estado original do seed
    await linhaBruno.getByTitle('Ativar').click();
    modal = page.getByRole('dialog');
    await expect(modal).toContainText('Ativar usuário');
    await modal.getByRole('button', { name: 'Ativar', exact: true }).click();
    await expect(page.locator('.alert-success')).toContainText('Usuário ativado.');
    await expect(linhaBruno.getByTitle('Desativar')).toBeVisible();

    await logout(page);
  });
});

test.describe('Módulos de acesso - formulário para todos os papéis', () => {
  test('CT-N6 - Novo usuário (qualquer papel) inicia com todos os módulos marcados', async ({
    page,
  }) => {
    // O formulário bloqueia navegação com draft não salvo via window.confirm
    page.on('dialog', (d) => d.accept());
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto('/gestao/usuarios/novo');

    await expect(page.getByText('Módulos de acesso')).toBeVisible();
    await expect(page.locator('label[for="modulo-frequencia"]')).toContainText('Frequência');
    await expect(page.locator('label[for="modulo-ocorrencias"]')).toContainText('Ocorrências');
    await expect(page.locator('#modulo-frequencia')).toBeChecked();
    await expect(page.locator('#modulo-ocorrencias')).toBeChecked();

    await logout(page);
  });

  test('CT-N7 - Edição de usuário responsável permite alterar módulos', async ({ page }) => {
    // O formulário bloqueia navegação com draft não salvo via window.confirm
    page.on('dialog', (d) => d.accept());
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await page.goto(`/gestao/usuarios/${RESP1_ID}`);

    await expect(page.locator('h1')).toContainText('Editar usuário');
    await expect(page.getByText('Módulos de acesso')).toBeVisible();
    await expect(page.locator('#modulo-frequencia')).toBeChecked();
    await expect(page.locator('#modulo-ocorrencias')).toBeChecked();

    await logout(page);
  });
});

test.describe('Módulos de acesso - gating do professor', () => {
  test('CT-N8 - Professor sem módulo de ocorrências não vê o card nem acessa a rota', async ({
    page,
  }) => {
    // prof2 (Bruno) possui apenas o módulo 'frequencia' no seed
    await login(page, 'prof2@escola.edu.br', SENHA_PROF);
    await expect(page).toHaveURL(/\/professor/);

    await expect(page.getByText('Registrar frequência')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Ausência em aula')).toBeVisible();
    await expect(page.getByText('Ocorrência grave')).toHaveCount(0);

    await page.goto('/professor/ocorrencia');
    await expect(page).toHaveURL(/\/professor\?moduloNegado=ocorrencias/);
    await expect(page.locator('.alert-warning')).toContainText(
      'Você não possui acesso ao módulo de ocorrências.',
    );

    await page.goto('/professor/frequencia');
    await expect(page.locator('h1')).toContainText('Registrar frequência');

    await logout(page);
  });

  test('CT-N9 - RLS bloqueia escrita de ocorrências e permite frequências', async () => {
    const token = await obterToken('prof2@escola.edu.br', SENHA_PROF);
    const cabecalhos = {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    };

    // Sem módulo 'ocorrencias': insert deve falhar (fail-closed via RLS)
    const resOcorrencia = await fetch(`${URL_SUPABASE}/rest/v1/ocorrencias`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify({
        aluno_id: ALUNO_LUCAS_ID,
        professor_id: PROF2_ID,
        turma_id: TURMA_2B_ID,
        ano_letivo_id: ANO_LETIVO_ID,
        titulo: 'Teste RLS',
        descricao: 'Tentativa de insert sem módulo habilitado.',
        tipo: ['grave'],
      }),
    });
    expect(resOcorrencia.status).toBe(403);

    // Com módulo 'frequencia': insert deve funcionar
    const requestId = crypto.randomUUID();
    try {
      const resFrequencia = await fetch(`${URL_SUPABASE}/rest/v1/frequencias`, {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify({
          aluno_id: ALUNO_LUCAS_ID,
          professor_id: PROF2_ID,
          turma_id: TURMA_2B_ID,
          ano_letivo_id: ANO_LETIVO_ID,
          data_aula: new Date().toISOString().slice(0, 10),
          periodo: '1º Horário',
          tipo_registro: 'chamada_aula',
          status: 'ausente',
          client_request_id: requestId,
        }),
      });
      expect(resFrequencia.status).toBe(201);
    } finally {
      await limparFrequenciasTeste(requestId);
    }
  });
});
