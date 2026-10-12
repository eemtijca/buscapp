# ADR-016: documentação interativa e CSP por URL

- Estado: aceita.
- Data: 2026.

## Contexto

A API não publicava especificação nem interface de teste, e as rotas eram documentadas apenas em `docs/api.md`. Os schemas Zod das rotas já carregavam tags e resumos, o que permite gerar a especificação sem reescrever contratos. A interface do Swagger UI valida as requisições do "Try it out" com ajv, que compila o schema em tempo de execução e não funciona sob `script-src` sem `'unsafe-eval'`.

## Decisão

1. Gerar a especificação OpenAPI 3.1 em tempo de execução com `@fastify/swagger` e `fastify-type-provider-zod`, registrados antes das rotas em `nucleo/http/documentacao.ts`.
2. Enriquecer o documento no `transformObject`: respostas de erro por operação a partir de um mapa coberto por teste, segurança por operação (públicas sem sessão e expurgo com segredo do agendador) e mídias especiais (SSE, multipart e download binário). O enriquecimento é apenas da especificação e não altera a validação nem a serialização em tempo real.
3. Servir a interface em `GET /api/docs` com `@fastify/swagger-ui` e a especificação também em `GET /api/docs/openapi.json`, com os scripts externos servidos pelo próprio plugin, compatíveis com a CSP estrita. Em runtimes sem `require` de módulos ESM, quando o plugin não pode ser carregado, a rota serve uma página mínima com o link da especificação.
4. Gerar o CSP por URL em `politicaDeSeguranca`: `script-src 'self'` em toda a API e `'unsafe-eval'` apenas em `/api/docs`, mantendo as demais diretivas iguais para toda a aplicação.
5. Proteger a cobertura com `documentacao.test.ts`: rota nova sem `operationId`, sem descrição, sem entrada no mapa de erros ou fora da política reprova o CI. O lint da especificação roda com Redocly CLI em `pnpm run openapi:lint`.

## Alternativas consideradas

- Especificação escrita à mão: descartada por duplicar os schemas Zod e divergir rápido.
- Redoc ou Scalar: descartados para manter o padrão Swagger e o menor atrito com o Fastify.
- CSP frouxa no aplicativo inteiro: descartada por ampliar a superfície de XSS sem necessidade.
- Sem "Try it out": descartado por reduzir o valor da interface para humanos e agentes.

## Consequências

- A documentação passa a derivar do código, e a guarda de cobertura evita divergência.
- A rota da interface tem um relaxamento pontual de CSP, registrado em [seguranca.md](../seguranca.md).
- O lint da especificação roda no workflow de testes, com o Compose no ar.

Referências: [api.md](../api.md), [seguranca.md](../seguranca.md) e [ADR-012](012-cabecalhos-de-seguranca-e-origem.md).
