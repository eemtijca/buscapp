import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';

const ANO_LETIVO_ID = 'b0000000-0000-0000-0000-000000000001';
const DISCIPLINA_MATEMATICA = 'c0000000-0000-0000-0000-000000000004';
const marcador = Date.now();

const gestaoId = randomUUID();
const profComId = randomUUID();
const profSemId = randomUUID();
const respComId = randomUUID();
const respSemId = randomUUID();
const turmaProfId = randomUUID();
const turmaForaId = randomUUID();
const alunoTurmaId = randomUUID();
const alunoForaId = randomUUID();
const alunoFilhoId = randomUUID();

const emails = {
  gestao: `gestao.ocorrencias.${marcador}@escola.edu.br`,
  profCom: `prof.com.ocorrencias.${marcador}@escola.edu.br`,
  profSem: `prof.sem.ocorrencias.${marcador}@escola.edu.br`,
  respCom: `resp.com.ocorrencias.${marcador}@escola.edu.br`,
  respSem: `resp.sem.ocorrencias.${marcador}@escola.edu.br`,
};

const alunosIds = [alunoTurmaId, alunoForaId, alunoFilhoId];
const perfisIds = [gestaoId, profComId, profSemId, respComId, respSemId];

let app: FastifyInstance;
let cookieGestao: string;
let cookieProfCom: string;
let cookieProfSem: string;
let cookieRespCom: string;
let cookieRespSem: string;
let ocorrenciaTurmaId: string;
let ocorrenciaForaId: string;
let ocorrenciaFilhoId: string;

function extrairCookie(cabecalho: string | string[] | undefined): string {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const par = (valor ?? '').split(';')[0] ?? '';
  return par.slice(par.indexOf('=') + 1);
}

async function login(email: string): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha: 'SenhaAtual1!' },
  });
  expect(resposta.statusCode).toBe(200);
  return extrairCookie(resposta.headers['set-cookie']);
}

async function criarPerfil(
  id: string,
  email: string,
  papel: 'gestao' | 'professor' | 'responsavel',
  modulos: string[],
) {
  await prisma.perfis.create({
    data: {
      id,
      nome: `Perfil ${papel} ${id.slice(0, 4)}`,
      email,
      papel,
      status: 'ativo',
      senha_hash: await gerarHashSenha('SenhaAtual1!'),
      acesso_modulos: modulos,
    },
  });
}

async function criarOcorrenciaViaApi(
  cookie: string,
  corpo: Record<string, unknown>,
): Promise<{ id: string }> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/ocorrencias',
    cookies: { buscapp_sessao: cookie },
    payload: corpo,
  });
  expect(resposta.statusCode).toBe(201);
  return resposta.json().ocorrencia;
}

beforeAll(async () => {
  app = await construirApp();

  await criarPerfil(gestaoId, emails.gestao, 'gestao', []);
  await criarPerfil(profComId, emails.profCom, 'professor', ['ocorrencias']);
  await criarPerfil(profSemId, emails.profSem, 'professor', []);
  await criarPerfil(respComId, emails.respCom, 'responsavel', ['alertas']);
  await criarPerfil(respSemId, emails.respSem, 'responsavel', []);

  await prisma.turmas.createMany({
    data: [
      {
        id: turmaProfId,
        ano_letivo_id: ANO_LETIVO_ID,
        serie: '1ª',
        letra: 'A',
        nome_completo: `1ª A ${marcador}`,
        ativo: true,
      },
      {
        id: turmaForaId,
        ano_letivo_id: ANO_LETIVO_ID,
        serie: '2ª',
        letra: 'B',
        nome_completo: `2ª B ${marcador}`,
        ativo: true,
      },
    ],
  });

  await prisma.atribuicoes_professores.create({
    data: {
      professor_id: profComId,
      turma_id: turmaProfId,
      disciplina_id: DISCIPLINA_MATEMATICA,
      papel: 'titular',
      ativo: true,
    },
  });

  await prisma.alunos.createMany({
    data: [
      { id: alunoTurmaId, nome: 'Aluno Turma', matricula: `TURMA-${marcador}` },
      { id: alunoForaId, nome: 'Aluno Fora', matricula: `FORA-${marcador}` },
      { id: alunoFilhoId, nome: 'Aluno Filho', matricula: `FILHO-${marcador}` },
    ],
  });

  await prisma.enturmacoes.createMany({
    data: [
      { aluno_id: alunoTurmaId, turma_id: turmaProfId, ano_letivo_id: ANO_LETIVO_ID },
      { aluno_id: alunoForaId, turma_id: turmaForaId, ano_letivo_id: ANO_LETIVO_ID },
      { aluno_id: alunoFilhoId, turma_id: turmaForaId, ano_letivo_id: ANO_LETIVO_ID },
    ],
  });

  await prisma.vinculos_responsaveis.createMany({
    data: [
      { responsavel_id: respComId, aluno_id: alunoFilhoId, tipo_relacao: 'pai' },
      { responsavel_id: respSemId, aluno_id: alunoForaId, tipo_relacao: 'mae' },
    ],
  });

  cookieGestao = await login(emails.gestao);
  cookieProfCom = await login(emails.profCom);
  cookieProfSem = await login(emails.profSem);
  cookieRespCom = await login(emails.respCom);
  cookieRespSem = await login(emails.respSem);

  const ocorrenciaTurma = await criarOcorrenciaViaApi(cookieProfCom, {
    aluno_id: alunoTurmaId,
    descricao: 'Relato de ocorrência grave: desrespeito ao professor em sala.',
    tipo: ['grave'],
    tags_comportamento: ['Desatenção'],
    exige_presenca_responsavel: false,
  });
  ocorrenciaTurmaId = ocorrenciaTurma.id;

  const ocorrenciaFora = await criarOcorrenciaViaApi(cookieGestao, {
    aluno_id: alunoForaId,
    titulo: 'Suspensão preventiva',
    descricao: 'Ameaça a colega durante o intervalo, encaminhada à coordenação.',
    tipo: ['suspensao'],
    exige_presenca_responsavel: false,
    notificar_coordenacao: false,
  });
  ocorrenciaForaId = ocorrenciaFora.id;

  const ocorrenciaFilho = await criarOcorrenciaViaApi(cookieGestao, {
    aluno_id: alunoFilhoId,
    descricao: 'Agressão física relatada por dois funcionários da escola.',
    tipo: ['grave'],
    exige_presenca_responsavel: true,
    tags_comportamento: ['Uso de celular'],
  });
  ocorrenciaFilhoId = ocorrenciaFilho.id;
});

