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
const respId = randomUUID();

const anoBaseId = randomUUID();
const anoTransferenciaId = randomUUID();
const turmaAId = randomUUID();
const turmaBId = randomUUID();
const turmaOutroAnoId = randomUUID();
const alunoFilhoId = randomUUID();
const alunoOutroId = randomUUID();

const emails = {
  gestao: `gestao.estrutura.${marcador}@escola.edu.br`,
  profCom: `prof.com.estrutura.${marcador}@escola.edu.br`,
  profSem: `prof.sem.estrutura.${marcador}@escola.edu.br`,
  resp: `resp.estrutura.${marcador}@escola.edu.br`,
};

const perfisTeste = [gestaoId, profComId, profSemId, respId];
const turmasTeste: string[] = [turmaAId, turmaBId, turmaOutroAnoId];
const alunosTeste = [alunoFilhoId, alunoOutroId];
const disciplinasTeste: string[] = [];
const anosTeste: string[] = [anoBaseId, anoTransferenciaId];

let app: FastifyInstance;
let cookieGestao: string;
let cookieProfCom: string;
let cookieProfSem: string;
let cookieResp: string;
let anoBase = 0;
let anoTransferencia = 0;
let anoVigente = 0;

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

/** Menor ano livre na tabela, respeitando o limite aceito pela API (2000..2100). */
async function proximoAnoDisponivel(): Promise<number> {
  const existentes = await prisma.anos_letivos.findMany({ select: { ano: true } });
  const usados = new Set(existentes.map((registro) => registro.ano));
  const maior = Math.max(2000, ...usados);
  if (maior + 1 <= 2100 && !usados.has(maior + 1)) return maior + 1;
  for (let ano = 2100; ano >= 2000; ano -= 1) {
    if (!usados.has(ano)) return ano;
  }
  throw new Error('Não há ano letivo disponível para os testes de estrutura.');
}

beforeAll(async () => {
  app = await construirApp();

  await criarPerfil(gestaoId, emails.gestao, 'gestao');
  await criarPerfil(profComId, emails.profCom, 'professor');
  await criarPerfil(profSemId, emails.profSem, 'professor');
  await criarPerfil(respId, emails.resp, 'responsavel');

  const anoCanonico = await prisma.anos_letivos.findUnique({ where: { id: ANO_LETIVO_ID } });
  if (!anoCanonico) throw new Error('Ano letivo canônico ausente; aplique as migrações/seed.');
  anoVigente = anoCanonico.ano;
  // Garante o estado inicial esperado mesmo após uma execução interrompida anterior.
  await prisma.anos_letivos.update({
    where: { id: ANO_LETIVO_ID },
    data: { status: 'ativo', ativo: true },
  });

  anoBase = await proximoAnoDisponivel();
  await prisma.anos_letivos.create({
    data: {
      id: anoBaseId,
      ano: anoBase,
      status: 'planejado',
      ativo: false,
      data_inicio: new Date(`${anoBase}-02-01T00:00:00.000Z`),
      data_fim: new Date(`${anoBase}-12-20T00:00:00.000Z`),
    },
  });

  anoTransferencia = await proximoAnoDisponivel();
  await prisma.anos_letivos.create({
    data: {
      id: anoTransferenciaId,
      ano: anoTransferencia,
      status: 'planejado',
      ativo: false,
      data_inicio: new Date(`${anoTransferencia}-02-01T00:00:00.000Z`),
      data_fim: new Date(`${anoTransferencia}-12-20T00:00:00.000Z`),
    },
  });

  await prisma.turmas.create({
    data: {
      id: turmaAId,
      ano_letivo_id: anoBaseId,
      serie: '1ª',
      letra: 'A',
      nome_completo: '1ª A',
      ativo: true,
    },
  });
  await prisma.turmas.create({
    data: {
      id: turmaBId,
      ano_letivo_id: anoBaseId,
      serie: '1ª',
      letra: 'B',
      nome_completo: '1ª B',
      ativo: true,
    },
  });
  await prisma.turmas.create({
    data: {
      id: turmaOutroAnoId,
      ano_letivo_id: anoTransferenciaId,
      serie: '2ª',
      letra: 'A',
      nome_completo: '2ª A',
      ativo: true,
    },
  });

  await prisma.atribuicoes_professores.create({
    data: {
      professor_id: profComId,
      turma_id: turmaAId,
      disciplina_id: DISCIPLINA_MATEMATICA,
      papel: 'titular',
      ativo: true,
    },
  });

  await prisma.alunos.create({
    data: { id: alunoFilhoId, nome: 'Aluno Filho', matricula: `FILHO-${marcador}` },
  });
  await prisma.alunos.create({
    data: { id: alunoOutroId, nome: 'Aluno Outro', matricula: `OUTRO-${marcador}` },
  });

  await prisma.enturmacoes.create({
    data: { aluno_id: alunoFilhoId, turma_id: turmaAId, ano_letivo_id: anoBaseId },
  });
  await prisma.enturmacoes.create({
    data: { aluno_id: alunoOutroId, turma_id: turmaAId, ano_letivo_id: anoBaseId },
  });

  await prisma.vinculos_responsaveis.create({
    data: { responsavel_id: respId, aluno_id: alunoFilhoId, tipo_relacao: 'pai' },
  });

  cookieGestao = await login(emails.gestao);
  cookieProfCom = await login(emails.profCom);
  cookieProfSem = await login(emails.profSem);
  cookieResp = await login(emails.resp);
});

