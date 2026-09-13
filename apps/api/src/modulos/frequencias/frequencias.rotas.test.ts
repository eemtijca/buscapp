import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';

const ANO_LETIVO_ID = 'b0000000-0000-0000-0000-000000000001';
const DISCIPLINA_MATEMATICA = 'c0000000-0000-0000-0000-000000000004';
const DATA_AULA = '2026-09-10';
const PERIODO = '1º Horário';
const marcador = Date.now();

const gestaoId = randomUUID();
const profComId = randomUUID();
const profSemId = randomUUID();
const respId = randomUUID();
const turmaId = randomUUID();
const turmaAlheiaId = randomUUID();
const alunoTurmaId = randomUUID();
const alunoAlheioId = randomUUID();

const clientRequestIdLote = randomUUID();
const clientRequestIdIndividual = randomUUID();

const emails = {
  gestao: `gestao.freq.${marcador}@escola.edu.br`,
  profCom: `prof.com.freq.${marcador}@escola.edu.br`,
  profSem: `prof.sem.freq.${marcador}@escola.edu.br`,
  resp: `resp.freq.${marcador}@escola.edu.br`,
};

let app: FastifyInstance;
let cookieGestao: string;
let cookieProfCom: string;
let cookieProfSem: string;
let cookieResp: string;

const payloadLote = {
  turma_id: turmaId,
  data_aula: DATA_AULA,
  periodo: PERIODO,
  tipo_registro: 'chamada_aula' as const,
  ausentes: [
    {
      aluno_id: alunoTurmaId,
      observacao: 'Atestado entregue na coordenação',
      motivos_ausencia: ['consulta_medica'],
    },
  ],
  client_request_id: clientRequestIdLote,
};

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
  acessoModulos: string[] = [],
) {
  await prisma.perfis.create({
    data: {
      id,
      nome: `Perfil ${papel} ${id.slice(0, 4)}`,
      email,
      papel,
      status: 'ativo',
      senha_hash: await gerarHashSenha('SenhaAtual1!'),
      acesso_modulos: acessoModulos,
    },
  });
}

async function listarFrequencias(cookie: string, query: Record<string, string | string[]> = {}) {
  return app.inject({
    method: 'GET',
    url: '/api/frequencias',
    query,
    cookies: { buscapp_sessao: cookie },
  });
}

