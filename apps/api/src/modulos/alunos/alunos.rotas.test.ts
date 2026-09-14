import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { prismaAdmin as prisma } from '../../nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';

const DISCIPLINA_MATEMATICA = 'c0000000-0000-0000-0000-000000000004';
const marcador = Date.now();

const gestaoId = randomUUID();
const profComId = randomUUID();
const profSemId = randomUUID();
const respId = randomUUID();
const turmaId = randomUUID();
const alunoVisivelId = randomUUID();
const alunoForaId = randomUUID();

const emails = {
  gestao: `gestao.alunos.${marcador}@escola.edu.br`,
  profCom: `prof.com.${marcador}@escola.edu.br`,
  profSem: `prof.sem.${marcador}@escola.edu.br`,
  resp: `resp.alunos.${marcador}@escola.edu.br`,
};

let app: FastifyInstance;
let anoPrivadoId: string;
let cookieGestao: string;
let cookieProfCom: string;
let cookieProfSem: string;
let cookieResp: string;

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
) {
  await prisma.perfis.create({
    data: {
      id,
      nome: `Perfil ${papel} ${id.slice(0, 4)}`,
      email,
      papel,
      status: 'ativo',
      senha_hash: await gerarHashSenha('SenhaAtual1!'),
      acesso_modulos: papel === 'professor' ? ['frequencia', 'ocorrencias'] : [],
    },
  });
}

/** Cria um ano letivo exclusivo da suíte para isolar as turmas do seed canônico. */
async function criarAnoLetivoPrivado(): Promise<string> {
  const existentes = await prisma.anos_letivos.findMany({ select: { ano: true } });
  const usados = new Set(existentes.map((registro) => registro.ano));
  let ano = 2100;
  while (usados.has(ano)) ano -= 1;
  if (ano < 2000) throw new Error('Não há ano letivo disponível para os testes.');

  const criado = await prisma.anos_letivos.create({
    data: {
      ano,
      status: 'planejado',
      data_inicio: new Date(`${ano}-02-01`),
      data_fim: new Date(`${ano}-12-20`),
      ativo: false,
    },
  });
  return criado.id;
}

beforeAll(async () => {
  app = await construirApp();
  anoPrivadoId = await criarAnoLetivoPrivado();

  await criarPerfil(gestaoId, emails.gestao, 'gestao');
  await criarPerfil(profComId, emails.profCom, 'professor');
  await criarPerfil(profSemId, emails.profSem, 'professor');
  await criarPerfil(respId, emails.resp, 'responsavel');

  await prisma.turmas.create({
    data: {
      id: turmaId,
      ano_letivo_id: anoPrivadoId,
      serie: '1ª',
      letra: 'A',
      nome_completo: '1ª A',
      ativo: true,
    },
  });

  await prisma.atribuicoes_professores.create({
    data: {
      professor_id: profComId,
      turma_id: turmaId,
      disciplina_id: DISCIPLINA_MATEMATICA,
      papel: 'titular',
      ativo: true,
    },
  });

  await prisma.alunos.create({
    data: { id: alunoVisivelId, nome: 'Aluno Visível', matricula: `VIS-${marcador}` },
  });
  await prisma.alunos.create({
    data: { id: alunoForaId, nome: 'Aluno Fora', matricula: `FORA-${marcador}` },
  });

  await prisma.enturmacoes.create({
    data: { aluno_id: alunoVisivelId, turma_id: turmaId, ano_letivo_id: anoPrivadoId },
  });

  await prisma.vinculos_responsaveis.create({
    data: { responsavel_id: respId, aluno_id: alunoForaId, tipo_relacao: 'pai' },
  });

  cookieGestao = await login(emails.gestao);
  cookieProfCom = await login(emails.profCom);
  cookieProfSem = await login(emails.profSem);
  cookieResp = await login(emails.resp);
});

