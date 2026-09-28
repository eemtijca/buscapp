# Testes

Suítes de guarda editorial, integração da API, unidade do cache do frontend, Playwright (E2E e PWA) e smoke test do schema. A convenção geral está em [docs/testes.md](../docs/testes.md).

## Pré-requisitos

Banco migrado e populado, com a API e a SPA no ar para os testes de ponta a ponta:

```bash
npm run compose:up
npm run seed -w @buscapp/api
```

Para os testes de integração da API, exporte as variáveis do banco:

```bash
export NODE_ENV=test
export AUTH_PEPPER=dev-pepper-local-com-mais-de-16-caracteres
export DATABASE_URL=postgresql://buscapp_api:buscapp_api@127.0.0.1:5433/buscapp
export MIGRATE_DATABASE_URL=postgresql://buscapp:buscapp@127.0.0.1:5433/buscapp
export REDIS_URL=redis://127.0.0.1:6379
export STORAGE_DRIVER=disco
```

## Suítes

```bash
npm run test              # type-check, lint, build da SPA e testes de unidade
npm run test:unit         # guarda editorial, integração da API e unidade do web (Vitest)
npm run test:texto        # apenas a guarda editorial
npm run test:unit:web     # apenas a unidade do cache do frontend
npm run test:e2e:docker   # Playwright na imagem oficial, com o aplicativo no ar
npm run test:pwa:docker   # PWA na imagem oficial, com o preview no ar
npm run test:db           # smoke test do schema no PostgreSQL do Compose
```

- `test:unit` roda `tests/unit/texto-editorial.test.ts`, `apps/api/src/**/*.test.ts` com `construirApp()` e `app.inject`, em série, contra o PostgreSQL do Compose, e `apps/web/src/**/*.test.ts` para o cache do frontend. Cada arquivo cria e limpa a própria massa.
- `test:e2e:docker` roda o Playwright na imagem oficial da Microsoft com o aplicativo no ar; `test:e2e` é a alternativa local e sobe `npm run dev:api` em `:3001` com `npm run dev:web` em `:5173`, nos projetos Chromium, Firefox, WebKit, Mobile Chrome e Mobile Safari.
- `test:pwa:docker` valida o PWA contra o `vite preview` em `:4173` com a API em `:3001`; `test:pwa` é a alternativa local.
- `test:db` aplica migrações pendentes e confere tabelas, CHECKs, triggers e o índice parcial de frequência.

## Suporte

Os helpers ficam em `tests/suporte`:

| Arquivo       | Papel                                                          |
| ------------- | -------------------------------------------------------------- |
| `api.ts`      | Requisições autenticadas, login, criação de usuário e limpeza. |
| `banco.ts`    | Acesso direto ao banco com `DATABASE_URL_ADMIN` para fixtures. |
| `dados.ts`    | UUIDs canônicos e senhas do seed compartilhados com os testes. |
| `fixtures.ts` | Fixtures do Playwright por papel, com login pela interface.    |
| `sessao.ts`   | Login e logout pela interface, além de restauração de senha.   |
| `senhas.ts`   | Geração de hash scrypt com os mesmos parâmetros da API.        |

## Massa e limpeza

A massa usa emails datados e o domínio de desenvolvimento. Os testes de API limpam no `afterAll`; os E2E limpam pelas funções de `tests/suporte/api.ts`. Nunca use dados reais. O seed de desenvolvimento é pré-requisito dos testes E2E, e as senhas vêm de `SEED_SENHA_*`.