afterAll(async () => {
  await prisma.ocorrencias.deleteMany({ where: { aluno_id: { in: alunosIds } } });
  await prisma.registros_comportamento.deleteMany({ where: { aluno_id: { in: alunosIds } } });
  await prisma.notificacoes.deleteMany({ where: { destinatario_id: { in: perfisIds } } });
  await prisma.vinculos_responsaveis.deleteMany({ where: { aluno_id: { in: alunosIds } } });
  await prisma.enturmacoes.deleteMany({ where: { aluno_id: { in: alunosIds } } });
  await prisma.atribuicoes_professores.deleteMany({
    where: { turma_id: { in: [turmaProfId, turmaForaId] } },
  });
  await prisma.alunos.deleteMany({ where: { id: { in: alunosIds } } });
  await prisma.turmas.deleteMany({ where: { id: { in: [turmaProfId, turmaForaId] } } });
  await prisma.sessoes.deleteMany({ where: { perfil_id: { in: perfisIds } } });
  await prisma.perfis.deleteMany({ where: { id: { in: perfisIds } } });
  await app.close();
  await prisma.$disconnect();
});

describe('GET /api/ocorrencias', () => {
  it('anônimo recebe 401 no envelope', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/ocorrencias' });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().erro.codigo).toBe('nao_autenticado');
  });

  it('professor sem módulo ocorrências recebe 403', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/ocorrencias',
      cookies: { buscapp_sessao: cookieProfSem },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('nao_autorizado');
  });

  it('responsável sem módulo alertas recebe 403', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/ocorrencias',
      cookies: { buscapp_sessao: cookieRespSem },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('nao_autorizado');
  });

  it('gestão lista todas as ocorrências com joins', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/ocorrencias',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(resposta.statusCode).toBe(200);
    const ocorrencias = resposta.json().ocorrencias as Array<{
      id: string;
      aluno: { id: string; nome: string };
      professor: { id: string; nome: string } | null;
      lista_tags: Array<{ nome: string; categoria: string }>;
    }>;
    const ids = ocorrencias.map((ocorrencia) => ocorrencia.id);
    expect(ids).toEqual(
      expect.arrayContaining([ocorrenciaTurmaId, ocorrenciaForaId, ocorrenciaFilhoId]),
    );

    const daTurma = ocorrencias.find((ocorrencia) => ocorrencia.id === ocorrenciaTurmaId);
    expect(daTurma?.aluno).toEqual({ id: alunoTurmaId, nome: 'Aluno Turma' });
    expect(daTurma?.professor).toMatchObject({ id: profComId });
    expect(daTurma?.lista_tags.map((tag) => tag.nome)).toEqual(['Desatenção']);
    expect(daTurma?.lista_tags[0]?.categoria).toBe('atencao');
  });

  it('professor vê apenas ocorrências de alunos da própria turma', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/ocorrencias',
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().ocorrencias.map((ocorrencia: { id: string }) => ocorrencia.id)).toEqual([
      ocorrenciaTurmaId,
    ]);
  });

  it('responsável vê apenas ocorrências do filho vinculado', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/ocorrencias',
      cookies: { buscapp_sessao: cookieRespCom },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().ocorrencias.map((ocorrencia: { id: string }) => ocorrencia.id)).toEqual([
      ocorrenciaFilhoId,
    ]);
  });

  it('aplica filtros de aluno, tipo, status e presença pendente', async () => {
    const porAluno = await app.inject({
      method: 'GET',
      url: `/api/ocorrencias?aluno_id=${alunoTurmaId}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(porAluno.statusCode).toBe(200);
    expect(porAluno.json().ocorrencias.map((o: { id: string }) => o.id)).toEqual([
      ocorrenciaTurmaId,
    ]);

    const porTipo = await app.inject({
      method: 'GET',
      url: '/api/ocorrencias?tipo=grave&tipo=suspensao',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(porTipo.statusCode).toBe(200);
    expect(porTipo.json().ocorrencias.length).toBe(3);

    const porTipoSuspensao = await app.inject({
      method: 'GET',
      url: '/api/ocorrencias?tipo=suspensao',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(porTipoSuspensao.json().ocorrencias.map((o: { id: string }) => o.id)).toEqual([
      ocorrenciaForaId,
    ]);

    const pendentes = await app.inject({
      method: 'GET',
      url: '/api/ocorrencias?exige_presenca_pendente=true',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(pendentes.statusCode).toBe(200);
    expect(pendentes.json().ocorrencias.map((o: { id: string }) => o.id)).toEqual([
      ocorrenciaFilhoId,
    ]);

    const abertas = await app.inject({
      method: 'GET',
      url: '/api/ocorrencias?status=aberta',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(abertas.json().ocorrencias.length).toBe(3);
  });
});

describe('GET /api/ocorrencias/:id', () => {
  it('fora do escopo responde 404 sem revelar existência', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/ocorrencias/${ocorrenciaForaId}`,
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json().erro.codigo).toBe('nao_encontrado');
  });

  it('professor acessa ocorrência da própria turma', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/ocorrencias/${ocorrenciaTurmaId}`,
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().ocorrencia).toMatchObject({
      id: ocorrenciaTurmaId,
      aluno_id: alunoTurmaId,
      turma_id: turmaProfId,
      ano_letivo_id: ANO_LETIVO_ID,
      professor_id: profComId,
      status: 'aberta',
    });
  });

  it('responsável acessa ocorrência do filho', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/ocorrencias/${ocorrenciaFilhoId}`,
      cookies: { buscapp_sessao: cookieRespCom },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().ocorrencia.aluno.id).toBe(alunoFilhoId);
  });
});

