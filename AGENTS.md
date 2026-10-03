# AGENTS.md

BuscApp: plataforma web de gestão escolar para acompanhar frequência, ocorrências, justificativas de falta e a comunicação entre professores, gestão e responsáveis. Monorepo npm workspaces com SPA Vue 3 e Vite (`apps/web`), API Fastify 5 (`apps/api`), contratos Zod (`packages/contratos`), PostgreSQL 17 com Prisma 7 e adaptador `pg` e Redis para o SSE. Autenticação própria com scrypt, pepper e sessão opaca em cookie. Código, comentários, documentação, testes e commits são em português.

## Diretrizes do repositório

- Leia o `CONTRIBUTING.md` antes de qualquer mudança: ele reúne o fluxo de issues, etiquetas, branches, commits, pull requests, padrões de código, banco, formatação e testes.
- `tests/unit/texto-editorial.test.ts` varre código, documentação e configuração. Ele reprova travessão, meia-risca, reticências tipográficas, aspas curvas, setas, aspas angulares, entidades HTML de aspas, segunda pessoa e plural escrito com parênteses. Rode `npm run test:texto` depois de escrever texto de interface ou documentação.
- Commits seguem Conventional Commits em português, no imperativo, com escopo opcional: `fix(api): corrige ...`. Branches usam `tipo/descricao-curta`; branches de agentes usam o prefixo do agente (`ai/`, `claude/`, `codex/`, `copilot/` ou `cursor/`).
- TypeScript é estrito e ainda tem `noUncheckedIndexedAccess`; oxlint e ESLint cobrem o restante. O gerenciador é npm, com `package-lock.json`; não use bun, yarn nem pnpm.
- Nomes de domínio em português (`alunos`, `frequencias`, `turmas`), termos de infraestrutura em inglês quando consagrados (`token`, `backup`).
- `npm run lint` e `npm test` aplicam correções automáticas (`--fix`); confira o diff antes de commitar.

## Padrões de código

- Cada módulo da API segue `.rotas.ts` (schema Zod e preHandlers), `.servico.ts` (regra e escopo) e `.repositorio.ts` (Prisma). As exceções são `auth`, `anexos`, `auditoria`, `lgpd` e `tarefas`, que acessam o Prisma no serviço ou na rota.
- Rotas usam validação Zod no limite, `autenticar`, `exigirPapel` e `exigirModulo`, filtro de escopo no serviço e erros no envelope `{ erro: { codigo, mensagem } }`. Recurso fora do escopo responde 404.
- Os contratos ficam em `packages/contratos/src` e são consumidos pela API; o web mantém tipos próprios em `apps/web/src/tipos`, que precisam ser mantidos em sincronia.
- No web, componentes são arquivos `.vue` em PascalCase, composables usam `useXxx.ts` e serviços e utilitários usam camelCase. Reutilize os componentes existentes e o `reka-ui` antes de criar outro.
- Datas civis trafegam como `yyyy-mm-dd` e timestamps em ISO 8601; o fuso da escola vem de `TZ_ESCOLA`.
- O banco usa snake_case em português, sem `@@map`; ids UUID, `created_at` e `updated_at`, e RLS como barreira de segunda linha. Nunca edite migração aplicada.

## Comandos

Pré-requisitos: Node 20.19 ou superior (ou 22.12 ou superior) e Docker com Compose. O CI usa Node 24.

