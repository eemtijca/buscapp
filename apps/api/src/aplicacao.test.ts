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
