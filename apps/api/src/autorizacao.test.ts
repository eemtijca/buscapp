import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from './aplicacao.js';
import { criarSessao } from './nucleo/autenticacao/sessoes.js';
import { gerarHashSenha } from './nucleo/autenticacao/senhas.js';
import { prismaAdmin as prisma } from './nucleo/banco/cliente.js';

/**
 * Matriz de autorização: cobre papel, módulo, escopo e status da conta.
 * Serve de rede de segurança para rotas novas que nasçam sem preHandler.
 */

const marcador = Date.now();
const ids = {
  gestao: randomUUID(),
  profCom: randomUUID(),
  profSem: randomUUID(),
  responsavel: randomUUID(),
  pendente: randomUUID(),
  inativo: randomUUID(),
  alunoTurma: randomUUID(),
  alunoFora: randomUUID(),
  ano: randomUUID(),
  turma: randomUUID(),
};

const emails = {
  gestao: `matriz.gestao.${marcador}@escola.edu.br`,
  profCom: `matriz.profcom.${marcador}@escola.edu.br`,
  profSem: `matriz.profsem.${marcador}@escola.edu.br`,
  responsavel: `matriz.resp.${marcador}@escola.edu.br`,
};

let app: FastifyInstance;
const cookies: Record<string, Record<string, string>> = {};

function extrairCookie(cabecalho: string | string[] | undefined): string {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const par = (valor ?? '').split(';')[0] ?? '';
  return par.slice(par.indexOf('=') + 1);
}

async function entrar(email: string): Promise<Record<string, string>> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha: 'SenhaAtual1!' },
  });
  expect(resposta.statusCode).toBe(200);
  return { buscapp_sessao: extrairCookie(resposta.headers['set-cookie']) };
}

beforeAll(async () => {
  app = await construirApp();
  const senha = await gerarHashSenha('SenhaAtual1!');

  await prisma.perfis.createMany({
    data: [
      {
        id: ids.gestao,
        nome: 'Matriz Gestão',
        email: emails.gestao,
        papel: 'gestao',
        status: 'ativo',
        senha_hash: senha,
        acesso_modulos: [],
      },
      {
        id: ids.profCom,
        nome: 'Matriz Professor Com Módulo',
        email: emails.profCom,
        papel: 'professor',
        status: 'ativo',
        senha_hash: senha,
        acesso_modulos: ['frequencia', 'ocorrencias'],
      },
      {
        id: ids.profSem,
        nome: 'Matriz Professor Sem Módulo',
        email: emails.profSem,
        papel: 'professor',
        status: 'ativo',
        senha_hash: senha,
        acesso_modulos: [],
      },
      {
        id: ids.responsavel,
        nome: 'Matriz Responsável',
        email: emails.responsavel,
        papel: 'responsavel',
        status: 'ativo',
        senha_hash: senha,
        acesso_modulos: ['alertas', 'justificativa', 'termometro', 'chat'],
      },
      {
        id: ids.pendente,
        nome: 'Matriz Pendente',
        email: `matriz.pendente.${marcador}@escola.edu.br`,
        papel: 'responsavel',
        status: 'pendente',
        senha_hash: senha,
        acesso_modulos: [],
      },
      {
        id: ids.inativo,
        nome: 'Matriz Inativo',
        email: `matriz.inativo.${marcador}@escola.edu.br`,
        papel: 'professor',
        status: 'inativo',
        senha_hash: senha,
        acesso_modulos: [],
      },
    ],
  });

  await prisma.anos_letivos.create({
    data: {
      id: ids.ano,
      ano: 2095,
      status: 'planejado',
      data_inicio: new Date('2095-02-01'),
      data_fim: new Date('2095-12-20'),
      ativo: false,
    },
  });
  await prisma.turmas.create({
    data: {
      id: ids.turma,
      ano_letivo_id: ids.ano,
      serie: '1ª',
      letra: 'A',
      nome_completo: `1ª A Matriz ${marcador}`,
      ativo: true,
    },
  });
  await prisma.alunos.createMany({
    data: [
      { id: ids.alunoTurma, nome: 'Aluno Da Turma', matricula: `MTZ${marcador}A` },
      { id: ids.alunoFora, nome: 'Aluno Fora', matricula: `MTZ${marcador}B` },
    ],
  });
  await prisma.enturmacoes.create({
    data: {
      aluno_id: ids.alunoTurma,
      turma_id: ids.turma,
      ano_letivo_id: ids.ano,
      status: 'matriculado',
    },
  });
  await prisma.atribuicoes_professores.create({
    data: { professor_id: ids.profCom, turma_id: ids.turma, papel: 'titular', ativo: true },
  });
  await prisma.vinculos_responsaveis.create({
    data: { responsavel_id: ids.responsavel, aluno_id: ids.alunoTurma, tipo_relacao: 'mae' },
  });

  cookies.gestao = await entrar(emails.gestao);
  cookies.profCom = await entrar(emails.profCom);
  cookies.profSem = await entrar(emails.profSem);
  cookies.responsavel = await entrar(emails.responsavel);
  cookies.pendente = { buscapp_sessao: (await criarSessao(ids.pendente, { lembrar: false })).token };
  cookies.inativo = { buscapp_sessao: (await criarSessao(ids.inativo, { lembrar: false })).token };
});

