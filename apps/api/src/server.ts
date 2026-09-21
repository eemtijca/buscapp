import type { FastifyInstance } from 'fastify';
import { ambiente } from './ambiente.js';
import { construirApp } from './aplicacao.js';
import { prisma } from './nucleo/banco/cliente.js';
import { contarConexoes, encerrarConexoes } from './nucleo/eventos/barramento.js';

// A importação de `fastify` acima é exigida pela detecção de entrada do framework na Vercel:
// o arquivo de entrada do servidor precisa importar `fastify` e chamar `listen`.
const app: FastifyInstance = await construirApp();

/** Tempo máximo para drenar conexões e fechar o app antes de sair. */
const TIMEOUT_DRENAGEM_MS = 10_000;

let encerrando = false;

async function encerrar(sinal: string) {
  if (encerrando) return;
  encerrando = true;

  const conexoes = contarConexoes();
  app.log.info({ sinal, conexoes_sse: conexoes }, 'Encerrando a API');

  // O SSE mantém a conexão aberta: encerra os streams antes de aguardar o `close`.
  const encerradas = encerrarConexoes();

  const timeout = new Promise<void>((resolver) => {
    setTimeout(resolver, TIMEOUT_DRENAGEM_MS).unref();
  });

  await Promise.race([app.close(), timeout]).catch((erro: unknown) => {
    app.log.error(erro, 'Falha ao encerrar o app');
  });
  await prisma.$disconnect().catch(() => undefined);

  app.log.info({ conexoes_sse: encerradas }, 'Conexões SSE encerradas');
  process.exit(0);
}

process.on('SIGINT', () => void encerrar('SIGINT'));
process.on('SIGTERM', () => void encerrar('SIGTERM'));

await app.ready();
// Sem `await`: na Vercel o `listen` é capturado para expor o servidor e não emite `listening`;
// aguardar a Promise travaria a avaliação do módulo.
app.listen({ port: ambiente.PORT, host: ambiente.HOST }).catch((erro) => {
  app.log.error(erro);
  process.exit(1);
});
