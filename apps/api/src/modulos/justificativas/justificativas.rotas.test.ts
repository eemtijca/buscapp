import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';

const DISCIPLINA_MATEMATICA = 'c0000000-0000-0000-0000-000000000004';
const DATA_FALTA = '2026-09-10';
const DATA_FIM = '2026-09-11';
const DATA_FORA = '2026-09-12';
const marcador = Date.now();

const gestaoId = randomUUID();
const profComId = randomUUID();
const profSemId = randomUUID();
const respComId = randomUUID();
const respSemId = randomUUID();
const turmaId = randomUUID();
const turmaAlheiaId = randomUUID();
const alunoVisivelId = randomUUID();
const alunoForaId = randomUUID();

const anexoVisivel1Id = randomUUID();
const anexoVisivel2Id = randomUUID();
const anexoGestaoId = randomUUID();

const emails = {
  gestao: `gestao.just.${marcador}@escola.edu.br`,
  profCom: `prof.com.just.${marcador}@escola.edu.br`,
  profSem: `prof.sem.just.${marcador}@escola.edu.br`,
  respCom: `resp.com.just.${marcador}@escola.edu.br`,
  respSem: `resp.sem.just.${marcador}@escola.edu.br`,
};

let app: FastifyInstance;
let anoPrivadoId: string;
let cookieGestao: string;
let cookieProfCom: string;
let cookieProfSem: string;
let cookieRespCom: string;
let cookieRespSem: string;

let justificativaVisivelId: string;
let justificativaForaId: string;

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

function paraData(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dataCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
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
  await criarPerfil(profComId, emails.profCom, 'professor', ['frequencia', 'ocorrencias']);
  await criarPerfil(profSemId, emails.profSem, 'professor');
  await criarPerfil(respComId, emails.respCom, 'responsavel', ['justificativa']);
  await criarPerfil(respSemId, emails.respSem, 'responsavel', []);

  await prisma.turmas.create({
    data: {
      id: turmaId,
      ano_letivo_id: anoPrivadoId,
      serie: '2ª',
      letra: 'A',
      nome_completo: '2ª A',
      ativo: true,
    },
  });
  await prisma.turmas.create({
    data: {
      id: turmaAlheiaId,
      ano_letivo_id: anoPrivadoId,
      serie: '2ª',
      letra: 'B',
      nome_completo: '2ª B',
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
    data: { id: alunoVisivelId, nome: 'Aluno Visível', matricula: `JUST-${marcador}-A` },
  });
  await prisma.alunos.create({
    data: { id: alunoForaId, nome: 'Aluno Fora', matricula: `JUST-${marcador}-B` },
  });

  await prisma.enturmacoes.create({
    data: { aluno_id: alunoVisivelId, turma_id: turmaId, ano_letivo_id: anoPrivadoId },
  });
  await prisma.enturmacoes.create({
    data: { aluno_id: alunoForaId, turma_id: turmaAlheiaId, ano_letivo_id: anoPrivadoId },
  });

  await prisma.vinculos_responsaveis.create({
    data: { responsavel_id: respComId, aluno_id: alunoVisivelId, tipo_relacao: 'pai' },
  });
  await prisma.vinculos_responsaveis.create({
    data: { responsavel_id: respSemId, aluno_id: alunoVisivelId, tipo_relacao: 'mae' },
  });

  await prisma.frequencias.createMany({
    data: [
      {
        aluno_id: alunoVisivelId,
        professor_id: profComId,
        turma_id: turmaId,
        ano_letivo_id: anoPrivadoId,
        data_aula: paraData(DATA_FALTA),
        periodo: '1º Horário',
        status: 'ausente',
      },
      {
        aluno_id: alunoVisivelId,
        professor_id: profComId,
        turma_id: turmaId,
        ano_letivo_id: anoPrivadoId,
        data_aula: paraData(DATA_FALTA),
        periodo: '2º Horário',
        status: 'ausente',
      },
      {
        aluno_id: alunoVisivelId,
        professor_id: profComId,
        turma_id: turmaId,
        ano_letivo_id: anoPrivadoId,
        data_aula: paraData(DATA_FORA),
        periodo: '1º Horário',
        status: 'ausente',
      },
    ],
  });

  await prisma.anexos.create({
    data: {
      id: anexoVisivel1Id,
      storage_path: `${respComId}/${marcador}-atestado.pdf`,
      nome_arquivo: 'atestado.pdf',
      mime_type: 'application/pdf',
      tamanho_bytes: 1024,
      criado_por: respComId,
    },
  });
  await prisma.anexos.create({
    data: {
      id: anexoVisivel2Id,
      storage_path: `${respComId}/${marcador}-foto.jpg`,
      nome_arquivo: 'foto.jpg',
      mime_type: 'image/jpeg',
      tamanho_bytes: 2048,
      criado_por: respComId,
    },
  });
  await prisma.anexos.create({
    data: {
      id: anexoGestaoId,
      storage_path: `${gestaoId}/${marcador}-gestao.pdf`,
      nome_arquivo: 'gestao.pdf',
      mime_type: 'application/pdf',
      tamanho_bytes: 512,
      criado_por: gestaoId,
    },
  });

  cookieGestao = await login(emails.gestao);
  cookieProfCom = await login(emails.profCom);
  cookieProfSem = await login(emails.profSem);
  cookieRespCom = await login(emails.respCom);
  cookieRespSem = await login(emails.respSem);
});

