import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { prismaAdmin as prisma } from '../../nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';

const marcador = Date.now();

const gestaoId = randomUUID();
const professorId = randomUUID();
const responsavelId = randomUUID();
const responsavelSemChatId = randomUUID();
const responsavelOutroId = randomUUID();
const turmaId = randomUUID();
const alunoId = randomUUID();
const alunoNovoId = randomUUID();
const alunoGestaoId = randomUUID();

const perfisIds = [gestaoId, professorId, responsavelId, responsavelSemChatId, responsavelOutroId];
const alunosIds = [alunoId, alunoNovoId, alunoGestaoId];

const emails = {
  gestao: `gestao.chat.${marcador}@escola.edu.br`,
  professor: `prof.chat.${marcador}@escola.edu.br`,
  responsavel: `resp.chat.${marcador}@escola.edu.br`,
  responsavelSemChat: `resp.sem.chat.${marcador}@escola.edu.br`,
  responsavelOutro: `resp.outro.chat.${marcador}@escola.edu.br`,
};

const MENSAGEM_FORA_HORARIO = `Canal fechado no momento do teste ${marcador}.`;

let app: FastifyInstance;
let anoPrivadoId: string;
let cookieGestao: string;
let cookieProfessor: string;
let cookieResponsavel: string;
let cookieResponsavelSemChat: string;
let cookieResponsavelOutro: string;
let conversaId: string;
let conversaNovoId: string;
let horariosIds: string[] = [];
let janelasAtivasOriginais: string[] = [];
let configuracaoExistiaOriginalmente = false;
let mensagemForaHorarioOriginal: string | null = null;

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
  acessoModulos: string[],
) {
  await prisma.perfis.create({
    data: {
      id,
      nome: `Perfil ${papel} ${id.slice(0, 4)}`,
      email,
      papel,
      status: 'ativo',
      senha_hash: await gerarHashSenha('SenhaAtual1!'),
      acesso_modulos: acessoModulos,
    },
  });
}

async function criarAluno(id: string, nome: string, matricula: string) {
  await prisma.alunos.create({ data: { id, nome, matricula } });
  await prisma.enturmacoes.create({
    data: { aluno_id: id, turma_id: turmaId, ano_letivo_id: anoPrivadoId },
  });
}

async function desativarJanelas() {
  await prisma.horarios_letivos.updateMany({ data: { ativo: false } });
}

async function restaurarJanelas() {
  await prisma.horarios_letivos.updateMany({
    where: { id: { in: janelasAtivasOriginais } },
    data: { ativo: true },
  });
}

