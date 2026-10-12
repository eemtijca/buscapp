// Baixa a especificação OpenAPI da API em execução para apps/api/openapi.json.
// Uso: com o ambiente no ar (pnpm run compose:up), rode pnpm run openapi:lint.
// A URL pode ser trocada pela variável OPENAPI_URL.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const url = process.env.OPENAPI_URL ?? 'http://127.0.0.1:3000/api/docs/openapi.json';
const destino = path.resolve('apps/api/openapi.json');

let resposta;
try {
  resposta = await fetch(url);
} catch {
  console.error(`Não foi possível alcançar ${url}. Suba o ambiente com pnpm run compose:up.`);
  process.exit(1);
}

if (!resposta.ok) {
  console.error(`A especificação respondeu ${resposta.status} em ${url}.`);
  process.exit(1);
}

const especificacao = await resposta.json();
if (!String(especificacao.openapi ?? '').startsWith('3.1')) {
  console.error('A especificação baixada não declara OpenAPI 3.1.');
  process.exit(1);
}

writeFileSync(destino, `${JSON.stringify(especificacao, null, 2)}\n`);
console.log(
  `Especificação salva em ${destino} com ${Object.keys(especificacao.paths ?? {}).length} rotas.`,
);