afterAll(async () => {
  const justificativasCriadas = [justificativaVisivelId, justificativaForaId].filter(
    (id): id is string => Boolean(id),
  );
  await prisma.justificativa_anexos.deleteMany({
    where: { justificativa_id: { in: justificativasCriadas } },
  });
  await prisma.justificativas_faltas.deleteMany({
    where: { aluno_id: { in: [alunoVisivelId, alunoForaId] } },
  });
  await prisma.anexos.deleteMany({
    where: { id: { in: [anexoVisivel1Id, anexoVisivel2Id, anexoGestaoId] } },
  });
  await prisma.frequencias.deleteMany({
    where: { aluno_id: { in: [alunoVisivelId, alunoForaId] } },
  });
  await prisma.vinculos_responsaveis.deleteMany({
    where: { aluno_id: { in: [alunoVisivelId, alunoForaId] } },
  });
  await prisma.enturmacoes.deleteMany({
    where: { aluno_id: { in: [alunoVisivelId, alunoForaId] } },
  });
  await prisma.atribuicoes_professores.deleteMany({
    where: { turma_id: { in: [turmaId, turmaAlheiaId] } },
  });
  await prisma.alunos.deleteMany({ where: { id: { in: [alunoVisivelId, alunoForaId] } } });
  await prisma.turmas.deleteMany({ where: { id: { in: [turmaId, turmaAlheiaId] } } });
  await prisma.anos_letivos.delete({ where: { id: anoPrivadoId } }).catch(() => {});
  await prisma.sessoes.deleteMany({
    where: { perfil_id: { in: [gestaoId, profComId, profSemId, respComId, respSemId] } },
  });
  await prisma.perfis.deleteMany({
    where: { id: { in: [gestaoId, profComId, profSemId, respComId, respSemId] } },
  });
  await app.close();
  await prisma.$disconnect();
});

describe('anônimo', () => {
  it('recebe 401 no envelope em todas as rotas de justificativas', async () => {
    const listagem = await app.inject({ method: 'GET', url: '/api/justificativas' });
    expect(listagem.statusCode).toBe(401);
    expect(listagem.json().erro.codigo).toBe('nao_autenticado');

    const envio = await app.inject({
      method: 'POST',
      url: '/api/justificativas',
      payload: { aluno_id: alunoVisivelId, data_falta: DATA_FALTA, motivo: 'Consulta médica' },
    });
    expect(envio.statusCode).toBe(401);
    expect(envio.json().erro.codigo).toBe('nao_autenticado');

    const avaliacao = await app.inject({
      method: 'PATCH',
      url: `/api/justificativas/${randomUUID()}`,
      payload: { status: 'aceita' },
    });
    expect(avaliacao.statusCode).toBe(401);
    expect(avaliacao.json().erro.codigo).toBe('nao_autenticado');
  });
});

