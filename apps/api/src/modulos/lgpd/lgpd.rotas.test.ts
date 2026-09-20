import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../aplicacao.js';
import { armazenamento } from '../../nucleo/armazenamento/index.js';
import { prismaAdmin as prisma } from '../../nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';

const marcador = Date.now();
const gestaoId = randomUUID();
const professorId = randomUUID();
const alunoId = randomUUID();
const anoId = randomUUID();
const turmaId = randomUUID();
const justificativaId = randomUUID();
const anexoId = randomUUID();
const chaveAnexo = `${gestaoId}/${randomUUID()}-comprovante.pdf`;

let app: FastifyInstance;
let cookieGestao: string;
let cookieProfessor: string;

function extrairCookie(cabecalho: string | string[] | undefined): string {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const par = (valor ?? '').split(';')[0] ?? '';
  return par.slice(par.indexOf('=') + 1);
}

async function entrar(email: string): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha: 'SenhaAtual1!' },
  });
  expect(resposta.statusCode).toBe(200);
  return extrairCookie(resposta.headers['set-cookie']);
}

beforeAll(async () => {
  app = await construirApp();

  await prisma.perfis.createMany({
    data: [
      {
        id: gestaoId,
        nome: 'Gestão LGPD',
        email: `lgpd.gestao.${marcador}@escola.edu.br`,
        papel: 'gestao',
        status: 'ativo',
        senha_hash: await gerarHashSenha('SenhaAtual1!'),
        acesso_modulos: [],
      },
      {
        id: professorId,
        nome: 'Professor LGPD',
        email: `lgpd.prof.${marcador}@escola.edu.br`,
        papel: 'professor',
        status: 'ativo',
        senha_hash: await gerarHashSenha('SenhaAtual1!'),
        acesso_modulos: [],
      },
    ],
  });

  await prisma.anos_letivos.create({
    data: {
      id: anoId,
      ano: 2099,
      status: 'planejado',
      data_inicio: new Date('2099-02-01'),
      data_fim: new Date('2099-12-20'),
      ativo: false,
    },
  });
  await prisma.turmas.create({
    data: {
      id: turmaId,
      ano_letivo_id: anoId,
      serie: '1ª',
      letra: 'A',
      nome_completo: `1ª A LGPD ${marcador}`,
      ativo: true,
    },
  });
  await prisma.alunos.create({
    data: {
      id: alunoId,
      nome: 'Aluno Titular',
      matricula: `LGPD${marcador}`,
      observacoes: 'Observação pessoal',
      documentos_recebidos: ['rg'],
    },
  });
  await prisma.enturmacoes.create({
    data: {
      aluno_id: alunoId,
      turma_id: turmaId,
      ano_letivo_id: anoId,
      status: 'matriculado',
    },
  });
  await prisma.frequencias.create({
    data: {
      aluno_id: alunoId,
      professor_id: professorId,
      turma_id: turmaId,
      ano_letivo_id: anoId,
      data_aula: new Date('2099-03-10'),
      periodo: '1º Horário',
      status: 'ausente',
      observacao: 'Ausência registrada',
    },
  });
  await prisma.justificativas_faltas.create({
    data: {
      id: justificativaId,
      responsavel_id: gestaoId,
      aluno_id: alunoId,
      data_falta: new Date('2099-03-10'),
      motivo: 'Consulta médica do aluno',
      status: 'pendente',
    },
  });

  await armazenamento().salvar(chaveAnexo, Buffer.from('%PDF-1.7\nanexo'), 'application/pdf');
  await prisma.anexos.create({
    data: {
      id: anexoId,
      storage_path: chaveAnexo,
      nome_arquivo: 'comprovante.pdf',
      mime_type: 'application/pdf',
      tamanho_bytes: 15,
      criado_por: gestaoId,
    },
  });
  await prisma.justificativa_anexos.create({
    data: { justificativa_id: justificativaId, anexo_id: anexoId },
  });

  cookieGestao = await entrar(`lgpd.gestao.${marcador}@escola.edu.br`);
  cookieProfessor = await entrar(`lgpd.prof.${marcador}@escola.edu.br`);
});

afterAll(async () => {
  await prisma.justificativa_anexos.deleteMany({ where: { justificativa_id: justificativaId } });
  await prisma.anexos.deleteMany({ where: { id: anexoId } });
  await prisma.justificativas_faltas.deleteMany({ where: { aluno_id: alunoId } });
  await prisma.frequencias.deleteMany({ where: { aluno_id: alunoId } });
  await prisma.enturmacoes.deleteMany({ where: { aluno_id: alunoId } });
  await prisma.alunos.deleteMany({ where: { id: alunoId } });
  await prisma.turmas.deleteMany({ where: { id: turmaId } });
  await prisma.anos_letivos.deleteMany({ where: { id: anoId } });
  await prisma.auditoria.deleteMany({
    where: {
      OR: [
        { usuario_id: { in: [gestaoId, professorId] } },
        { entidade_id: { in: [alunoId, gestaoId, professorId] } },
      ],
    },
  });
  await prisma.sessoes.deleteMany({ where: { perfil_id: { in: [gestaoId, professorId] } } });
  await prisma.$executeRawUnsafe('delete from public.rate_limit_contadores');
  await prisma.perfis.deleteMany({ where: { id: { in: [gestaoId, professorId] } } });
  await app.close();
  await prisma.$disconnect();
});

describe('LGPD', () => {
  it('exporta os dados do titular para a gestão', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/lgpd/alunos/${alunoId}/exportar`,
      cookies: { buscapp_sessao: cookieGestao },
    });

    expect(resposta.statusCode).toBe(200);
    const dados = resposta.json();
    expect(dados.aluno).toMatchObject({ id: alunoId, nome: 'Aluno Titular' });
    expect(dados.frequencias).toHaveLength(1);
    expect(dados.justificativas).toHaveLength(1);
    expect(dados.anexos).toHaveLength(1);
  });

  it('nega a exportação para professor', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/lgpd/alunos/${alunoId}/exportar`,
      cookies: { buscapp_sessao: cookieProfessor },
    });

    expect(resposta.statusCode).toBe(403);
  });

  it('anonimiza os dados pessoais e remove os anexos', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: `/api/lgpd/alunos/${alunoId}/anonimizar`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { confirmar: true },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, anexos_removidos: 1 });

    const aluno = await prisma.alunos.findUnique({ where: { id: alunoId } });
    expect(aluno?.nome).toBe('Aluno anonimizado');
    expect(aluno?.observacoes).toBeNull();
    expect(aluno?.documentos_recebidos).toEqual([]);

    const justificativa = await prisma.justificativas_faltas.findUnique({
      where: { id: justificativaId },
    });
    expect(justificativa?.motivo).toBe('[anonimizado]');

    // O histórico de frequência é preservado para estatística.
    const frequencias = await prisma.frequencias.count({ where: { aluno_id: alunoId } });
    expect(frequencias).toBe(1);

    const anexos = await prisma.anexos.count({ where: { id: anexoId } });
    expect(anexos).toBe(0);

    const auditoria = await prisma.auditoria.count({
      where: { acao: 'ANONIMIZAR_ALUNO', entidade_id: alunoId },
    });
    expect(auditoria).toBe(1);
  });

  it('exige confirmação explícita', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: `/api/lgpd/alunos/${alunoId}/anonimizar`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: {},
    });

    expect(resposta.statusCode).toBe(400);
  });
});