afterAll(async () => {
  await prisma.vinculos_responsaveis.deleteMany({ where: { aluno_id: { in: [ids.alunoTurma, ids.alunoFora] } } });
  await prisma.atribuicoes_professores.deleteMany({ where: { turma_id: ids.turma } });
  await prisma.enturmacoes.deleteMany({ where: { aluno_id: { in: [ids.alunoTurma, ids.alunoFora] } } });
  await prisma.alunos.deleteMany({ where: { id: { in: [ids.alunoTurma, ids.alunoFora] } } });
  await prisma.turmas.deleteMany({ where: { id: ids.turma } });
  await prisma.anos_letivos.deleteMany({ where: { id: ids.ano } });
  await prisma.auditoria.deleteMany({
    where: {
      OR: [
        { usuario_id: { in: Object.values(ids) } },
        { entidade_id: { in: Object.values(ids) } },
      ],
    },
  });
  await prisma.sessoes.deleteMany({ where: { perfil_id: { in: Object.values(ids) } } });
  await prisma.$executeRawUnsafe('delete from public.rate_limit_contadores');
  await prisma.perfis.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await app.close();
  await prisma.$disconnect();
});

interface CasoMatriz {
  nome: string;
  url: string;
  /** Chave do cookie resolvida em tempo de execução (o login acontece no beforeAll). */
  como?: keyof typeof cookies;
  esperado: number;
}

const casos: CasoMatriz[] = [
  // Público
  { nome: 'saúde é pública', url: '/api/saude', esperado: 200 },
  { nome: 'sonda de sessão responde 200 anônima', url: '/api/auth/me', esperado: 200 },
  // Sem sessão
  { nome: 'alunos exige sessão', url: '/api/alunos', esperado: 401 },
  { nome: 'usuários exige sessão', url: '/api/usuarios', esperado: 401 },
  { nome: 'eventos exige sessão', url: '/api/eventos', esperado: 401 },
  // Papel
  { nome: 'gestão lista usuários', url: '/api/usuarios', como: 'gestao', esperado: 200 },
  { nome: 'responsável não lista usuários', url: '/api/usuarios', como: 'responsavel', esperado: 403 },
  { nome: 'professor não lista usuários', url: '/api/usuarios', como: 'profCom', esperado: 403 },
  // Módulo (fail-closed)
  { nome: 'professor com módulo lê ocorrências', url: '/api/ocorrencias', como: 'profCom', esperado: 200 },
  { nome: 'professor sem módulo não lê ocorrências', url: '/api/ocorrencias', como: 'profSem', esperado: 403 },
  // Escopo
  {
    nome: 'professor lê aluno da própria turma',
    url: `/api/alunos/${ids.alunoTurma}`,
    como: 'profCom',
    esperado: 200,
  },
  {
    nome: 'professor não vê aluno fora da turma (404)',
    url: `/api/alunos/${ids.alunoFora}`,
    como: 'profCom',
    esperado: 404,
  },
  {
    nome: 'responsável vê o próprio dependente',
    url: `/api/alunos/${ids.alunoTurma}`,
    como: 'responsavel',
    esperado: 200,
  },
  {
    nome: 'responsável não vê aluno sem vínculo (404)',
    url: `/api/alunos/${ids.alunoFora}`,
    como: 'responsavel',
    esperado: 404,
  },
  // Status da conta
  { nome: 'conta pendente é recusada', url: '/api/alunos', como: 'pendente', esperado: 403 },
  { nome: 'conta inativa é recusada', url: '/api/alunos', como: 'inativo', esperado: 403 },
  // Módulo do responsável
  { nome: 'responsável com alertas lê ocorrências', url: '/api/ocorrencias', como: 'responsavel', esperado: 200 },
];

describe('matriz de autorização', () => {
  for (const caso of casos) {
    it(caso.nome, async () => {
      const resposta = await app.inject({
        method: 'GET',
        url: caso.url,
        ...(caso.como ? { cookies: cookies[caso.como] } : {}),
      });

      expect(resposta.statusCode).toBe(caso.esperado);
    });
  }

  it('sonda de sessão devolve perfil nulo para cookie inválido', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { buscapp_sessao: 'token-invalido' },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().perfil).toBeNull();
  });
});
