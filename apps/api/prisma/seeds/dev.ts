// Seed de desenvolvimento: fixtures canônicas dos testes de ponta a ponta e um ano
// de uso simulado com massa sintética, determinística e idempotente.
// Parâmetros: SEED_PERFIL (leve, padrao, pesado), SEED_SEMENTE e SEED_LIMPAR.

import { pathToFileURL } from 'node:url';
import { Prisma } from '../../generated/prisma/client.js';
import { ambiente } from '../../src/ambiente.js';
import { hashCodigo } from '../../src/nucleo/autenticacao/codigos.js';
import { gerarHashSenha } from '../../src/nucleo/autenticacao/senhas.js';
import { prismaAdmin } from '../../src/nucleo/banco/cliente.js';

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
const PROF3_ID = 'a0000000-0000-0000-0000-000000000004';
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

/**
 * Marcador das linhas da massa sintética: todo id começa com o prefixo, o que permite
 * limpar apenas o que o seed criou sem tocar nas fixtures canônicas nem nos testes.
 */
const MARCADOR_SEED = '5eed0000-0000-4000-8000-';
const PREFIXO_MARCADOR = `${MARCADOR_SEED}%`;

// Código de duas letras hexadecimais por entidade dentro do marcador.
const TIPO_TURMA = '01';
const TIPO_ALUNO = '02';
const TIPO_ENTURMACAO = '03';
const TIPO_ATRIBUICAO = '04';
const TIPO_FREQUENCIA = '05';
const TIPO_JUSTIFICATIVA = '06';
const TIPO_OCORRENCIA = '07';
const TIPO_CONVERSA = '08';
const TIPO_MENSAGEM = '09';
const TIPO_NOTIFICACAO = '0a';
const TIPO_MONITORAMENTO = '0b';
const TIPO_AUDITORIA = '0c';
const TIPO_VINCULO = '0d';
const TIPO_REGISTRO = '0e';
const TIPO_RESPONSAVEL = '0f';

function idSeed(tipo: string, indice: number): string {
  return `${MARCADOR_SEED}${tipo}${String(indice).padStart(10, '0')}`;
}

// ---------------------------------------------------------------------------
// Aleatoriedade determinística
// ---------------------------------------------------------------------------

interface Sorteio {
  numero(): number;
  inteiro(minimo: number, maximo: number): number;
  chance(probabilidade: number): boolean;
  escolher<T>(opcoes: readonly T[]): T;
  amostrar<T>(opcoes: readonly T[], quantidade: number): T[];
}

/** PRNG mulberry32 semeado por FNV-1a; sem Math.random em nenhum ponto da massa. */
function criarSorteio(semente: string): Sorteio {
  let estado = 2166136261;
  for (let i = 0; i < semente.length; i += 1) {
    estado ^= semente.charCodeAt(i);
    estado = Math.imul(estado, 16777619);
  }

  function numero(): number {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    numero,
    inteiro: (minimo, maximo) => minimo + Math.floor(numero() * (maximo - minimo + 1)),
    chance: (probabilidade) => numero() < probabilidade,
    escolher: <T>(opcoes: readonly T[]): T => {
      if (!opcoes.length) throw new Error('Sorteio sem opções.');
      return opcoes[Math.floor(numero() * opcoes.length)] as T;
    },
    amostrar: <T>(opcoes: readonly T[], quantidade: number): T[] => {
      const copia = [...opcoes];
      const escolhidos: T[] = [];
      const total = Math.min(quantidade, copia.length);
      for (let i = 0; i < total; i += 1) {
        escolhidos.push(copia.splice(Math.floor(numero() * copia.length), 1)[0] as T);
      }
      return escolhidos;
    },
  };
}

// ---------------------------------------------------------------------------
// Datas civis, feriados e dias letivos
// ---------------------------------------------------------------------------

/** Datas civis gravadas à meia-noite UTC para não deslocar o dia. */
function data(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function isoCivil(dataCivil: Date): string {
  return dataCivil.toISOString().slice(0, 10);
}

/** Deslocamento do fuso da escola no instante informado, em milissegundos. */
function deslocamentoFusoEscola(instante: Date): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ambiente.TZ_ESCOLA,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instante);
  const obter = (tipo: Intl.DateTimeFormatPartTypes): number =>
    Number(partes.find((parte) => parte.type === tipo)?.value ?? 0);
  const comoUtc = Date.UTC(
    obter('year'),
    obter('month') - 1,
    obter('day'),
    obter('hour'),
    obter('minute'),
    obter('second'),
  );
  return comoUtc - instante.getTime();
}

/** Instante UTC correspondente a um horário de parede no fuso da escola. */
function instanteNaEscola(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const primeiro = new Date(palpite - deslocamentoFusoEscola(new Date(palpite)));
  return new Date(palpite - deslocamentoFusoEscola(primeiro));
}

interface DataCivil {
  ano: number;
  mes: number;
  dia: number;
  iso: string;
}

