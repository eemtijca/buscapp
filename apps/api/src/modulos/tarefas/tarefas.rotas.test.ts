import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// O segredo é lido na carga de `ambiente.ts`; define antes de importar a aplicação.
process.env.CRON_SECRET = 'segredo-de-expurgo';

const { construirApp } = await import('../../aplicacao.js');
const { armazenamento } = await import('../../nucleo/armazenamento/index.js');
const { prismaAdmin: prisma } = await import('../../nucleo/banco/cliente.js');

const marcador = Date.now();
const anexoId = randomUUID();
const chaveAnexo = `expurgo/${randomUUID()}-antigo.pdf`;
const raizUploads = path.resolve(process.cwd(), 'uploads');

let app: FastifyInstance;

beforeAll(async () => {
  app = await construirApp();
  await armazenamento().salvar(chaveAnexo, Buffer.from('%PDF-1.7\nantigo'), 'application/pdf');
  await prisma.anexos.create({
    data: {
      id: anexoId,
      storage_path: chaveAnexo,
      nome_arquivo: 'antigo.pdf',
      mime_type: 'application/pdf',
      tamanho_bytes: 12,
      expurgo_em: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });
  await prisma.rate_limit_contadores.create({
    data: {
      chave: `expurgo-teste-${marcador}`,
      contagem: 3,
      expira_em: new Date(Date.now() - 1000),
    },
  });
});

afterAll(async () => {
  await prisma.auditoria.deleteMany({ where: { acao: 'EXPURGO' } });
  await prisma.rate_limit_contadores.deleteMany({
    where: { chave: { contains: 'expurgo-teste' } },
  });
  await app.close();
  await prisma.$disconnect();
});

describe('POST /api/tarefas/expurgo', () => {
  it('rejeita chamadas sem o segredo do agendador', async () => {
    const semSegredo = await app.inject({ method: 'POST', url: '/api/tarefas/expurgo' });
    expect(semSegredo.statusCode).toBe(403);

    const segredoErrado = await app.inject({
      method: 'POST',
      url: '/api/tarefas/expurgo',
      headers: { authorization: 'Bearer outro-segredo' },
    });
    expect(segredoErrado.statusCode).toBe(403);
  });

  it('remove anexos vencidos, contadores expirados e registra auditoria', async () => {
    const caminhoArquivo = path.join(raizUploads, chaveAnexo);
    expect(existsSync(caminhoArquivo)).toBe(true);

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/tarefas/expurgo',
      headers: { authorization: 'Bearer segredo-de-expurgo' },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().anexos).toBe(1);
    expect(resposta.json().contadores).toBeGreaterThanOrEqual(1);

    const anexo = await prisma.anexos.findUnique({ where: { id: anexoId } });
    expect(anexo).toBeNull();
    expect(existsSync(caminhoArquivo)).toBe(false);

    const auditoria = await prisma.auditoria.count({ where: { acao: 'EXPURGO' } });
    expect(auditoria).toBeGreaterThanOrEqual(1);
  });

  it('é idempotente em uma segunda execução', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/tarefas/expurgo',
      headers: { authorization: 'Bearer segredo-de-expurgo' },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().anexos).toBe(0);
  });
});