function erroDe(resposta: { json: () => unknown }): { codigo: string; mensagem: string } {
  return (resposta.json() as { erro: { codigo: string; mensagem: string } }).erro;
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

  await criarPerfil(gestaoId, emails.gestao, 'gestao', []);
  await criarPerfil(professorId, emails.professor, 'professor', []);
  await criarPerfil(responsavelId, emails.responsavel, 'responsavel', ['chat']);
  await criarPerfil(responsavelSemChatId, emails.responsavelSemChat, 'responsavel', []);
  await criarPerfil(responsavelOutroId, emails.responsavelOutro, 'responsavel', ['chat']);

  await prisma.turmas.create({
    data: {
      id: turmaId,
      ano_letivo_id: anoPrivadoId,
      serie: '1ª',
      letra: 'A',
      nome_completo: '1ª A',
      ativo: true,
    },
  });

  await prisma.atribuicoes_professores.create({
    data: { professor_id: professorId, turma_id: turmaId, papel: 'titular', ativo: true },
  });

  await criarAluno(alunoId, 'Aluno do Responsável', `CHAT-A-${marcador}`);
  await criarAluno(alunoNovoId, 'Aluno Conversa Nova', `CHAT-B-${marcador}`);
  await criarAluno(alunoGestaoId, 'Aluno da Gestão', `CHAT-C-${marcador}`);

  await prisma.vinculos_responsaveis.create({
    data: {
      responsavel_id: responsavelId,
      aluno_id: alunoId,
      tipo_relacao: 'pai',
      contato_prioritario: true,
    },
  });
  await prisma.vinculos_responsaveis.create({
    data: { responsavel_id: responsavelId, aluno_id: alunoNovoId, tipo_relacao: 'pai' },
  });
  await prisma.vinculos_responsaveis.create({
    data: {
      responsavel_id: responsavelId,
      aluno_id: alunoGestaoId,
      tipo_relacao: 'mae',
      contato_prioritario: true,
    },
  });

  // Janelas amplas para que o envio do responsável nunca esbarre no horário real do servidor.
  await prisma.horarios_letivos.createMany({
    data: Array.from({ length: 7 }, (_, dia) => ({
      dia_semana: dia,
      hora_inicio: new Date('1970-01-01T00:00:00.000Z'),
      hora_fim: new Date('1970-01-01T23:59:59.000Z'),
      ativo: true,
    })),
    skipDuplicates: true,
  });

  horariosIds = (
    await prisma.horarios_letivos.findMany({
      where: { hora_inicio: new Date('1970-01-01T00:00:00.000Z') },
      select: { id: true },
    })
  ).map((horario) => horario.id);

  janelasAtivasOriginais = (
    await prisma.horarios_letivos.findMany({ where: { ativo: true }, select: { id: true } })
  ).map((horario) => horario.id);

  const configuracao = await prisma.configuracoes_sistema.findUnique({ where: { id: 1 } });
  configuracaoExistiaOriginalmente = Boolean(configuracao);
  mensagemForaHorarioOriginal = configuracao?.mensagem_fora_horario ?? null;
  if (!configuracao) {
    await prisma.configuracoes_sistema.create({ data: { id: 1 } });
  }
  await prisma.configuracoes_sistema.update({
    where: { id: 1 },
    data: { mensagem_fora_horario: MENSAGEM_FORA_HORARIO },
  });

  const conversa = await prisma.conversas.create({
    data: { responsavel_id: responsavelId, aluno_id: alunoId, turma_id: turmaId, ativa: true },
  });
  conversaId = conversa.id;

  cookieGestao = await login(emails.gestao);
  cookieProfessor = await login(emails.professor);
  cookieResponsavel = await login(emails.responsavel);
  cookieResponsavelSemChat = await login(emails.responsavelSemChat);
  cookieResponsavelOutro = await login(emails.responsavelOutro);
});

afterAll(async () => {
  const conversas = await prisma.conversas.findMany({
    where: {
      OR: [
        { responsavel_id: { in: [responsavelId, responsavelSemChatId, responsavelOutroId] } },
        { aluno_id: { in: alunosIds } },
      ],
    },
    select: { id: true },
  });
  const conversasIds = conversas.map((conversa) => conversa.id);

  await prisma.notificacoes.deleteMany({
    where: {
      OR: [
        { destinatario_id: { in: perfisIds } },
        ...conversasIds.map((id) => ({ metadados: { path: ['conversa_id'], equals: id } })),
      ],
    },
  });
  await prisma.mensagens.deleteMany({ where: { conversa_id: { in: conversasIds } } });
  await prisma.conversas.deleteMany({ where: { id: { in: conversasIds } } });

  await prisma.horarios_letivos.deleteMany({ where: { id: { in: horariosIds } } });

  if (configuracaoExistiaOriginalmente && mensagemForaHorarioOriginal !== null) {
    await prisma.configuracoes_sistema.update({
      where: { id: 1 },
      data: { mensagem_fora_horario: mensagemForaHorarioOriginal },
    });
  } else if (!configuracaoExistiaOriginalmente) {
    await prisma.configuracoes_sistema.deleteMany({ where: { id: 1 } });
  }

  await prisma.enturmacoes.deleteMany({ where: { aluno_id: { in: alunosIds } } });
  await prisma.atribuicoes_professores.deleteMany({ where: { turma_id: turmaId } });
  await prisma.vinculos_responsaveis.deleteMany({ where: { aluno_id: { in: alunosIds } } });
  await prisma.alunos.deleteMany({ where: { id: { in: alunosIds } } });
  await prisma.turmas.deleteMany({ where: { id: turmaId } });
  await prisma.anos_letivos.delete({ where: { id: anoPrivadoId } }).catch(() => {});
  await prisma.sessoes.deleteMany({ where: { perfil_id: { in: perfisIds } } });
  await prisma.perfis.deleteMany({ where: { id: { in: perfisIds } } });
  await app.close();
  await prisma.$disconnect();
});