/** Data corrente no fuso da escola, independente do fuso do servidor. */
function hojeCivil(): DataCivil {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ambiente.TZ_ESCOLA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const obter = (tipo: Intl.DateTimeFormatPartTypes): number =>
    Number(partes.find((parte) => parte.type === tipo)?.value ?? 0);
  const ano = obter('year');
  const mes = obter('month');
  const dia = obter('day');
  return { ano, mes, dia, iso: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}` };
}

function diferencaEmDias(inicioIso: string, fimIso: string): number {
  return Math.round((Date.parse(`${fimIso}T00:00:00Z`) - Date.parse(`${inicioIso}T00:00:00Z`)) / 86400000);
}

/** Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher (calendário gregoriano). */
function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return data(ano, mes, dia);
}

/** Feriados nacionais, do Ceará (25/03) e móveis que fecham a escola no ano. */
function feriadosDoAno(ano: number): Set<string> {
  const feriados = new Set<string>();
  const fixos: Array<[number, number]> = [
    [1, 1],
    [3, 25],
    [4, 21],
    [5, 1],
    [9, 7],
    [10, 12],
    [11, 2],
    [11, 15],
    [11, 20],
    [12, 25],
  ];
  for (const [mes, dia] of fixos) feriados.add(isoCivil(data(ano, mes, dia)));

  const pascoa = domingoDePascoa(ano).getTime();
  const deslocar = (dias: number): string => isoCivil(new Date(pascoa + dias * 86400000));
  feriados.add(deslocar(-48)); // segunda-feira de Carnaval
  feriados.add(deslocar(-47)); // terça-feira de Carnaval
  feriados.add(deslocar(-2)); // Sexta-feira Santa
  feriados.add(deslocar(60)); // Corpus Christi
  feriados.add(isoCivil(data(ano, 6, 24))); // São João
  return feriados;
}

interface DiaLetivo {
  data: Date;
  iso: string;
  diaSemana: number;
  mes: number;
}

/**
 * Dias letivos de fevereiro a dezembro do ano corrente, sem fins de semana, feriados
 * e recesso de julho, limitados a hoje.
 */
function diasLetivosDoAno(ano: number, limiteIso: string): DiaLetivo[] {
  const feriados = feriadosDoAno(ano);
  const fim = isoCivil(data(ano, 12, 20));
  const dias: DiaLetivo[] = [];
  for (
    let cursor = data(ano, 2, 1);
    isoCivil(cursor) <= fim;
    cursor = new Date(cursor.getTime() + 86400000)
  ) {
    const iso = isoCivil(cursor);
    if (iso > limiteIso) break;
    const diaSemana = cursor.getUTCDay();
    if (diaSemana === 0 || diaSemana === 6) continue;
    if (feriados.has(iso)) continue;
    if (cursor.getUTCMonth() === 6) continue; // recesso de julho
    dias.push({ data: cursor, iso, diaSemana, mes: cursor.getUTCMonth() + 1 });
  }
  return dias;
}

// ---------------------------------------------------------------------------
// Nomes e textos sintéticos
// ---------------------------------------------------------------------------

/**
 * A massa usa nomes depois das fixtures na ordem alfabética para que as buscas e as
 * primeiras páginas dos testes continuem encontrando os alunos e usuários canônicos.
 */
const NOMES_ALUNOS = [
  'Naiara',
  'Natália',
  'Nicolas',
  'Nivaldo',
  'Noemi',
  'Núbia',
  'Otávio',
  'Olívia',
  'Osvaldo',
  'Odair',
  'Pablo',
  'Paloma',
  'Patrícia',
  'Paulo',
  'Priscila',
  'Queren',
  'Rafaela',
  'Raíssa',
  'Ramiro',
  'Raul',
  'Rebeca',
  'Renan',
  'Renata',
  'Ricardo',
  'Roberta',
  'Rodrigo',
  'Rúbia',
  'Rute',
  'Sabrina',
  'Samuel',
  'Sandra',
  'Sara',
  'Saulo',
  'Sérgio',
  'Sofia',
  'Sônia',
  'Stefany',
  'Suzana',
  'Tainá',
  'Talita',
  'Tarcísio',
  'Tatiane',
  'Thales',
  'Thaís',
  'Tiago',
  'Tomás',
  'Túlio',
  'Ubirajara',
  'Úrsula',
  'Valentina',
  'Vanessa',
  'Victor',
  'Vinícius',
  'Vitória',
  'Vivian',
  'Wagner',
  'Wallace',
  'Wesley',
  'Willian',
  'Wilson',
  'Xênia',
  'Yago',
  'Yara',
  'Yasmin',
  'Yuri',
  'Zaira',
  'Zélia',
  'Zoe',
  'Zulmira',
];

const NOMES_RESPONSAVEIS = [
  'Valéria',
  'Vanessa',
  'Vera',
  'Victor',
  'Vinícius',
  'Vitória',
  'Vânia',
  'Valter',
  'Wagner',
  'Wallace',
  'Wanderley',
  'Welington',
  'Wesley',
  'Willian',
  'Wilson',
  'Xênia',
  'Yago',
  'Yara',
  'Yasmin',
  'Yuri',
  'Zaira',
  'Zélia',
  'Zoe',
  'Zulmira',
];

const SOBRENOMES = [
  'Albuquerque',
  'Almeida',
  'Andrade',
  'Aragão',
  'Araújo',
  'Barbosa',
  'Barros',
  'Batista',
  'Bezerra',
  'Borges',
  'Braga',
  'Brandão',
  'Caldas',
  'Campos',
  'Cardoso',
  'Carvalho',
  'Castro',
  'Cavalcante',
  'Cordeiro',
  'Correia',
  'Costa',
  'Cunha',
  'Dantas',
  'Duarte',
  'Farias',
  'Fernandes',
  'Ferreira',
  'Figueiredo',
  'Fonseca',
  'Freitas',
  'Gadelha',
  'Gomes',
  'Gonçalves',
  'Guedes',
  'Holanda',
  'Lacerda',
  'Leal',
  'Lima',
  'Lopes',
  'Machado',
  'Maciel',
  'Maia',
  'Marques',
  'Martins',
  'Melo',
  'Mendonça',
  'Mesquita',
  'Miranda',
  'Monteiro',
  'Moraes',
  'Moreira',
  'Nascimento',
  'Neves',
  'Nobre',
  'Nogueira',
  'Oliveira',
  'Paiva',
  'Pereira',
  'Pinheiro',
  'Pontes',
  'Portela',
  'Queiroz',
  'Ramos',
  'Reis',
  'Ribeiro',
  'Rocha',
  'Rodrigues',
  'Sales',
  'Sampaio',
  'Santana',
  'Santos',
  'Siqueira',
  'Sousa',
  'Teixeira',
  'Vasconcelos',
  'Viana',
  'Vieira',
  'Xavier',
];

/** Trechos reservados das fixtures; nenhum nome sintético pode contê-los. */
const NOMES_RESERVADOS = [
  'João Miguel',
  'Maria Clara',
  'Pedro Henrique',
  'Ana Beatriz',
  'Lucas Eduardo',
  'Júlia Gabriela',
  'Rafael Augusto',
  'Isabela Cristina',
  'Thiago Vinicius',
  'Maria Silva',
  'João Santos',
  'Lucia Oliveira',
  'Carlos Administrador',
  'Ana Professora',
  'Bruno Professor',
  'Carla Docente',
];

const MODELOS_OCORRENCIA: Array<{
  peso: number;
  titulo: string;
  descricao: string;
  tipo: string[];
  tags: string[];
  exigePresenca: boolean;
  notificarResponsavel: boolean;
}> = [
  {
    peso: 5,
    titulo: 'Uso de celular durante a aula',
    descricao:
      'Aluno utilizou o celular durante a explicação. O aparelho foi recolhido e devolvido ao final da aula.',
    tipo: ['grave'],
    tags: ['Uso de celular'],
    exigePresenca: false,
    notificarResponsavel: false,
  },
  {
    peso: 4,
    titulo: 'Conversa paralela durante a atividade',
    descricao:
      'Aluno manteve conversa paralela e atrapalhou o andamento da atividade proposta para a turma.',
    tipo: ['grave'],
    tags: ['Conversa paralela'],
    exigePresenca: false,
    notificarResponsavel: false,
  },
  {
    peso: 3,
    titulo: 'Atraso frequente',
    descricao: 'Aluno chegou após o início das atividades e perdeu a retomada da aula.',
    tipo: ['grave'],
    tags: ['Atraso às aulas'],
    exigePresenca: false,
    notificarResponsavel: false,
  },
  {
    peso: 3,
    titulo: 'Sem material didático',
    descricao: 'Aluno não trouxe o material necessário e precisou compartilhar com um colega.',
    tipo: ['grave'],
    tags: ['Sem material'],
    exigePresenca: false,
    notificarResponsavel: false,
  },
  {
    peso: 2,
    titulo: 'Desatenção constante',
    descricao:
      'Aluno demonstrou dificuldade de concentração e não concluiu a atividade do período.',
    tipo: ['grave'],
    tags: ['Desatenção'],
    exigePresenca: false,
    notificarResponsavel: false,
  },
  {
    peso: 2,
    titulo: 'Distração com fones de ouvido',
    descricao: 'Aluno usou fones de ouvido sem autorização durante a aula.',
    tipo: ['grave'],
    tags: ['Distração com eletrônicos'],
    exigePresenca: false,
    notificarResponsavel: false,
  },
  {
    peso: 2,
    titulo: 'Desrespeito a colega',
    descricao:
      'Aluno respondeu de forma agressiva a um colega durante o intervalo. A coordenação foi acionada.',
    tipo: ['grave'],
    tags: ['Desatenção'],
    exigePresenca: true,
    notificarResponsavel: true,
  },
  {
    peso: 1,
    titulo: 'Suspensão após conflito',
    descricao:
      'Aluno se envolveu em conflito e cumpriu suspensão, com retorno condicionado à presença do responsável.',
    tipo: ['suspensao'],
    tags: [],
    exigePresenca: true,
    notificarResponsavel: true,
  },
  {
    peso: 1,
    titulo: 'Dano ao patrimônio escolar',
    descricao:
      'Aluno danificou material da sala. A coordenação registrou a ocorrência para reparo e orientação.',
    tipo: ['grave'],
    tags: [],
    exigePresenca: true,
    notificarResponsavel: true,
  },
  {
    peso: 1,
    titulo: 'Saída da sala sem autorização',
    descricao: 'Aluno deixou a sala durante a aula sem autorização do professor.',
    tipo: ['grave'],
    tags: ['Desatenção'],
    exigePresenca: false,
    notificarResponsavel: false,
  },
];

const MOTIVOS_JUSTIFICATIVA = [
  'Atestado médico apresentado à coordenação.',
  'Consulta médica de rotina com atestado.',
  'Aluno com sintomas gripais, orientado a permanecer em casa.',
  'Consulta odontológica agendada pela família.',
  'Transporte escolar não circulou no dia.',
  'Viagem familiar comunicada previamente à coordenação.',
  'Acompanhamento de familiar em consulta médica.',
  'Aluno apresentou febre e permaneceu em repouso.',
  'Consulta médica de acompanhamento com atestado.',
  'Problema de saúde na família, comunicado à coordenação.',
];

const PARECERES_ACEITE = [
  'Justificativa aceita. Faltas abonadas pela coordenação.',
  'Documentação conferida e aceita pela coordenação.',
  'Motivo pertinente; faltas justificadas.',
];

const PARECERES_RECUSA = [
  'Justificativa recusada: documentação insuficiente.',
  'Justificativa recusada: motivo não comprovado.',
  'Justificativa recusada: enviada fora do prazo.',
];

const MENSAGENS_GESTAO = [
  'Olá! A coordenação acompanhou a frequência de {aluno} nesta semana. Podemos conversar?',
  'Bom dia! Registramos ausências de {aluno} e gostaríamos de entender o contexto.',
  'A escola agendou um atendimento sobre {aluno}. Qual o melhor horário para a família?',
  'Obrigado pelo retorno. Seguimos acompanhando a frequência de {aluno}.',
  'A justificativa enviada foi recebida pela coordenação e está em análise.',
  'A reunião sobre o desempenho de {aluno} pode ser na próxima quinta-feira, às 10h.',
  'Enviamos o calendário de recuperação. Em caso de dúvida, a coordenação está à disposição.',
];

const MENSAGENS_RESPONSAVEL = [
  'Bom dia! {aluno} estava com febre, mas já está melhor.',
  'A ausência foi por consulta médica. O atestado será entregue na escola.',
  'Obrigado pelo aviso. Vamos conversar com {aluno} em casa.',
  'Pode ser na quinta-feira às 10h, confirmado.',
  'O transporte escolar não passou no dia. Vamos acompanhar as atividades.',
  'Certo, a família está acompanhando as atividades de {aluno}.',
  'Vamos levar o atestado na secretaria ainda esta semana.',
];

const OBSERVACOES_POSITIVAS = [
  'Participou ativamente da aula e ajudou os colegas.',
  'Organizou o grupo na atividade prática.',
  'Apresentou o trabalho da equipe com clareza.',
  'Ajudou na organização da sala ao final da aula.',
  'Contribuiu com ideias relevantes para o debate.',
  'Colaborou com um colega que estava com dificuldade.',
];

// ---------------------------------------------------------------------------
// Fixtures canônicas
// ---------------------------------------------------------------------------

const ANO_VIGENTE = hojeCivil().ano;
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
    observacoes: `Transferida para escola estadual em abril de ${ANO_VIGENTE}`,
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
  { aluno_id: ALUNO_JOAO_ID, turma_id: TURMA_1A_ID, status: 'matriculado', data_encerramento: null },
  {
    aluno_id: ALUNO_MARIA_CLARA_ID,
    turma_id: TURMA_1A_ID,
    status: 'matriculado',
    data_encerramento: null,
  },
  { aluno_id: ALUNO_PEDRO_ID, turma_id: TURMA_1A_ID, status: 'matriculado', data_encerramento: null },
  {
    aluno_id: ALUNO_ANA_BEATRIZ_ID,
    turma_id: TURMA_2B_ID,
    status: 'transferido',
    data_encerramento: data(ANO_VIGENTE, 4, 15),
  },
  { aluno_id: ALUNO_LUCAS_ID, turma_id: TURMA_2B_ID, status: 'matriculado', data_encerramento: null },
  { aluno_id: ALUNO_JULIA_ID, turma_id: TURMA_2B_ID, status: 'matriculado', data_encerramento: null },
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
  { aluno_id: ALUNO_THIAGO_ID, turma_id: TURMA_3C_ID, status: 'matriculado', data_encerramento: null },
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
  {
    id: 'f1000000-0000-0000-0000-000000000009',
    professor_id: PROF3_ID,
    turma_id: TURMA_1A_ID,
    disciplina_id: DISCIPLINA_EDUCACAO_FISICA_ID,
  },
];

const VINCULOS = [
  { responsavel_id: RESP1_ID, aluno_id: ALUNO_JOAO_ID, tipo_relacao: 'mae', contato_prioritario: true },
  {
    responsavel_id: RESP1_ID,
    aluno_id: ALUNO_MARIA_CLARA_ID,
    tipo_relacao: 'mae',
    contato_prioritario: false,
  },
  {
    responsavel_id: RESP1_ID,
    aluno_id: ALUNO_PEDRO_ID,
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
    responsavel_id: RESP2_ID,
    aluno_id: ALUNO_JULIA_ID,
    tipo_relacao: 'pai',
    contato_prioritario: false,
  },
  {
    responsavel_id: RESP3_ID,
    aluno_id: ALUNO_RAFAEL_ID,
    tipo_relacao: 'mae',
    contato_prioritario: true,
  },
  {
    responsavel_id: RESP3_ID,
    aluno_id: ALUNO_ISABELA_ID,
    tipo_relacao: 'mae',
    contato_prioritario: false,
  },
  {
    responsavel_id: RESP3_ID,
    aluno_id: ALUNO_THIAGO_ID,
    tipo_relacao: 'mae',
    contato_prioritario: false,
  },
];

interface OcorrenciaSeed {
  id: string;
  aluno_id: string;
  professor_id: string;
  turma_id: string;
  titulo: string;
  descricao: string;
  tipo: string[];
  status: 'em_andamento' | 'aberta' | 'resolvida';
  data_ocorrencia: Date;
  tags_comportamento: string[];
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
    data_ocorrencia: instanteNaEscola(ANO_VIGENTE, 3, 10, 9, 30),
    tags_comportamento: ['Uso de celular'],
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
    data_ocorrencia: instanteNaEscola(ANO_VIGENTE, 3, 18, 15, 0),
    tags_comportamento: [],
  },
  {
    id: 'f3000000-0000-0000-0000-000000000003',
    aluno_id: ALUNO_JOAO_ID,
    professor_id: PROF1_ID,
    turma_id: TURMA_1A_ID,
    titulo: 'Conversa paralela e desatenção',
    descricao:
      'Aluno manteve conversa paralela durante a explicação e não concluiu a atividade. A ocorrência foi registrada para acompanhamento pedagógico.',
    tipo: ['grave'],
    status: 'resolvida',
    data_ocorrencia: instanteNaEscola(ANO_VIGENTE, 5, 12, 10, 15),
    tags_comportamento: ['Conversa paralela', 'Desatenção'],
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
    corpo: `O ano letivo de ${ANO_VIGENTE} foi ativado com sucesso. Todas as turmas e horários estão configurados.`,
  },
  {
    id: 'f4000000-0000-0000-0000-000000000002',
    destinatario_id: GESTAO_ID,
    tipo: 'ausencia_aula',
    titulo: 'Aluno com faltas críticas detectado',
    corpo:
      'Pedro Henrique Lima (1ª A) atingiu o limite de faltas consecutivas. Recomenda-se acionar o protocolo de monitoramento.',
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
    corpo: 'Perfil de professora ativado. O vínculo com a turma 1ª A é como titular.',
  },
  {
    id: 'f4000000-0000-0000-0000-000000000005',
    destinatario_id: RESP1_ID,
    tipo: 'sistema',
    titulo: 'Bem-vindo ao sistema',
    corpo:
      'Perfil de responsável ativado. As notificações sobre a frequência dos dependentes serão enviadas.',
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
    realizado_em: instanteNaEscola(ANO_VIGENTE, 3, 20, 10, 0),
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
    realizado_em: instanteNaEscola(ANO_VIGENTE, 3, 20, 14, 30),
  },
  {
    id: 'f6000000-0000-0000-0000-000000000003',
    aluno_id: ALUNO_JULIA_ID,
    responsavel_id: RESP2_ID,
    tipo_contato: 'presencial',
    status: 'pendente',
    realizado_por: null,
    observacao: 'Visita domiciliar aguardando agendamento. Aluna com faltas consecutivas.',
    agendado_para: instanteNaEscola(ANO_VIGENTE, 4, 1, 9, 0),
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
      'Reunião agendada com a mãe na escola para discutir o desempenho e a frequência do aluno.',
    agendado_para: instanteNaEscola(ANO_VIGENTE, 7, 15, 14, 0),
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
      id: PROF3_ID,
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

// ---------------------------------------------------------------------------
// Planejamento da massa
// ---------------------------------------------------------------------------

type PerfilSeed = 'leve' | 'padrao' | 'pesado';
type FaixaPropensao = 'baixa' | 'media' | 'alta';

interface ParametrosPerfil {
  alunosMin: number;
  alunosMax: number;
  densidade: number;
}

const PARAMETROS_PERFIL: Record<PerfilSeed, ParametrosPerfil> = {
  leve: { alunosMin: 35, alunosMax: 37, densidade: 0.7 },
  padrao: { alunosMin: 40, alunosMax: 47, densidade: 1 },
  pesado: { alunosMin: 48, alunosMax: 50, densidade: 1.4 },
};

function lerPerfil(): PerfilSeed {
  const valor = process.env.SEED_PERFIL ?? 'padrao';
  if (valor === 'leve' || valor === 'padrao' || valor === 'pesado') return valor;
  throw new Error(`SEED_PERFIL inválido: "${valor}". Use leve, padrao ou pesado.`);
}

interface TurmaGerada {
  id: string;
  serie: string;
  letra: string;
  capacidade: number;
  professorId: string;
  canonica: boolean;
}

interface AlunoGerado {
  id: string;
  nome: string;
  matricula: string;
  codigoInep: string;
  dataNascimento: Date;
  status: 'ativo' | 'transferido';
  observacoes: string | null;
  turmaId: string;
  serie: string;
  professorId: string;
  responsavelId: string | null;
  faixa: FaixaPropensao;
  propensao: number;
  canonico: boolean;
  dataLimite: string | null;
}

interface ResponsavelGerado {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

interface ResumoSeed {
  turmas: number;
  alunos: number;
  alunosMassa: number;
  responsaveis: number;
  enturmacoes: number;
  atribuicoes: number;
  vinculos: number;
  diasLetivos: number;
  frequencias: number;
  justificativas: number;
  justificativasAceitas: number;
  justificativasRecusadas: number;
  ocorrencias: number;
  conversas: number;
  mensagens: number;
  notificacoes: number;
  monitoramento: number;
  auditoria: number;
  registros: number;
}

interface ContextoSeed {
  sorteio: Sorteio;
  perfil: PerfilSeed;
  parametros: ParametrosPerfil;
  ano: number;
  hoje: DataCivil;
  agora: Date;
  diasLetivos: DiaLetivo[];
  indicePorIso: Map<string, number>;
  semanaSurto: Set<string>;
  turmas: TurmaGerada[];
  alunos: AlunoGerado[];
  responsaveis: ResponsavelGerado[];
  resumo: ResumoSeed;
}

function sortearPropensao(sorteio: Sorteio): { faixa: FaixaPropensao; propensao: number } {
  const faixa = sorteio.numero();
  if (faixa < 0.78) return { faixa: 'baixa', propensao: 0.004 + sorteio.numero() * 0.014 };
  if (faixa < 0.92) return { faixa: 'media', propensao: 0.025 + sorteio.numero() * 0.025 };
  return { faixa: 'alta', propensao: 0.07 + sorteio.numero() * 0.06 };
}

function gerarNomeSintetico(
  sorteio: Sorteio,
  primeirosNomes: readonly string[],
  usados: Set<string>,
): string {
  for (let tentativa = 0; tentativa < 200; tentativa += 1) {
    const nome = `${sorteio.escolher(primeirosNomes)} ${sorteio.escolher(SOBRENOMES)} ${sorteio.escolher(SOBRENOMES)}`;
    if (usados.has(nome)) continue;
    if (NOMES_RESERVADOS.some((reservado) => nome.includes(reservado))) continue;
    usados.add(nome);
    return nome;
  }
  throw new Error('Não foi possível gerar um nome sintético sem colisão.');
}

function gerarTelefone(sorteio: Sorteio): string {
  const prefixo = sorteio.inteiro(9000, 9999);
  const sufixo = sorteio.inteiro(1000, 9999);
  return `(88) 9${prefixo}-${sufixo}`;
}

function planejarTurmas(): TurmaGerada[] {
  return [
    { id: TURMA_1A_ID, serie: '1ª', letra: 'A', capacidade: 50, professorId: PROF1_ID, canonica: true },
    { id: idSeed(TIPO_TURMA, 1), serie: '1ª', letra: 'B', capacidade: 50, professorId: PROF2_ID, canonica: false },
    { id: idSeed(TIPO_TURMA, 2), serie: '1ª', letra: 'C', capacidade: 50, professorId: PROF3_ID, canonica: false },
    { id: idSeed(TIPO_TURMA, 3), serie: '2ª', letra: 'A', capacidade: 50, professorId: PROF2_ID, canonica: false },
    { id: TURMA_2B_ID, serie: '2ª', letra: 'B', capacidade: 50, professorId: PROF2_ID, canonica: true },
    { id: idSeed(TIPO_TURMA, 4), serie: '2ª', letra: 'C', capacidade: 50, professorId: PROF3_ID, canonica: false },
    { id: idSeed(TIPO_TURMA, 5), serie: '3ª', letra: 'A', capacidade: 50, professorId: PROF3_ID, canonica: false },
    { id: idSeed(TIPO_TURMA, 6), serie: '3ª', letra: 'B', capacidade: 50, professorId: PROF3_ID, canonica: false },
    { id: TURMA_3C_ID, serie: '3ª', letra: 'C', capacidade: 50, professorId: PROF1_ID, canonica: true },
  ];
}

function planejarAlunos(
  sorteio: Sorteio,
  turmas: TurmaGerada[],
  parametros: ParametrosPerfil,
): { alunos: AlunoGerado[]; responsaveis: ResponsavelGerado[] } {
  const responsavelCanonico: Record<string, string> = {
    [ALUNO_JOAO_ID]: RESP1_ID,
    [ALUNO_MARIA_CLARA_ID]: RESP1_ID,
    [ALUNO_PEDRO_ID]: RESP1_ID,
    [ALUNO_LUCAS_ID]: RESP2_ID,
    [ALUNO_JULIA_ID]: RESP2_ID,
    [ALUNO_RAFAEL_ID]: RESP3_ID,
    [ALUNO_ISABELA_ID]: RESP3_ID,
    [ALUNO_THIAGO_ID]: RESP3_ID,
  };

  const alunos: AlunoGerado[] = [];
  const responsaveis: ResponsavelGerado[] = [];
  const nomesUsados = new Set<string>(ALUNOS.map((aluno) => aluno.nome));

  // Fixtures canônicas primeiro, preservando os IDs usados pelos testes.
  for (const aluno of ALUNOS) {
    const enturmacao = ENTURMACOES.find((registro) => registro.aluno_id === aluno.id);
    const turma = turmas.find((registro) => registro.id === enturmacao?.turma_id);
    if (!turma) throw new Error(`Turma da fixture não encontrada para ${aluno.nome}.`);
    const sorteada = sortearPropensao(sorteio);
    // A narrativa das fixtures canônicas define o perfil de faltas de Pedro e João.
    const faixaForcada: FaixaPropensao | null =
      aluno.id === ALUNO_PEDRO_ID ? 'alta' : aluno.id === ALUNO_JOAO_ID ? 'media' : null;
    const faixa = faixaForcada ?? sorteada.faixa;
    const propensao = faixaForcada
      ? faixa === 'alta'
        ? 0.1 + sorteio.numero() * 0.03
        : 0.03 + sorteio.numero() * 0.02
      : sorteada.propensao;
    alunos.push({
      id: aluno.id,
      nome: aluno.nome,
      matricula: aluno.matricula,
      codigoInep: aluno.codigo_inep,
      dataNascimento: aluno.data_nascimento,
      status: aluno.status,
      observacoes: aluno.observacoes,
      turmaId: turma.id,
      serie: turma.serie,
      professorId: turma.professorId,
      responsavelId: responsavelCanonico[aluno.id] ?? null,
      faixa,
      propensao,
      canonico: true,
      dataLimite: aluno.id === ALUNO_ANA_BEATRIZ_ID ? isoCivil(data(ANO_VIGENTE, 4, 15)) : null,
    });
  }

  let sequenciaMatricula = 10;
  let sequenciaResponsavel = 0;

  for (const turma of turmas) {
    const canonicosDaTurma = alunos.filter(
      (aluno) => aluno.turmaId === turma.id && aluno.canonico && aluno.dataLimite === null,
    ).length;
    const alvo = sorteio.inteiro(parametros.alunosMin, parametros.alunosMax);
    const quantidade = Math.max(0, alvo - canonicosDaTurma);

    for (let i = 0; i < quantidade; i += 1) {
      sequenciaMatricula += 1;
      sequenciaResponsavel += 1;
      const { faixa, propensao } = sortearPropensao(sorteio);
      const responsavel: ResponsavelGerado = {
        id: idSeed(TIPO_RESPONSAVEL, sequenciaResponsavel),
        nome: gerarNomeSintetico(sorteio, NOMES_RESPONSAVEIS, nomesUsados),
        email: `responsavel${99 + sequenciaResponsavel}@email.com`,
        telefone: gerarTelefone(sorteio),
      };
      responsaveis.push(responsavel);

      const anoNascimento = turma.serie === '1ª' ? ANO_VIGENTE - 15 : turma.serie === '2ª' ? ANO_VIGENTE - 16 : ANO_VIGENTE - 17;
      alunos.push({
        id: idSeed(TIPO_ALUNO, sequenciaMatricula),
        nome: gerarNomeSintetico(sorteio, NOMES_ALUNOS, nomesUsados),
        matricula: `MAT2026${String(sequenciaMatricula).padStart(3, '0')}`,
        codigoInep: String(23124000 + sequenciaMatricula),
        dataNascimento: data(
          anoNascimento,
          sorteio.inteiro(1, 12),
          sorteio.inteiro(1, 28),
        ),
        status: 'ativo',
        observacoes: null,
        turmaId: turma.id,
        serie: turma.serie,
        professorId: turma.professorId,
        responsavelId: responsavel.id,
        faixa,
        propensao,
        canonico: false,
        dataLimite: null,
      });
    }
  }

  return { alunos, responsaveis };
}

function escolherPonderado<T extends { peso: number }>(sorteio: Sorteio, opcoes: readonly T[]): T {
  const total = opcoes.reduce((soma, opcao) => soma + opcao.peso, 0);
  let alvo = sorteio.numero() * total;
  for (const opcao of opcoes) {
    alvo -= opcao.peso;
    if (alvo <= 0) return opcao;
  }
  return opcoes[opcoes.length - 1] as T;
}

// ---------------------------------------------------------------------------
// Frequências, justificativas e ocorrências
// ---------------------------------------------------------------------------

interface AusenciaGerada {
  dia: DiaLetivo;
  parcial: boolean;
  periodo: string;
  motivos: string[];
  observacao: string | null;
}

interface EpisodioGerado {
  inicio: DiaLetivo;
  fim: DiaLetivo;
  dias: AusenciaGerada[];
  justificavel: boolean;
}

const CENARIOS_PARCIAS = [
  {
    motivos: ['enfermaria'],
    observacao: 'Aluno passou mal e foi encaminhado à enfermaria durante a aula.',
  },
  {
    motivos: ['saida_antecipada'],
    observacao: 'Saída antecipada autorizada pela coordenação.',
  },
  {
    motivos: ['consulta_medica'],
    observacao: 'Saiu para consulta médica com autorização da família.',
  },
  {
    motivos: ['atendimento_psicologico'],
    observacao: 'Atendimento psicológico agendado pela escola.',
  },
  {
    motivos: ['atividade_externa'],
    observacao: 'Representou a turma em atividade externa.',
  },
  {
    motivos: ['orientacao'],
    observacao: 'Encaminhado à orientação pedagógica no período.',
  },
];

function descreverAusencia(dia: DiaLetivo, sorteio: Sorteio): AusenciaGerada {
  // Ausência parcial: o aluno perdeu apenas um horário específico.
  if (sorteio.chance(0.22)) {
    const cenario = sorteio.escolher(CENARIOS_PARCIAS);
    return {
      dia,
      parcial: true,
      periodo: sorteio.escolher(['1º Horário', '2º Horário', '3º Horário', '4º Horário']),
      motivos: [...cenario.motivos],
      observacao: cenario.observacao,
    };
  }
  return { dia, parcial: false, periodo: 'Manhã', motivos: [], observacao: null };
}

function simularAusencias(contexto: ContextoSeed, aluno: AlunoGerado): AusenciaGerada[] {
  const limite = aluno.dataLimite;
  const dias = limite
    ? contexto.diasLetivos.filter((dia) => dia.iso <= limite)
    : contexto.diasLetivos;
  const ausencias: AusenciaGerada[] = [];
  let restantesDoEpisodio = 0;

  for (const dia of dias) {
    let ausente = false;
    if (restantesDoEpisodio > 0) {
      ausente = true;
      restantesDoEpisodio -= 1;
    } else {
      // Efeito de segunda e sexta, sazonalidade de doenças e surto coletivo de inverno.
      const fatorDia = dia.diaSemana === 1 ? 1.35 : dia.diaSemana === 5 ? 1.45 : 1;
      const fatorMes = dia.mes >= 5 && dia.mes <= 8 ? 1.5 : 1;
      const fatorSurto = contexto.semanaSurto.has(dia.iso) ? 2.2 : 1;
      const probabilidade = Math.min(
        0.65,
        aluno.propensao * contexto.parametros.densidade * fatorDia * fatorMes * fatorSurto,
      );
      if (contexto.sorteio.chance(probabilidade)) {
        ausente = true;
        // Episódios em cadeia de 1 a 3 dias.
        if (contexto.sorteio.chance(0.45)) restantesDoEpisodio = contexto.sorteio.inteiro(1, 2);
      }
    }
    if (!ausente) continue;
    if (ausencias.length >= 30) break;
    ausencias.push(descreverAusencia(dia, contexto.sorteio));
  }

  // As fixtures canônicas precisam de ao menos uma falta para as telas de monitoramento.
  if (aluno.canonico && ausencias.length === 0 && dias.length) {
    const diaFixo = dias.find((dia) => dia.mes === 3 && dia.diaSemana !== 0 && dia.diaSemana !== 6) ?? dias[0];
    if (diaFixo) ausencias.push(descreverAusencia(diaFixo, contexto.sorteio));
  }

  return ausencias;
}

function agruparEpisodios(
  ausencias: AusenciaGerada[],
  indicePorIso: Map<string, number>,
): EpisodioGerado[] {
  const episodios: EpisodioGerado[] = [];
  let atual: AusenciaGerada[] = [];
  let indiceAnterior = -1;

  for (const ausencia of ausencias) {
    const indice = indicePorIso.get(ausencia.dia.iso) ?? -1;
    if (indice === indiceAnterior + 1 && atual.length) {
      atual.push(ausencia);
    } else {
      if (atual.length) episodios.push(montarEpisodio(atual));
      atual = [ausencia];
    }
    indiceAnterior = indice;
  }
  if (atual.length) episodios.push(montarEpisodio(atual));
  return episodios;
}

function montarEpisodio(dias: AusenciaGerada[]): EpisodioGerado {
  const primeiro = dias[0] as AusenciaGerada;
  const ultimo = dias[dias.length - 1] as AusenciaGerada;
  const justificavel = !dias.some((dia) => dia.motivos.includes('atividade_externa'));
  return { inicio: primeiro.dia, fim: ultimo.dia, dias, justificavel };
}

function motivoDoEpisodio(episodio: EpisodioGerado, sorteio: Sorteio): string {
  if (episodio.dias.some((dia) => dia.motivos.includes('consulta_medica'))) {
    return 'Consulta médica do aluno, com atestado entregue à coordenação.';
  }
  if (episodio.dias.some((dia) => dia.motivos.includes('enfermaria'))) {
    return 'Aluno passou mal na escola e permaneceu em casa no dia seguinte.';
  }
  return sorteio.escolher(MOTIVOS_JUSTIFICATIVA);
}

function chanceJustificativa(faixa: FaixaPropensao): number {
  if (faixa === 'alta') return 0.25;
  if (faixa === 'media') return 0.35;
  return 0.5;
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

async function emLotes<T>(
  dados: T[],
  tamanho: number,
  gravar: (lote: T[]) => Promise<void | unknown>,
): Promise<void> {
  for (let inicio = 0; inicio < dados.length; inicio += tamanho) {
    await gravar(dados.slice(inicio, inicio + tamanho));
  }
}

/** Dias letivos estritamente anteriores a hoje, para eventos com horário. */
function diasAntesDeHoje(contexto: ContextoSeed): DiaLetivo[] {
  return contexto.diasLetivos.filter((dia) => dia.iso < contexto.hoje.iso);
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

async function criarPerfisCanonicos(): Promise<void> {
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
}

async function criarTurmas(contexto: ContextoSeed): Promise<void> {
  for (const turma of contexto.turmas) {
    const nome_completo = `${turma.serie} ${turma.letra}`;
    await prismaAdmin.turmas.upsert({
      where: {
        ano_letivo_id_serie_letra: {
          ano_letivo_id: ANO_LETIVO_ID,
          serie: turma.serie,
          letra: turma.letra,
        },
      },
      create: {
        id: turma.id,
        ano_letivo_id: ANO_LETIVO_ID,
        serie: turma.serie,
        letra: turma.letra,
        nome_completo,
        capacidade: turma.capacidade,
        ativo: true,
      },
      update: { nome_completo, capacidade: turma.capacidade, ativo: true },
    });
  }
}

async function criarAlunos(contexto: ContextoSeed): Promise<void> {
  const canonicos: Prisma.alunosCreateManyInput[] = [];
  const massa: Prisma.alunosCreateManyInput[] = [];

  for (const aluno of contexto.alunos) {
    const registro: Prisma.alunosCreateManyInput = {
      id: aluno.id,
      nome: aluno.nome,
      matricula: aluno.matricula,
      codigo_inep: aluno.codigoInep,
      status: aluno.status,
      data_nascimento: aluno.dataNascimento,
      data_matricula: DATA_MATRICULA,
      observacoes: aluno.observacoes,
      transporte_escolar: aluno.canonico ? false : contexto.sorteio.chance(0.18),
      alimentacao_diferenciada: aluno.canonico ? false : contexto.sorteio.chance(0.12),
      necessidades_especiais: aluno.canonico ? false : contexto.sorteio.chance(0.05),
      documentos_recebidos: aluno.canonico
        ? []
        : contexto.sorteio.amostrar(
            ['rg', 'cpf', 'certidao_nascimento', 'comprovante_residencia', 'cartao_vacina', 'nis'],
            contexto.sorteio.inteiro(0, 4),
          ),
    };
    if (aluno.canonico) {
      canonicos.push(registro);
    } else {
      massa.push(registro);
    }
  }

  // Fixtures canônicas: upsert por matrícula preserva os IDs usados nos testes.
  for (const registro of canonicos) {
    await prismaAdmin.alunos.upsert({
      where: { matricula: registro.matricula },
      create: registro,
      update: {
        nome: registro.nome,
        codigo_inep: registro.codigo_inep,
        status: registro.status,
        data_nascimento: registro.data_nascimento,
        data_matricula: registro.data_matricula,
        observacoes: registro.observacoes,
      },
    });
  }
  await emLotes(massa, 500, (lote) =>
    prismaAdmin.alunos.createMany({ data: lote, skipDuplicates: true }),
  );
}

async function criarEnturmacoes(contexto: ContextoSeed): Promise<void> {
  const canonicas = ENTURMACOES.map((enturmacao) => ({
    aluno_id: enturmacao.aluno_id,
    turma_id: enturmacao.turma_id,
    status: enturmacao.status,
    data_encerramento: enturmacao.data_encerramento,
  }));
  const massa: Prisma.enturmacoesCreateManyInput[] = contexto.alunos
    .filter((aluno) => !aluno.canonico)
    .map((aluno, indice) => ({
      id: idSeed(TIPO_ENTURMACAO, indice + 1),
      aluno_id: aluno.id,
      turma_id: aluno.turmaId,
      ano_letivo_id: ANO_LETIVO_ID,
      status: 'matriculado',
      data_matricula: DATA_MATRICULA,
      data_encerramento: null,
    }));

  for (const enturmacao of canonicas) {
    await prismaAdmin.enturmacoes.upsert({
      where: {
        aluno_id_ano_letivo_id: { aluno_id: enturmacao.aluno_id, ano_letivo_id: ANO_LETIVO_ID },
      },
      create: { ...enturmacao, ano_letivo_id: ANO_LETIVO_ID, data_matricula: DATA_MATRICULA },
      update: {
        turma_id: enturmacao.turma_id,
        status: enturmacao.status,
        data_matricula: DATA_MATRICULA,
        data_encerramento: enturmacao.data_encerramento,
      },
    });
  }
  await emLotes(massa, 500, (lote) =>
    prismaAdmin.enturmacoes.createMany({ data: lote, skipDuplicates: true }),
  );
}

async function criarAtribuicoes(contexto: ContextoSeed): Promise<void> {
  const atribuicoes = [
    ...ATRIBUICOES,
    // Titulares das turmas sem atribuição canônica, para o escopo dos professores.
    ...contexto.turmas
      .filter((turma) => !ATRIBUICOES.some((atribuicao) => atribuicao.turma_id === turma.id && atribuicao.disciplina_id === null))
      .map((turma, indice) => ({
        id: idSeed(TIPO_ATRIBUICAO, indice + 1),
        professor_id: turma.professorId,
        turma_id: turma.id,
        disciplina_id: null,
      })),
  ];

  for (const atribuicao of atribuicoes) {
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

async function criarVinculos(contexto: ContextoSeed): Promise<void> {
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

  const massa: Prisma.vinculos_responsaveisCreateManyInput[] = contexto.alunos
    .filter((aluno) => !aluno.canonico && aluno.responsavelId)
    .map((aluno, indice) => ({
      id: idSeed(TIPO_VINCULO, indice + 1),
      responsavel_id: aluno.responsavelId as string,
      aluno_id: aluno.id,
      tipo_relacao: indice % 3 === 0 ? 'pai' : 'mae',
      contato_prioritario: true,
      ativo: true,
    }));

  await emLotes(massa, 500, (lote) =>
    prismaAdmin.vinculos_responsaveis.createMany({ data: lote, skipDuplicates: true }),
  );
}

async function criarResponsaveis(contexto: ContextoSeed): Promise<void> {
  const senhaResp = process.env.SEED_SENHA_RESP ?? 'Resp123!';
  const senhaHash = await gerarHashSenha(senhaResp);
  const perfis: Prisma.perfisCreateManyInput[] = contexto.responsaveis.map((responsavel) => ({
    id: responsavel.id,
    nome: responsavel.nome,
    email: responsavel.email,
    telefone: responsavel.telefone,
    papel: 'responsavel',
    status: 'ativo',
    senha_hash: senhaHash,
    senha_alterada_em: new Date(),
    acesso_modulos: MODULOS_RESPONSAVEL,
  }));

  await emLotes(perfis, 500, (lote) =>
    prismaAdmin.perfis.createMany({ data: lote, skipDuplicates: true }),
  );

  // Mantém a senha da massa alinhada ao SEED_SENHA_RESP sem duplicar linhas.
  await prismaAdmin.perfis.updateMany({
    where: { id: { in: contexto.responsaveis.map((responsavel) => responsavel.id) } },
    data: { senha_hash: senhaHash, senha_alterada_em: new Date() },
  });
}

interface JustificativaGerada {
  id: string;
  alunoId: string;
  responsavelId: string;
  statusFinal: 'pendente' | 'aceita' | 'recusada';
  avaliadoEm: Date | null;
}

async function criarFrequenciasEJustificativas(
  contexto: ContextoSeed,
): Promise<JustificativaGerada[]> {
  const { sorteio, resumo } = contexto;
  const frequencias: Prisma.frequenciasCreateManyInput[] = [];
  const justificativas: Prisma.justificativas_faltasCreateManyInput[] = [];
  const geradas: JustificativaGerada[] = [];

  for (const aluno of contexto.alunos) {
    const ausencias = simularAusencias(contexto, aluno);
    const episodios = agruparEpisodios(ausencias, contexto.indicePorIso);

    for (const ausencia of ausencias) {
      const periodos = ausencia.parcial ? [ausencia.periodo] : ['Manhã', 'Tarde'];
      for (const periodo of periodos) {
        frequencias.push({
          id: idSeed(TIPO_FREQUENCIA, frequencias.length + 1),
          aluno_id: aluno.id,
          professor_id: aluno.professorId,
          turma_id: aluno.turmaId,
          disciplina_id: null,
          ano_letivo_id: ANO_LETIVO_ID,
          data_aula: ausencia.dia.data,
          tipo_registro: 'chamada_aula',
          periodo,
          status: 'ausente',
          observacao: ausencia.observacao,
          motivos_ausencia: ausencia.motivos,
          created_at: instanteNaEscola(
            ausencia.dia.data.getUTCFullYear(),
            ausencia.dia.data.getUTCMonth() + 1,
            ausencia.dia.data.getUTCDate(),
            7,
            30 + (frequencias.length % 30),
          ),
        });
      }
    }

    for (const [indiceEpisodio, episodio] of episodios.entries()) {
      if (!episodio.justificavel || !aluno.responsavelId) continue;
      // As fixtures canônicas mantêm ao menos um episódio sem justificativa.
      if (aluno.canonico && indiceEpisodio === 0) continue;
      if (!sorteio.chance(chanceJustificativa(aluno.faixa))) continue;

      const diasDesdeFim = diferencaEmDias(episodio.fim.iso, contexto.hoje.iso);
      const recente = diasDesdeFim <= 21;
      const aceita = recente ? sorteio.chance(0.2) : sorteio.chance(0.72);
      const decidida = !recente || aceita;
      const statusFinal: JustificativaGerada['statusFinal'] = decidida
        ? aceita
          ? 'aceita'
          : 'recusada'
        : 'pendente';
      const id = idSeed(TIPO_JUSTIFICATIVA, justificativas.length + 1);
      const criadoEm = instanteNaEscola(
        episodio.fim.data.getUTCFullYear(),
        episodio.fim.data.getUTCMonth() + 1,
        episodio.fim.data.getUTCDate(),
        8,
        sorteio.inteiro(0, 59),
      );
      const avaliadoEm = decidida
        ? new Date(
            Math.min(criadoEm.getTime() + sorteio.inteiro(1, 3) * 86400000, contexto.agora.getTime()),
          )
        : null;

      justificativas.push({
        id,
        responsavel_id: aluno.responsavelId,
        aluno_id: aluno.id,
        data_falta: episodio.inicio.data,
        data_fim: episodio.dias.length > 1 ? episodio.fim.data : null,
        motivo: motivoDoEpisodio(episodio, sorteio),
        status: statusFinal,
        avaliado_por: decidida ? GESTAO_ID : null,
        avaliado_em: avaliadoEm,
        parecer: decidida
          ? aceita
            ? sorteio.escolher(PARECERES_ACEITE)
            : sorteio.escolher(PARECERES_RECUSA)
          : null,
        created_at: criadoEm,
        updated_at: avaliadoEm ?? criadoEm,
      });
      geradas.push({
        id,
        alunoId: aluno.id,
        responsavelId: aluno.responsavelId,
        statusFinal,
        avaliadoEm,
      });
    }
  }

  await emLotes(frequencias, 500, (lote) =>
    prismaAdmin.frequencias.createMany({ data: lote, skipDuplicates: true }),
  );
  await emLotes(justificativas, 500, (lote) =>
    prismaAdmin.justificativas_faltas.createMany({ data: lote, skipDuplicates: true }),
  );

  // Espelha o trigger de aceite, mas restrito às frequências do próprio seed:
  // reaplicar o seed nunca altera registros criados pelos testes.
  await prismaAdmin.$executeRawUnsafe(
    `update public.frequencias f
        set status = 'justificado'
      where f.id::text like $1
        and f.status = 'ausente'
        and f.deleted_at is null
        and exists (
          select 1 from public.justificativas_faltas j
           where j.id::text like $1
             and j.status = 'aceita'
             and j.aluno_id = f.aluno_id
             and f.data_aula >= j.data_falta
             and f.data_aula <= coalesce(j.data_fim, j.data_falta)
        )`,
    PREFIXO_MARCADOR,
  );

  resumo.frequencias += frequencias.length;
  resumo.justificativas += justificativas.length;
  resumo.justificativasAceitas += geradas.filter(
    (justificativa) => justificativa.statusFinal === 'aceita',
  ).length;
  resumo.justificativasRecusadas += geradas.filter(
    (justificativa) => justificativa.statusFinal === 'recusada',
  ).length;

  return geradas;
}

async function criarOcorrenciasCanonicas(): Promise<void> {
  for (const ocorrencia of OCORRENCIAS) {
    await prismaAdmin.ocorrencias.upsert({
      where: { id: ocorrencia.id },
      create: {
        ...ocorrencia,
        ano_letivo_id: ANO_LETIVO_ID,
        created_at: ocorrencia.data_ocorrencia,
        updated_at: ocorrencia.data_ocorrencia,
      },
      update: {
        aluno_id: ocorrencia.aluno_id,
        professor_id: ocorrencia.professor_id,
        turma_id: ocorrencia.turma_id,
        titulo: ocorrencia.titulo,
        descricao: ocorrencia.descricao,
        tipo: ocorrencia.tipo,
        status: ocorrencia.status,
        tags_comportamento: ocorrencia.tags_comportamento,
        data_ocorrencia: ocorrencia.data_ocorrencia,
      },
    });
  }
}

interface ResultadoOcorrencias {
  ocorrencias: Prisma.ocorrenciasCreateManyInput[];
  porAluno: Map<string, Prisma.ocorrenciasCreateManyInput[]>;
}

function gerarOcorrencias(contexto: ContextoSeed): ResultadoOcorrencias {
  const { sorteio } = contexto;
  const ocorrencias: Prisma.ocorrenciasCreateManyInput[] = [];
  const porAluno = new Map<string, Prisma.ocorrenciasCreateManyInput[]>();
  const diasDisponiveis = diasAntesDeHoje(contexto);
  if (!diasDisponiveis.length) return { ocorrencias, porAluno };

  for (const aluno of contexto.alunos) {
    if (aluno.dataLimite) continue; // aluno transferido não recebe registros novos
    const chance = Math.min(0.5, 0.2 * contexto.parametros.densidade);
    if (!sorteio.chance(chance)) continue;
    let quantidade = sorteio.chance(0.25) ? 2 : 1;
    if (aluno.faixa === 'alta' && sorteio.chance(0.3)) quantidade += 1;

    for (let i = 0; i < quantidade; i += 1) {
      const dia = sorteio.escolher(diasDisponiveis);
      const modelo = escolherPonderado(sorteio, MODELOS_OCORRENCIA);
      const dataOcorrencia = instanteNaEscola(
        dia.data.getUTCFullYear(),
        dia.data.getUTCMonth() + 1,
        dia.data.getUTCDate(),
        sorteio.inteiro(7, 16),
        sorteio.inteiro(0, 59),
      );
      const diasDesde = diferencaEmDias(dia.iso, contexto.hoje.iso);
      const status =
        diasDesde <= 15
          ? sorteio.chance(0.5)
            ? 'aberta'
            : 'em_andamento'
          : diasDesde <= 45
            ? sorteio.chance(0.4)
              ? 'em_andamento'
              : 'resolvida'
            : sorteio.chance(0.75)
              ? 'resolvida'
              : 'arquivada';
      const exigePresenca = modelo.exigePresenca;
      const confirmada = exigePresenca && diasDesde > 7 && sorteio.chance(0.6);
      const encerrada = status === 'resolvida' || status === 'arquivada';
      const limiteAgora = contexto.agora.getTime();
      const ocorrencia: Prisma.ocorrenciasCreateManyInput = {
        id: idSeed(TIPO_OCORRENCIA, ocorrencias.length + 1),
        aluno_id: aluno.id,
        professor_id: aluno.professorId,
        coordenador_id: status === 'aberta' ? null : GESTAO_ID,
        turma_id: aluno.turmaId,
        ano_letivo_id: ANO_LETIVO_ID,
        titulo: modelo.titulo,
        descricao: modelo.descricao,
        tipo: modelo.tipo,
        status,
        tags_comportamento: modelo.tags,
        exige_presenca_responsavel: exigePresenca,
        presenca_responsavel_confirmada: confirmada,
        data_confirmacao_presenca: confirmada
          ? new Date(
              Math.min(
                dataOcorrencia.getTime() + sorteio.inteiro(1, 3) * 86400000,
                limiteAgora,
              ),
            )
          : null,
        notificar_coordenacao: true,
        notificar_responsavel: modelo.notificarResponsavel,
        data_ocorrencia: dataOcorrencia,
        closed_at: encerrada
          ? new Date(
              Math.min(
                dataOcorrencia.getTime() + sorteio.inteiro(3, 8) * 86400000,
                limiteAgora,
              ),
            )
          : null,
        created_at: dataOcorrencia,
        updated_at: dataOcorrencia,
      };
      ocorrencias.push(ocorrencia);
      const lista = porAluno.get(aluno.id) ?? [];
      lista.push(ocorrencia);
      porAluno.set(aluno.id, lista);
    }
  }

  return { ocorrencias, porAluno };
}

async function criarOcorrencias(contexto: ContextoSeed): Promise<ResultadoOcorrencias> {
  const resultado = gerarOcorrencias(contexto);
  await emLotes(resultado.ocorrencias, 500, (lote) =>
    prismaAdmin.ocorrencias.createMany({ data: lote, skipDuplicates: true }),
  );
  contexto.resumo.ocorrencias += resultado.ocorrencias.length;
  return resultado;
}

async function criarConversas(contexto: ContextoSeed): Promise<void> {
  const { sorteio, resumo } = contexto;
  const conversas: Prisma.conversasCreateManyInput[] = [];
  const mensagens: Prisma.mensagensCreateManyInput[] = [];
  const diasParaMensagens = contexto.diasLetivos.filter((dia) => dia.iso < contexto.hoje.iso);
  if (!diasParaMensagens.length) return;

  for (const aluno of contexto.alunos) {
    if (!aluno.responsavelId) continue;
    const participa = aluno.canonico || sorteio.chance(0.18 * contexto.parametros.densidade);
    if (!participa) continue;

    const conversaId = idSeed(TIPO_CONVERSA, conversas.length + 1);
    const iniciadaPelaGestao = sorteio.chance(0.35);
    const diasEscolhidos = sorteio
      .amostrar(diasParaMensagens.slice(-90), sorteio.inteiro(1, 3))
      .sort((a, b) => a.iso.localeCompare(b.iso));
    if (!diasEscolhidos.length) continue;
    const primeiraLetra = aluno.nome.split(' ')[0] ?? aluno.nome;
    let remetenteGestao = iniciadaPelaGestao;
    const mensagensDaConversa: Prisma.mensagensCreateManyInput[] = [];

    const quantidade = sorteio.inteiro(3, 7);
    for (let i = 0; i < quantidade; i += 1) {
      const dia = diasEscolhidos[i % diasEscolhidos.length] as DiaLetivo;
      const criadoEm = instanteNaEscola(
        dia.data.getUTCFullYear(),
        dia.data.getUTCMonth() + 1,
        dia.data.getUTCDate(),
        sorteio.inteiro(7, 16),
        sorteio.inteiro(0, 59),
      );
      const texto = remetenteGestao
        ? sorteio.escolher(MENSAGENS_GESTAO).replace('{aluno}', primeiraLetra)
        : sorteio.escolher(MENSAGENS_RESPONSAVEL).replace('{aluno}', primeiraLetra);
      const remetenteId = remetenteGestao ? GESTAO_ID : (aluno.responsavelId as string);
      const diasDesde = diferencaEmDias(isoCivil(dia.data), contexto.hoje.iso);
      mensagensDaConversa.push({
        id: idSeed(TIPO_MENSAGEM, mensagens.length + mensagensDaConversa.length + 1),
        conversa_id: conversaId,
        remetente_id: remetenteId,
        conteudo: texto,
        is_system_message: false,
        lida_em: diasDesde > 5 ? new Date(criadoEm.getTime() + 2 * 3600000) : null,
        created_at: criadoEm,
        updated_at: criadoEm,
      });
      remetenteGestao = !remetenteGestao;
    }

    // A conversa segue a ordem cronológica das mensagens.
    mensagensDaConversa.sort((a, b) => (a.created_at as Date).getTime() - (b.created_at as Date).getTime());
    const ultimaMensagem = (mensagensDaConversa[mensagensDaConversa.length - 1]?.created_at as Date) ?? null;
    mensagens.push(...mensagensDaConversa);

    conversas.push({
      id: conversaId,
      turma_id: aluno.turmaId,
      responsavel_id: aluno.responsavelId,
      aluno_id: aluno.id,
      assunto: sorteio.escolher([
        'Acompanhamento de frequência',
        'Rotina escolar',
        'Alinhamento sobre ocorrência',
        'Devolutiva pedagógica',
      ]),
      ativa: true,
      iniciada_pela_gestao: iniciadaPelaGestao,
      ultima_mensagem_em: ultimaMensagem,
      created_at: (diasEscolhidos[0] as DiaLetivo).data,
      updated_at: ultimaMensagem ?? new Date(),
    });
  }

  await emLotes(conversas, 500, (lote) =>
    prismaAdmin.conversas.createMany({ data: lote, skipDuplicates: true }),
  );
  // O trigger de mensagens gera as notificações de chat; o lote evita duplicar na reaplicação.
  await emLotes(mensagens, 500, (lote) =>
    prismaAdmin.mensagens.createMany({ data: lote, skipDuplicates: true }),
  );

  resumo.conversas += conversas.length;
  resumo.mensagens += mensagens.length;
}

async function criarNotificacoesCanonicas(): Promise<void> {
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

async function criarNotificacoes(
  contexto: ContextoSeed,
  justificativas: JustificativaGerada[],
): Promise<void> {
  const { sorteio } = contexto;
  const notificacoes: Prisma.notificacoesCreateManyInput[] = [];
  const registrar = (
    dados: Omit<Prisma.notificacoesCreateManyInput, 'id'>,
  ): void => {
    notificacoes.push({ id: idSeed(TIPO_NOTIFICACAO, notificacoes.length + 1), ...dados });
  };

  registrar({
    destinatario_id: GESTAO_ID,
    tipo: 'sistema',
    titulo: `Ano letivo de ${contexto.ano} em andamento`,
    corpo: 'Acompanhe o painel de risco, as justificativas e as ocorrências do período.',
    created_at: contexto.diasLetivos[0]?.data ?? new Date(),
    lida: true,
    lida_em: contexto.diasLetivos[0]?.data ?? new Date(),
  });

  const diasAnteriores = diasAntesDeHoje(contexto);

  for (const aluno of contexto.alunos) {
    if (aluno.dataLimite) continue;
    if (aluno.faixa !== 'alta') continue;
    if (!sorteio.chance(0.5)) continue;
    if (!diasAnteriores.length) break;
    const dia = sorteio.escolher(diasAnteriores);
    const criadoEm = instanteNaEscola(
      dia.data.getUTCFullYear(),
      dia.data.getUTCMonth() + 1,
      dia.data.getUTCDate(),
      9,
      sorteio.inteiro(0, 59),
    );
    registrar({
      destinatario_id: GESTAO_ID,
      tipo: 'ausencia_aula',
      titulo: 'Aluno com faltas recorrentes detectado',
      corpo: `${aluno.nome} acumula faltas no período. Recomenda-se acionar o monitoramento.`,
      metadados: { aluno_id: aluno.id },
      created_at: criadoEm,
      lida: false,
    });
    if (aluno.responsavelId) {
      registrar({
        destinatario_id: aluno.responsavelId,
        tipo: 'ausencia_aula',
        titulo: 'Faltas registradas',
        corpo: `Foram registradas faltas de ${aluno.nome}. A coordenação está à disposição.`,
        metadados: { aluno_id: aluno.id },
        created_at: criadoEm,
        lida: false,
      });
    }
  }

  for (const justificativa of justificativas) {
    if (justificativa.statusFinal === 'pendente') continue;
    if (!sorteio.chance(0.5)) continue;
    const avaliadoEm = justificativa.avaliadoEm ?? contexto.agora;
    registrar({
      destinatario_id: justificativa.responsavelId,
      tipo: 'justificativa',
      titulo: justificativa.statusFinal === 'aceita' ? 'Justificativa aceita' : 'Justificativa recusada',
      corpo: 'A coordenação avaliou a justificativa enviada.',
      metadados: { aluno_id: justificativa.alunoId, justificativa_id: justificativa.id },
      created_at: avaliadoEm,
      lida: true,
      lida_em: new Date(Math.min(avaliadoEm.getTime() + 3600000, contexto.agora.getTime())),
    });
  }

  for (const justificativa of justificativas) {
    if (justificativa.statusFinal !== 'pendente') continue;
    if (!sorteio.chance(0.4)) continue;
    registrar({
      destinatario_id: GESTAO_ID,
      tipo: 'justificativa',
      titulo: 'Justificativa aguardando validação',
      corpo: 'Há uma justificativa pendente na fila de validação.',
      metadados: { aluno_id: justificativa.alunoId, justificativa_id: justificativa.id },
      created_at: contexto.agora,
      lida: false,
    });
  }

  await emLotes(notificacoes, 500, (lote) =>
    prismaAdmin.notificacoes.createMany({ data: lote, skipDuplicates: true }),
  );
}

async function criarMonitoramento(
  contexto: ContextoSeed,
  ocorrencias: ResultadoOcorrencias,
): Promise<void> {
  const { sorteio, resumo } = contexto;
  const acoes: Prisma.monitoramento_acoesCreateManyInput[] = [];
  const registrados = new Set<string>();
  const diasAnteriores = diasAntesDeHoje(contexto);

  for (const aluno of contexto.alunos) {
    if (aluno.dataLimite || !aluno.responsavelId) continue;
    const temOcorrenciaCritica = (ocorrencias.porAluno.get(aluno.id) ?? []).some(
      (ocorrencia) => ocorrencia.exige_presenca_responsavel,
    );
    if (aluno.faixa !== 'alta' && !temOcorrenciaCritica) continue;
    if (registrados.has(aluno.id)) continue;
    registrados.add(aluno.id);
    if (!sorteio.chance(0.7)) continue;
    if (!diasAnteriores.length) break;

    const quantidade = sorteio.chance(0.3) ? 2 : 1;
    for (let i = 0; i < quantidade; i += 1) {
      const pendente = sorteio.chance(0.35);
      const dia = sorteio.escolher(diasAnteriores);
      const criadoEm = instanteNaEscola(
        dia.data.getUTCFullYear(),
        dia.data.getUTCMonth() + 1,
        dia.data.getUTCDate(),
        10,
        sorteio.inteiro(0, 59),
      );
      acoes.push({
        id: idSeed(TIPO_MONITORAMENTO, acoes.length + 1),
        aluno_id: aluno.id,
        responsavel_id: aluno.responsavelId,
        tipo_contato: sorteio.escolher(['telefone', 'whatsapp', 'presencial', 'carta'] as const),
        status: pendente ? 'pendente' : 'realizado',
        realizado_por: pendente ? null : GESTAO_ID,
        observacao: pendente
          ? 'Contato agendado com o responsável para tratar da frequência do aluno.'
          : 'Contato realizado com o responsável e orientações registradas.',
        agendado_para: pendente
          ? new Date(contexto.agora.getTime() + sorteio.inteiro(2, 7) * 86400000)
          : null,
        realizado_em: pendente ? null : new Date(criadoEm.getTime() + 86400000),
        created_at: criadoEm,
        updated_at: criadoEm,
      });
    }
  }

  await emLotes(acoes, 500, (lote) =>
    prismaAdmin.monitoramento_acoes.createMany({ data: lote, skipDuplicates: true }),
  );
  resumo.monitoramento += acoes.length;
}

async function criarAuditoria(contexto: ContextoSeed): Promise<void> {
  const { sorteio, resumo } = contexto;
  const eventos: Prisma.auditoriaCreateManyInput[] = [];
  const ip = (): string => `203.0.113.${sorteio.inteiro(1, 254)}`;
  const diasAnteriores = diasAntesDeHoje(contexto);
  if (!diasAnteriores.length) return;
  const instante = (dia: DiaLetivo, hora: number): Date =>
    instanteNaEscola(
      dia.data.getUTCFullYear(),
      dia.data.getUTCMonth() + 1,
      dia.data.getUTCDate(),
      hora,
      sorteio.inteiro(0, 59),
    );

  const registrar = (dados: Omit<Prisma.auditoriaCreateManyInput, 'id'>): void => {
    eventos.push({ id: idSeed(TIPO_AUDITORIA, eventos.length + 1), ...dados });
  };

  // Matrícula: criação de alunos e responsáveis no início do ano letivo.
  const primeirosDias = diasAnteriores.slice(0, 5);
  for (const aluno of contexto.alunos) {
    if (aluno.canonico) continue;
    const dia = primeirosDias[eventos.length % primeirosDias.length] as DiaLetivo;
    registrar({
      usuario_id: GESTAO_ID,
      acao: 'CRIAR_ALUNO',
      entidade: 'alunos',
      entidade_id: aluno.id,
      dados_novos: { nome: aluno.nome, matricula: aluno.matricula, status: 'ativo' },
      ip_origem: ip(),
      created_at: instante(dia, 8),
    });
  }
  for (const responsavel of contexto.responsaveis) {
    const dia = primeirosDias[eventos.length % primeirosDias.length] as DiaLetivo;
    registrar({
      usuario_id: GESTAO_ID,
      acao: 'CRIAR_USUARIO',
      entidade: 'perfis',
      entidade_id: responsavel.id,
      dados_novos: { nome: responsavel.nome, papel: 'responsavel' },
      ip_origem: ip(),
      created_at: instante(dia, 9),
    });
  }

  // Sessões: logins dos perfis canônicos e de parte dos responsáveis.
  const perfisCanonicos = [GESTAO_ID, PROF1_ID, PROF2_ID, PROF3_ID, RESP1_ID, RESP2_ID, RESP3_ID];
  for (const perfilId of perfisCanonicos) {
    const quantidade = sorteio.inteiro(3, 6);
    for (let i = 0; i < quantidade; i += 1) {
      const dia = sorteio.escolher(diasAnteriores);
      registrar({
        usuario_id: perfilId,
        acao: 'LOGIN',
        entidade: 'perfis',
        entidade_id: perfilId,
        ip_origem: ip(),
        created_at: instante(dia, sorteio.inteiro(7, 17)),
      });
    }
  }
  for (const responsavel of sorteio.amostrar(contexto.responsaveis, Math.min(60, contexto.responsaveis.length))) {
    const dia = sorteio.escolher(diasAnteriores);
    registrar({
      usuario_id: responsavel.id,
      acao: 'LOGIN',
      entidade: 'perfis',
      entidade_id: responsavel.id,
      ip_origem: ip(),
      created_at: instante(dia, sorteio.inteiro(7, 20)),
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const dia = sorteio.escolher(diasAnteriores);
    registrar({
      usuario_id: null,
      acao: 'LOGIN_FALHA',
      entidade: 'perfis',
      entidade_id: null,
      dados_novos: { email: `tentativa${i + 1}@escola.edu.br` },
      ip_origem: ip(),
      created_at: instante(dia, sorteio.inteiro(7, 20)),
    });
  }

  // Códigos de redefinição canônicos.
  const diaCodigos = diasAnteriores[diasAnteriores.length - 1] as DiaLetivo;
  registrar({
    usuario_id: GESTAO_ID,
    acao: 'GERAR_CODIGO',
    entidade: 'codigos_redefinicao',
    entidade_id: 'f5000000-0000-0000-0000-000000000001',
    ip_origem: ip(),
    created_at: instante(diaCodigos, 8),
  });
  registrar({
    usuario_id: RESP1_ID,
    acao: 'USAR_CODIGO',
    entidade: 'codigos_redefinicao',
    entidade_id: 'f5000000-0000-0000-0000-000000000002',
    ip_origem: ip(),
    created_at: instante(diaCodigos, 10),
  });
  registrar({
    usuario_id: GESTAO_ID,
    acao: 'REVOGAR_CODIGO',
    entidade: 'codigos_redefinicao',
    entidade_id: 'f5000000-0000-0000-0000-000000000003',
    ip_origem: ip(),
    created_at: instante(diaCodigos, 11),
  });

  await emLotes(eventos, 500, (lote) =>
    prismaAdmin.auditoria.createMany({ data: lote, skipDuplicates: true }),
  );
  resumo.auditoria += eventos.length;
}

async function criarRegistrosComportamento(contexto: ContextoSeed): Promise<void> {
  const { sorteio, resumo } = contexto;
  const registros: Prisma.registros_comportamentoCreateManyInput[] = [];
  const vinculos: Array<{ registroId: string; nomeTag: string }> = [];
  const tagsPositivas = ['Participativo', 'Colaborativo', 'Pontual', 'Protagonista', 'Respeitoso', 'Cooperativo'];
  const diasAnteriores = diasAntesDeHoje(contexto);
  if (!diasAnteriores.length) return;

  for (const aluno of contexto.alunos) {
    if (aluno.dataLimite) continue;
    if (!sorteio.chance(0.3 * contexto.parametros.densidade)) continue;
    const quantidade = sorteio.chance(0.3) ? 2 : 1;
    for (let i = 0; i < quantidade; i += 1) {
      const dia = sorteio.escolher(diasAnteriores);
      const id = idSeed(TIPO_REGISTRO, registros.length + 1);
      const dataHora = instanteNaEscola(
        dia.data.getUTCFullYear(),
        dia.data.getUTCMonth() + 1,
        dia.data.getUTCDate(),
        sorteio.inteiro(7, 16),
        sorteio.inteiro(0, 59),
      );
      registros.push({
        id,
        aluno_id: aluno.id,
        professor_id: aluno.professorId,
        turma_id: aluno.turmaId,
        disciplina_id: null,
        ano_letivo_id: ANO_LETIVO_ID,
        data_hora: dataHora,
        observacao: sorteio.escolher(OBSERVACOES_POSITIVAS),
        created_at: dataHora,
        updated_at: dataHora,
      });
      for (const nome of sorteio.amostrar(tagsPositivas, sorteio.inteiro(1, 2))) {
        vinculos.push({ registroId: id, nomeTag: nome });
      }
    }
  }

  await emLotes(registros, 500, (lote) =>
    prismaAdmin.registros_comportamento.createMany({ data: lote, skipDuplicates: true }),
  );

  // A junção nasce com o nome da tag e é resolvida para o id real antes do insert.
  if (vinculos.length) {
    const tags = await prismaAdmin.tags_comportamento.findMany({
      where: { nome: { in: tagsPositivas } },
      select: { id: true, nome: true },
    });
    const idPorNome = new Map(tags.map((tag) => [tag.nome, tag.id]));
    const resolvidos: Prisma.registro_comportamento_tagsCreateManyInput[] = [];
    for (const vinculo of vinculos) {
      const tagId = idPorNome.get(vinculo.nomeTag);
      if (!tagId) continue;
      resolvidos.push({ registro_id: vinculo.registroId, tag_id: tagId });
    }
    await emLotes(resolvidos, 500, (lote) =>
      prismaAdmin.registro_comportamento_tags.createMany({ data: lote, skipDuplicates: true }),
    );
  }

  resumo.registros += registros.length;
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

async function criarMonitoramentoCanonico(): Promise<void> {
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

/**
 * Remove apenas as linhas com o marcador do seed, na ordem segura para as chaves
 * estrangeiras. Fixtures canônicas, dados de testes e dados reais ficam intactos.
 */
async function limparMassaSeed(): Promise<void> {
  await prismaAdmin.$executeRawUnsafe(
    `delete from public.notificacoes
      where id::text like $1
         or metadados->>'conversa_id' like $1
         or metadados->>'aluno_id' like $1`,
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.mensagens where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.conversas where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.justificativas_faltas where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.registro_comportamento_tags where registro_id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.registros_comportamento where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.frequencias where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.ocorrencias where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.monitoramento_acoes where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.auditoria where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.vinculos_responsaveis where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.atribuicoes_professores where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.enturmacoes where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.perfis where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.alunos where id::text like $1',
    PREFIXO_MARCADOR,
  );
  await prismaAdmin.$executeRawUnsafe(
    'delete from public.turmas where id::text like $1',
    PREFIXO_MARCADOR,
  );
}

/** Remove as frequências fixas do seed anterior, sem tocar em justificativas que as referenciem. */
async function removerFrequenciasLegadas(): Promise<void> {
  await prismaAdmin.$executeRawUnsafe(
    `delete from public.frequencias f
      where f.id::text like 'f2000000-%'
        and not exists (
          select 1 from public.justificativas_faltas j where j.frequencia_id = f.id
        )`,
  );
}

async function planejarContexto(): Promise<ContextoSeed> {
  const perfil = lerPerfil();
  const semente = process.env.SEED_SEMENTE ?? 'buscapp-dev';
  const sorteio = criarSorteio(`${semente}|${perfil}`);
  const hoje = hojeCivil();
  const diasLetivos = diasLetivosDoAno(hoje.ano, hoje.iso);
  const indicePorIso = new Map(diasLetivos.map((dia, indice) => [dia.iso, indice]));
  const turmas = planejarTurmas();
  const { alunos, responsaveis } = planejarAlunos(sorteio, turmas, PARAMETROS_PERFIL[perfil]);

  // Surto coletivo de inverno: uma semana de junho com transmissão alta entre os alunos.
  const diasDeJunho = diasLetivos.filter((dia) => dia.mes === 6);
  const inicioSurto = Math.min(
    Math.max(0, diasDeJunho.length - 5),
    Math.floor(sorteio.numero() * Math.max(1, diasDeJunho.length - 5)),
  );
  const semanaSurto = new Set(diasDeJunho.slice(inicioSurto, inicioSurto + 5).map((dia) => dia.iso));

  return {
    sorteio,
    perfil,
    parametros: PARAMETROS_PERFIL[perfil],
    ano: hoje.ano,
    hoje,
    agora: new Date(),
    diasLetivos,
    indicePorIso,
    semanaSurto,
    turmas,
    alunos,
    responsaveis,
    resumo: {
      turmas: turmas.length,
      alunos: alunos.length,
      alunosMassa: alunos.filter((aluno) => !aluno.canonico).length,
      responsaveis: responsaveis.length,
      enturmacoes: alunos.filter((aluno) => !aluno.canonico).length + ENTURMACOES.length,
      atribuicoes: 0,
      vinculos: VINCULOS.length + responsaveis.length,
      diasLetivos: diasLetivos.length,
      frequencias: 0,
      justificativas: 0,
      justificativasAceitas: 0,
      justificativasRecusadas: 0,
      ocorrencias: OCORRENCIAS.length,
      conversas: 0,
      mensagens: 0,
      notificacoes: NOTIFICACOES.length,
      monitoramento: MONITORAMENTO.length,
      auditoria: 0,
      registros: 0,
    },
  };
}

/** Cria/atualiza as fixtures canônicas e a massa sintética com os IDs determinísticos. */
export async function executarSeed(): Promise<void> {
  const limpar = process.env.SEED_LIMPAR === 'true';
  const semente = process.env.SEED_SEMENTE ?? 'buscapp-dev';
  const contexto = await planejarContexto();
  const inicio = Date.now();

  if (limpar) {
    await limparMassaSeed();
  }
  await removerFrequenciasLegadas();

  // Ordem segura para as FKs: catálogos e pessoas antes das atividades.
  await criarAnoLetivo();
  await criarPerfisCanonicos();
  await criarResponsaveis(contexto);
  await criarTurmas(contexto);
  await criarAlunos(contexto);
  await criarEnturmacoes(contexto);
  await criarAtribuicoes(contexto);
  await criarVinculos(contexto);
  contexto.resumo.atribuicoes = await prismaAdmin.atribuicoes_professores.count({
    where: { turma_id: { in: contexto.turmas.map((turma) => turma.id) } },
  });

  const justificativas = await criarFrequenciasEJustificativas(contexto);
  await criarOcorrenciasCanonicas();
  const ocorrencias = await criarOcorrencias(contexto);
  await criarConversas(contexto);
  await criarNotificacoesCanonicas();
  await criarMonitoramentoCanonico();
  await criarMonitoramento(contexto, ocorrencias);
  await criarRegistrosComportamento(contexto);
  await criarAuditoria(contexto);
  await criarCodigosRedefinicao();

  await criarNotificacoes(contexto, justificativas);

  // Os triggers de chat e ocorrência criam notificações próprias; o resumo conta o total real.
  const notificacoesReais = await prismaAdmin.$queryRaw<Array<{ total: number }>>`
    select count(*)::int as total
    from public.notificacoes
    where id::text like ${PREFIXO_MARCADOR}
       or metadados->>'conversa_id' like ${PREFIXO_MARCADOR}
       or metadados->>'aluno_id' like ${PREFIXO_MARCADOR}
  `;
  contexto.resumo.notificacoes += notificacoesReais[0]?.total ?? 0;

  const { resumo } = contexto;
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log('Seed de desenvolvimento aplicado.');
  console.log(
    `Parâmetros: perfil ${contexto.perfil}, semente "${semente}", limpeza prévia ${limpar ? 'sim' : 'não'}.`,
  );
  console.log(
    `Ano letivo ${contexto.ano}: ${resumo.diasLetivos} dias letivos até ${contexto.hoje.iso}, sem feriados nem recesso de julho.`,
  );
  console.log(
    `Turmas ${resumo.turmas} | alunos ${resumo.alunos} (${resumo.alunosMassa} sintéticos) | responsáveis ${resumo.responsaveis}.`,
  );
  console.log(
    `Enturmações ${resumo.enturmacoes} | atribuições ${resumo.atribuicoes} | vínculos ${resumo.vinculos}.`,
  );
  console.log(
    `Frequências ${resumo.frequencias} | justificativas ${resumo.justificativas} (${resumo.justificativasAceitas} aceitas, ${resumo.justificativasRecusadas} recusadas, ${resumo.justificativas - resumo.justificativasAceitas - resumo.justificativasRecusadas} pendentes).`,
  );
  console.log(
    `Ocorrências ${resumo.ocorrencias} | conversas ${resumo.conversas} | mensagens ${resumo.mensagens}.`,
  );
  console.log(
    `Notificações ${resumo.notificacoes} | monitoramento ${resumo.monitoramento} | auditoria ${resumo.auditoria} | registros de comportamento ${resumo.registros}.`,
  );
  console.log(`Concluído em ${segundos}s. Para recriar a massa, use SEED_LIMPAR=true.`);
}

const executadoDiretamente =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDiretamente) {
  await executarSeed()
    .then(() => prismaAdmin.$disconnect())
    .catch(async (erro) => {
      console.error('Falha ao aplicar o seed:', erro);
      await prismaAdmin.$disconnect();
      process.exit(1);
    });
}
