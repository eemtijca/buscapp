import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';

const marcador = Date.now();
const gestaoId = randomUUID();
const profId = randomUUID();
const emailGestao = `gestao.usuarios.${marcador}@escola.edu.br`;
const emailProf = `prof.usuarios.${marcador}@escola.edu.br`;

let app: FastifyInstance;
let cookieGestao: string;
let cookieProf: string;
const criados: string[] = [];

function extrairCookie(cabecalho: string | string[] | undefined): string {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const par = (valor ?? '').split(';')[0] ?? '';
  return par.slice(par.indexOf('=') + 1);
}

async function criarPerfil(id: string, email: string, papel: 'gestao' | 'professor') {
  await prisma.perfis.create({
    data: {
      id,
      nome: `Perfil ${papel}`,
      email,
      papel,
      status: 'ativo',
      senha_hash: await gerarHashSenha('SenhaAtual1!'),
      acesso_modulos: [],
    },
  });
}

async function login(email: string, senha = 'SenhaAtual1!'): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha },
  });
  expect(resposta.statusCode).toBe(200);
  return extrairCookie(resposta.headers['set-cookie']);
}

beforeAll(async () => {
  app = await construirApp();
  await criarPerfil(gestaoId, emailGestao, 'gestao');
  await criarPerfil(profId, emailProf, 'professor');
  cookieGestao = await login(emailGestao);
  cookieProf = await login(emailProf);
});

afterAll(async () => {
  await prisma.sessoes.deleteMany({
    where: { perfil_id: { in: [gestaoId, profId, ...criados] } },
  });
  await prisma.codigos_redefinicao.deleteMany({ where: { perfil_id: { in: criados } } });
  await prisma.notificacoes.deleteMany({ where: { destinatario_id: { in: criados } } });
  await prisma.auditoria.deleteMany({ where: { usuario_id: { in: criados } } });
  await prisma.perfis.deleteMany({ where: { id: { in: [gestaoId, profId, ...criados] } } });
  await app.close();
  await prisma.$disconnect();
});

describe('POST /api/usuarios', () => {
  it('cria usuário pendente com código e senha temporária utilizável', async () => {
    const email = `novo.usuarios.${marcador}@escola.edu.br`;
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/usuarios',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome: 'Novo Professor', email, papel: 'professor' },
    });

    expect(resposta.statusCode).toBe(201);
    const corpo = resposta.json();
    expect(corpo.usuario).toMatchObject({ email, papel: 'professor', status: 'pendente' });
    expect(corpo.codigo).toMatch(/^\d{6}$/);
    criados.push(corpo.usuario.id);

    const novoSessao = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, senha: corpo.senha_temporaria },
    });
    expect(novoSessao.statusCode).toBe(200);

    const duplicado = await app.inject({
      method: 'POST',
      url: '/api/usuarios',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome: 'Outro', email, papel: 'professor' },
    });
    expect(duplicado.statusCode).toBe(409);
    expect(duplicado.json().erro.codigo).toBe('email_duplicado');
  });

  it('professor não pode criar usuários', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/usuarios',
      cookies: { buscapp_sessao: cookieProf },
      payload: { nome: 'X', email: `x.${marcador}@escola.edu.br`, papel: 'professor' },
    });
    expect(resposta.statusCode).toBe(403);
  });
});

describe('leituras e edição', () => {
  it('lista com filtro de papel e atualiza módulos de acesso', async () => {
    const lista = await app.inject({
      method: 'GET',
      url: '/api/usuarios?papel=professor',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(lista.statusCode).toBe(200);
    const ids = lista.json().usuarios.map((usuario: { id: string }) => usuario.id);
    expect(ids).toContain(profId);

    const atualizado = await app.inject({
      method: 'PUT',
      url: `/api/usuarios/${profId}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { acesso_modulos: ['frequencia'], notificacoes_ativas: false },
    });
    expect(atualizado.statusCode).toBe(200);
    expect(atualizado.json().usuario).toMatchObject({
      acesso_modulos: ['frequencia'],
      notificacoes_ativas: false,
    });

    const invalido = await app.inject({
      method: 'PUT',
      url: `/api/usuarios/${profId}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { acesso_modulos: ['modulo_inexistente'] },
    });
    expect(invalido.statusCode).toBe(400);
  });

  it('inativar revoga as sessões do usuário', async () => {
    const sessaoProf = await login(emailProf);

    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/usuarios/${profId}/status`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { status: 'inativo' },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().usuario.status).toBe('inativo');

    const depois = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { buscapp_sessao: sessaoProf },
    });
    expect(depois.statusCode).toBe(401);

    await prisma.perfis.update({ where: { id: profId }, data: { status: 'ativo' } });
  });
});
