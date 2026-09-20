import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../aplicacao.js';
import { prismaAdmin as prisma } from '../../nucleo/banco/cliente.js';
import { criarSessao } from '../../nucleo/autenticacao/sessoes.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';
import { gerarCodigoRedefinicao } from '../../nucleo/autenticacao/codigos.js';

const marcador = Date.now();
const emailGestao = `gestao.teste.${marcador}@escola.edu.br`;
const emailProf = `prof.teste.${marcador}@escola.edu.br`;
const emailPendente = `pendente.teste.${marcador}@escola.edu.br`;

const gestaoId = randomUUID();
const profId = randomUUID();
const pendenteId = randomUUID();

let app: FastifyInstance;

function extrairCookie(cabecalho: string | string[] | undefined): string {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const par = (valor ?? '').split(';')[0] ?? '';
  return par.slice(par.indexOf('=') + 1);
}

async function criarPerfil(
  id: string,
  email: string,
  papel: 'gestao' | 'professor' | 'responsavel',
  status: 'ativo' | 'pendente',
) {
  await prisma.perfis.create({
    data: {
      id,
      nome: `Perfil ${papel}`,
      email,
      papel,
      status,
      senha_hash: await gerarHashSenha('SenhaAtual1!'),
      acesso_modulos: [],
    },
  });
}

beforeAll(async () => {
  app = await construirApp();
  await criarPerfil(gestaoId, emailGestao, 'gestao', 'ativo');
  await criarPerfil(profId, emailProf, 'professor', 'ativo');
  await criarPerfil(pendenteId, emailPendente, 'responsavel', 'pendente');
});

afterAll(async () => {
  await prisma.sessoes.deleteMany({ where: { perfil_id: { in: [gestaoId, profId, pendenteId] } } });
  await prisma.notificacoes.deleteMany({ where: { destinatario_id: gestaoId } });
  await prisma.codigos_redefinicao.deleteMany({
    where: { perfil_id: { in: [gestaoId, profId, pendenteId] } },
  });
  await prisma.codigos_redefinicao_tentativas.deleteMany({
    where: { email: { in: [emailProf, emailPendente, emailGestao] } },
  });
  await prisma.auditoria.deleteMany({ where: { entidade_id: pendenteId } });
  await prisma.perfis.deleteMany({ where: { id: { in: [gestaoId, profId, pendenteId] } } });
  await prisma.configuracoes_sistema.deleteMany({ where: { id: { not: 1 } } });
  await app.close();
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('autentica e cria sessão', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: emailGestao, senha: 'SenhaAtual1!', lembrar: true },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().perfil).toMatchObject({ id: gestaoId, papel: 'gestao' });

    const cookie = resposta.headers['set-cookie'];
    expect(String(cookie)).toContain('buscapp_sessao=');
    expect(String(cookie)).toContain('HttpOnly');
    expect(String(cookie)).toContain('Max-Age');
  });

  it('rejeita senha incorreta e usuário inexistente com a mesma resposta', async () => {
    const senhaErrada = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: emailGestao, senha: 'Errada1!' },
    });
    const inexistente = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `ninguem.${marcador}@escola.edu.br`, senha: 'Errada1!' },
    });

    expect(senhaErrada.statusCode).toBe(401);
    expect(inexistente.statusCode).toBe(401);
    expect(senhaErrada.json()).toEqual(inexistente.json());
  });

  it('bloqueia conta inativa', async () => {
    await prisma.perfis.update({ where: { id: profId }, data: { status: 'inativo' } });
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: emailProf, senha: 'SenhaAtual1!' },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('conta_inativa');
    await prisma.perfis.update({ where: { id: profId }, data: { status: 'ativo' } });
  });

  it('bloqueia conta pendente com erro próprio', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: emailPendente, senha: 'SenhaAtual1!' },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('conta_pendente');
  });
});