beforeAll(async () => {
  app = await construirApp();

  await criarPerfil(gestaoId, emails.gestao, 'gestao');
  await criarPerfil(profComId, emails.profCom, 'professor', ['frequencia', 'ocorrencias']);
  await criarPerfil(profSemId, emails.profSem, 'professor', ['frequencia']);
  await criarPerfil(respId, emails.resp, 'responsavel', ['alertas']);

  await prisma.turmas.create({
    data: {
      id: turmaId,
      ano_letivo_id: ANO_LETIVO_ID,
      serie: '3ª',
      letra: 'B',
      nome_completo: '3ª B',
      ativo: true,
    },
  });
  await prisma.turmas.create({
    data: {
      id: turmaAlheiaId,
      ano_letivo_id: ANO_LETIVO_ID,
      serie: '3ª',
      letra: 'C',
      nome_completo: '3ª C',
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
    data: { id: alunoTurmaId, nome: 'Aluno da Turma', matricula: `FREQ-${marcador}-A` },
  });
  await prisma.alunos.create({
    data: { id: alunoAlheioId, nome: 'Aluno Alheio', matricula: `FREQ-${marcador}-B` },
  });

  await prisma.enturmacoes.create({
    data: { aluno_id: alunoTurmaId, turma_id: turmaId, ano_letivo_id: ANO_LETIVO_ID },
  });
  await prisma.enturmacoes.create({
    data: { aluno_id: alunoAlheioId, turma_id: turmaAlheiaId, ano_letivo_id: ANO_LETIVO_ID },
  });

  await prisma.vinculos_responsaveis.create({
    data: { responsavel_id: respId, aluno_id: alunoTurmaId, tipo_relacao: 'pai' },
  });

  cookieGestao = await login(emails.gestao);
  cookieProfCom = await login(emails.profCom);
  cookieProfSem = await login(emails.profSem);
  cookieResp = await login(emails.resp);
});

afterAll(async () => {
  await prisma.frequencias.deleteMany({
    where: { aluno_id: { in: [alunoTurmaId, alunoAlheioId] } },
  });
  await prisma.vinculos_responsaveis.deleteMany({
    where: { aluno_id: { in: [alunoTurmaId, alunoAlheioId] } },
  });
  await prisma.enturmacoes.deleteMany({
    where: { aluno_id: { in: [alunoTurmaId, alunoAlheioId] } },
  });
  await prisma.atribuicoes_professores.deleteMany({
    where: { turma_id: { in: [turmaId, turmaAlheiaId] } },
  });
  await prisma.alunos.deleteMany({ where: { id: { in: [alunoTurmaId, alunoAlheioId] } } });
  await prisma.turmas.deleteMany({ where: { id: { in: [turmaId, turmaAlheiaId] } } });
  await prisma.sessoes.deleteMany({
    where: { perfil_id: { in: [gestaoId, profComId, profSemId, respId] } },
  });
  await prisma.perfis.deleteMany({
    where: { id: { in: [gestaoId, profComId, profSemId, respId] } },
  });
  await app.close();
  await prisma.$disconnect();
});

describe('POST /api/frequencias/lote', () => {
  it('professor registra a chamada da própria turma', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/frequencias/lote',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: payloadLote,
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({ ok: true, registradas: 1 });
  });

  it('professor não registra chamada de turma alheia (403)', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/frequencias/lote',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: {
        ...payloadLote,
        turma_id: turmaAlheiaId,
        ausentes: [{ aluno_id: alunoAlheioId }],
        client_request_id: randomUUID(),
      },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('nao_autorizado');
  });

  it('repetir o mesmo client_request_id é idempotente e não duplica', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/frequencias/lote',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: payloadLote,
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, idempotente: true });

    const listagem = await listarFrequencias(cookieProfCom, {
      aluno_id: alunoTurmaId,
      data_aula: DATA_AULA,
    });
    expect(listagem.statusCode).toBe(200);
    expect(listagem.json().frequencias).toHaveLength(1);
  });

  it('professor sem atribuição também recebe 403', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/frequencias/lote',
      cookies: { buscapp_sessao: cookieProfSem },
      payload: { ...payloadLote, client_request_id: randomUUID() },
    });
    expect(resposta.statusCode).toBe(403);
  });
});

describe('POST /api/frequencias', () => {
  it('gestão registra ausência individual em qualquer turma', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/frequencias',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        aluno_id: alunoAlheioId,
        data_aula: DATA_AULA,
        periodo: PERIODO,
        observacao: 'Sem justificativa',
        motivos_ausencia: ['saida_antecipada'],
        client_request_id: clientRequestIdIndividual,
      },
    });
    expect(resposta.statusCode).toBe(201);
    const frequencia = resposta.json().frequencia;
    expect(frequencia).toMatchObject({
      aluno_id: alunoAlheioId,
      turma_id: turmaAlheiaId,
      ano_letivo_id: ANO_LETIVO_ID,
      data_aula: DATA_AULA,
      status: 'ausente',
    });
  });

  it('repetir o client_request_id individual é idempotente', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/frequencias',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        aluno_id: alunoAlheioId,
        data_aula: DATA_AULA,
        periodo: PERIODO,
        client_request_id: clientRequestIdIndividual,
      },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().idempotente).toBe(true);
  });

  it('professor não registra aluno de turma alheia (403)', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/frequencias',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: { aluno_id: alunoAlheioId, data_aula: DATA_AULA, periodo: PERIODO },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('responsável não pode lançar frequência (403)', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/frequencias',
      cookies: { buscapp_sessao: cookieResp },
      payload: { aluno_id: alunoTurmaId, data_aula: DATA_AULA, periodo: PERIODO },
    });
    expect(resposta.statusCode).toBe(403);
  });
});

