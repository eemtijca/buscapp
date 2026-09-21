import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../aplicacao.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';
import { prismaAdmin as prisma } from '../../nucleo/banco/cliente.js';

const marcador = Date.now();
const gestaoId = randomUUID();
const professorId = randomUUID();
const eventoA = randomUUID();
const eventoB = randomUUID();
const eventoOutroUsuario = randomUUID();
const emailGestao = `auditoria.gestao.${marcador}@escola.edu.br`;
const emailProfessor = `auditoria.prof.${marcador}@escola.edu.br`;

let app: FastifyInstance;
let cookieGestao: string;
let cookieProfessor: string;

function extrairCookie(cabecalho: string | string[] | undefined): string {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const par = (valor ?? '').split(';')[0] ?? '';
  return par.slice(par.indexOf('=') + 1);
}

async function entrar(email: string): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha: 'SenhaAtual1!' },
  });
  expect(resposta.statusCode).toBe(200);
  return extrairCookie(resposta.headers['set-cookie']);
}

beforeAll(async () => {
  app = await construirApp();
  const senha = await gerarHashSenha('SenhaAtual1!');

  await prisma.perfis.createMany({
    data: [
      {
        id: gestaoId,
        nome: 'Auditoria Gestão',
        email: emailGestao,
        papel: 'gestao',
        status: 'ativo',
        senha_hash: senha,
        acesso_modulos: [],
      },
      {
        id: professorId,
        nome: 'Auditoria Professor',
        email: emailProfessor,
        papel: 'professor',
        status: 'ativo',
        senha_hash: senha,
        acesso_modulos: [],
      },
    ],
  });

  await prisma.auditoria.createMany({
    data: [
      {
        id: eventoA,
        usuario_id: gestaoId,
        acao: 'BAIXAR_ANEXO',
        entidade: 'anexos',
        entidade_id: randomUUID(),
        ip_origem: '203.0.113.10',
        created_at: new Date('2026-09-10T12:00:00.000Z'),
      },
      {
        id: eventoB,
        usuario_id: gestaoId,
        acao: 'CRIAR_ALUNO',
        entidade: 'alunos',
        entidade_id: randomUUID(),
        created_at: new Date('2026-09-11T12:00:00.000Z'),
      },
      {
        id: eventoOutroUsuario,
        usuario_id: professorId,
        acao: 'BAIXAR_ANEXO',
        entidade: 'anexos',
        entidade_id: randomUUID(),
        created_at: new Date('2026-09-12T12:00:00.000Z'),
      },
    ],
  });

  cookieGestao = await entrar(emailGestao);
  cookieProfessor = await entrar(emailProfessor);
});

afterAll(async () => {
  await prisma.auditoria.deleteMany({
    where: { id: { in: [eventoA, eventoB, eventoOutroUsuario] } },
  });
  await prisma.sessoes.deleteMany({ where: { perfil_id: { in: [gestaoId, professorId] } } });
  await prisma.auditoria.deleteMany({
    where: { usuario_id: { in: [gestaoId, professorId] }, acao: 'LOGIN' },
  });
  await prisma.perfis.deleteMany({ where: { id: { in: [gestaoId, professorId] } } });
  await app.close();
  await prisma.$disconnect();
});

describe('GET /api/auditoria', () => {
  it('gestão lista os eventos com paginação estável', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/auditoria?limite=2',
      cookies: { buscapp_sessao: cookieGestao },
    });

    expect(resposta.statusCode).toBe(200);
    const eventos = resposta.json().auditoria as Array<{ id: string; created_at: string }>;
    expect(eventos).toHaveLength(2);
    expect(new Date(eventos[0]!.created_at).getTime()).toBeGreaterThanOrEqual(
      new Date(eventos[1]!.created_at).getTime(),
    );

    const segundaPagina = await app.inject({
      method: 'GET',
      url: '/api/auditoria?limite=2&offset=2',
      cookies: { buscapp_sessao: cookieGestao },
    });
    const ids = new Set(eventos.map((evento) => evento.id));
    for (const evento of segundaPagina.json().auditoria as Array<{ id: string }>) {
      expect(ids.has(evento.id)).toBe(false);
    }
  });

  it('filtra por ação, entidade, usuário e intervalo', async () => {
    const porAcao = await app.inject({
      method: 'GET',
      url: '/api/auditoria?acao=BAIXAR_ANEXO&limite=200',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(porAcao.statusCode).toBe(200);
    const eventosAcao = porAcao.json().auditoria as Array<{ id: string; acao: string }>;
    expect(eventosAcao.every((evento) => evento.acao === 'BAIXAR_ANEXO')).toBe(true);
    expect(eventosAcao.map((evento) => evento.id)).toEqual(
      expect.arrayContaining([eventoA, eventoOutroUsuario]),
    );

    const porUsuario = await app.inject({
      method: 'GET',
      url: `/api/auditoria?usuario_id=${professorId}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(
      (porUsuario.json().auditoria as Array<{ id: string }>).some(
        (evento) => evento.id === eventoOutroUsuario,
      ),
    ).toBe(true);

    const porIntervalo = await app.inject({
      method: 'GET',
      url: '/api/auditoria?data_inicio=2026-09-11&data_fim=2026-09-11',
      cookies: { buscapp_sessao: cookieGestao },
    });
    const ids = (porIntervalo.json().auditoria as Array<{ id: string }>).map((evento) => evento.id);
    expect(ids).toContain(eventoB);
    expect(ids).not.toContain(eventoA);

    const porEntidade = await app.inject({
      method: 'GET',
      url: '/api/auditoria?entidade=alunos',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(
      (porEntidade.json().auditoria as Array<{ entidade: string }>).every(
        (evento) => evento.entidade === 'alunos',
      ),
    ).toBe(true);
  });

  it('respeita o limite máximo e rejeita valores inválidos', async () => {
    const excesso = await app.inject({
      method: 'GET',
      url: '/api/auditoria?limite=201',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(excesso.statusCode).toBe(400);

    const vazio = await app.inject({
      method: 'GET',
      url: '/api/auditoria?offset=99999',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(vazio.statusCode).toBe(200);
    expect(vazio.json().auditoria).toEqual([]);
  });

  it('professor não lê a auditoria', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/auditoria',
      cookies: { buscapp_sessao: cookieProfessor },
    });

    expect(resposta.statusCode).toBe(403);
  });
});
