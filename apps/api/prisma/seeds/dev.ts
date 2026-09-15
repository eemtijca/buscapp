import { Prisma } from '../../generated/prisma/client.js';
import { prismaAdmin } from '../../src/nucleo/banco/cliente.js';
import { hashCodigo } from '../../src/nucleo/autenticacao/codigos.js';
import { gerarHashSenha } from '../../src/nucleo/autenticacao/senhas.js';

interface UsuarioSeed {
  id: string;
  nome: string;
  email: string;
  papel: 'gestao' | 'professor' | 'responsavel';
  senha: string;
  acesso_modulos: string[];
}

const MODULOS_PROFESSOR = ['frequencia', 'ocorrencias'];
const MODULOS_RESPONSAVEL = ['alertas', 'termometro', 'justificativa', 'chat'];

// IDs canônicos das fixtures, compartilhados com tests/suporte/dados.ts.
const GESTAO_ID = 'a0000000-0000-0000-0000-000000000001';
const PROF1_ID = 'a0000000-0000-0000-0000-000000000002';
const PROF2_ID = 'a0000000-0000-0000-0000-000000000003';
const RESP1_ID = 'a0000000-0000-0000-0000-000000000005';
const RESP2_ID = 'a0000000-0000-0000-0000-000000000006';
const RESP3_ID = 'a0000000-0000-0000-0000-000000000007';
const ANO_LETIVO_ID = 'b0000000-0000-0000-0000-000000000001';
const DISCIPLINA_PORTUGUES_ID = 'c0000000-0000-0000-0000-000000000001';
const DISCIPLINA_ARTE_ID = 'c0000000-0000-0000-0000-000000000002';
const DISCIPLINA_EDUCACAO_FISICA_ID = 'c0000000-0000-0000-0000-000000000003';
const TURMA_1A_ID = 'd0000000-0000-0000-0000-000000000001';
const TURMA_2B_ID = 'd0000000-0000-0000-0000-000000000002';
const TURMA_3C_ID = 'd0000000-0000-0000-0000-000000000003';
const ALUNO_JOAO_ID = 'e0000000-0000-0000-0000-000000000001';
const ALUNO_MARIA_CLARA_ID = 'e0000000-0000-0000-0000-000000000002';
const ALUNO_PEDRO_ID = 'e0000000-0000-0000-0000-000000000003';
const ALUNO_ANA_BEATRIZ_ID = 'e0000000-0000-0000-0000-000000000004';
const ALUNO_LUCAS_ID = 'e0000000-0000-0000-0000-000000000005';
const ALUNO_JULIA_ID = 'e0000000-0000-0000-0000-000000000006';
const ALUNO_RAFAEL_ID = 'e0000000-0000-0000-0000-000000000007';
const ALUNO_ISABELA_ID = 'e0000000-0000-0000-0000-000000000008';
const ALUNO_THIAGO_ID = 'e0000000-0000-0000-0000-000000000009';

