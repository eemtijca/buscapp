# Deploy

A aplicação pode ser publicada de três formas: imagem Docker (GHCR), Docker Compose e Vercel. O banco é sempre um PostgreSQL externo ao processo, gerenciado ou no Compose.

## Artefatos

| Alvo                | Configuração                                     | Resultado                                                     |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Imagem Docker       | `infra/docker/Dockerfile`, workflow `publicacao` | `ghcr.io/<repo>:latest`, `:<sha>` e `:<tag do release>`       |
| Docker Compose      | `compose.yaml`                                   | App e PostgreSQL 17 com migrações no start                    |
| Vercel SPA separada | Projeto com root em `apps/web`                   | SPA estática apontando para uma API em outro host             |
| Vercel Services     | `vercel.json` na raiz, framework Services        | SPA e API no mesmo domínio, sem Docker e sem backend separado |

## Integração contínua

- `qualidade.yml`: type-check, lint e build da SPA.
- `testes.yml`: sobe o Compose, espera `/api/saude` e derruba o ambiente.
- `migracoes.yml`: aplica `prisma migrate deploy` com `DATABASE_URL` vindo do secret `DIRECT_URL_PROD` e, em seguida, define a senha do papel `buscapp_api` com `APP_DB_PASSWORD_PROD`.
- `publicacao.yml`: build e push da imagem para o GHCR ao publicar um release estável (e por dispatch manual).
- `codeql.yml`: análise estática de javascript-typescript.
- Todas as Actions são fixadas por SHA (comentário com a versão) e o Dependabot mantém as atualizações.

A imagem Docker roda como usuário `node` (não-root), com o diretório de uploads próprio, e declara `HEALTHCHECK` contra `/api/saude` (intervalo de 30 s, 30 s de carência). A base `node:24-slim` é fixada por digest para builds reproduzíveis.

O schema engine do Prisma (usado por `prisma migrate deploy` no entrypoint) é baixado durante o build da imagem e tem a escrita liberada para o usuário `node`; o container não precisa de rede para migrar. A aplicação sobe como `node` e o ensaio local do container cobre migrações, login, RLS, upload com remoção de EXIF e leitura da auditoria.

Ver [testes.md](testes.md) para as lacunas de cobertura do CI.

## Vercel full-stack (Services)

O `vercel.json` da raiz define dois serviços no mesmo projeto:

```json
{
  "services": {
    "web": {
      "root": "apps/web/",
      "framework": "vite",
      "buildCommand": "npm run build-only",
      "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
    },
    "api": {
      "root": "apps/api/",
      "framework": "fastify",
      "entrypoint": "src/server.ts",
      "buildCommand": "npm run build"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "api" } },
    { "source": "/(.*)", "destination": { "service": "web" } }
  ]
}
```

O rewrite de `/api/(.*)` encaminha para a API e o restante para a SPA, no mesmo domínio, o que mantém o cookie de sessão first-party. Services está em beta e disponível em todos os planos.

Configuração do projeto:

1. Root do projeto na raiz do repositório e framework definido como Services nas configurações de build.
2. `DATABASE_URL` no pooler de transação do Supabase (`:6543`, usuário `buscapp_api.<ref>`), com `TRUST_PROXY=true`, `DB_POOL_MAX=1` e `WEB_DIST=/tmp/sem-spa`.
3. `MIGRATE_DATABASE_URL` com a conexão de sessão ou direta do dono do schema. A API usa essa conexão no cliente administrativo, e o workflow de migrações continua sendo o responsável por migrar.
4. `AUTH_PEPPER` com pelo menos 32 caracteres, `COOKIE_SECURE=true`, `APP_URL` com o domínio do projeto e as origens extras em `APP_ORIGINS`.
5. Anexos com `STORAGE_DRIVER=s3`, endpoint S3 do Supabase Storage e bucket com underscore no nome, como `buscapp_anexos`. Isso força URLs pré-assinadas path-style e evita erro de CORS no envio direto do navegador.

Build no monorepo:

