// Verifica se a versão da raiz, dos workspaces e dos importers do lockfile está sincronizada.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = readFileSync('pnpm-lock.yaml', 'utf8');
const linhas = new Set(lock.split('\n'));
const alvos = ['.', 'apps/api', 'apps/web', 'packages/contratos'];
const divergencias = [];

for (const caminho of alvos) {
  const pacote = caminho === '.' ? raiz : JSON.parse(readFileSync(resolve(caminho, 'package.json'), 'utf8'));
  if (pacote.version !== raiz.version) {
    divergencias.push(`${caminho}: ${pacote.version}, diferente da raiz ${raiz.version}`);
  }
  // O lockfile do pnpm não guarda a versão do próprio pacote em cada importer;
  // confere se a seção do pacote existe para pegar lockfile desatualizado.
  if (!linhas.has(`  ${caminho}:`)) {
    divergencias.push(`${caminho}: seção ausente no pnpm-lock.yaml`);
  }
}

if (divergencias.length > 0) {
  console.error(divergencias.join('\n'));
  process.exit(1);
}

console.log(`Versões alinhadas em ${raiz.version}.`);
