import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../aplicacao.js';
import { prismaAdmin as prisma } from '../../nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';

const marcador = Date.now();

const gestaoId = randomUUID();
const professorId = randomUUID();

const emails = {
  gestao: `gestao.config.${marcador}@escola.edu.br`,
  professor: `prof.config.${marcador}@escola.edu.br`,
};

let app: FastifyInstance;
let anoPrivadoId: string;
let cookieGestao: string;
let cookieProfessor: string;
let configuracaoInicial: Awaited<ReturnType<typeof prisma.configuracoes_sistema.findUniqueOrThrow>>;
let configuracaoExistiaOriginalmente = true;

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

async function criarPerfil(
  id: string,
  email: string,
  papel: 'gestao' | 'professor' | 'responsavel',
) {
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

/** Cria um ano letivo exclusivo da suíte para isolar as turmas do seed canônico. */
async function criarAnoLetivoPrivado(): Promise<string> {
  const existentes = await prisma.anos_letivos.findMany({ select: { ano: true } });
  const usados = new Set(existentes.map((registro) => registro.ano));
  let ano = 2100;
  while (usados.has(ano)) ano -= 1;
  if (ano < 2000) throw new Error('Não há ano letivo disponível para os testes.');

  const criado = await prisma.anos_letivos.create({
    data: {
      ano,
      status: 'planejado',
      data_inicio: new Date(`${ano}-02-01`),
      data_fim: new Date(`${ano}-12-20`),
      ativo: false,
    },
  });
  return criado.id;
}

beforeAll(async () => {
  app = await construirApp();
  anoPrivadoId = await criarAnoLetivoPrivado();

  await criarPerfil(gestaoId, emails.gestao, 'gestao');
  await criarPerfil(professorId, emails.professor, 'professor');

  // Guarda o estado original para restauração integral ao final da suíte.
  const existente = await prisma.configuracoes_sistema.findUnique({ where: { id: 1 } });
  if (existente) {
    configuracaoInicial = existente;
  } else {
    configuracaoExistiaOriginalmente = false;
    configuracaoInicial = await prisma.configuracoes_sistema.create({ data: { id: 1 } });
  }

  cookieGestao = await login(emails.gestao);
  cookieProfessor = await login(emails.professor);
});

afterAll(async () => {
  // Restaura a configuração original (ou remove a linha criada pela suíte).
  if (configuracaoExistiaOriginalmente) {
    await prisma.configuracoes_sistema.update({
      where: { id: 1 },
      data: { ...configuracaoInicial },
    });
  } else {
    await prisma.configuracoes_sistema.deleteMany({ where: { id: 1 } });
  }

  await prisma.opcoes_configuracao.deleteMany({
    where: { chave: { contains: `config_teste_${marcador}` } },
  });
  await prisma.tags_comportamento.deleteMany({
    where: { nome: { contains: `config_teste_tag_${marcador}` } },
  });
  await prisma.horarios_letivos.deleteMany({
    where: { dia_semana: 6, hora_inicio: new Date('1970-01-01T20:30:00.000Z') },
  });
  await prisma.anos_letivos.delete({ where: { id: anoPrivadoId } }).catch(() => {});
  await prisma.sessoes.deleteMany({
    where: { perfil_id: { in: [gestaoId, professorId] } },
  });
  await prisma.perfis.deleteMany({ where: { id: { in: [gestaoId, professorId] } } });
  await app.close();
  await prisma.$disconnect();
});

describe('GET/PUT /api/configuracoes', () => {
  it('gestão lê a configuração completa do sistema', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/configuracoes',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(resposta.statusCode).toBe(200);
    const configuracao = resposta.json().configuracao;
    expect(configuracao).toMatchObject({
      id: 1,
      escola_nome: configuracaoInicial.escola_nome,
      decaimento_ocorrencia_tipo: configuracaoInicial.decaimento_ocorrencia_tipo,
    });
    expect(typeof configuracao.updated_at).toBe('string');
    expect(typeof configuracao.dias_retencao_codigos).toBe('number');
  });

  it('professor lê apenas o subconjunto público', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/configuracoes/publicas',
      cookies: { buscapp_sessao: cookieProfessor },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().configuracao).toMatchObject({ id: 1 });
    expect(resposta.json().configuracao).not.toHaveProperty('dias_retencao_codigos');

    const completa = await app.inject({
      method: 'GET',
      url: '/api/configuracoes',
      cookies: { buscapp_sessao: cookieProfessor },
    });
    expect(completa.statusCode).toBe(403);
  });

  it('anônimo recebe 401', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/configuracoes' });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().erro.codigo).toBe('nao_autenticado');
  });

  it('professor recebe 403 ao tentar atualizar', async () => {
    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/configuracoes',
      cookies: { buscapp_sessao: cookieProfessor },
      payload: { escola_nome: 'Não deveria salvar' },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('nao_autorizado');
  });

  it('gestão atualiza e a alteração persiste', async () => {
    const escolaNome = `Escola Teste ${marcador}`;
    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/configuracoes',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        escola_nome: escolaNome,
        limite_preventivo_faltas: 11,
        limite_critico_faltas: 26,
        peso_falta: 1.5,
        peso_ocorrencia: 1.5,
        janela_recencia_dias: 21,
        limite_score_medio: 45,
        limite_score_alto: 80,
        forcar_medio_em_grave: false,
        decaimento_ocorrencia_tipo: 'exponencial',
        mensagem_fora_horario: 'Mensagem de teste do horário.',
      },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().configuracao).toMatchObject({
      escola_nome: escolaNome,
      limite_preventivo_faltas: 11,
      limite_critico_faltas: 26,
      peso_falta: 1.5,
      janela_recencia_dias: 21,
      limite_score_medio: 45,
      limite_score_alto: 80,
      forcar_medio_em_grave: false,
      decaimento_ocorrencia_tipo: 'exponencial',
      mensagem_fora_horario: 'Mensagem de teste do horário.',
    });

    const consulta = await app.inject({
      method: 'GET',
      url: '/api/configuracoes',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(consulta.json().configuracao).toMatchObject({
      escola_nome: escolaNome,
      peso_falta: 1.5,
      decaimento_ocorrencia_tipo: 'exponencial',
    });
  });

  it('rejeita decaimento inválido com 400', async () => {
    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/configuracoes',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { decaimento_ocorrencia_tipo: 'invalido' },
    });
    expect(resposta.statusCode).toBe(400);
  });
});

