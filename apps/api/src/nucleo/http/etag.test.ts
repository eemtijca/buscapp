import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../aplicacao.js';

describe('Cache HTTP e ETag', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await construirApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde com ETag e cache privado na sonda anônima', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['cache-control']).toContain('no-store');
    expect(resposta.headers.etag).toBeTruthy();
  });

  it('responde 304 quando o If-None-Match corresponde', async () => {
    const primeira = await app.inject({ method: 'GET', url: '/api/auth/me' });
    const etag = primeira.headers.etag as string;

    const segunda = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { 'if-none-match': etag },
    });

    expect(segunda.statusCode).toBe(304);
    expect(segunda.headers.etag).toBe(etag);
    expect(segunda.body).toBe('');
  });

  it('ignora If-None-Match divergente', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { 'if-none-match': '"etag-inexistente"' },
    });
    expect(resposta.statusCode).toBe(200);
  });

  it('não gera ETag em respostas de erro', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/alunos' });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.headers.etag).toBeUndefined();
    expect(resposta.headers['cache-control']).toContain('no-store');
  });
});
