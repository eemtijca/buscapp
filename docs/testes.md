# Testes

Suítes de integração da API (Vitest), Playwright (E2E e PWA) e smoke test do schema. Os comandos e pré-requisitos de execução estão em [../tests/README.md](../tests/README.md); esta página descreve a convenção e a integração contínua.

## Convenção

- Os testes de API ficam junto do código, em `apps/api/src/**/*.test.ts`, e usam `construirApp()` com `app.inject`, contra o PostgreSQL do Compose.
- Cada arquivo cobre um módulo e usa `beforeAll` e `afterAll` para criar e limpar a própria massa, com emails datados.
- As suítes rodam em série (`fileParallelism: false`) por compartilharem o mesmo banco, com timeout de 20 segundos por teste.
- Os testes E2E ficam em `tests/e2e` e usam os helpers de `tests/suporte` para API, banco, fixtures e sessão.
- Nenhum teste depende de ordem de execução, e a massa usa dados fictícios.

## Suítes

| Suíte             | Arquivos                                  | Dependências                         | Cobertura                                                                                          |
| ----------------- | ----------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Integração da API | `apps/api/src/**/*.test.ts` (12 arquivos) | Banco do Compose migrado             | Autenticação e sessões, senhas, autorização e escopo, CRUD dos domínios, códigos, anexos e regras. |
| E2E               | `tests/e2e/*.spec.ts` (19 especificações) | API e SPA no ar, banco com seed      | Fluxos dos três papéis, tempo real, notificações, anexos, termômetro, ranking e resiliência.       |
| PWA               | `tests/e2e/pwa.spec.ts`                   | Build de produção via `vite preview` | Manifest, service worker, ícones e shell offline.                                                  |
| Smoke do banco    | `scripts/test-db.sh`                      | Compose no ar                        | Migrações aplicadas, 33 tabelas, CHECKs, triggers e índice parcial de frequência.                  |

## Como executar

Na raiz, com o Compose no ar:

```bash
npm run test          # type-check, lint, build da SPA e testes de integração da API
npm run test:unit     # apenas os testes de integração (Vitest)
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

Os testes E2E usam `DATABASE_URL_ADMIN` para fixtures e limpeza direta no banco, e esperam o seed de desenvolvimento aplicado. As senhas vêm de `SEED_SENHA_*`.

## Integração contínua

| Workflow         | Etapas                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `qualidade.yml`  | `npm ci`, `type-check`, `lint` e `build-only` em push para `main` e pull requests.                |
| `testes.yml`     | `docker compose up -d --build`, espera `/api/saude` e derruba o ambiente.                         |
| `migracoes.yml`  | `prisma migrate deploy` e aplicação da senha do papel em push para `main` com mudanças no schema. |
| `publicacao.yml` | Build da imagem e push para o GHCR em push para `main` e tags `v*`.                               |
| `codeql.yml`     | Análise CodeQL para javascript-typescript em push, pull request e agenda semanal.                 |

> [!WARNING]
> Vitest, Playwright e o teste de PWA não são executados no CI hoje. A integração contínua cobre verificação de tipos, lint, build e a subida do container com checagem de saúde. Rode as suítes localmente antes de abrir um pull request.
