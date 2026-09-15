import type { FastifyInstance } from 'fastify';
import { ambiente } from './ambiente.js';
import { construirApp } from './aplicacao.js';
import { prisma } from './nucleo/banco/cliente.js';

// A importação de `fastify` acima é exigida pela detecção de entrada do framework na Vercel:
// o arquivo de entrada do servidor precisa importar `fastify` e chamar `listen`.
const app: FastifyInstance = await construirApp();

async function encerrar(sinal: string) {
  app.log.info({ sinal }, 'Encerrando a API');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void encerrar('SIGINT'));
process.on('SIGTERM', () => void encerrar('SIGTERM'));

try {
  await app.listen({ port: ambiente.PORT, host: ambiente.HOST });
} catch (erro) {
  app.log.error(erro);
  process.exit(1);
}