- Ambiente local: `npm ci`; `cp .env.example .env` com `AUTH_PEPPER` de 32 caracteres ou mais; `npm run compose:up`; `npm run seed -w @buscapp/api`; `npm run dev:web` na porta 5173 e `npm run dev:api` na porta 3001.
- Docker: `npm run compose:up` sobe a aplicação em `http://localhost:3000` e o PostgreSQL em `localhost:5433`; as credenciais de desenvolvimento estão em `docs/ambiente.md`.
- Ordem de verificação antes do pull request: `npm run type-check`, `npm run lint` e `npm run test:unit`. `npm run test` encadeia tipos, lint, build e unidade.
- `npm run test:unit` exige o Compose migrado, `NODE_ENV=test`, `AUTH_PEPPER`, `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `REDIS_URL` e `STORAGE_DRIVER=disco`.
- Ponta a ponta: `npm run test:e2e:docker` e `npm run test:pwa:docker` rodam na imagem oficial com o aplicativo no ar; `npm run test:e2e` e `npm run test:pwa` são a alternativa local.
- Banco: `npm run db:generate` e `npm run db:migrate` (deploy). Migrações de desenvolvimento com `npx prisma migrate dev --name ajuste` em `apps/api`.
- Guarda editorial: `npm run test:texto`.

## Ferramentas externas

- GitHub: opere issues, pull requests, execuções de workflow e releases pelo GitHub CLI (`gh`), não pela interface web. Confirme a sessão com `gh auth status` e, se necessário, autentique com `gh auth login`. Exemplos: `gh issue create`, `gh pr create`, `gh pr checks --watch`, `gh run watch` e `gh release create`. Nunca inclua segredos ou dados de alunos.
- Playwright: rode a suíte na imagem oficial da Microsoft, com o aplicativo no ar, usando `npm run test:e2e:docker` (ou `npm run test:e2e:docker:chromium`) e `npm run test:pwa:docker`. O script `tests/playwright-container.sh` aceita `PLAYWRIGHT_IMAGE`, `PLAYWRIGHT_DOCKER_NETWORK` e `PLAYWRIGHT_DOCKER_USER`. Mantenha a versão da imagem igual à do `@playwright/test`. A instalação local (`npm run test:e2e:install`) é alternativa.

## Fluxo de issues e pull requests

- Aplique etiquetas em toda issue e todo pull request: uma de tipo e, fora do tipo `docs`, uma de área. Use `gh issue create --label "bug" --label "area: web"` e `gh pr edit <número> --add-label "area: api"`. O catálogo fica em `.github/labels.json` e é sincronizado com `npm run etiquetas:sync`. Pull requests do Dependabot recebem `dependencies` e dispensam as demais.
- Faça apenas commits atômicos: uma mudança lógica completa por commit, sem trabalho em andamento nem correção de revisão. Use `git commit --fixup` durante o desenvolvimento e `git rebase -i --autosquash` antes de publicar.
- Organize todos os commits do assunto em uma única branch e um único pull request. Abra o pull request somente quando estiver finalizado, com título em Conventional Commits, verificações locais, documentação e CHANGELOG prontos. Não use `gh pr create --fill`.
- Se o CI falhar ou surgir algo novo depois de aberto, converta para rascunho com `gh pr ready --undo`, faça os commits e só marque como pronto com `gh pr ready` quando tudo estiver verde.
- Nunca peça revisão com o pull request em rascunho nem abra pull request incompleto.
- Commits com geração relevante por IA levam o rodapé `Assisted-by: ferramenta:modelo`; a autoria e a responsabilidade são humanas.

## Arquitetura

- Três workspaces: `apps/web` (SPA Vue 3), `apps/api` (Fastify) e `packages/contratos` (Zod). A topologia padrão é de mesma origem, com a API servindo o build da SPA.
- Na API, `src/nucleo/` reúne infraestrutura transversal (banco, autenticação, autorização, armazenamento, auditoria, eventos, http, rate-limit e tempo) e `src/modulos/<dominio>/` concentra os domínios.
- Tempo real: SSE em `/api/eventos`, com Redis como pub/sub e fallback para `LISTEN/NOTIFY`.
- Escopo por papel: gestão vê tudo, professor vê as turmas com atribuição ativa e responsável vê os alunos vinculados; a RLS funciona como barreira de segunda linha.
- O ambiente é validado na partida em `apps/api/src/ambiente.ts` com Zod.

## Armadilhas

- O preset Fastify da Vercel detecta o servidor pelo nome do arquivo e exige que `apps/api/src/server.ts` importe `fastify` e chame `listen()`; renomear o arquivo quebra a função.
- `@fastify/static` é CommonJS e só é carregado quando existe `index.html` em `WEB_DIST`; na Vercel usa-se `WEB_DIST=/tmp/sem-spa`.
- Não defina `NODE_ENV` manualmente na Vercel para não omitir devDependencies no install.
- Limites serverless: upload por URL pré-assinada, streaming de anexos, SSE reconectando e `DB_POOL_MAX=1` recomendado.
- As suítes compartilham um único banco; por isso rodam em série (`fileParallelism: false` e `workers: 1`).
- O teste de PWA só funciona contra o build de produção (`vite preview`), porque o service worker não existe no servidor de desenvolvimento.
- O smoke `test:db` espera o container chamado `buscapp-postgres`.
- Ao adicionar variável de ambiente, atualize o `.env.example`, o `compose.yaml` e espelhe no `compose.ci.yml` e nos workflows quando fizer sentido.
- Nenhum teste usa dados reais; a massa usa emails datados e o domínio de desenvolvimento. O seed de desenvolvimento é pré-requisito dos testes de ponta a ponta.
