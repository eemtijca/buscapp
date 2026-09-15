import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { prismaAdmin as prisma } from '../../nucleo/banco/cliente.js';
import { armazenamento } from '../../nucleo/armazenamento/index.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';

const marcador = Date.now();
const gestaoId = randomUUID();
const emailGestao = `gestao.anexos.${marcador}@escola.edu.br`;

let app: FastifyInstance;
let cookieGestao: string;

function extrairCookie(cabecalho: string | string[] | undefined): string {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const par = (valor ?? '').split(';')[0] ?? '';
  return par.slice(par.indexOf('=') + 1);
}

function corpoMultipart(nome: string, tipo: string, conteudo: Buffer) {
  const boundary = `----buscapp${Date.now()}${Math.random().toString(16).slice(2)}`;
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\nContent-Type: ${tipo}\r\n\r\n`,
    ),
    conteudo,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { boundary, payload };
}

beforeAll(async () => {
  app = await construirApp();
  await prisma.perfis.create({
    data: {
      id: gestaoId,
      nome: 'Perfil gestão anexos',
      email: emailGestao,
      papel: 'gestao',
      status: 'ativo',
      senha_hash: await gerarHashSenha('SenhaAtual1!'),
      acesso_modulos: [],
    },
  });

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: emailGestao, senha: 'SenhaAtual1!' },
  });
  expect(login.statusCode).toBe(200);
  cookieGestao = extrairCookie(login.headers['set-cookie']);
});

afterAll(async () => {
  const anexos = await prisma.anexos.findMany({ where: { criado_por: gestaoId } });
  for (const anexo of anexos) {
    await armazenamento()
      .remover(anexo.storage_path)
      .catch(() => undefined);
  }
  await prisma.anexos.deleteMany({ where: { criado_por: gestaoId } });
  await prisma.sessoes.deleteMany({ where: { perfil_id: gestaoId } });
  await prisma.perfis.deleteMany({ where: { id: gestaoId } });
  await app.close();
  await prisma.$disconnect();
});

describe('upload direto de anexos', () => {
  it('informa indisponibilidade quando o driver não é S3', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/anexos/upload',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome_arquivo: 'foto.jpg', mime_type: 'image/jpeg', tamanho_bytes: 1024 },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.codigo).toBe('upload_direto_indisponivel');
  });

  it('rejeita confirmação de chave de outro usuário', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/anexos/confirmar',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        chave: `${randomUUID()}/arquivo.pdf`,
        nome_arquivo: 'arquivo.pdf',
        mime_type: 'application/pdf',
        tamanho_bytes: 10,
      },
    });

    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('nao_autorizado');
  });

  it('valida o tipo permitido no pedido de upload', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/anexos/upload',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        nome_arquivo: 'script.exe',
        mime_type: 'application/x-msdownload',
        tamanho_bytes: 10,
      },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.codigo).toBe('validacao');
  });
});

describe('anexo multipart', () => {
  it('envia, lê em streaming e remove o arquivo', async () => {
    const conteudo = Buffer.from('conteudo-pdf-de-teste-com-streaming');
    const { boundary, payload } = corpoMultipart('teste.pdf', 'application/pdf', conteudo);

    const envio = await app.inject({
      method: 'POST',
      url: '/api/anexos',
      cookies: { buscapp_sessao: cookieGestao },
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });

    expect(envio.statusCode).toBe(201);
    const anexo = envio.json().anexo as { id: string; nome_arquivo: string; tamanho_bytes: number };
    expect(anexo.nome_arquivo).toBe('teste.pdf');
    expect(anexo.tamanho_bytes).toBe(conteudo.length);

    const leitura = await app.inject({
      method: 'GET',
      url: `/api/anexos/${anexo.id}/arquivo`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(leitura.statusCode).toBe(200);
    expect(leitura.headers['content-type']).toContain('application/pdf');
    expect(leitura.rawPayload.equals(conteudo)).toBe(true);

    const remocao = await app.inject({
      method: 'DELETE',
      url: `/api/anexos/${anexo.id}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(remocao.statusCode).toBe(200);

    const apagado = await app.inject({
      method: 'GET',
      url: `/api/anexos/${anexo.id}/arquivo`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(apagado.statusCode).toBe(404);
  });
});