- A Vercel instala dependências por serviço. Por isso o `prepare` do root é ignorado no ambiente da Vercel e cada workspace declara as ferramentas que os próprios scripts usam (`typescript`, `@types/node`, `vue-tsc` e `@tsconfig/node24` onde se aplica). No desenvolvimento local, o `prepare` continua compilando os contratos.
- O `buildCommand` do serviço `api` roda `npm run build`, que compila `@buscapp/contratos`, gera o Prisma Client e transpila a API. O serviço `web` roda `npm run build-only`, que não depende dos contratos.
- Não defina `NODE_ENV` manualmente no projeto da Vercel, para não omitir as devDependencies no install.
- O preset `fastify` da Vercel ignora o `entrypoint` do `vercel.json` e detecta o servidor pelo nome do arquivo: `app`, `index` ou `server`, na raiz do serviço ou em `src/`, desde que o arquivo importe `fastify` e chame `listen()`. Por isso a API separa `src/aplicacao.ts` (fábrica Fastify, usada pelos testes) de `src/server.ts` (entrada do processo). Renomear esses arquivos ou mover a chamada de `listen()` para fora de `server.ts` faz a função subir sem handler e as requisições expirarem.

Limites do perfil serverless:

- As Functions limitam corpo de requisição e resposta a 4,5 MB. Por isso o anexo usa URL pré-assinada para envio e streaming no download.
- A duração padrão de 300 segundos encerra o stream SSE periodicamente. O `EventSource` reconecta sozinho e dispara recarga.
- O barramento SSE é em memória; eventos podem não cruzar instâncias diferentes. As telas continuam se atualizando ao reconectar, ao voltar para a aba e pelo polling de notificações.
- O `sharp` adiciona binários nativos ao bundle da função (dezenas de MB). As imagens são regravadas na confirmação do upload direto, com download e novo envio ao bucket; se o processamento falhar, o original é mantido e um aviso é registrado. `PROCESSAR_IMAGENS=false` desliga o processamento e reduz o cold start.

Para desenvolver com a mesma topologia:

```bash
npx vercel dev -L
```

## Vercel SPA separada

Publique a SPA com root em `apps/web`, defina `VITE_API_URL` com o endereço da API e libere a origem em `APP_ORIGINS`. O cookie continua funcionando com `COOKIE_SAMESITE` configurado e CORS com credenciais.

## Docker Compose

```bash
cp .env.example .env
# Preencha AUTH_PEPPER e, se quiser, SEED=true
npm run compose:up
```

O entrypoint aguarda o PostgreSQL, aplica as migrações, define a senha do papel e inicia a API servindo a SPA. As imagens ficam no volume `uploads` no driver de disco.

## Sem Docker

Com um PostgreSQL gerenciado e Node instalado:

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev:api
VITE_API_URL=http://localhost:3001 npm run dev:web
```

Para um processo único que serve a SPA e a API na mesma origem:

```bash
npm run build-only
npm run build -w @buscapp/api
node apps/api/dist/src/server.js
```

## Migrações e papel

- As migrações rodam no workflow `migracoes.yml` em push para `main` quando há mudança em `apps/api/prisma/**` ou no schema, usando a conexão de sessão ou direta de produção no secret `DIRECT_URL_PROD`.
- O mesmo workflow aplica a senha do papel `buscapp_api` com o secret `APP_DB_PASSWORD_PROD`, via `infra/docker/role.mjs`.
- O build da Vercel não migra. Garanta a ordem: migrar e, se necessário, fazer deploy compatível com a versão anterior do schema.
- Desde o ADR-009, a migração de RLS em `perfis` exige o código novo no ar antes de ser aplicada.

## Redis e cron

- `REDIS_URL` é obrigatória em todos os ambientes; o Redis atende apenas ao pub/sub do SSE, com fallback por `LISTEN/NOTIFY` na conexão de sessão.
- O expurgo é agendado por Vercel Cron (`crons` no topo do `vercel.json`) ou GitHub Actions, com `CRON_SECRET`.
- Os cabeçalhos da SPA ficam no topo do `vercel.json`, aplicados às rotas fora de `/api`.

## Verificação pós-deploy

1. `GET /api/saude` responde `{ "status": "ok" }`.
2. Login, criação de registro e listagem funcionam no mesmo domínio.
3. Anexo de imagem e PDF: envio direto, confirmação e download em streaming.
4. O indicador de conexão fica conectado e o SSE recebe invalidações.
5. `prisma migrate status` com a conexão de produção não indica pendências.

## Rollback

1. Reverta o deploy na Vercel ou promova uma imagem anterior no host.
2. Para uma migração já aplicada, crie uma nova migração corretiva. Nunca edite nem remova uma migração aplicada.
3. Mudanças de schema devem ser compatíveis com a versão anterior durante a janela de deploy, como colunas com padrão e remoções em etapa posterior.
