# Testes

Suítes de integração da API (Vitest), unidade do cache do frontend (Vitest), Playwright (E2E e PWA) e smoke test do schema. Os comandos e pré-requisitos de execução estão em [../tests/README.md](../tests/README.md); esta página descreve a convenção e a integração contínua.

## Convenção

- Os testes de API ficam junto do código, em `apps/api/src/**/*.test.ts`, e usam `construirApp()` com `app.inject`, contra o PostgreSQL do Compose.
- Os testes de unidade do frontend ficam junto do código, em `apps/web/src/**/*.test.ts`, e isolam a persistência com mocks.
- Cada arquivo cobre um módulo e usa `beforeAll` e `afterAll` para criar e limpar a própria massa, com emails datados.
- As suítes rodam em série (`fileParallelism: false`) por compartilharem o mesmo banco, com timeout de 20 segundos por teste.
- Os testes E2E ficam em `tests/e2e` e usam os helpers de `tests/suporte` para API, banco, fixtures e sessão.
- Nenhum teste depende de ordem de execução, e a massa usa dados fictícios.

## Suítes

| Suíte             | Arquivos                                              | Dependências                              | Cobertura                                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integração da API | `apps/api/src/**/*.test.ts` (24 arquivos)             | Banco do Compose migrado                  | Autenticação e sessões, senhas, matriz de autorização, escopo por requisição, CRUD dos domínios, códigos, anexos, paginação, auditoria, barramento SSE, processamento de imagens, regras e ETag/304. |
| Unidade do web    | `apps/web/src/**/*.test.ts` (2 arquivos)              | Nenhuma                                   | Cache (deduplicação, frescor, 304, invalidação, GC, namespace) e cliente HTTP (timeout, retry, 401 e cancelamento).                                                                                  |
| E2E               | `tests/e2e/*.spec.ts` (21 especificações, exceto PWA) | API e SPA no ar, banco com seed           | Fluxos dos três papéis, tempo real, notificações, anexos, termômetro, ranking, cache, sessão e resiliência.                                                                                          |
| PWA               | `tests/e2e/pwa*.spec.ts` (2 especificações)           | Build via `vite preview` e API em `:3001` | Manifest, service worker, ícones, shell offline, dados persistidos e revalidação por 304.                                                                                                            |
| Smoke do banco    | `scripts/test-db.sh`                                  | Compose no ar                             | Migrações aplicadas, 34 tabelas, CHECKs, triggers e índice parcial de frequência.                                                                                                                    |

## Como executar

Na raiz, com o Compose no ar:

```bash
npm run test          # type-check, lint, build da SPA e testes de unidade
npm run test:unit     # integração da API e unidade do cache do web (Vitest)
npm run test:e2e      # Playwright sobe API e SPA automaticamente
npm run test:pwa      # build de produção e testes de PWA
npm run test:db       # smoke test do schema
```

Os testes de API precisam de `DATABASE_URL` (papel restrito), `MIGRATE_DATABASE_URL` (dono, usado pelo cliente administrativo), `AUTH_PEPPER` e `STORAGE_DRIVER=disco`. Uma execução típica contra o PostgreSQL do Compose:

```bash
NODE_ENV=test \
AUTH_PEPPER='dev-pepper-local-com-mais-de-16-caracteres' \
DATABASE_URL='postgresql://buscapp_api:buscapp_api@127.0.0.1:5433/buscapp' \
MIGRATE_DATABASE_URL='postgresql://buscapp:buscapp@127.0.0.1:5433/buscapp' \
STORAGE_DRIVER=disco \
npm run test:unit
```

Os testes E2E esperam o seed de desenvolvimento aplicado e usam `DATABASE_URL_ADMIN` (dono do schema) para fixtures e limpeza direta no banco; a API continua com `DATABASE_URL` no papel restrito. As senhas vêm de `SEED_SENHA_*`:

```bash
NODE_ENV=test \
AUTH_PEPPER='dev-pepper-local-com-mais-de-16-caracteres' \
DATABASE_URL='postgresql://buscapp_api:buscapp_api@127.0.0.1:5433/buscapp' \
DATABASE_URL_ADMIN='postgresql://buscapp:buscapp@127.0.0.1:5433/buscapp' \
MIGRATE_DATABASE_URL='postgresql://buscapp:buscapp@127.0.0.1:5433/buscapp' \
STORAGE_DRIVER=disco \
SEED_SENHA_ADMIN='Admin123!' SEED_SENHA_PROF='Prof123!' SEED_SENHA_RESP='Resp123!' \
npm run test:e2e
```

## Integração contínua

| Workflow         | Etapas                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `qualidade.yml`  | `npm ci`, `type-check`, `lint` e `build-only` em push para `main` e pull requests.                     |
| `testes.yml`     | `docker compose up -d --build`, espera `/api/saude` e roda `npm run test:unit` com PostgreSQL e Redis. |
| `migracoes.yml`  | `prisma migrate deploy` e aplicação da senha do papel em push para `main` com mudanças no schema.      |
| `publicacao.yml` | Build da imagem e push para o GHCR ao publicar um release estável, além de dispatch manual.            |
| `codeql.yml`     | Análise CodeQL para javascript-typescript em push, pull request e agenda semanal.                      |

> [!WARNING]
> Vitest roda no CI desde a integração com o Compose. Playwright e o teste de PWA continuam de execução local: rode as suítes antes de abrir um pull request.

> [!NOTE]
> Os testes de API e de integração exigem `REDIS_URL` (Redis do Compose) além das variáveis do banco.