describe('status da conta em rotas privadas', () => {
  it('rejeita sessão de perfil pendente', async () => {
    const { token } = await criarSessao(pendenteId, { lembrar: false });
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/alunos',
      cookies: { buscapp_sessao: token },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('conta_pendente');
  });

  it('rejeita sessão de perfil inativo', async () => {
    await prisma.perfis.update({ where: { id: profId }, data: { status: 'inativo' } });
    const { token } = await criarSessao(profId, { lembrar: false });
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/alunos',
      cookies: { buscapp_sessao: token },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('conta_inativa');
    await prisma.perfis.update({ where: { id: profId }, data: { status: 'ativo' } });
  });
});

describe('sessão', () => {
  it('retorna o perfil em /me e encerra no logout', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: emailProf, senha: 'SenhaAtual1!' },
    });
    const token = extrairCookie(login.headers['set-cookie']);

    const eu = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { buscapp_sessao: token },
    });
    expect(eu.statusCode).toBe(200);
    expect(eu.json().perfil.id).toBe(profId);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { buscapp_sessao: token },
    });
    expect(logout.statusCode).toBe(200);

    const depois = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { buscapp_sessao: token },
    });
    expect(depois.statusCode).toBe(200);
    expect(depois.json().perfil).toBeNull();
  });

  it('devolve perfil null sem cookie (sonda de sessão)', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().perfil).toBeNull();
  });
});

describe('redefinição por código', () => {
  it('notifica a gestão ativa ao solicitar', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/solicitar-codigo',
      payload: { email: emailPendente },
    });
    expect(resposta.statusCode).toBe(200);

    const notificacao = await prisma.notificacoes.findFirst({
      where: { destinatario_id: gestaoId, tipo: 'codigo_redefinicao', lida: false },
    });
    expect(notificacao).not.toBeNull();
  });

  it('redefine a senha, ativa perfil pendente e revoga sessões', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: emailPendente, senha: 'SenhaAtual1!' },
    });
    const tokenAntigo = extrairCookie(login.headers['set-cookie']);

    const codigo = await gerarCodigoRedefinicao(pendenteId);
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/redefinir-senha',
      payload: { email: emailPendente, codigo, novaSenha: 'NovaSenha2@' },
    });
    expect(resposta.statusCode).toBe(200);

    const sessaoAntiga = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { buscapp_sessao: tokenAntigo },
    });
    expect(sessaoAntiga.statusCode).toBe(200);
    expect(sessaoAntiga.json().perfil).toBeNull();

    const loginNovo = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: emailPendente, senha: 'NovaSenha2@' },
    });
    expect(loginNovo.statusCode).toBe(200);
    expect(loginNovo.json().perfil.status).toBe('ativo');

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade_id: pendenteId, acao: 'USAR_CODIGO' },
    });
    expect(auditoria).not.toBeNull();
  });

  it('bloqueia após exceder o máximo de tentativas', async () => {
    await prisma.configuracoes_sistema.upsert({
      where: { id: 1 },
      create: { id: 1, max_tentativas_codigo: 2, minutos_bloqueio_codigo: 15 },
      update: { max_tentativas_codigo: 2, minutos_bloqueio_codigo: 15 },
    });

    try {
      const payload = { email: emailProf, codigo: '000000', novaSenha: 'NovaSenha2@' };
      const primeira = await app.inject({
        method: 'POST',
        url: '/api/auth/redefinir-senha',
        payload,
      });
      const segunda = await app.inject({
        method: 'POST',
        url: '/api/auth/redefinir-senha',
        payload,
      });
      const terceira = await app.inject({
        method: 'POST',
        url: '/api/auth/redefinir-senha',
        payload,
      });

      expect(primeira.statusCode).toBe(400);
      expect(segunda.statusCode).toBe(400);
      expect(terceira.statusCode).toBe(429);
    } finally {
      await prisma.configuracoes_sistema.deleteMany({ where: { id: 1 } });
    }
  });

  it('recusa senha fraca', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/redefinir-senha',
      payload: { email: emailProf, codigo: '123456', novaSenha: 'fraca' },
    });
    expect(resposta.statusCode).toBe(400);
  });
});