/** Datas civis gravadas à meia-noite UTC para não deslocar o dia. */
function data(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const ANO_VIGENTE = new Date().getFullYear();
const DATA_MATRICULA = data(ANO_VIGENTE, 2, 1);

interface AlunoSeed {
  id: string;
  nome: string;
  matricula: string;
  codigo_inep: string;
  status: 'ativo' | 'transferido';
  data_nascimento: Date;
  observacoes: string | null;
}

const ALUNOS: AlunoSeed[] = [
  {
    id: ALUNO_JOAO_ID,
    nome: 'João Miguel da Silva',
    matricula: 'MAT2026001',
    codigo_inep: '23123456',
    status: 'ativo',
    data_nascimento: data(2012, 3, 15),
    observacoes: null,
  },
  {
    id: ALUNO_MARIA_CLARA_ID,
    nome: 'Maria Clara Santos',
    matricula: 'MAT2026002',
    codigo_inep: '23123457',
    status: 'ativo',
    data_nascimento: data(2012, 7, 22),
    observacoes: null,
  },
  {
    id: ALUNO_PEDRO_ID,
    nome: 'Pedro Henrique Lima',
    matricula: 'MAT2026003',
    codigo_inep: '23123458',
    status: 'ativo',
    data_nascimento: data(2011, 11, 30),
    observacoes: 'Aluno com histórico de faltas recorrentes',
  },
  {
    id: ALUNO_ANA_BEATRIZ_ID,
    nome: 'Ana Beatriz Costa',
    matricula: 'MAT2026004',
    codigo_inep: '23123459',
    status: 'transferido',
    data_nascimento: data(2011, 1, 10),
    observacoes: 'Transferida para escola estadual em abril/2026',
  },
  {
    id: ALUNO_LUCAS_ID,
    nome: 'Lucas Eduardo Pereira',
    matricula: 'MAT2026005',
    codigo_inep: '23123460',
    status: 'ativo',
    data_nascimento: data(2011, 5, 18),
    observacoes: null,
  },
  {
    id: ALUNO_JULIA_ID,
    nome: 'Júlia Gabriela Oliveira',
    matricula: 'MAT2026006',
    codigo_inep: '23123461',
    status: 'ativo',
    data_nascimento: data(2010, 9, 25),
    observacoes: null,
  },
  {
    id: ALUNO_RAFAEL_ID,
    nome: 'Rafael Augusto Almeida',
    matricula: 'MAT2026007',
    codigo_inep: '23123462',
    status: 'ativo',
    data_nascimento: data(2010, 2, 14),
    observacoes: null,
  },
  {
    id: ALUNO_ISABELA_ID,
    nome: 'Isabela Cristina Martins',
    matricula: 'MAT2026008',
    codigo_inep: '23123463',
    status: 'ativo',
    data_nascimento: data(2009, 12, 1),
    observacoes: null,
  },
  {
    id: ALUNO_THIAGO_ID,
    nome: 'Thiago Vinicius Barbosa',
    matricula: 'MAT2026009',
    codigo_inep: '23123464',
    status: 'ativo',
    data_nascimento: data(2010, 6, 8),
    observacoes: 'Aluno com acompanhamento pedagógico',
  },
];

const ENTURMACOES: Array<{
  aluno_id: string;
  turma_id: string;
  status: 'matriculado' | 'transferido';
  data_encerramento: Date | null;
}> = [
  {
    aluno_id: ALUNO_JOAO_ID,
    turma_id: TURMA_1A_ID,
    status: 'matriculado',
    data_encerramento: null,
  },
  {
    aluno_id: ALUNO_MARIA_CLARA_ID,
    turma_id: TURMA_1A_ID,
    status: 'matriculado',
    data_encerramento: null,
  },
  {
    aluno_id: ALUNO_PEDRO_ID,
    turma_id: TURMA_1A_ID,
    status: 'matriculado',
    data_encerramento: null,
  },
  {
    aluno_id: ALUNO_ANA_BEATRIZ_ID,
    turma_id: TURMA_2B_ID,
    status: 'transferido',
    data_encerramento: data(2026, 4, 15),
  },
  {
    aluno_id: ALUNO_LUCAS_ID,
    turma_id: TURMA_2B_ID,
    status: 'matriculado',
    data_encerramento: null,
  },
  {
    aluno_id: ALUNO_JULIA_ID,
    turma_id: TURMA_2B_ID,
    status: 'matriculado',
    data_encerramento: null,
  },
  {
    aluno_id: ALUNO_RAFAEL_ID,
    turma_id: TURMA_3C_ID,
    status: 'matriculado',
    data_encerramento: null,
  },
  {
    aluno_id: ALUNO_ISABELA_ID,
    turma_id: TURMA_3C_ID,
    status: 'matriculado',
    data_encerramento: null,
  },
  {
    aluno_id: ALUNO_THIAGO_ID,
    turma_id: TURMA_3C_ID,
    status: 'matriculado',
    data_encerramento: null,
  },
];

// IDs determinísticos para tabelas sem chave natural, garantindo idempotência.
const ATRIBUICOES = [
  {
    id: 'f1000000-0000-0000-0000-000000000001',
    professor_id: PROF1_ID,
    turma_id: TURMA_1A_ID,
    disciplina_id: null,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000002',
    professor_id: PROF1_ID,
    turma_id: TURMA_1A_ID,
    disciplina_id: DISCIPLINA_PORTUGUES_ID,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000003',
    professor_id: PROF1_ID,
    turma_id: TURMA_2B_ID,
    disciplina_id: DISCIPLINA_PORTUGUES_ID,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000004',
    professor_id: PROF1_ID,
    turma_id: TURMA_3C_ID,
    disciplina_id: DISCIPLINA_PORTUGUES_ID,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000005',
    professor_id: PROF2_ID,
    turma_id: TURMA_2B_ID,
    disciplina_id: null,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000006',
    professor_id: PROF2_ID,
    turma_id: TURMA_1A_ID,
    disciplina_id: DISCIPLINA_ARTE_ID,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000007',
    professor_id: PROF2_ID,
    turma_id: TURMA_2B_ID,
    disciplina_id: DISCIPLINA_ARTE_ID,
  },
  {
    id: 'f1000000-0000-0000-0000-000000000008',
    professor_id: PROF2_ID,
    turma_id: TURMA_3C_ID,
    disciplina_id: DISCIPLINA_ARTE_ID,
  },
];

const VINCULOS = [
  {
    responsavel_id: RESP1_ID,
    aluno_id: ALUNO_JOAO_ID,
    tipo_relacao: 'mae',
    contato_prioritario: true,
  },
  {
    responsavel_id: RESP1_ID,
    aluno_id: ALUNO_MARIA_CLARA_ID,
    tipo_relacao: 'mae',
    contato_prioritario: false,
  },
  {
    responsavel_id: RESP2_ID,
    aluno_id: ALUNO_LUCAS_ID,
    tipo_relacao: 'pai',
    contato_prioritario: true,
  },
  {
    responsavel_id: RESP3_ID,
    aluno_id: ALUNO_RAFAEL_ID,
    tipo_relacao: 'mae',
    contato_prioritario: true,
  },
];

// Cinco dias de aula em março, com padrões de ausência que exercitam o ranking.
const DIAS_FREQUENCIA = [2, 3, 4, 5, 6];
const AULAS_DO_DIA = [
  { disciplina_id: DISCIPLINA_PORTUGUES_ID, periodo: 'Manhã' },
  { disciplina_id: DISCIPLINA_ARTE_ID, periodo: 'Manhã' },
  { disciplina_id: DISCIPLINA_EDUCACAO_FISICA_ID, periodo: 'Tarde' },
];
const ALUNOS_MATRICULADOS = [
  { aluno_id: ALUNO_JOAO_ID, turma_id: TURMA_1A_ID },
  { aluno_id: ALUNO_MARIA_CLARA_ID, turma_id: TURMA_1A_ID },
  { aluno_id: ALUNO_PEDRO_ID, turma_id: TURMA_1A_ID },
  { aluno_id: ALUNO_LUCAS_ID, turma_id: TURMA_2B_ID },
  { aluno_id: ALUNO_JULIA_ID, turma_id: TURMA_2B_ID },
  { aluno_id: ALUNO_RAFAEL_ID, turma_id: TURMA_3C_ID },
  { aluno_id: ALUNO_ISABELA_ID, turma_id: TURMA_3C_ID },
  { aluno_id: ALUNO_THIAGO_ID, turma_id: TURMA_3C_ID },
];

const AUSENCIAS_POR_ALUNO: Record<string, number[]> = {
  [ALUNO_JOAO_ID]: [2, 4, 6],
  [ALUNO_PEDRO_ID]: [2, 3, 4, 5, 6],
  [ALUNO_LUCAS_ID]: [3, 5],
  [ALUNO_JULIA_ID]: [2, 3, 5, 6],
  [ALUNO_ISABELA_ID]: [4],
  [ALUNO_THIAGO_ID]: [2, 4, 6],
};

/** Identificador determinístico das frequências semeadas (1..120). */
function idFrequencia(indice: number): string {
  return `f2000000-0000-0000-0000-${String(indice).padStart(12, '0')}`;
}

interface OcorrenciaSeed {
  id: string;
  aluno_id: string;
  professor_id: string;
  turma_id: string;
  titulo: string;
  descricao: string;
  tipo: string[];
  status: 'em_andamento' | 'aberta';
  data_ocorrencia: Date;
}

const OCORRENCIAS: OcorrenciaSeed[] = [
  {
    id: 'f3000000-0000-0000-0000-000000000001',
    aluno_id: ALUNO_PEDRO_ID,
    professor_id: PROF1_ID,
    turma_id: TURMA_1A_ID,
    titulo: 'Uso de celular durante prova',
    descricao:
      'Aluno foi flagrado utilizando o celular durante a avaliação bimestral de Português. O aparelho foi recolhido e entregue à coordenação.',
    tipo: ['grave'],
    status: 'em_andamento',
    data_ocorrencia: new Date('2026-03-10T09:30:00-03:00'),
  },
  {
    id: 'f3000000-0000-0000-0000-000000000002',
    aluno_id: ALUNO_JULIA_ID,
    professor_id: PROF2_ID,
    turma_id: TURMA_2B_ID,
    titulo: 'Ameaça a colega de turma',
    descricao:
      'Aluna fez ameaças verbais a um colega durante o intervalo. Testemunhas relataram o ocorrido à coordenação. Exige reunião com responsável.',
    tipo: ['suspensao'],
    status: 'aberta',
    data_ocorrencia: new Date('2026-03-18T15:00:00-03:00'),
  },
];

interface NotificacaoSeed {
  id: string;
  destinatario_id: string;
  tipo: 'sistema' | 'ausencia_aula' | 'codigo_redefinicao';
  titulo: string;
  corpo: string;
  metadados?: Prisma.InputJsonValue;
}

const NOTIFICACOES: NotificacaoSeed[] = [
  {
    id: 'f4000000-0000-0000-0000-000000000001',
    destinatario_id: GESTAO_ID,
    tipo: 'sistema',
    titulo: 'Novo ano letivo iniciado',
    corpo:
      'O ano letivo de 2026 foi ativado com sucesso. Todas as turmas e horários estão configurados.',
  },
  {
    id: 'f4000000-0000-0000-0000-000000000002',
    destinatario_id: GESTAO_ID,
    tipo: 'ausencia_aula',
    titulo: 'Aluno com faltas críticas detectado',
    corpo:
      'Pedro Henrique Lima (1ª A) atingiu 5 faltas consecutivas. Recomenda-se acionar o protocolo de monitoramento.',
  },
  {
    id: 'f4000000-0000-0000-0000-000000000003',
    destinatario_id: GESTAO_ID,
    tipo: 'codigo_redefinicao',
    titulo: 'Solicitação de redefinição de senha',
    corpo:
      'O usuário Maria Silva (resp1@email.com, responsável) solicitou um código para redefinir a senha.',
    metadados: { email: 'resp1@email.com', perfil_id: RESP1_ID },
  },
  {
    id: 'f4000000-0000-0000-0000-000000000004',
    destinatario_id: PROF1_ID,
    tipo: 'sistema',
    titulo: 'Bem-vinda ao sistema',
    corpo: 'Seu perfil de professora foi ativado. Você está vinculada à turma 1ª A como titular.',
  },
  {
    id: 'f4000000-0000-0000-0000-000000000005',
    destinatario_id: RESP1_ID,
    tipo: 'sistema',
    titulo: 'Bem-vindo ao sistema',
    corpo:
      'Seu perfil de responsável foi ativado. Você receberá notificações sobre a frequência dos seus dependentes.',
  },
];

interface CodigoSeed {
  id: string;
  email: string;
  perfil_id: string;
  codigo: string;
  criado_por: string;
  usado_em: Date | null;
  expira_em: Date;
}

interface MonitoramentoSeed {
  id: string;
  aluno_id: string;
  responsavel_id: string;
  tipo_contato: 'telefone' | 'whatsapp' | 'presencial';
  status: 'realizado' | 'pendente';
  realizado_por: string | null;
  observacao: string;
  agendado_para: Date | null;
  realizado_em: Date | null;
}

const MONITORAMENTO: MonitoramentoSeed[] = [
  {
    id: 'f6000000-0000-0000-0000-000000000001',
    aluno_id: ALUNO_PEDRO_ID,
    responsavel_id: RESP1_ID,
    tipo_contato: 'telefone',
    status: 'realizado',
    realizado_por: GESTAO_ID,
    observacao: 'Tentativa de contato com a mãe. Telefone chamou mas ninguém atendeu.',
    agendado_para: null,
    realizado_em: new Date('2026-03-20T10:00:00-03:00'),
  },
  {
    id: 'f6000000-0000-0000-0000-000000000002',
    aluno_id: ALUNO_PEDRO_ID,
    responsavel_id: RESP1_ID,
    tipo_contato: 'whatsapp',
    status: 'realizado',
    realizado_por: GESTAO_ID,
    observacao:
      'Enviada mensagem via WhatsApp informando sobre as faltas do aluno. Aguardando retorno.',
    agendado_para: null,
    realizado_em: new Date('2026-03-20T14:30:00-03:00'),
  },
  {
    id: 'f6000000-0000-0000-0000-000000000003',
    aluno_id: ALUNO_JULIA_ID,
    responsavel_id: RESP2_ID,
    tipo_contato: 'presencial',
    status: 'pendente',
    realizado_por: null,
    observacao: 'Visita domiciliar aguardando agendamento. Aluna com 4 faltas consecutivas.',
    agendado_para: new Date('2026-04-01T09:00:00-03:00'),
    realizado_em: null,
  },
  {
    id: 'f6000000-0000-0000-0000-000000000004',
    aluno_id: ALUNO_PEDRO_ID,
    responsavel_id: RESP1_ID,
    tipo_contato: 'presencial',
    status: 'pendente',
    realizado_por: GESTAO_ID,
    observacao:
      'Reunião agendada com a mãe na escola para discutir o desempenho e frequência do aluno.',
    agendado_para: new Date('2026-07-15T14:00:00-03:00'),
    realizado_em: null,
  },
];

function usuarios(): UsuarioSeed[] {
  const senhaAdmin = process.env.SEED_SENHA_ADMIN ?? 'Admin123!';
  const senhaProf = process.env.SEED_SENHA_PROF ?? 'Prof123!';
  const senhaResp = process.env.SEED_SENHA_RESP ?? 'Resp123!';

  return [
    {
      id: GESTAO_ID,
      nome: 'Carlos Administrador',
      email: 'gestao@escola.edu.br',
      papel: 'gestao',
      senha: senhaAdmin,
      acesso_modulos: [],
    },
    {
      id: PROF1_ID,
      nome: 'Ana Professora',
      email: 'prof1@escola.edu.br',
      papel: 'professor',
      senha: senhaProf,
      acesso_modulos: MODULOS_PROFESSOR,
    },
    {
      id: PROF2_ID,
      nome: 'Bruno Professor',
      email: 'prof2@escola.edu.br',
      papel: 'professor',
      senha: senhaProf,
      acesso_modulos: ['frequencia'],
    },
    {
      id: 'a0000000-0000-0000-0000-000000000004',
      nome: 'Carla Docente',
      email: 'prof3@escola.edu.br',
      papel: 'professor',
      senha: senhaProf,
      acesso_modulos: MODULOS_PROFESSOR,
    },
    {
      id: RESP1_ID,
      nome: 'Maria Silva',
      email: 'resp1@email.com',
      papel: 'responsavel',
      senha: senhaResp,
      acesso_modulos: MODULOS_RESPONSAVEL,
    },
    {
      id: RESP2_ID,
      nome: 'João Santos',
      email: 'resp2@email.com',
      papel: 'responsavel',
      senha: senhaResp,
      acesso_modulos: MODULOS_RESPONSAVEL,
    },
    {
      id: RESP3_ID,
      nome: 'Lucia Oliveira',
      email: 'resp3@email.com',
      papel: 'responsavel',
      senha: senhaResp,
      acesso_modulos: MODULOS_RESPONSAVEL,
    },
  ];
}

/** Ano letivo canônico já criado pela migration; o upsert por `ano` preserva o ID. */
async function criarAnoLetivo(): Promise<void> {
  await prismaAdmin.anos_letivos.upsert({
    where: { ano: ANO_VIGENTE },
    create: {
      id: ANO_LETIVO_ID,
      ano: ANO_VIGENTE,
      status: 'ativo',
      data_inicio: data(ANO_VIGENTE, 2, 1),
      data_fim: data(ANO_VIGENTE, 12, 20),
      ativo: true,
    },
    update: {},
  });
}

async function criarTurmas(): Promise<void> {
  const turmas = [
    { id: TURMA_1A_ID, serie: '1ª', letra: 'A', capacidade: 40 },
    { id: TURMA_2B_ID, serie: '2ª', letra: 'B', capacidade: 40 },
    { id: TURMA_3C_ID, serie: '3ª', letra: 'C', capacidade: 40 },
  ];

  for (const turma of turmas) {
    const nome_completo = `${turma.serie} ${turma.letra}`;
    await prismaAdmin.turmas.upsert({
      where: {
        ano_letivo_id_serie_letra: {
          ano_letivo_id: ANO_LETIVO_ID,
          serie: turma.serie,
          letra: turma.letra,
        },
      },
      create: { ...turma, ano_letivo_id: ANO_LETIVO_ID, nome_completo, ativo: true },
      update: { nome_completo, capacidade: turma.capacidade, ativo: true },
    });
  }
}

async function criarAlunos(): Promise<void> {
  for (const aluno of ALUNOS) {
    await prismaAdmin.alunos.upsert({
      where: { matricula: aluno.matricula },
      create: {
        id: aluno.id,
        nome: aluno.nome,
        matricula: aluno.matricula,
        codigo_inep: aluno.codigo_inep,
        status: aluno.status,
        data_nascimento: aluno.data_nascimento,
        data_matricula: DATA_MATRICULA,
        observacoes: aluno.observacoes,
      },
      update: {
        nome: aluno.nome,
        codigo_inep: aluno.codigo_inep,
        status: aluno.status,
        data_nascimento: aluno.data_nascimento,
        data_matricula: DATA_MATRICULA,
        observacoes: aluno.observacoes,
      },
    });
  }
}

async function criarEnturmacoes(): Promise<void> {
  for (const enturmacao of ENTURMACOES) {
    await prismaAdmin.enturmacoes.upsert({
      where: {
        aluno_id_ano_letivo_id: {
          aluno_id: enturmacao.aluno_id,
          ano_letivo_id: ANO_LETIVO_ID,
        },
      },
      create: {
        aluno_id: enturmacao.aluno_id,
        turma_id: enturmacao.turma_id,
        ano_letivo_id: ANO_LETIVO_ID,
        status: enturmacao.status,
        data_matricula: DATA_MATRICULA,
        data_encerramento: enturmacao.data_encerramento,
      },
      update: {
        turma_id: enturmacao.turma_id,
        status: enturmacao.status,
        data_matricula: DATA_MATRICULA,
        data_encerramento: enturmacao.data_encerramento,
      },
    });
  }
}

async function criarAtribuicoes(): Promise<void> {
  for (const atribuicao of ATRIBUICOES) {
    await prismaAdmin.atribuicoes_professores.upsert({
      where: { id: atribuicao.id },
      create: { ...atribuicao, papel: 'titular', ativo: true },
      update: {
        professor_id: atribuicao.professor_id,
        turma_id: atribuicao.turma_id,
        disciplina_id: atribuicao.disciplina_id,
        papel: 'titular',
        ativo: true,
      },
    });
  }
}

async function criarVinculos(): Promise<void> {
  for (const vinculo of VINCULOS) {
    await prismaAdmin.vinculos_responsaveis.upsert({
      where: {
        responsavel_id_aluno_id: {
          responsavel_id: vinculo.responsavel_id,
          aluno_id: vinculo.aluno_id,
        },
      },
      create: { ...vinculo, ativo: true },
      update: {
        tipo_relacao: vinculo.tipo_relacao,
        contato_prioritario: vinculo.contato_prioritario,
        ativo: true,
      },
    });
  }
}

async function criarFrequencias(): Promise<void> {
  const frequencias: Prisma.frequenciasCreateManyInput[] = [];
  let indice = 0;

  for (const dia of DIAS_FREQUENCIA) {
    for (const aluno of ALUNOS_MATRICULADOS) {
      for (const aula of AULAS_DO_DIA) {
        indice += 1;
        frequencias.push({
          id: idFrequencia(indice),
          aluno_id: aluno.aluno_id,
          professor_id: aluno.turma_id === TURMA_2B_ID ? PROF2_ID : PROF1_ID,
          turma_id: aluno.turma_id,
          disciplina_id: aula.disciplina_id,
          ano_letivo_id: ANO_LETIVO_ID,
          data_aula: data(2026, 3, dia),
          tipo_registro: 'chamada_aula',
          periodo: aula.periodo,
          status: AUSENCIAS_POR_ALUNO[aluno.aluno_id]?.includes(dia) ? 'ausente' : 'presente',
        });
      }
    }
  }

  // IDs determinísticos: a segunda execução apenas ignora as linhas existentes.
  await prismaAdmin.frequencias.createMany({ data: frequencias, skipDuplicates: true });
}

async function criarOcorrencias(): Promise<void> {
  for (const ocorrencia of OCORRENCIAS) {
    await prismaAdmin.ocorrencias.upsert({
      where: { id: ocorrencia.id },
      create: { ...ocorrencia, ano_letivo_id: ANO_LETIVO_ID },
      update: {
        aluno_id: ocorrencia.aluno_id,
        professor_id: ocorrencia.professor_id,
        turma_id: ocorrencia.turma_id,
        titulo: ocorrencia.titulo,
        descricao: ocorrencia.descricao,
        tipo: ocorrencia.tipo,
        status: ocorrencia.status,
        data_ocorrencia: ocorrencia.data_ocorrencia,
      },
    });
  }
}

async function criarNotificacoes(): Promise<void> {
  for (const notificacao of NOTIFICACOES) {
    await prismaAdmin.notificacoes.upsert({
      where: { id: notificacao.id },
      create: {
        id: notificacao.id,
        destinatario_id: notificacao.destinatario_id,
        tipo: notificacao.tipo,
        titulo: notificacao.titulo,
        corpo: notificacao.corpo,
        metadados: notificacao.metadados ?? Prisma.DbNull,
      },
      update: {
        destinatario_id: notificacao.destinatario_id,
        tipo: notificacao.tipo,
        titulo: notificacao.titulo,
        corpo: notificacao.corpo,
        metadados: notificacao.metadados ?? Prisma.DbNull,
      },
    });
  }
}

async function criarCodigosRedefinicao(): Promise<void> {
  const agora = Date.now();
  const umaHora = 60 * 60 * 1000;
  const codigos: CodigoSeed[] = [
    {
      id: 'f5000000-0000-0000-0000-000000000001',
      email: 'resp1@email.com',
      perfil_id: RESP1_ID,
      codigo: '123456',
      criado_por: GESTAO_ID,
      usado_em: null,
      expira_em: new Date(agora - 2 * 24 * umaHora),
    },
    {
      id: 'f5000000-0000-0000-0000-000000000002',
      email: 'prof1@escola.edu.br',
      perfil_id: PROF1_ID,
      codigo: '654321',
      criado_por: GESTAO_ID,
      usado_em: new Date(agora - umaHora),
      expira_em: new Date(agora + 24 * umaHora),
    },
    {
      id: 'f5000000-0000-0000-0000-000000000003',
      email: 'prof2@escola.edu.br',
      perfil_id: PROF2_ID,
      codigo: '789012',
      criado_por: GESTAO_ID,
      usado_em: null,
      expira_em: new Date(agora + 2 * umaHora),
    },
  ];

  for (const codigo of codigos) {
    const dados = {
      email: codigo.email,
      perfil_id: codigo.perfil_id,
      codigo: null,
      codigo_hash: hashCodigo(codigo.email, codigo.codigo),
      criado_por: codigo.criado_por,
      usado_em: codigo.usado_em,
      expira_em: codigo.expira_em,
    };
    await prismaAdmin.codigos_redefinicao.upsert({
      where: { id: codigo.id },
      create: { id: codigo.id, ...dados },
      update: dados,
    });
  }
}

async function criarMonitoramento(): Promise<void> {
  for (const acao of MONITORAMENTO) {
    await prismaAdmin.monitoramento_acoes.upsert({
      where: { id: acao.id },
      create: acao,
      update: {
        aluno_id: acao.aluno_id,
        responsavel_id: acao.responsavel_id,
        tipo_contato: acao.tipo_contato,
        status: acao.status,
        realizado_por: acao.realizado_por,
        observacao: acao.observacao,
        agendado_para: acao.agendado_para,
        realizado_em: acao.realizado_em,
      },
    });
  }
}

/** Cria/atualiza usuários e fixtures de desenvolvimento com os IDs determinísticos usados nos testes. */
export async function executarSeed(): Promise<void> {
  for (const usuario of usuarios()) {
    const senhaHash = await gerarHashSenha(usuario.senha);
    await prismaAdmin.perfis.upsert({
      where: { id: usuario.id },
      create: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        status: 'ativo',
        senha_hash: senhaHash,
        senha_alterada_em: new Date(),
        acesso_modulos: usuario.acesso_modulos,
      },
      update: {
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        status: 'ativo',
        senha_hash: senhaHash,
        acesso_modulos: usuario.acesso_modulos,
      },
    });
  }

  // Ordem segura para as FKs: catálogos e pessoas antes das atividades.
  await criarAnoLetivo();
  await criarTurmas();
  await criarAlunos();
  await criarEnturmacoes();
  await criarAtribuicoes();
  await criarVinculos();
  await criarFrequencias();
  await criarOcorrencias();
  await criarNotificacoes();
  await criarCodigosRedefinicao();
  await criarMonitoramento();

  console.log('Seed de desenvolvimento aplicado (7 perfis, 3 turmas, 9 alunos e fixtures).');
}

await executarSeed()
  .then(() => prismaAdmin.$disconnect())
  .catch(async (erro) => {
    console.error('Falha ao aplicar o seed:', erro);
    await prismaAdmin.$disconnect();
    process.exit(1);
  });
