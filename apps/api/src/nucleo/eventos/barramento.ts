import type { FastifyReply } from 'fastify';

export interface EventoInvalidacao {
  tabela: string;
  escopo?: Record<string, string>;
  destinatarios?: string[];
}

interface Conexao {
  usuarioId: string;
  enviar: (dados: string) => void;
}

const conexoes = new Set<Conexao>();

/** Notifica clientes SSE conectados; sem destinatários, transmite a todos os autenticados. */
export function publicarEvento(evento: EventoInvalidacao): void {
  const payload = `event: invalidar\ndata: ${JSON.stringify({
    tabela: evento.tabela,
    escopo: evento.escopo ?? {},
  })}\n\n`;

  for (const conexao of conexoes) {
    if (evento.destinatarios && !evento.destinatarios.includes(conexao.usuarioId)) continue;
    try {
      conexao.enviar(payload);
    } catch {
      conexoes.delete(conexao);
    }
  }
}

export function conectarEventos(usuarioId: string, resposta: FastifyReply): void {
  resposta.hijack();
  const bruto = resposta.raw;

  bruto.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
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
