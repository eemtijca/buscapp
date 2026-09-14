import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { prismaAdmin as prisma } from '../../nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';

const marcador = Date.now();

const gestaoId = randomUUID();
const professorId = randomUUID();

const emails = {
  gestao: `gestao.notificacoes.${marcador}@escola.edu.br`,
  professor: `prof.notificacoes.${marcador}@escola.edu.br`,
};

let app: FastifyInstance;
let cookieGestao: string;

function extrairCookie(cabecalho: string | string[] | undefined): string {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const par = (valor ?? '').split(';')[0] ?? '';
  return par.slice(par.indexOf('=') + 1);
}

async function login(email: string): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha: 'SenhaAtual1!' },
  });
  expect(resposta.statusCode).toBe(200);
  return extrairCookie(resposta.headers['set-cookie']);
}

async function criarPerfil(id: string, email: string, papel: 'gestao' | 'professor') {
  await prisma.perfis.create({
    data: {
      id,
      nome: `Perfil ${papel} ${id.slice(0, 4)}`,
      email,
      papel,
      status: 'ativo',
      senha_hash: await gerarHashSenha('SenhaAtual1!'),
      acesso_modulos: [],
    },
  });
}

interface DadosNotificacao {
  tipo?:
    | 'ausencia_portao'
    | 'ausencia_aula'
    | 'monitoramento'
    | 'ocorrencia'
    | 'justificativa'
    | 'mensagem'
    | 'sistema'
    | 'codigo_redefinicao';
  titulo?: string;
  corpo?: string | null;
  metadados?: Record<string, string>;
  lida?: boolean;
  criadaEm?: Date;
}

async function criarNotificacao(destinatarioId: string, dados: DadosNotificacao = {}) {
  return prisma.notificacoes.create({
    data: {
      destinatario_id: destinatarioId,
      tipo: dados.tipo ?? 'sistema',
      titulo: dados.titulo ?? 'Notificação de teste',
      corpo: dados.corpo ?? null,
      ...(dados.metadados ? { metadados: dados.metadados } : {}),
      lida: dados.lida ?? false,
      lida_em: dados.lida ? new Date() : null,
      ...(dados.criadaEm ? { created_at: dados.criadaEm } : {}),
    },
  });
}

async function limparNotificacoes() {
  await prisma.notificacoes.deleteMany({
    where: { destinatario_id: { in: [gestaoId, professorId] } },
  });
}

beforeAll(async () => {
  app = await construirApp();

  await criarPerfil(gestaoId, emails.gestao, 'gestao');
  await criarPerfil(professorId, emails.professor, 'professor');

  cookieGestao = await login(emails.gestao);
});

beforeEach(async () => {
  await limparNotificacoes();
});

afterAll(async () => {
  await prisma.notificacoes.deleteMany({
    where: { destinatario_id: { in: [gestaoId, professorId] } },
  });
  await prisma.sessoes.deleteMany({
    where: { perfil_id: { in: [gestaoId, professorId] } },
  });
  await prisma.perfis.deleteMany({ where: { id: { in: [gestaoId, professorId] } } });
  await app.close();
  await prisma.$disconnect();
});

describe('GET /api/notificacoes', () => {
  it('lista apenas as próprias notificações com a contagem de não lidas correta', async () => {
    const prima = await criarNotificacao(gestaoId, { titulo: 'Primeira' });
    const segunda = await criarNotificacao(gestaoId, { titulo: 'Segunda' });
    const lida = await criarNotificacao(gestaoId, { titulo: 'Já lida', lida: true });
    await criarNotificacao(professorId, { titulo: 'Do professor' });

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/notificacoes',
      cookies: { buscapp_sessao: cookieGestao },
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    const ids = corpo.notificacoes.map((notificacao: { id: string }) => notificacao.id);
    expect(ids).toEqual(expect.arrayContaining([prima.id, segunda.id, lida.id]));
    expect(ids).toHaveLength(3);
    expect(
      corpo.notificacoes.every(
        (notificacao: { destinatario_id: string }) => notificacao.destinatario_id === gestaoId,
      ),
    ).toBe(true);
    expect(corpo.nao_lidas).toBe(2);
  });

  it('respeita o limite e ordena por created_at desc', async () => {
    const base = Date.now();
    await criarNotificacao(gestaoId, {
      titulo: 'Mais antiga',
      criadaEm: new Date(base - 2000),
    });
    await criarNotificacao(gestaoId, {
      titulo: 'Intermediária',
      criadaEm: new Date(base - 1000),
    });
    await criarNotificacao(gestaoId, { titulo: 'Mais recente', criadaEm: new Date(base) });

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/notificacoes?limite=2',
      cookies: { buscapp_sessao: cookieGestao },
    });

    expect(resposta.statusCode).toBe(200);
    const titulos = resposta
      .json()
      .notificacoes.map((notificacao: { titulo: string }) => notificacao.titulo);
    expect(titulos).toEqual(['Mais recente', 'Intermediária']);
  });

  it('filtra pelo status de leitura', async () => {
    await criarNotificacao(gestaoId, { titulo: 'Pendente' });
    await criarNotificacao(gestaoId, { titulo: 'Concluída', lida: true });

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/notificacoes?lida=false',
      cookies: { buscapp_sessao: cookieGestao },
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.notificacoes).toHaveLength(1);
    expect(corpo.notificacoes[0]).toMatchObject({ titulo: 'Pendente', lida: false });
  });

  it('anônimo recebe 401 no envelope', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/notificacoes' });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().erro.codigo).toBe('nao_autenticado');
  });
});

