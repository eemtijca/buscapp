import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from './aplicacao.js';
import { deveAvisarTrustProxy } from './ambiente.js';

const ORIGEM_PREVIEW_CONFIADA = 'https://buscapp-fix.preview.example.com';

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

  it('recusa senha acima do tamanho máximo do contrato', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'a@b.com', senha: 'x'.repeat(129) },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.codigo).toBe('validacao');
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

describe('aviso de TRUST_PROXY', () => {
  it('avisa apenas em produção sem confiança no proxy', () => {
    expect(deveAvisarTrustProxy({ NODE_ENV: 'production', TRUST_PROXY: false })).toBe(true);
    expect(deveAvisarTrustProxy({ NODE_ENV: 'production', TRUST_PROXY: true })).toBe(false);
    expect(deveAvisarTrustProxy({ NODE_ENV: 'development', TRUST_PROXY: false })).toBe(false);
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

  it('aceita preview no sufixo confiável', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: ORIGEM_PREVIEW_CONFIADA },
      payload: { email: 'ninguem@escola.edu.br', senha: 'Errada1!' },
    });

    expect(resposta.statusCode).toBe(401);
  });

  it('rejeita domínio que contorna o sufixo confiável', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: 'https://preview.example.com.evil.test' },
      payload: { email: 'a@b.com', senha: 'x' },
    });

    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('origem_invalida');
  });
});

describe('CORS', () => {
  it('reflete a origem confiável no preflight', async () => {
    const resposta = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/login',
      headers: {
        origin: ORIGEM_PREVIEW_CONFIADA,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers['access-control-allow-origin']).toBe(ORIGEM_PREVIEW_CONFIADA);
    expect(resposta.headers['access-control-allow-credentials']).toBe('true');
  });

  it('não reflete origem não autorizada', async () => {
    const resposta = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/login',
      headers: {
        origin: 'https://outro.vercel.app',
        'access-control-request-method': 'POST',
      },
    });

    expect(resposta.headers['access-control-allow-origin']).toBeUndefined();
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

describe('saúde, correlação e métricas', () => {
  it('responde readiness com o banco disponível', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/saude/pronto' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: 'ok', banco: 'ok' });
  });

  it('devolve x-request-id na resposta', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/saude' });

    expect(resposta.headers['x-request-id']).toBeTruthy();
  });

  it('protege as métricas para usuários anônimos', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/saude/metricas' });

    expect(resposta.statusCode).toBe(401);
  });
});
