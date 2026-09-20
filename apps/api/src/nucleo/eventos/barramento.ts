import type { FastifyReply } from 'fastify';
import { Redis } from 'ioredis';
import { Client } from 'pg';
import { ambiente } from '../../ambiente.js';
import { prisma } from '../banco/cliente.js';

export interface EventoInvalidacao {
  tabela: string;
  escopo?: Record<string, string>;
  destinatarios?: string[];
}

interface MensagemEvento {
  tabela: string;
  escopo?: Record<string, string>;
  destinatarios?: string[];
}

interface Conexao {
  usuarioId: string;
  enviar: (dados: string) => void;
}

const conexoes = new Set<Conexao>();
const CANAL = 'buscapp_eventos';
/** Limite de payload do `pg_notify`. */
const LIMITE_PAYLOAD = 7_000;

let publicador: Redis | null = null;
let assinante: Redis | null = null;
let escuta: Client | null = null;
let escutaAtiva = false;
let reconexaoAgendada: NodeJS.Timeout | null = null;
let iniciado = false;

function formatarEvento(mensagem: MensagemEvento): string {
  return `event: invalidar\ndata: ${JSON.stringify({
    tabela: mensagem.tabela,
    escopo: mensagem.escopo ?? {},
  })}\n\n`;
}

/** Entrega a mensagem às conexões locais, respeitando os destinatários quando informados. */
function entregarLocal(mensagem: MensagemEvento): void {
  if (!mensagem?.tabela) return;
  const dados = formatarEvento(mensagem);

  for (const conexao of conexoes) {
    if (mensagem.destinatarios && !mensagem.destinatarios.includes(conexao.usuarioId)) continue;
    try {
      conexao.enviar(dados);
    } catch {
      conexoes.delete(conexao);
    }
  }
}

function garantirPublicador(): Redis {
  publicador ??= new Redis(ambiente.REDIS_URL, {
    connectTimeout: 3_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  // Sem o ouvinte de erro, uma falha de conexão derruba o processo.
  publicador.on('error', () => undefined);
  return publicador;
}

async function publicar(mensagem: string): Promise<void> {
  try {
    await garantirPublicador().publish(CANAL, mensagem);
    return;
  } catch {
    /* Redis indisponível: publica pelo Postgres. */
  }

  try {
    if (mensagem.length > LIMITE_PAYLOAD) return;
    await prisma.$executeRawUnsafe('select pg_notify($1, $2)', CANAL, mensagem);
  } catch {
    /* Sem barramento disponível; os clientes revalidam ao reconectar. */
  }
}

/** Notifica clientes SSE; sem destinatários, transmite a todos os autenticados. */
export function publicarEvento(evento: EventoInvalidacao): void {
  const mensagem = JSON.stringify({
    tabela: evento.tabela,
    escopo: evento.escopo ?? {},
    ...(evento.destinatarios ? { destinatarios: evento.destinatarios } : {}),
  });
  void publicar(mensagem);
}

function tratarMensagem(bruta: string): void {
  try {
    entregarLocal(JSON.parse(bruta) as MensagemEvento);
  } catch {
    /* evento malformado é ignorado */
  }
}

async function conectarAssinante(): Promise<void> {
  if (assinante) return;
  // O assinante precisa enfileirar o `subscribe` até a conexão ficar pronta.
  assinante = new Redis(ambiente.REDIS_URL, {
    connectTimeout: 3_000,
    maxRetriesPerRequest: null,
  });
  assinante.on('error', () => undefined);
  assinante.on('message', (_canal: string, mensagem: string) => tratarMensagem(mensagem));
  await assinante.subscribe(CANAL);
}

function agendarReconexaoDaEscuta(): void {
  if (!escutaAtiva || reconexaoAgendada) return;
  reconexaoAgendada = setTimeout(() => {
    reconexaoAgendada = null;
    void conectarEscuta();
  }, 5_000);
  reconexaoAgendada.unref();
}

async function conectarEscuta(): Promise<void> {
  const url =
    ambiente.DATABASE_URL_ESCUTA ?? ambiente.MIGRATE_DATABASE_URL ?? ambiente.DATABASE_URL;

  const cliente = new Client({ connectionString: url, application_name: 'buscapp-escutas' });
  cliente.on('error', () => {
    escuta = null;
    agendarReconexaoDaEscuta();
  });
  cliente.on('end', () => {
    escuta = null;
    agendarReconexaoDaEscuta();
  });
  cliente.on('notification', (notificacao) => {
    if (notificacao.channel === CANAL && notificacao.payload) tratarMensagem(notificacao.payload);
  });

  await cliente.connect();
  await cliente.query(`listen ${CANAL}`);
  escuta = cliente;
}

/**
 * Liga as assinaturas do barramento: Redis pub/sub como caminho principal e
 * `LISTEN/NOTIFY` do Postgres como fallback entre instâncias.
 */
export async function iniciarBarramento(): Promise<void> {
  if (iniciado) return;
  iniciado = true;
  escutaAtiva = true;

  await conectarAssinante().catch(() => undefined);
  await conectarEscuta().catch(() => agendarReconexaoDaEscuta());
}

/** Encerra assinaturas e conexões; usado no shutdown e no fim dos testes. */
export async function encerrarBarramento(): Promise<void> {
  escutaAtiva = false;
  if (reconexaoAgendada) {
    clearTimeout(reconexaoAgendada);
    reconexaoAgendada = null;
  }

  const clienteEscuta = escuta;
  escuta = null;
  if (clienteEscuta) await clienteEscuta.end().catch(() => undefined);

  const assinanteAtual = assinante;
  assinante = null;
  if (assinanteAtual) assinanteAtual.disconnect();

  const publicadorAtual = publicador;
  publicador = null;
  if (publicadorAtual) publicadorAtual.disconnect();

  iniciado = false;
}

/** Quantidade de conexões SSE abertas nesta instância. */
export function contarConexoes(): number {
  return conexoes.size;
}

export function conectarEventos(
  usuarioId: string,
  resposta: FastifyReply,
  origemPermitida?: string,
): void {
  resposta.hijack();
  const bruto = resposta.raw;

  bruto.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...(origemPermitida
      ? {
          'Access-Control-Allow-Origin': origemPermitida,
          'Access-Control-Allow-Credentials': 'true',
          Vary: 'Origin',
        }
      : {}),
  });
  bruto.write(': conectado\n\n');

  const conexao: Conexao = { usuarioId, enviar: (dados) => bruto.write(dados) };
  conexoes.add(conexao);

  const heartbeat = setInterval(() => {
    try {
      bruto.write(': ping\n\n');
    } catch {
      /* conexão encerrando */
    }
  }, 25_000);

  const encerrar = () => {
    clearInterval(heartbeat);
    conexoes.delete(conexao);
    bruto.end();
  };

  bruto.on('close', encerrar);
  bruto.on('error', encerrar);
}
