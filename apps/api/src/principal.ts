import { construirApp } from './app.js';
import { ambiente } from './ambiente.js';
import { prisma } from './nucleo/banco/cliente.js';

const app = await construirApp();

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
