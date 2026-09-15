import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

if (process.env.VERCEL) {
  console.log('Preparação dos contratos ignorada na Vercel: cada serviço compila no build.');
  process.exit(0);
}

const requireRaiz = createRequire(import.meta.url);
const requireContratos = createRequire(
  new URL('../packages/contratos/package.json', import.meta.url),
);

function disponivel(pacote) {
  for (const resolver of [requireRaiz, requireContratos]) {
    try {
      resolver.resolve(pacote);
      return true;
    } catch {
      // tenta o próximo ponto de resolução
    }
  }
  return false;
}

if (!disponivel('zod') || !disponivel('typescript')) {
  console.log('Dependências de build dos contratos ausentes; preparação ignorada.');
  process.exit(0);
}

execSync('npm run build -w @buscapp/contratos', { stdio: 'inherit' });