describe('POST /api/ocorrencias', () => {
  it('professor sem módulo não registra ocorrência', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/ocorrencias',
      cookies: { buscapp_sessao: cookieProfSem },
      payload: {
        aluno_id: alunoTurmaId,
        descricao: 'Descrição suficientemente longa para o registro.',
        tipo: ['grave'],
      },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('professor não registra para aluno fora da sua turma', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/ocorrencias',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: {
        aluno_id: alunoForaId,
        descricao: 'Descrição suficientemente longa para o registro.',
        tipo: ['grave'],
      },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('rejeita tipo fora do catálogo', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/ocorrencias',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: {
        aluno_id: alunoTurmaId,
        descricao: 'Descrição suficientemente longa para o registro.',
        tipo: ['inexistente'],
      },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.codigo).toBe('tipo_invalido');
  });

  it('gestão registra ocorrência derivando turma e ano letivo da enturmação', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/ocorrencias',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        aluno_id: alunoTurmaId,
        titulo: 'Ocorrência da gestão',
        descricao: 'Descrição suficientemente longa para o registro da gestão.',
        tipo: ['grave'],
        exige_presenca_responsavel: true,
      },
    });
    expect(resposta.statusCode).toBe(201);
    const ocorrencia = resposta.json().ocorrencia;
    expect(ocorrencia).toMatchObject({
      aluno_id: alunoTurmaId,
      turma_id: turmaProfId,
      ano_letivo_id: ANO_LETIVO_ID,
      professor_id: gestaoId,
      status: 'aberta',
      exige_presenca_responsavel: true,
      presenca_responsavel_confirmada: false,
      notificar_coordenacao: true,
      notificar_responsavel: false,
    });

    await prisma.ocorrencias.delete({ where: { id: ocorrencia.id } });
  });
});