describe('catálogo de opções', () => {
  it('professor não pode escrever no catálogo', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/opcoes',
      cookies: { buscapp_sessao: cookieProfessor },
      payload: {
        tipo: 'periodo',
        chave: `config_teste_bloqueada_${marcador}`,
        rotulo: 'Bloqueada',
      },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('gestão cria, edita, reordena e exclui opções; chave duplicada recebe 409', async () => {
    const chaveA = `config_teste_periodo_a_${marcador}`;
    const chaveB = `config_teste_periodo_b_${marcador}`;

    const criadaA = await app.inject({
      method: 'POST',
      url: '/api/opcoes',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { tipo: 'periodo', chave: chaveA, rotulo: 'Período Teste A', ordem: 90 },
    });
    expect(criadaA.statusCode).toBe(201);
    const opcaoA = criadaA.json().opcao;
    expect(opcaoA).toMatchObject({ tipo: 'periodo', chave: chaveA, ativo: true });

    const criadaB = await app.inject({
      method: 'POST',
      url: '/api/opcoes',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { tipo: 'periodo', chave: chaveB, rotulo: 'Período Teste B', ordem: 91 },
    });
    expect(criadaB.statusCode).toBe(201);
    const opcaoB = criadaB.json().opcao;

    const duplicada = await app.inject({
      method: 'POST',
      url: '/api/opcoes',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { tipo: 'periodo', chave: chaveA, rotulo: 'Duplicada' },
    });
    expect(duplicada.statusCode).toBe(409);
    expect(duplicada.json().erro.codigo).toBe('chave_duplicada');

    const editada = await app.inject({
      method: 'PUT',
      url: `/api/opcoes/${opcaoA.id}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { rotulo: 'Período Teste A Editado', ativo: false },
    });
    expect(editada.statusCode).toBe(200);
    expect(editada.json().opcao).toMatchObject({
      rotulo: 'Período Teste A Editado',
      ativo: false,
    });

    const reordenada = await app.inject({
      method: 'PATCH',
      url: '/api/opcoes/reordenar',
      cookies: { buscapp_sessao: cookieGestao },
      payload: {
        itens: [
          { id: opcaoB.id, ordem: 93 },
          { id: opcaoA.id, ordem: 94 },
        ],
      },
    });
    expect(reordenada.statusCode).toBe(200);

    const listagem = await app.inject({
      method: 'GET',
      url: `/api/opcoes?tipo=periodo`,
      cookies: { buscapp_sessao: cookieProfessor },
    });
    expect(listagem.statusCode).toBe(200);
    const ordemA = listagem
      .json()
      .opcoes.filter((o: { id: string }) => [opcaoA.id, opcaoB.id].includes(o.id))
      .map((o: { id: string; ordem: number }) => ({ id: o.id, ordem: o.ordem }));
    expect(ordemA).toEqual([
      { id: opcaoB.id, ordem: 93 },
      { id: opcaoA.id, ordem: 94 },
    ]);

    const exclusaoB = await app.inject({
      method: 'DELETE',
      url: `/api/opcoes/${opcaoB.id}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(exclusaoB.statusCode).toBe(204);

    const exclusaoA = await app.inject({
      method: 'DELETE',
      url: `/api/opcoes/${opcaoA.id}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(exclusaoA.statusCode).toBe(204);
  });

  it('bloqueia exclusão de opção referenciada com 409 opcao_em_uso', async () => {
    const chave = `config_teste_doc_${marcador}`;
    const criada = await app.inject({
      method: 'POST',
      url: '/api/opcoes',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { tipo: 'documento', chave, rotulo: 'Documento Teste' },
    });
    expect(criada.statusCode).toBe(201);
    const opcao = criada.json().opcao;

    const aluno = await prisma.alunos.create({
      data: {
        nome: 'Aluno Catálogo Teste',
        matricula: `CONFIGDOC-${marcador}`,
        documentos_recebidos: [chave],
      },
    });

    try {
      const bloqueada = await app.inject({
        method: 'DELETE',
        url: `/api/opcoes/${opcao.id}`,
        cookies: { buscapp_sessao: cookieGestao },
      });
      expect(bloqueada.statusCode).toBe(409);
      expect(bloqueada.json().erro.codigo).toBe('opcao_em_uso');
    } finally {
      await prisma.alunos.delete({ where: { id: aluno.id } });
    }

    const liberada = await app.inject({
      method: 'DELETE',
      url: `/api/opcoes/${opcao.id}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(liberada.statusCode).toBe(204);
  });
});

describe('horários letivos', () => {
  it('gestão cria, valida intervalo, alterna status e exclui', async () => {
    const criado = await app.inject({
      method: 'POST',
      url: '/api/horarios',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { dia_semana: 6, hora_inicio: '20:30', hora_fim: '21:30' },
    });
    expect(criado.statusCode).toBe(201);
    const horario = criado.json().horario;
    expect(horario).toMatchObject({ dia_semana: 6, hora_inicio: '20:30:00', hora_fim: '21:30:00' });

    const invalido = await app.inject({
      method: 'POST',
      url: '/api/horarios',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { dia_semana: 6, hora_inicio: '22:00', hora_fim: '21:00' },
    });
    expect(invalido.statusCode).toBe(400);
    expect(invalido.json().erro.codigo).toBe('horario_invalido');

    const diaInvalido = await app.inject({
      method: 'POST',
      url: '/api/horarios',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { dia_semana: 7, hora_inicio: '08:00', hora_fim: '09:00' },
    });
    expect(diaInvalido.statusCode).toBe(400);

    const status = await app.inject({
      method: 'PATCH',
      url: `/api/horarios/${horario.id}/status`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { ativo: false },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().horario.ativo).toBe(false);

    const editado = await app.inject({
      method: 'PUT',
      url: `/api/horarios/${horario.id}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { hora_fim: '21:00' },
    });
    expect(editado.statusCode).toBe(200);
    expect(editado.json().horario.hora_fim).toBe('21:00:00');

    const semSentido = await app.inject({
      method: 'PUT',
      url: `/api/horarios/${horario.id}`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { hora_fim: '20:00' },
    });
    expect(semSentido.statusCode).toBe(400);
    expect(semSentido.json().erro.codigo).toBe('horario_invalido');

    const excluido = await app.inject({
      method: 'DELETE',
      url: `/api/horarios/${horario.id}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(excluido.statusCode).toBe(204);
  });

  it('professor não pode criar horário', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/horarios',
      cookies: { buscapp_sessao: cookieProfessor },
      payload: { dia_semana: 6, hora_inicio: '10:00', hora_fim: '11:00' },
    });
    expect(resposta.statusCode).toBe(403);
  });
});

describe('tags de comportamento', () => {
  it('gestão cria tag e recebe 409 em nome duplicado', async () => {
    const nome = `config_teste_tag_${marcador}`;
    const criada = await app.inject({
      method: 'POST',
      url: '/api/tags-comportamento',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome, categoria: 'atencao', peso_pontuacao: 3, icone: 'emoji-frown' },
    });
    expect(criada.statusCode).toBe(201);
    const tag = criada.json().tag;
    expect(tag).toMatchObject({ nome, categoria: 'atencao', peso_pontuacao: 3 });

    const duplicada = await app.inject({
      method: 'POST',
      url: '/api/tags-comportamento',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome, categoria: 'critico' },
    });
    expect(duplicada.statusCode).toBe(409);
    expect(duplicada.json().erro.codigo).toBe('nome_duplicado');

    const status = await app.inject({
      method: 'PATCH',
      url: `/api/tags-comportamento/${tag.id}/status`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { ativo: false },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().tag.ativo).toBe(false);

    await prisma.tags_comportamento.delete({ where: { id: tag.id } });
  });

  it('bloqueia renomear e excluir tag referenciada com 409 tag_em_uso', async () => {
    const nome = `config_teste_tag_${marcador}_uso`;
    const criada = await app.inject({
      method: 'POST',
      url: '/api/tags-comportamento',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { nome, categoria: 'critico', peso_pontuacao: 8 },
    });
    expect(criada.statusCode).toBe(201);
    const tag = criada.json().tag;

    const aluno = await prisma.alunos.create({
      data: { nome: 'Aluno Tag Teste', matricula: `CONFIGTAG-${marcador}` },
    });
    const turma = await prisma.turmas.create({
      data: {
        ano_letivo_id: anoPrivadoId,
        serie: '1ª',
        letra: 'A',
        nome_completo: `Turma Tag ${marcador}`,
        ativo: true,
      },
    });
    const ocorrencia = await prisma.ocorrencias.create({
      data: {
        aluno_id: aluno.id,
        turma_id: turma.id,
        ano_letivo_id: anoPrivadoId,
        titulo: `Ocorrência tag ${marcador}`,
        descricao: 'Ocorrência criada para referenciar a tag de teste.',
        tipo: [],
        tags_comportamento: [nome],
      },
    });

    try {
      const renomeada = await app.inject({
        method: 'PUT',
        url: `/api/tags-comportamento/${tag.id}`,
        cookies: { buscapp_sessao: cookieGestao },
        payload: { nome: `${nome}_renomeada` },
      });
      expect(renomeada.statusCode).toBe(409);
      expect(renomeada.json().erro.codigo).toBe('tag_em_uso');

      const excluida = await app.inject({
        method: 'DELETE',
        url: `/api/tags-comportamento/${tag.id}`,
        cookies: { buscapp_sessao: cookieGestao },
      });
      expect(excluida.statusCode).toBe(409);
      expect(excluida.json().erro.codigo).toBe('tag_em_uso');
    } finally {
      await prisma.ocorrencias.delete({ where: { id: ocorrencia.id } });
      await prisma.turmas.delete({ where: { id: turma.id } });
      await prisma.alunos.delete({ where: { id: aluno.id } });
    }

    const liberada = await app.inject({
      method: 'DELETE',
      url: `/api/tags-comportamento/${tag.id}`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(liberada.statusCode).toBe(204);
  });

  it('professor recebe 403 ao criar tag', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/tags-comportamento',
      cookies: { buscapp_sessao: cookieProfessor },
      payload: { nome: `config_teste_tag_prof_${marcador}`, categoria: 'positivo' },
    });
    expect(resposta.statusCode).toBe(403);
  });
});