describe('GET /api/frequencias', () => {
  it('responsável vê apenas as frequências do próprio filho', async () => {
    const resposta = await listarFrequencias(cookieResp);
    expect(resposta.statusCode).toBe(200);
    const registros = resposta.json().frequencias;
    expect(registros).toHaveLength(1);
    expect(registros[0].aluno_id).toBe(alunoTurmaId);
  });

  it('professor vê apenas frequências das turmas em que leciona', async () => {
    const resposta = await listarFrequencias(cookieProfCom);
    expect(resposta.statusCode).toBe(200);
    const ids = resposta.json().frequencias.map((f: { aluno_id: string }) => f.aluno_id);
    expect(ids).toEqual([alunoTurmaId]);
  });

  it('gestão vê registros de todas as turmas', async () => {
    const resposta = await listarFrequencias(cookieGestao, { data_aula: DATA_AULA });
    expect(resposta.statusCode).toBe(200);
    const ids = resposta.json().frequencias.map((f: { aluno_id: string }) => f.aluno_id);
    expect(ids).toEqual(expect.arrayContaining([alunoTurmaId, alunoAlheioId]));
  });
});

describe('GET /api/frequencias/resumo', () => {
  it('responsável recebe apenas o próprio filho e as contagens', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/frequencias/resumo',
      query: { aluno_ids: [alunoTurmaId, alunoAlheioId] },
      cookies: { buscapp_sessao: cookieResp },
    });
    expect(resposta.statusCode).toBe(200);
    const resumo = resposta.json().resumo;
    expect(resumo).toHaveLength(1);
    expect(resumo[0]).toMatchObject({
      aluno_id: alunoTurmaId,
      total_ausentes: 1,
      total_justificados: 0,
    });
    expect(resumo[0].registros[0]).toMatchObject({
      aluno_id: alunoTurmaId,
      data_aula: DATA_AULA,
      periodo: PERIODO,
      status: 'ausente',
    });
  });

  it('professor não enxerga o aluno de outra turma', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/frequencias/resumo',
      query: { aluno_ids: [alunoAlheioId] },
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().resumo).toEqual([]);
  });
});

describe('DELETE /api/frequencias/lote', () => {
  it('professor desfaz a chamada e aplica soft delete', async () => {
    const resposta = await app.inject({
      method: 'DELETE',
      url: '/api/frequencias/lote',
      query: {
        turma_id: turmaId,
        data_aula: DATA_AULA,
        periodo: PERIODO,
        tipo_registro: 'chamada_aula',
      },
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, removidas: 1 });

    const padrao = await listarFrequencias(cookieProfCom, { aluno_id: alunoTurmaId });
    expect(padrao.json().frequencias).toHaveLength(0);

    const comDeletadas = await listarFrequencias(cookieProfCom, {
      aluno_id: alunoTurmaId,
      incluir_deletadas: 'true',
    });
    expect(comDeletadas.json().frequencias).toHaveLength(1);
    expect(comDeletadas.json().frequencias[0].deleted_at).not.toBeNull();
  });

  it('professor não desfaz chamada de turma alheia (403)', async () => {
    const resposta = await app.inject({
      method: 'DELETE',
      url: '/api/frequencias/lote',
      query: {
        turma_id: turmaAlheiaId,
        data_aula: DATA_AULA,
        periodo: PERIODO,
        tipo_registro: 'chamada_aula',
      },
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(403);
  });
});

describe('anônimo', () => {
  it('recebe 401 no envelope em todas as rotas de frequências', async () => {
    const listagem = await app.inject({ method: 'GET', url: '/api/frequencias' });
    expect(listagem.statusCode).toBe(401);
    expect(listagem.json().erro.codigo).toBe('nao_autenticado');

    const lote = await app.inject({
      method: 'POST',
      url: '/api/frequencias/lote',
      payload: payloadLote,
    });
    expect(lote.statusCode).toBe(401);
    expect(lote.json().erro.codigo).toBe('nao_autenticado');

    const resumo = await app.inject({ method: 'GET', url: '/api/frequencias/resumo' });
    expect(resumo.statusCode).toBe(401);
    expect(resumo.json().erro.codigo).toBe('nao_autenticado');
  });
});