describe('PATCH /api/notificacoes/:id/lida', () => {
  it('marca a própria notificação como lida sem afetar a de outro usuário', async () => {
    const propria = await criarNotificacao(gestaoId, { titulo: 'Própria' });
    const alheia = await criarNotificacao(professorId, { titulo: 'Alheia' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/notificacoes/${propria.id}/lida`,
      cookies: { buscapp_sessao: cookieGestao },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().notificacao).toMatchObject({ id: propria.id, lida: true });
    expect(resposta.json().notificacao.lida_em).not.toBeNull();

    const propriaNoBanco = await prisma.notificacoes.findUnique({ where: { id: propria.id } });
    const alheiaNoBanco = await prisma.notificacoes.findUnique({ where: { id: alheia.id } });
    expect(propriaNoBanco?.lida).toBe(true);
    expect(propriaNoBanco?.lida_em).not.toBeNull();
    expect(alheiaNoBanco?.lida).toBe(false);
  });

  it('responde 404 ao tentar marcar notificação de outro usuário', async () => {
    const alheia = await criarNotificacao(professorId, { titulo: 'Alheia' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/notificacoes/${alheia.id}/lida`,
      cookies: { buscapp_sessao: cookieGestao },
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json().erro.codigo).toBe('nao_encontrado');

    const alheiaNoBanco = await prisma.notificacoes.findUnique({ where: { id: alheia.id } });
    expect(alheiaNoBanco?.lida).toBe(false);
  });

  it('anônimo recebe 401', async () => {
    const propria = await criarNotificacao(gestaoId);
    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/notificacoes/${propria.id}/lida`,
    });
    expect(resposta.statusCode).toBe(401);
  });
});

describe('PATCH /api/notificacoes/lidas', () => {
  it('marca todas as não lidas do usuário e ignora as dos outros', async () => {
    await criarNotificacao(gestaoId, { titulo: 'Uma' });
    await criarNotificacao(gestaoId, { titulo: 'Duas' });
    await criarNotificacao(gestaoId, { titulo: 'Já lida', lida: true });
    const alheia = await criarNotificacao(professorId, { titulo: 'Do professor' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/api/notificacoes/lidas',
      cookies: { buscapp_sessao: cookieGestao },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ atualizadas: 2 });

    const naoLidasGestao = await prisma.notificacoes.count({
      where: { destinatario_id: gestaoId, lida: false },
    });
    const alheiaNoBanco = await prisma.notificacoes.findUnique({ where: { id: alheia.id } });
    expect(naoLidasGestao).toBe(0);
    expect(alheiaNoBanco?.lida).toBe(false);
  });

  it('anônimo recebe 401', async () => {
    const resposta = await app.inject({ method: 'PATCH', url: '/api/notificacoes/lidas' });
    expect(resposta.statusCode).toBe(401);
  });
});

describe('DELETE /api/notificacoes', () => {
  it('remove apenas as notificações do usuário autenticado', async () => {
    await criarNotificacao(gestaoId, { titulo: 'Uma' });
    await criarNotificacao(gestaoId, { titulo: 'Duas' });
    await criarNotificacao(professorId, { titulo: 'Do professor' });

    const resposta = await app.inject({
      method: 'DELETE',
      url: '/api/notificacoes',
      cookies: { buscapp_sessao: cookieGestao },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ removidas: 2 });

    const restantesGestao = await prisma.notificacoes.count({
      where: { destinatario_id: gestaoId },
    });
    const restantesProfessor = await prisma.notificacoes.count({
      where: { destinatario_id: professorId },
    });
    expect(restantesGestao).toBe(0);
    expect(restantesProfessor).toBe(1);
  });

  it('anônimo recebe 401', async () => {
    const resposta = await app.inject({ method: 'DELETE', url: '/api/notificacoes' });
    expect(resposta.statusCode).toBe(401);
  });
});

describe('PATCH /api/notificacoes/conversa/:conversaId/lidas', () => {
  it('marca apenas as mensagens não lidas da conversa do usuário', async () => {
    const conversaA = randomUUID();
    const conversaB = randomUUID();

    const mensagemA = await criarNotificacao(gestaoId, {
      tipo: 'mensagem',
      titulo: 'Conversa A',
      metadados: { conversa_id: conversaA },
    });
    await criarNotificacao(gestaoId, {
      tipo: 'mensagem',
      titulo: 'Conversa A já lida',
      metadados: { conversa_id: conversaA },
      lida: true,
    });
    const mensagemB = await criarNotificacao(gestaoId, {
      tipo: 'mensagem',
      titulo: 'Conversa B',
      metadados: { conversa_id: conversaB },
    });
    const sistema = await criarNotificacao(gestaoId, { titulo: 'Sistema' });
    const alheia = await criarNotificacao(professorId, {
      tipo: 'mensagem',
      titulo: 'Conversa A do professor',
      metadados: { conversa_id: conversaA },
    });

    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/notificacoes/conversa/${conversaA}/lidas`,
      cookies: { buscapp_sessao: cookieGestao },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ atualizadas: 1 });

    const mensagemApos = await prisma.notificacoes.findUnique({ where: { id: mensagemA.id } });
    const mensagemBApos = await prisma.notificacoes.findUnique({ where: { id: mensagemB.id } });
    const sistemaApos = await prisma.notificacoes.findUnique({ where: { id: sistema.id } });
    const alheiaApos = await prisma.notificacoes.findUnique({ where: { id: alheia.id } });
    expect(mensagemApos?.lida).toBe(true);
    expect(mensagemBApos?.lida).toBe(false);
    expect(sistemaApos?.lida).toBe(false);
    expect(alheiaApos?.lida).toBe(false);
  });

  it('anônimo recebe 401', async () => {
    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/notificacoes/conversa/${randomUUID()}/lidas`,
    });
    expect(resposta.statusCode).toBe(401);
  });
});
