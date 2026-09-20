import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from './aplicacao.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await construirApp();
});

afterAll(async () => {
  await app.close();
});

describe('envelope de erro do Fastify', () => {
  it('responde 400 para JSON malformado', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{ "email": ',
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.codigo).toBe('requisicao_invalida');
  });

  it('responde 413 para corpo acima do limite', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'a@b.com', senha: 'x'.repeat(1024 * 1024 + 100) }),
    });

    expect(resposta.statusCode).toBe(413);
    expect(resposta.json().erro.codigo).toBe('payload_grande');
  });

  it('responde 415 para tipo de conteúdo não suportado', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/xml' },
      payload: '<email>teste</email>',
    });

    expect(resposta.statusCode).toBe(415);
    expect(resposta.json().erro.codigo).toBe('tipo_nao_suportado');
  });
});

describe('verificação de origem', () => {
  it('rejeita método mutante de origem não autorizada', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: 'https://malicioso.example' },
      payload: { email: 'a@b.com', senha: 'x' },
    });

    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('origem_invalida');
  });

  it('aceita método mutante da origem permitida', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: 'http://localhost:5173' },
      payload: { email: 'ninguem@escola.edu.br', senha: 'Errada1!' },
    });

    expect(resposta.statusCode).toBe(401);
  });
});

describe('cabeçalhos de segurança', () => {
  it('responde com nosniff e CSP na API', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/saude' });

    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
    expect(String(resposta.headers['content-security-policy'])).toContain("default-src 'self'");
    expect(String(resposta.headers['content-security-policy'])).toContain("frame-ancestors 'none'");
  });
});
