// Verifica se a versão da raiz, dos workspaces e do lockfile está sincronizada.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const alvos = ['.', 'apps/api', 'apps/web', 'packages/contratos'];
const divergencias = [];

for (const caminho of alvos) {
  const pacote = caminho === '.' ? raiz : JSON.parse(readFileSync(resolve(caminho, 'package.json'), 'utf8'));
  const chave = caminho === '.' ? '' : caminho;
  const trava = lock.packages?.[chave]?.version;
  if (pacote.version !== raiz.version) {
    divergencias.push(`${caminho}: ${pacote.version}, diferente da raiz ${raiz.version}`);
  }
  if (trava !== raiz.version) {
    divergencias.push(`${caminho}: lockfile em ${trava}, diferente da raiz ${raiz.version}`);
  }
}

if (divergencias.length > 0) {
  console.error(divergencias.join('\n'));
  process.exit(1);
}

console.log(`Versões alinhadas em ${raiz.version}.`);