describe('PATCH /api/ocorrencias/:id', () => {
  it('professor não atualiza ocorrência', async () => {
    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/ocorrencias/${ocorrenciaTurmaId}`,
      cookies: { buscapp_sessao: cookieProfCom },
      payload: { status: 'em_andamento' },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('anônimo recebe 401', async () => {
    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/ocorrencias/${ocorrenciaTurmaId}`,
      payload: { status: 'em_andamento' },
    });
    expect(resposta.statusCode).toBe(401);
  });

  it('gestão confirma presença e conclui a ocorrência', async () => {
    const confirmacao = await app.inject({
      method: 'PATCH',
      url: `/api/ocorrencias/${ocorrenciaFilhoId}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { presenca_responsavel_confirmada: true },
    });
    expect(confirmacao.statusCode).toBe(200);
    expect(confirmacao.json().ocorrencia).toMatchObject({
      presenca_responsavel_confirmada: true,
    });
    expect(confirmacao.json().ocorrencia.data_confirmacao_presenca).not.toBeNull();

    const resolucao = await app.inject({
      method: 'PATCH',
      url: `/api/ocorrencias/${ocorrenciaFilhoId}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { status: 'resolvida' },
    });
    expect(resolucao.statusCode).toBe(200);
    expect(resolucao.json().ocorrencia.status).toBe('resolvida');
    expect(resolucao.json().ocorrencia.closed_at).not.toBeNull();

    const reabertura = await app.inject({
      method: 'PATCH',
      url: `/api/ocorrencias/${ocorrenciaFilhoId}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { status: 'em_andamento' },
    });
    expect(reabertura.json().ocorrencia.closed_at).toBeNull();
  });
});

describe('registros de comportamento', () => {
  let registroTurmaId: string;

  it('professor sem módulo não registra para aluno fora da turma', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/registros-comportamento',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: { aluno_id: alunoForaId, descricao: 'Comportamento fora da turma.' },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('professor registra comportamento com tags para aluno da turma', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/registros-comportamento',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: {
        aluno_id: alunoTurmaId,
        descricao: 'Ajudou os colegas durante a atividade em grupo.',
        tags: ['Colaborativo'],
      },
    });
    expect(resposta.statusCode).toBe(201);
    const registro = resposta.json().registro;
    registroTurmaId = registro.id;
    expect(registro).toMatchObject({
      aluno_id: alunoTurmaId,
      professor_id: profComId,
      turma_id: turmaProfId,
      ano_letivo_id: ANO_LETIVO_ID,
      descricao: 'Ajudou os colegas durante a atividade em grupo.',
    });
    expect(registro.aluno).toEqual({ id: alunoTurmaId, nome: 'Aluno Turma' });
    expect(registro.tags.map((tag: { nome: string }) => tag.nome)).toEqual(['Colaborativo']);
  });

  it('rejeita tag fora do catálogo', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/registros-comportamento',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: { aluno_id: alunoTurmaId, descricao: 'Teste.', tags: ['Inexistente'] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.codigo).toBe('tags_invalidas');
  });

  it('professor vê somente registros dos alunos da sua turma', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/registros-comportamento',
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().registros.map((registro: { id: string }) => registro.id)).toEqual([
      registroTurmaId,
    ]);
  });

  it('responsável vê os registros do filho e aplica filtros de data', async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const vazio = await app.inject({
      method: 'GET',
      url: '/api/registros-comportamento',
      cookies: { buscapp_sessao: cookieRespCom },
    });
    expect(vazio.statusCode).toBe(200);
    expect(vazio.json().registros).toEqual([]);

    const registroGestao = await app.inject({
      method: 'POST',
      url: '/api/registros-comportamento',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        aluno_id: alunoFilhoId,
        descricao: 'Participou ativamente da feira de ciências.',
        tags: ['Participativo'],
      },
    });
    expect(registroGestao.statusCode).toBe(201);

    const doFilho = await app.inject({
      method: 'GET',
      url: `/api/registros-comportamento?aluno_id=${alunoFilhoId}`,
      cookies: { buscapp_sessao: cookieRespCom },
    });
    expect(doFilho.statusCode).toBe(200);
    expect(doFilho.json().registros).toHaveLength(1);
    expect(doFilho.json().registros[0].aluno.id).toBe(alunoFilhoId);

    const comData = await app.inject({
      method: 'GET',
      url: `/api/registros-comportamento?data_inicio=${hoje}&data_fim=${hoje}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(comData.statusCode).toBe(200);
    expect(comData.json().registros.map((registro: { id: string }) => registro.id)).toEqual(
      expect.arrayContaining([registroTurmaId]),
    );

    const semData = await app.inject({
      method: 'GET',
      url: `/api/registros-comportamento?data_inicio=${amanha}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(semData.statusCode).toBe(200);
    expect(semData.json().registros).toEqual([]);
  });
});