describe('POST /api/justificativas', () => {
  it('responsável sem módulo justificativa recebe 403', async () => {
    const envio = await app.inject({
      method: 'POST',
      url: '/api/justificativas',
      cookies: { buscapp_sessao: cookieRespSem },
      payload: { aluno_id: alunoVisivelId, data_falta: DATA_FALTA, motivo: 'Consulta médica' },
    });
    expect(envio.statusCode).toBe(403);
    expect(envio.json().erro.codigo).toBe('nao_autorizado');

    const listagem = await app.inject({
      method: 'GET',
      url: '/api/justificativas',
      cookies: { buscapp_sessao: cookieRespSem },
    });
    expect(listagem.statusCode).toBe(403);
  });

  it('professor não envia justificativa (403)', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/justificativas',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: { aluno_id: alunoVisivelId, data_falta: DATA_FALTA, motivo: 'Consulta médica' },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('responsável cria justificativa pendente com anexos vinculados', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/justificativas',
      cookies: { buscapp_sessao: cookieRespCom },
      payload: {
        aluno_id: alunoVisivelId,
        data_falta: DATA_FALTA,
        data_fim: DATA_FIM,
        motivo: 'Atestado médico entregue na coordenação',
        anexo_ids: [anexoVisivel1Id, anexoVisivel2Id, anexoVisivel1Id],
      },
    });
    expect(resposta.statusCode).toBe(201);
    const justificativa = resposta.json().justificativa;
    expect(justificativa).toMatchObject({
      aluno_id: alunoVisivelId,
      responsavel_id: respComId,
      data_falta: DATA_FALTA,
      data_fim: DATA_FIM,
      motivo: 'Atestado médico entregue na coordenação',
      status: 'pendente',
      avaliado_por: null,
      avaliado_em: null,
    });
    const anexoIds = justificativa.anexos.map((anexo: { id: string }) => anexo.id);
    expect(anexoIds).toHaveLength(2);
    expect(anexoIds).toEqual(expect.arrayContaining([anexoVisivel1Id, anexoVisivel2Id]));
    expect(justificativa.anexos[0]).toHaveProperty('nome_arquivo');
    expect(justificativa.anexos[0]).toHaveProperty('mime_type');
    expect(justificativa.anexos[0]).toHaveProperty('storage_path');

    justificativaVisivelId = justificativa.id;
  });

  it('gestão lança justificativa de aluno de outra turma', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/justificativas',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        aluno_id: alunoForaId,
        data_falta: '2026-09-15',
        motivo: 'Justificativa lançada manualmente pela gestão',
      },
    });
    expect(resposta.statusCode).toBe(201);
    justificativaForaId = resposta.json().justificativa.id;
  });

  it('rejeita data final anterior à data da falta', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/justificativas',
      cookies: { buscapp_sessao: cookieRespCom },
      payload: {
        aluno_id: alunoVisivelId,
        data_falta: DATA_FALTA,
        data_fim: '2026-09-09',
        motivo: 'Período inconsistente',
      },
    });
    expect(resposta.statusCode).toBe(400);
  });

  it('rejeita anexo de outro usuário sem deixar justificativa órfã', async () => {
    const motivo = `Anexo inválido ${marcador}`;
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/justificativas',
      cookies: { buscapp_sessao: cookieRespCom },
      payload: {
        aluno_id: alunoVisivelId,
        data_falta: DATA_FALTA,
        motivo,
        anexo_ids: [anexoGestaoId],
      },
    });
    expect(resposta.statusCode).toBe(400);

    const orfas = await prisma.justificativas_faltas.count({
      where: { aluno_id: alunoVisivelId, motivo },
    });
    expect(orfas).toBe(0);
  });
});

