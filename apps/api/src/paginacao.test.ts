import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from './aplicacao.js';
import { gerarHashSenha } from './nucleo/autenticacao/senhas.js';
import { prismaAdmin as prisma } from './nucleo/banco/cliente.js';

const marcador = Date.now();
const gestaoId = randomUUID();
const responsavelId = randomUUID();
const alunoId = randomUUID();
const anoId = randomUUID();
const turmaId = randomUUID();
const conversaId = randomUUID();
const emailGestao = `paginacao.gestao.${marcador}@escola.edu.br`;

let app: FastifyInstance;
let cookie: string;
let mensagemMaisAntigaId = '';

function extrairCookie(cabecalho: string | string[] | undefined): string {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const par = (valor ?? '').split(';')[0] ?? '';
  return par.slice(par.indexOf('=') + 1);
}

beforeAll(async () => {
  app = await construirApp();

  await prisma.perfis.createMany({
    data: [
      {
        id: gestaoId,
        nome: 'Gestão Paginação',
        email: emailGestao,
        papel: 'gestao',
        status: 'ativo',
        senha_hash: await gerarHashSenha('SenhaAtual1!'),
        acesso_modulos: [],
      },
      {
        id: responsavelId,
        nome: 'Responsável Paginação',
        email: `paginacao.resp.${marcador}@escola.edu.br`,
        papel: 'responsavel',
        status: 'ativo',
        senha_hash: await gerarHashSenha('SenhaAtual1!'),
        acesso_modulos: ['chat'],
      },
    ],
  });

  await prisma.anos_letivos.create({
    data: {
      id: anoId,
      ano: 2096,
      status: 'planejado',
      data_inicio: new Date('2096-02-01'),
      data_fim: new Date('2096-12-20'),
      ativo: false,
    },
  });
  await prisma.turmas.create({
    data: {
      id: turmaId,
      ano_letivo_id: anoId,
      serie: '1ª',
      letra: 'A',
      nome_completo: `1ª A Paginação ${marcador}`,
      ativo: true,
    },
  });
  await prisma.alunos.create({
    data: { id: alunoId, nome: 'Aluno Paginação', matricula: `PAG${marcador}` },
  });
  await prisma.conversas.create({
    data: {
      id: conversaId,
      turma_id: turmaId,
      responsavel_id: responsavelId,
      aluno_id: alunoId,
    },
  });

  // Três mensagens com horários distintos, da mais antiga para a mais recente.
  const agora = Date.now();
  const mensagens = await Promise.all(
    [1, 2, 3].map((numero) =>
      prisma.mensagens.create({
        data: {
          conversa_id: conversaId,
          remetente_id: gestaoId,
          conteudo: `Mensagem ${numero}`,
          created_at: new Date(agora - (4 - numero) * 60_000),
        },
      }),
    ),
  );
  mensagemMaisAntigaId = mensagens[0]!.id;

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: emailGestao, senha: 'SenhaAtual1!' },
  });
  expect(login.statusCode).toBe(200);
  cookie = extrairCookie(login.headers['set-cookie']);
});

afterAll(async () => {
  await prisma.mensagens.deleteMany({ where: { conversa_id: conversaId } });
  await prisma.conversas.deleteMany({ where: { id: conversaId } });
  await prisma.alunos.deleteMany({ where: { id: alunoId } });
  await prisma.turmas.deleteMany({ where: { id: turmaId } });
  await prisma.anos_letivos.deleteMany({ where: { id: anoId } });
  await prisma.auditoria.deleteMany({ where: { usuario_id: { in: [gestaoId, responsavelId] } } });
  await prisma.sessoes.deleteMany({ where: { perfil_id: { in: [gestaoId, responsavelId] } } });
  await prisma.$executeRawUnsafe('delete from public.rate_limit_contadores');
  await prisma.perfis.deleteMany({ where: { id: { in: [gestaoId, responsavelId] } } });
  await app.close();
  await prisma.$disconnect();
});

describe('paginação das listagens', () => {
  it('limita o número de itens devolvidos', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/alunos?limite=1',
      cookies: { buscapp_sessao: cookie },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().alunos).toHaveLength(1);
  });

  it('rejeita limite fora da faixa permitida', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/alunos?limite=0',
      cookies: { buscapp_sessao: cookie },
    });

    expect(resposta.statusCode).toBe(400);
  });

  it('devolve lista vazia quando o offset passa do fim', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/alunos?limite=10&offset=99999',
      cookies: { buscapp_sessao: cookie },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().alunos).toEqual([]);
  });

  it('pagina as mensagens do chat por cursor', async () => {
    const recentes = await app.inject({
      method: 'GET',
      url: `/api/conversas/${conversaId}/mensagens?limite=2`,
      cookies: { buscapp_sessao: cookie },
    });

    expect(recentes.statusCode).toBe(200);
    const mensagensRecentes = recentes.json().mensagens as Array<{ id: string; conteudo: string }>;
    expect(mensagensRecentes).toHaveLength(2);
    expect(mensagensRecentes.map((mensagem) => mensagem.conteudo)).toEqual([
      'Mensagem 2',
      'Mensagem 3',
    ]);

    // O cursor é a mensagem mais antiga da página atual; o retorno traz as anteriores a ela.
    const cursor = mensagensRecentes[0]!.id;
    const anteriores = await app.inject({
      method: 'GET',
      url: `/api/conversas/${conversaId}/mensagens?limite=2&cursor=${cursor}`,
      cookies: { buscapp_sessao: cookie },
    });

    expect(anteriores.statusCode).toBe(200);
    expect(
      anteriores.json().mensagens.map((mensagem: { conteudo: string }) => mensagem.conteudo),
    ).toEqual(['Mensagem 1']);

    expect(mensagemMaisAntigaId).toBeTruthy();
  });
});