afterAll(async () => {
  // Restaura o ano letivo canônico que a virada de ano arquiva durante os testes.
  await prisma.anos_letivos
    .update({ where: { id: ANO_LETIVO_ID }, data: { status: 'ativo', ativo: true } })
    .catch(() => undefined);

  await prisma.auditoria.deleteMany({ where: { usuario_id: { in: perfisTeste } } });
  await prisma.vinculos_responsaveis.deleteMany({
    where: { aluno_id: { in: alunosTeste } },
  });
  await prisma.enturmacoes.deleteMany({ where: { aluno_id: { in: alunosTeste } } });
  await prisma.atribuicoes_professores.deleteMany({
    where: {
      OR: [{ professor_id: { in: perfisTeste } }, { turma_id: { in: turmasTeste } }],
    },
  });
  await prisma.turmas.deleteMany({ where: { id: { in: turmasTeste } } });
  await prisma.alunos.deleteMany({ where: { id: { in: alunosTeste } } });
  await prisma.disciplinas.deleteMany({ where: { id: { in: disciplinasTeste } } });
  await prisma.anos_letivos.deleteMany({ where: { id: { in: anosTeste } } });
  await prisma.sessoes.deleteMany({ where: { perfil_id: { in: perfisTeste } } });
  await prisma.perfis.deleteMany({ where: { id: { in: perfisTeste } } });
  await app.close();
  await prisma.$disconnect();
});

describe('GET /api/turmas', () => {
  it('gestão lista todas as turmas', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/turmas',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(resposta.statusCode).toBe(200);
    const ids = resposta.json().turmas.map((turma: { id: string }) => turma.id);
    expect(ids).toEqual(expect.arrayContaining([turmaAId, turmaBId, turmaOutroAnoId]));
  });

  it('professor vê apenas as turmas em que leciona', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/turmas',
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(200);
    const ids = resposta.json().turmas.map((turma: { id: string }) => turma.id);
    expect(ids).toEqual([turmaAId]);
  });

  it('professor sem atribuição não vê turmas', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/turmas',
      cookies: { buscapp_sessao: cookieProfSem },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().turmas).toEqual([]);
  });

  it('responsável vê apenas a turma do aluno vinculado', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/turmas',
      cookies: { buscapp_sessao: cookieResp },
    });
    expect(resposta.statusCode).toBe(200);
    const ids = resposta.json().turmas.map((turma: { id: string }) => turma.id);
    expect(ids).toEqual([turmaAId]);
  });

  it('anônimo recebe 401 no envelope', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/turmas' });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().erro.codigo).toBe('nao_autenticado');
  });
});