describe('Autorização e escopo do chat', () => {
  it('anônimo recebe 401 no envelope', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/conversas' });
    expect(resposta.statusCode).toBe(401);
    expect(erroDe(resposta).codigo).toBe('nao_autenticado');
  });

  it('responsável sem módulo chat recebe 403', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieResponsavelSemChat },
    });
    expect(resposta.statusCode).toBe(403);
    expect(erroDe(resposta).codigo).toBe('nao_autorizado');
  });

  it('responsável lista apenas as conversas em que é o responsável', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieResponsavel },
    });
    expect(resposta.statusCode).toBe(200);

    const conversas = resposta.json().conversas as Array<{
      id: string;
      responsavel: { id: string };
      aluno: { id: string };
      turma: { id: string; nome_completo: string };
      ultima_mensagem_em: string | null;
      ultima_mensagem: unknown;
      nao_lidas: number;
      ativa: boolean;
      iniciada_pela_gestao: boolean;
    }>;

    expect(conversas.every((conversa) => conversa.responsavel.id === responsavelId)).toBe(true);
    const principal = conversas.find((conversa) => conversa.id === conversaId);
    expect(principal).toBeDefined();
    expect(principal).toMatchObject({
      aluno: { id: alunoId, nome: 'Aluno do Responsável' },
      turma: { id: turmaId, nome_completo: '1ª A' },
      ultima_mensagem_em: null,
      ultima_mensagem: null,
      nao_lidas: 0,
      ativa: true,
      iniciada_pela_gestao: false,
    });
  });

  it('professor lista apenas conversas das turmas em que tem atribuição ativa', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieProfessor },
    });
    expect(resposta.statusCode).toBe(200);

    const conversas = resposta.json().conversas as Array<{ id: string; turma: { id: string } }>;
    expect(conversas.some((conversa) => conversa.id === conversaId)).toBe(true);
    expect(conversas.every((conversa) => conversa.turma.id === turmaId)).toBe(true);
  });

  it('gestão lista todas as conversas', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(resposta.statusCode).toBe(200);
    const ids = (resposta.json().conversas as Array<{ id: string }>).map((conversa) => conversa.id);
    expect(ids).toContain(conversaId);
  });
});

describe('POST /api/conversas', () => {
  it('responsável cria conversa com o próprio filho e envia mensagem dentro do horário', async () => {
    await restaurarJanelas();

    const criada = await app.inject({
      method: 'POST',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieResponsavel },
      payload: { aluno_id: alunoNovoId },
    });
    expect(criada.statusCode).toBe(201);
    const conversa = criada.json().conversa as {
      id: string;
      responsavel: { id: string };
      aluno: { id: string };
      iniciada_pela_gestao: boolean;
    };
    expect(conversa).toMatchObject({
      responsavel: { id: responsavelId },
      aluno: { id: alunoNovoId },
      iniciada_pela_gestao: false,
    });
    conversaNovoId = conversa.id;

    const repetida = await app.inject({
      method: 'POST',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieResponsavel },
      payload: { aluno_id: alunoNovoId },
    });
    expect(repetida.statusCode).toBe(200);
    expect(repetida.json().conversa.id).toBe(conversaNovoId);

    const mensagem = await app.inject({
      method: 'POST',
      url: `/api/conversas/${conversaNovoId}/mensagens`,
      cookies: { buscapp_sessao: cookieResponsavel },
      payload: { conteudo: 'Olá, gostaria de acompanhar as aulas.' },
    });
    expect(mensagem.statusCode).toBe(201);
    expect(mensagem.json().mensagem).toMatchObject({
      conversa_id: conversaNovoId,
      remetente_id: responsavelId,
      autor: { id: responsavelId, papel: 'responsavel' },
      conteudo: 'Olá, gostaria de acompanhar as aulas.',
      is_system_message: false,
      lida_em: null,
    });

    const listagem = await app.inject({
      method: 'GET',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieResponsavel },
    });
    const contato = (
      listagem.json().conversas as Array<{ id: string; ultima_mensagem: { conteudo: string } }>
    ).find((item) => item.id === conversaNovoId);
    expect(contato?.ultima_mensagem.conteudo).toBe('Olá, gostaria de acompanhar as aulas.');
  });

  it('gestão inicia conversa usando o contato prioritário do aluno', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieGestao },
      payload: { aluno_id: alunoGestaoId },
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json().conversa).toMatchObject({
      responsavel: { id: responsavelId },
      aluno: { id: alunoGestaoId },
      iniciada_pela_gestao: true,
    });
  });

  it('responsável não vinculado ao aluno recebe 403', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieResponsavelOutro },
      payload: { aluno_id: alunoNovoId },
    });
    expect(resposta.statusCode).toBe(403);
    expect(erroDe(resposta).codigo).toBe('nao_autorizado');
  });

  it('professor não pode iniciar conversa', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieProfessor },
      payload: { aluno_id: alunoId },
    });
    expect(resposta.statusCode).toBe(403);
    expect(erroDe(resposta).codigo).toBe('nao_autorizado');
  });
});