afterAll(async () => {
  await prisma.vinculos_responsaveis.deleteMany({
    where: { aluno_id: { in: [alunoVisivelId, alunoForaId] } },
  });
  await prisma.enturmacoes.deleteMany({
    where: { aluno_id: { in: [alunoVisivelId, alunoForaId] } },
  });
  await prisma.atribuicoes_professores.deleteMany({ where: { turma_id: turmaId } });
  await prisma.alunos.deleteMany({ where: { id: { in: [alunoVisivelId, alunoForaId] } } });
  await prisma.turmas.deleteMany({ where: { id: turmaId } });
  await prisma.anos_letivos.delete({ where: { id: anoPrivadoId } }).catch(() => {});
  await prisma.sessoes.deleteMany({
    where: { perfil_id: { in: [gestaoId, profComId, profSemId, respId] } },
  });
  await prisma.perfis.deleteMany({
    where: { id: { in: [gestaoId, profComId, profSemId, respId] } },
  });
  await app.close();
  await prisma.$disconnect();
});

describe('GET /api/alunos', () => {
  it('gestão lista todos os alunos', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/alunos',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(resposta.statusCode).toBe(200);
    const ids = resposta.json().alunos.map((aluno: { id: string }) => aluno.id);
    expect(ids).toContain(alunoVisivelId);
    expect(ids).toContain(alunoForaId);
  });

  it('professor vê apenas alunos das turmas em que leciona', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/alunos',
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(200);
    const ids = resposta.json().alunos.map((aluno: { id: string }) => aluno.id);
    expect(ids).toEqual([alunoVisivelId]);
  });

  it('professor sem atribuição não vê alunos', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/alunos',
      cookies: { buscapp_sessao: cookieProfSem },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().alunos).toEqual([]);
  });

  it('responsável vê apenas os alunos vinculados', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/alunos',
      cookies: { buscapp_sessao: cookieResp },
    });
    expect(resposta.statusCode).toBe(200);
    const ids = resposta.json().alunos.map((aluno: { id: string }) => aluno.id);
    expect(ids).toEqual([alunoForaId]);
  });

  it('anônimo recebe 401 no envelope', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/alunos' });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().erro.codigo).toBe('nao_autenticado');
  });
});

describe('GET /api/alunos/:id', () => {
  it('fora do escopo responde 404 sem revelar existência', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/alunos/${alunoVisivelId}`,
      cookies: { buscapp_sessao: cookieProfSem },
    });
    expect(resposta.statusCode).toBe(404);
  });

  it('dentro do escopo retorna o aluno', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/alunos/${alunoVisivelId}`,
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().aluno).toMatchObject({ id: alunoVisivelId, nome: 'Aluno Visível' });
  });
});

describe('POST/PUT /api/alunos', () => {
  it('responsável e professor não podem cadastrar', async () => {
    const payload = { nome: 'Aluno Novo', matricula: `NOVO-${marcador}` };
    const comoResp = await app.inject({
      method: 'POST',
      url: '/api/alunos',
      cookies: { buscapp_sessao: cookieResp },
      payload,
    });
    const comoProf = await app.inject({
      method: 'POST',
      url: '/api/alunos',
      cookies: { buscapp_sessao: cookieProfCom },
      payload,
    });
    expect(comoResp.statusCode).toBe(403);
    expect(comoProf.statusCode).toBe(403);
  });

  it('gestão cadastra, edita e recebe 409 em matrícula duplicada', async () => {
    const matricula = `CRIADO-${marcador}`;
    const criado = await app.inject({
      method: 'POST',
      url: '/api/alunos',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome: 'Aluno Criado', matricula },
    });
    expect(criado.statusCode).toBe(201);
    const aluno = criado.json().aluno;
    expect(aluno).toMatchObject({ nome: 'Aluno Criado', matricula, status: 'ativo' });

    const duplicado = await app.inject({
      method: 'POST',
      url: '/api/alunos',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome: 'Outro', matricula },
    });
    expect(duplicado.statusCode).toBe(409);
    expect(duplicado.json().erro.codigo).toBe('matricula_duplicada');

    const editado = await app.inject({
      method: 'PUT',
      url: `/api/alunos/${aluno.id}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome: 'Aluno Editado', necessidades_especiais: true },
    });
    expect(editado.statusCode).toBe(200);
    expect(editado.json().aluno).toMatchObject({
      nome: 'Aluno Editado',
      necessidades_especiais: true,
    });

    await prisma.alunos.delete({ where: { id: aluno.id } });
  });
});