describe('GET /api/justificativas', () => {
  it('responsável lista apenas justificativas dos alunos vinculados', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/justificativas',
      cookies: { buscapp_sessao: cookieRespCom },
    });
    expect(resposta.statusCode).toBe(200);
    const ids = resposta.json().justificativas.map((j: { id: string }) => j.id);
    expect(ids).toContain(justificativaVisivelId);
    expect(ids).not.toContain(justificativaForaId);
  });

  it('professor vê a justificativa da própria turma e não a do aluno fora', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/justificativas',
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(200);
    const ids = resposta.json().justificativas.map((j: { id: string }) => j.id);
    expect(ids).toEqual([justificativaVisivelId]);
    expect(ids).not.toContain(justificativaForaId);
  });

  it('professor sem atribuição não vê justificativas', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/justificativas',
      cookies: { buscapp_sessao: cookieProfSem },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().justificativas).toEqual([]);
  });

  it('gestão filtra por status, aluno e período', async () => {
    const porAluno = await app.inject({
      method: 'GET',
      url: '/api/justificativas',
      query: { aluno_id: alunoForaId, status: 'pendente' },
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(porAluno.statusCode).toBe(200);
    const ids = porAluno.json().justificativas.map((j: { id: string }) => j.id);
    expect(ids).toEqual([justificativaForaId]);

    const foraDoPeriodo = await app.inject({
      method: 'GET',
      url: '/api/justificativas',
      query: { aluno_id: alunoVisivelId, data_inicio: '2026-09-11' },
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(foraDoPeriodo.statusCode).toBe(200);
    expect(foraDoPeriodo.json().justificativas).toEqual([]);

    const noPeriodo = await app.inject({
      method: 'GET',
      url: '/api/justificativas',
      query: { aluno_id: alunoVisivelId, data_inicio: '2026-09-01', data_fim: '2026-09-30' },
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(noPeriodo.statusCode).toBe(200);
    expect(noPeriodo.json().justificativas.map((j: { id: string }) => j.id)).toEqual([
      justificativaVisivelId,
    ]);
  });
});

describe('GET /api/justificativas/:id', () => {
  it('professor fora do escopo recebe 404', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/justificativas/${justificativaForaId}`,
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(404);
  });

  it('responsável sem vínculo com o aluno recebe 404', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/justificativas/${justificativaForaId}`,
      cookies: { buscapp_sessao: cookieRespCom },
    });
    expect(resposta.statusCode).toBe(404);
  });

  it('professor dentro do escopo e gestão recebem 200', async () => {
    const comoProfessor = await app.inject({
      method: 'GET',
      url: `/api/justificativas/${justificativaVisivelId}`,
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(comoProfessor.statusCode).toBe(200);
    expect(comoProfessor.json().justificativa.anexos).toHaveLength(2);

    const comoGestao = await app.inject({
      method: 'GET',
      url: `/api/justificativas/${justificativaForaId}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(comoGestao.statusCode).toBe(200);
  });

  it('id inexistente responde 404', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/justificativas/${randomUUID()}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(resposta.statusCode).toBe(404);
  });
});

describe('PATCH /api/justificativas/:id', () => {
  it('professor e responsável não avaliam (403)', async () => {
    const comoProfessor = await app.inject({
      method: 'PATCH',
      url: `/api/justificativas/${justificativaVisivelId}`,
      cookies: { buscapp_sessao: cookieProfCom },
      payload: { status: 'aceita' },
    });
    expect(comoProfessor.statusCode).toBe(403);

    const comoResponsavel = await app.inject({
      method: 'PATCH',
      url: `/api/justificativas/${justificativaVisivelId}`,
      cookies: { buscapp_sessao: cookieRespCom },
      payload: { status: 'aceita' },
    });
    expect(comoResponsavel.statusCode).toBe(403);
  });

  it('gestão aceita e o trigger justifica as frequências do período', async () => {
    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/justificativas/${justificativaVisivelId}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { status: 'aceita' },
    });
    expect(resposta.statusCode).toBe(200);
    const justificativa = resposta.json().justificativa;
    expect(justificativa).toMatchObject({
      id: justificativaVisivelId,
      status: 'aceita',
      avaliado_por: gestaoId,
    });
    expect(justificativa.avaliado_em).not.toBeNull();

    const frequencias = await prisma.frequencias.findMany({
      where: { aluno_id: alunoVisivelId },
      orderBy: { data_aula: 'asc' },
    });
    const noPeriodo = frequencias.filter((frequencia) => {
      const dia = dataCivil(frequencia.data_aula);
      return dia >= DATA_FALTA && dia <= DATA_FIM;
    });
    expect(noPeriodo).toHaveLength(2);
    expect(noPeriodo.every((frequencia) => frequencia.status === 'justificado')).toBe(true);

    const foraDoPeriodo = frequencias.find(
      (frequencia) => dataCivil(frequencia.data_aula) === DATA_FORA,
    );
    expect(foraDoPeriodo?.status).toBe('ausente');
  });

  it('segunda avaliação da mesma justificativa retorna 409', async () => {
    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/justificativas/${justificativaVisivelId}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { status: 'recusada' },
    });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json().erro.codigo).toBe('justificativa_ja_avaliada');
  });

  it('avaliação de justificativa inexistente responde 404', async () => {
    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/justificativas/${randomUUID()}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { status: 'aceita' },
    });
    expect(resposta.statusCode).toBe(404);
  });
});