describe('POST/PUT/PATCH /api/turmas', () => {
  it('professor e responsável não podem cadastrar turmas', async () => {
    const payload = { ano_letivo_id: anoBaseId, serie: '3ª', letra: 'C' };
    const comoProf = await app.inject({
      method: 'POST',
      url: '/api/turmas',
      cookies: { buscapp_sessao: cookieProfCom },
      payload,
    });
    const comoResp = await app.inject({
      method: 'POST',
      url: '/api/turmas',
      cookies: { buscapp_sessao: cookieResp },
      payload,
    });
    expect(comoProf.statusCode).toBe(403);
    expect(comoResp.statusCode).toBe(403);
  });

  it('gestão cadastra, edita, altera status e recebe 409 na turma duplicada', async () => {
    const criado = await app.inject({
      method: 'POST',
      url: '/api/turmas',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { ano_letivo_id: anoBaseId, serie: '3ª', letra: 'C', capacidade: 30 },
    });
    expect(criado.statusCode).toBe(201);
    const turma = criado.json().turma;
    turmasTeste.push(turma.id);
    expect(turma).toMatchObject({
      ano_letivo_id: anoBaseId,
      serie: '3ª',
      letra: 'C',
      nome_completo: '3ª C',
      capacidade: 30,
      ativo: true,
    });

    const duplicado = await app.inject({
      method: 'POST',
      url: '/api/turmas',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { ano_letivo_id: anoBaseId, serie: '3ª', letra: 'C' },
    });
    expect(duplicado.statusCode).toBe(409);
    expect(duplicado.json().erro.codigo).toBe('turma_duplicada');

    const editado = await app.inject({
      method: 'PUT',
      url: `/api/turmas/${turma.id}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { letra: 'D', capacidade: 25 },
    });
    expect(editado.statusCode).toBe(200);
    expect(editado.json().turma).toMatchObject({
      serie: '3ª',
      letra: 'D',
      nome_completo: '3ª D',
      capacidade: 25,
    });

    const inativado = await app.inject({
      method: 'PATCH',
      url: `/api/turmas/${turma.id}/status`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { ativo: false },
    });
    expect(inativado.statusCode).toBe(200);
    expect(inativado.json().turma.ativo).toBe(false);

    const filtradas = await app.inject({
      method: 'GET',
      url: `/api/turmas?ativo=false&ano_letivo_id=${anoBaseId}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(filtradas.statusCode).toBe(200);
    const ids = filtradas.json().turmas.map((item: { id: string }) => item.id);
    expect(ids).toContain(turma.id);

    await prisma.turmas.delete({ where: { id: turma.id } });
  });
});

describe('/api/disciplinas', () => {
  it('professor lê disciplinas, mas não cadastra', async () => {
    const leitura = await app.inject({
      method: 'GET',
      url: '/api/disciplinas',
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(leitura.statusCode).toBe(200);
    const ids = leitura.json().disciplinas.map((item: { id: string }) => item.id);
    expect(ids).toContain(DISCIPLINA_MATEMATICA);

    const escrita = await app.inject({
      method: 'POST',
      url: '/api/disciplinas',
      cookies: { buscapp_sessao: cookieProfCom },
      payload: { nome: 'Disciplina Proibida' },
    });
    expect(escrita.statusCode).toBe(403);
  });

  it('gestão cadastra, edita, altera status e recebe 409 no código SIGE duplicado', async () => {
    const codigoSige = `SIGE-${marcador}`;
    const criada = await app.inject({
      method: 'POST',
      url: '/api/disciplinas',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome: 'Disciplina Teste', codigo_sige: codigoSige, carga_horaria: 80 },
    });
    expect(criada.statusCode).toBe(201);
    const disciplina = criada.json().disciplina;
    disciplinasTeste.push(disciplina.id);
    expect(disciplina).toMatchObject({
      nome: 'Disciplina Teste',
      codigo_sige: codigoSige,
      carga_horaria: 80,
      ativo: true,
    });

    const duplicada = await app.inject({
      method: 'POST',
      url: '/api/disciplinas',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome: 'Outra Disciplina', codigo_sige: codigoSige },
    });
    expect(duplicada.statusCode).toBe(409);
    expect(duplicada.json().erro.codigo).toBe('codigo_sige_duplicado');

    const editada = await app.inject({
      method: 'PUT',
      url: `/api/disciplinas/${disciplina.id}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome: 'Disciplina Editada', carga_horaria: 120 },
    });
    expect(editada.statusCode).toBe(200);
    expect(editada.json().disciplina).toMatchObject({
      nome: 'Disciplina Editada',
      carga_horaria: 120,
    });

    const inativada = await app.inject({
      method: 'PATCH',
      url: `/api/disciplinas/${disciplina.id}/status`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { ativo: false },
    });
    expect(inativada.statusCode).toBe(200);
    expect(inativada.json().disciplina.ativo).toBe(false);

    await prisma.disciplinas.delete({ where: { id: disciplina.id } });
  });
});

describe('/api/atribuicoes', () => {
  it('apenas a gestão lista atribuições', async () => {
    const comoGestao = await app.inject({
      method: 'GET',
      url: '/api/atribuicoes',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(comoGestao.statusCode).toBe(200);
    const atribuicao = comoGestao
      .json()
      .atribuicoes.find((item: { turma_id: string }) => item.turma_id === turmaAId);
    expect(atribuicao).toMatchObject({
      professor_id: profComId,
      papel: 'titular',
      ativo: true,
      professor: { id: profComId },
      turma: { id: turmaAId, nome_completo: '1ª A' },
      disciplina: { id: DISCIPLINA_MATEMATICA, nome: 'Matemática' },
    });

    const comoProf = await app.inject({
      method: 'GET',
      url: '/api/atribuicoes',
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(comoProf.statusCode).toBe(403);
  });

  it('gestão cria, edita e altera status de atribuição', async () => {
    const criada = await app.inject({
      method: 'POST',
      url: '/api/atribuicoes',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        professor_id: profSemId,
        turma_id: turmaBId,
        disciplina_id: DISCIPLINA_MATEMATICA,
        papel: 'substituto',
        data_inicio: `${anoBase}-02-01`,
      },
    });
    expect(criada.statusCode).toBe(201);
    const atribuicao = criada.json().atribuicao;
    expect(atribuicao).toMatchObject({
      professor_id: profSemId,
      turma_id: turmaBId,
      papel: 'substituto',
      data_inicio: `${anoBase}-02-01`,
      data_fim: null,
      ativo: true,
      professor: { id: profSemId },
      turma: { id: turmaBId, nome_completo: '1ª B' },
    });

    const editada = await app.inject({
      method: 'PUT',
      url: `/api/atribuicoes/${atribuicao.id}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { papel: 'titular', data_fim: `${anoBase}-12-20`, ativo: false },
    });
    expect(editada.statusCode).toBe(200);
    expect(editada.json().atribuicao).toMatchObject({
      papel: 'titular',
      data_fim: `${anoBase}-12-20`,
      ativo: false,
    });

    const status = await app.inject({
      method: 'PATCH',
      url: `/api/atribuicoes/${atribuicao.id}/status`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { ativo: true },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().atribuicao.ativo).toBe(true);

    const filtradas = await app.inject({
      method: 'GET',
      url: `/api/atribuicoes?professor_id=${profSemId}&turma_id=${turmaBId}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(filtradas.statusCode).toBe(200);
    expect(filtradas.json().atribuicoes).toHaveLength(1);

    await prisma.atribuicoes_professores.delete({ where: { id: atribuicao.id } });
  });

  it('rejeita período com fim anterior ao início', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/atribuicoes',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        professor_id: profSemId,
        turma_id: turmaBId,
        papel: 'titular',
        data_inicio: `${anoBase}-06-01`,
        data_fim: `${anoBase}-05-01`,
      },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.codigo).toBe('validacao');
  });
});

describe('/api/anos-letivos', () => {
  it('gestão lista os anos do mais recente para o mais antigo', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/anos-letivos',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(resposta.statusCode).toBe(200);
    const anos = resposta.json().anos_letivos.map((ano: { ano: number }) => ano.ano);
    const ordenados = [...anos].sort((a, b) => b - a);
    expect(anos).toEqual(ordenados);
  });

  it('professor não acessa anos letivos', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/anos-letivos',
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('gestão cria como planejado, edita e recebe 409 em ano duplicado', async () => {
    const ano = await proximoAnoDisponivel();
    const criado = await app.inject({
      method: 'POST',
      url: '/api/anos-letivos',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        ano,
        data_inicio: `${ano}-02-01`,
        data_fim: `${ano}-12-20`,
      },
    });
    expect(criado.statusCode).toBe(201);
    const anoLetivo = criado.json().ano_letivo;
    anosTeste.push(anoLetivo.id);
    expect(anoLetivo).toMatchObject({
      ano,
      status: 'planejado',
      ativo: false,
      data_inicio: `${ano}-02-01`,
      data_fim: `${ano}-12-20`,
    });

    const editado = await app.inject({
      method: 'PUT',
      url: `/api/anos-letivos/${anoLetivo.id}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { data_fim: `${ano}-12-15` },
    });
    expect(editado.statusCode).toBe(200);
    expect(editado.json().ano_letivo.data_fim).toBe(`${ano}-12-15`);

    const duplicado = await app.inject({
      method: 'POST',
      url: '/api/anos-letivos',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        ano: anoVigente,
        data_inicio: `${anoVigente}-01-01`,
        data_fim: `${anoVigente}-12-31`,
      },
    });
    expect(duplicado.statusCode).toBe(409);
    expect(duplicado.json().erro.codigo).toBe('ano_letivo_duplicado');

    await prisma.anos_letivos.delete({ where: { id: anoLetivo.id } });
  });

  it('ativar arquiva o ano vigente e grava auditoria da virada', async () => {
    const ano = await proximoAnoDisponivel();
    const criado = await app.inject({
      method: 'POST',
      url: '/api/anos-letivos',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        ano,
        data_inicio: `${ano}-02-01`,
        data_fim: `${ano}-12-20`,
      },
    });
    expect(criado.statusCode).toBe(201);
    const anoLetivo = criado.json().ano_letivo;
    anosTeste.push(anoLetivo.id);

    const ativado = await app.inject({
      method: 'POST',
      url: `/api/anos-letivos/${anoLetivo.id}/ativar`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(ativado.statusCode).toBe(200);
    expect(ativado.json().ano_letivo).toMatchObject({
      id: anoLetivo.id,
      status: 'ativo',
      ativo: true,
    });

    const vigente = await prisma.anos_letivos.findUnique({ where: { id: ANO_LETIVO_ID } });
    expect(vigente).toMatchObject({ status: 'arquivado', ativo: false });

    const auditoriaArquivar = await prisma.auditoria.findFirst({
      where: {
        usuario_id: gestaoId,
        acao: 'ARQUIVAR_ANO_LETIVO',
        entidade: 'anos_letivos',
        entidade_id: ANO_LETIVO_ID,
      },
    });
    expect(auditoriaArquivar).not.toBeNull();

    const auditoriaAtivar = await prisma.auditoria.findFirst({
      where: {
        usuario_id: gestaoId,
        acao: 'ATIVAR_ANO_LETIVO',
        entidade: 'anos_letivos',
        entidade_id: anoLetivo.id,
      },
    });
    expect(auditoriaAtivar).not.toBeNull();

    const repetido = await app.inject({
      method: 'POST',
      url: `/api/anos-letivos/${anoLetivo.id}/ativar`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(repetido.statusCode).toBe(400);

    const retorno = await app.inject({
      method: 'POST',
      url: `/api/anos-letivos/${ANO_LETIVO_ID}/ativar`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(retorno.statusCode).toBe(200);
    expect(retorno.json().ano_letivo).toMatchObject({
      id: ANO_LETIVO_ID,
      status: 'ativo',
      ativo: true,
    });

    await prisma.anos_letivos.delete({ where: { id: anoLetivo.id } });
  });
});

describe('/api/enturmacoes', () => {
  it('gestão, professor e responsável veem apenas o escopo permitido', async () => {
    const comoGestao = await app.inject({
      method: 'GET',
      url: '/api/enturmacoes',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(comoGestao.statusCode).toBe(200);
    const idsGestao = comoGestao
      .json()
      .enturmacoes.map((item: { aluno_id: string }) => item.aluno_id);
    expect(idsGestao).toEqual(expect.arrayContaining([alunoFilhoId, alunoOutroId]));

    const comoProf = await app.inject({
      method: 'GET',
      url: '/api/enturmacoes',
      cookies: { buscapp_sessao: cookieProfCom },
    });
    expect(comoProf.statusCode).toBe(200);
    const enturmacoesProf = comoProf.json().enturmacoes;
    expect(enturmacoesProf).toHaveLength(2);
    expect(enturmacoesProf.every((item: { turma_id: string }) => item.turma_id === turmaAId)).toBe(
      true,
    );
    expect(enturmacoesProf[0]).toMatchObject({
      turma: { id: turmaAId, nome_completo: '1ª A' },
      ano_letivo: { id: anoBaseId, ano: anoBase },
    });

    const comoResp = await app.inject({
      method: 'GET',
      url: '/api/enturmacoes',
      cookies: { buscapp_sessao: cookieResp },
    });
    expect(comoResp.statusCode).toBe(200);
    const enturmacoesResp = comoResp.json().enturmacoes;
    expect(enturmacoesResp).toHaveLength(1);
    expect(enturmacoesResp[0].aluno_id).toBe(alunoFilhoId);

    const foraDoEscopo = await app.inject({
      method: 'GET',
      url: `/api/enturmacoes?aluno_id=${alunoOutroId}`,
      cookies: { buscapp_sessao: cookieResp },
    });
    expect(foraDoEscopo.statusCode).toBe(404);

    const semTurmas = await app.inject({
      method: 'GET',
      url: '/api/enturmacoes',
      cookies: { buscapp_sessao: cookieProfSem },
    });
    expect(semTurmas.statusCode).toBe(200);
    expect(semTurmas.json().enturmacoes).toEqual([]);
  });

  it('professor e responsável não podem enturmar', async () => {
    const payload = {
      aluno_id: alunoOutroId,
      turma_id: turmaOutroAnoId,
    };
    const comoProf = await app.inject({
      method: 'POST',
      url: '/api/enturmacoes',
      cookies: { buscapp_sessao: cookieProfCom },
      payload,
    });
    const comoResp = await app.inject({
      method: 'POST',
      url: '/api/enturmacoes',
      cookies: { buscapp_sessao: cookieResp },
      payload,
    });
    expect(comoProf.statusCode).toBe(403);
    expect(comoResp.statusCode).toBe(403);
  });

  it('gestão enturma, transfere a matrícula ativa e atualiza a enturmação', async () => {
    const criada = await app.inject({
      method: 'POST',
      url: '/api/enturmacoes',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { aluno_id: alunoOutroId, turma_id: turmaOutroAnoId },
    });
    expect(criada.statusCode).toBe(201);
    const enturmacao = criada.json().enturmacao;
    expect(enturmacao).toMatchObject({
      aluno_id: alunoOutroId,
      turma_id: turmaOutroAnoId,
      ano_letivo_id: anoTransferenciaId,
      status: 'matriculado',
      turma: { id: turmaOutroAnoId, nome_completo: '2ª A' },
      ano_letivo: { id: anoTransferenciaId, ano: anoTransferencia },
    });

    const anterior = await prisma.enturmacoes.findFirst({
      where: { aluno_id: alunoOutroId, turma_id: turmaAId },
    });
    expect(anterior?.status).toBe('transferido');
    expect(anterior?.data_encerramento).not.toBeNull();

    const atualizada = await app.inject({
      method: 'PUT',
      url: `/api/enturmacoes/${enturmacao.id}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { status: 'transferido', data_encerramento: `${anoTransferencia}-12-01` },
    });
    expect(atualizada.statusCode).toBe(200);
    expect(atualizada.json().enturmacao).toMatchObject({
      status: 'transferido',
      data_encerramento: `${anoTransferencia}-12-01`,
    });
  });

  it('reenturmar no mesmo ano reaproveita a linha existente', async () => {
    const criada = await app.inject({
      method: 'POST',
      url: '/api/enturmacoes',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { aluno_id: alunoFilhoId, turma_id: turmaBId },
    });
    expect(criada.statusCode).toBe(201);
    expect(criada.json().enturmacao).toMatchObject({
      aluno_id: alunoFilhoId,
      turma_id: turmaBId,
      ano_letivo_id: anoBaseId,
      status: 'matriculado',
      data_encerramento: null,
    });

    const linhas = await prisma.enturmacoes.findMany({
      where: { aluno_id: alunoFilhoId, ano_letivo_id: anoBaseId },
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.turma_id).toBe(turmaBId);
  });
});