describe('GET /api/conversas/:id/mensagens', () => {
  it('responsável do par lê as mensagens da conversa', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/conversas/${conversaNovoId}/mensagens`,
      cookies: { buscapp_sessao: cookieResponsavel },
    });
    expect(resposta.statusCode).toBe(200);
    const mensagens = resposta.json().mensagens as Array<{
      conteudo: string;
      autor: { id: string; nome: string; papel: string };
    }>;
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]).toMatchObject({
      conteudo: 'Olá, gostaria de acompanhar as aulas.',
      autor: { id: responsavelId, papel: 'responsavel' },
    });
    expect(typeof mensagens[0]?.autor.nome).toBe('string');
  });

  it('participante errado recebe 404', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/conversas/${conversaNovoId}/mensagens`,
      cookies: { buscapp_sessao: cookieResponsavelOutro },
    });
    expect(resposta.statusCode).toBe(404);
    expect(erroDe(resposta).codigo).toBe('nao_encontrado');
  });

  it('conversa inexistente responde 404', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/conversas/${randomUUID()}/mensagens`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(resposta.statusCode).toBe(404);
  });
});

describe('POST /api/conversas/:id/mensagens', () => {
  it('envio fora do horário protegido retorna 403 fora_horario', async () => {
    await desativarJanelas();
    try {
      const resposta = await app.inject({
        method: 'POST',
        url: `/api/conversas/${conversaId}/mensagens`,
        cookies: { buscapp_sessao: cookieResponsavel },
        payload: { conteudo: 'Tentativa fora do horário.' },
      });
      expect(resposta.statusCode).toBe(403);
      expect(erroDe(resposta)).toMatchObject({
        codigo: 'fora_horario',
        mensagem: MENSAGEM_FORA_HORARIO,
      });
    } finally {
      await restaurarJanelas();
    }
  });

  it('gestão envia a qualquer hora, mesmo com as janelas desativadas', async () => {
    await desativarJanelas();
    try {
      const resposta = await app.inject({
        method: 'POST',
        url: `/api/conversas/${conversaId}/mensagens`,
        cookies: { buscapp_sessao: cookieGestao },
        payload: { conteudo: 'Mensagem da gestão fora do horário.' },
      });
      expect(resposta.statusCode).toBe(201);
      expect(resposta.json().mensagem).toMatchObject({
        remetente_id: gestaoId,
        autor: { papel: 'gestao' },
      });
    } finally {
      await restaurarJanelas();
    }
  });

  it('envio idempotente por client_request_id não duplica a mensagem', async () => {
    const clientRequestId = randomUUID();
    const payload = { conteudo: 'Mensagem idempotente.', client_request_id: clientRequestId };

    const primeira = await app.inject({
      method: 'POST',
      url: `/api/conversas/${conversaId}/mensagens`,
      cookies: { buscapp_sessao: cookieGestao },
      payload,
    });
    expect(primeira.statusCode).toBe(201);

    const segunda = await app.inject({
      method: 'POST',
      url: `/api/conversas/${conversaId}/mensagens`,
      cookies: { buscapp_sessao: cookieGestao },
      payload,
    });
    expect(segunda.statusCode).toBe(200);
    expect(segunda.json().mensagem.id).toBe(primeira.json().mensagem.id);

    const total = await prisma.mensagens.count({ where: { client_request_id: clientRequestId } });
    expect(total).toBe(1);
  });
});

describe('PATCH /api/conversas/:id/lidas', () => {
  it('nao_lidas reflete as mensagens recebidas e zera após marcar como lidas', async () => {
    const antesResposta = await app.inject({
      method: 'GET',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieResponsavel },
    });
    const contatoAntes = (
      antesResposta.json().conversas as Array<{ id: string; nao_lidas: number }>
    ).find((conversa) => conversa.id === conversaId);
    const naoLidasAntes = contatoAntes?.nao_lidas ?? 0;

    const novaMensagem = await app.inject({
      method: 'POST',
      url: `/api/conversas/${conversaId}/mensagens`,
      cookies: { buscapp_sessao: cookieGestao },
      payload: { conteudo: 'Mais uma mensagem para a contagem.' },
    });
    expect(novaMensagem.statusCode).toBe(201);

    const listagem = await app.inject({
      method: 'GET',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieResponsavel },
    });
    const contato = (listagem.json().conversas as Array<{ id: string; nao_lidas: number }>).find(
      (conversa) => conversa.id === conversaId,
    );
    expect(contato?.nao_lidas).toBe(naoLidasAntes + 1);

    const marcadas = await app.inject({
      method: 'PATCH',
      url: `/api/conversas/${conversaId}/lidas`,
      cookies: { buscapp_sessao: cookieResponsavel },
    });
    expect(marcadas.statusCode).toBe(200);
    expect(marcadas.json()).toEqual({ atualizadas: naoLidasAntes + 1 });

    const depois = await app.inject({
      method: 'GET',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieResponsavel },
    });
    const contatoDepois = (
      depois.json().conversas as Array<{ id: string; nao_lidas: number }>
    ).find((conversa) => conversa.id === conversaId);
    expect(contatoDepois?.nao_lidas).toBe(0);
  });

  it('gestão também marca as mensagens do responsável como lidas', async () => {
    await restaurarJanelas();
    const envio = await app.inject({
      method: 'POST',
      url: `/api/conversas/${conversaId}/mensagens`,
      cookies: { buscapp_sessao: cookieResponsavel },
      payload: { conteudo: 'Resposta do responsável.' },
    });
    expect(envio.statusCode).toBe(201);

    const listagem = await app.inject({
      method: 'GET',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieGestao },
    });
    const contato = (listagem.json().conversas as Array<{ id: string; nao_lidas: number }>).find(
      (conversa) => conversa.id === conversaId,
    );
    expect(contato?.nao_lidas).toBeGreaterThanOrEqual(1);

    const marcadas = await app.inject({
      method: 'PATCH',
      url: `/api/conversas/${conversaId}/lidas`,
      cookies: { buscapp_sessao: cookieGestao },
    });
    expect(marcadas.statusCode).toBe(200);
    expect(marcadas.json().atualizadas).toBe(contato?.nao_lidas);

    const depois = await app.inject({
      method: 'GET',
      url: '/api/conversas',
      cookies: { buscapp_sessao: cookieGestao },
    });
    const contatoDepois = (
      depois.json().conversas as Array<{ id: string; nao_lidas: number }>
    ).find((conversa) => conversa.id === conversaId);
    expect(contatoDepois?.nao_lidas).toBe(0);
  });
});

describe('PATCH /api/conversas/:id', () => {
  it('participante pode ocultar e reexibir; participante errado recebe 404', async () => {
    try {
      const ocultada = await app.inject({
        method: 'PATCH',
        url: `/api/conversas/${conversaId}`,
        cookies: { buscapp_sessao: cookieGestao },
        payload: { ativa: false },
      });
      expect(ocultada.statusCode).toBe(200);
      expect(ocultada.json().conversa.ativa).toBe(false);

      const reexibida = await app.inject({
        method: 'PATCH',
        url: `/api/conversas/${conversaId}`,
        cookies: { buscapp_sessao: cookieResponsavel },
        payload: { ativa: true },
      });
      expect(reexibida.statusCode).toBe(200);
      expect(reexibida.json().conversa.ativa).toBe(true);
    } finally {
      await prisma.conversas.update({ where: { id: conversaId }, data: { ativa: true } });
    }

    const foraDoEscopo = await app.inject({
      method: 'PATCH',
      url: `/api/conversas/${conversaId}`,
      cookies: { buscapp_sessao: cookieResponsavelOutro },
      payload: { ativa: false },
    });
    expect(foraDoEscopo.statusCode).toBe(404);
  });
});
