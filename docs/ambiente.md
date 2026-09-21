# Ambiente

Todas as variáveis da API passam por `apps/api/src/ambiente.ts`, validadas com Zod na partida (fail-fast). O `.env` fica na raiz do repositório e é lido pela API e pelo Vite (`envDir` aponta para a raiz). O espelho pronto para cópia é o [`.env.example`](../.env.example).

## Referência

| Variável                                                                            | Onde é usada      | Descrição                                                                                      |
| ----------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                      | API (runtime)     | Conexão com o papel restrito `buscapp_api`, sujeito ao RLS.                                    |
| `MIGRATE_DATABASE_URL`                                                              | Migrações e admin | Conexão dona do schema; usada por `prisma migrate`, pelo seed e pelo cliente administrativo.   |
| `DATABASE_URL_ADMIN`                                                                | Testes            | Conexão dona do schema usada pelas fixtures e pela limpeza dos testes E2E.                     |
| `APP_DB_PASSWORD`                                                                   | Compose e CI      | Senha aplicada ao papel `buscapp_api` pelo entrypoint do Compose e pelo workflow de migrações. |
| `PORT` / `HOST`                                                                     | API               | Porta e interface de escuta (padrão `3001` e `0.0.0.0`).                                       |
| `APP_URL`                                                                           | API               | Origem do frontend liberada no CORS com credenciais (padrão `http://localhost:5173`).          |
| `APP_ORIGINS`                                                                       | API               | Origens adicionais para CORS, separadas por vírgula.                                           |
| `WEB_DIST`                                                                          | API               | Caminho do build da SPA servido na mesma origem (padrão `../web/dist`).                        |
| `AUTH_PEPPER`                                                                       | API               | Pepper do HMAC dos códigos de redefinição; mínimo de 32 caracteres em produção.                |
| `SESSAO_COOKIE`                                                                     | API               | Nome do cookie de sessão (padrão `buscapp_sessao`).                                            |
| `COOKIE_SAMESITE`                                                                   | API               | Atributo `SameSite` do cookie (`lax`, `strict` ou `none`).                                     |
| `COOKIE_SECURE`                                                                     | API               | Força `Secure` no cookie; por padrão ativo quando `NODE_ENV=production`.                       |
| `TRUST_PROXY`                                                                       | API               | Usa `X-Forwarded-For` para o IP real do cliente (padrão `false`; `true` na Vercel).            |
| `STORAGE_DRIVER`                                                                    | API               | Driver de anexos: `disco` (padrão) ou `s3`.                                                    |
| `UPLOAD_DIR`                                                                        | API (disco)       | Diretório dos uploads (padrão `uploads`).                                                      |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | API (S3)          | Credenciais e endpoint do bucket (MinIO, R2, AWS ou Supabase Storage).                         |
| `S3_UPLOAD_URL_EXPIRA_S`                                                            | API (S3)          | Validade da URL pré-assinada do upload direto, em segundos (padrão `300`).                     |
| `UPLOAD_DIRETO_MAX_BYTES`                                                           | API               | Limite do upload direto, em bytes (padrão `20971520`, 20 MB).                                  |
| `PROCESSAR_IMAGENS`                                                                 | API               | Regrava imagens no servidor removendo EXIF e limitando o lado a 1600 px (padrão `true`).       |
| `DB_POOL_MAX`                                                                       | API               | Conexões por instância do pool `pg` (padrão `10`; use `1` ou `2` em serverless).               |
| `TZ_ESCOLA`                                                                         | API               | Fuso IANA da escola para o horário protegido e datas civis (padrão `America/Sao_Paulo`).       |
| `REDIS_URL`                                                                         | API               | Redis do pub/sub do SSE; obrigatória em todos os ambientes.                                    |
| `DATABASE_URL_ESCUTA`                                                               | API               | Conexão de sessão do `LISTEN`; vazia usa `MIGRATE_DATABASE_URL`.                               |
| `CRON_SECRET`                                                                       | API               | Segredo do agendador do expurgo; sem ele a rota responde 404.                                  |
| `SEED`                                                                              | Compose           | Com `SEED=true`, o entrypoint do container popula o banco na partida.                          |
| `SEED_SENHA_ADMIN`, `SEED_SENHA_PROF`, `SEED_SENHA_RESP`                            | Seed              | Senhas dos usuários de teste criados pelo seed de desenvolvimento.                             |
| `VITE_API_URL`                                                                      | Frontend          | URL base da API. Vazio (padrão) usa a mesma origem; defina ao hospedar a SPA separada da API.  |

> [!NOTE]
> Não existe variável `DIRECT_URL`. As migrações em bancos gerenciados usam `MIGRATE_DATABASE_URL`, que também é a conexão do cliente administrativo da API. No GitHub Actions o secret `DIRECT_URL_PROD` é injetado em `DATABASE_URL` no passo de migração e em `MIGRATE_DATABASE_URL` no passo que define a senha do papel.

## Banco de dados

Em banco gerenciado atrás de pooler, como o Supabase:

- `DATABASE_URL` usa o pooler de transação (`:6543`, usuário `buscapp_api.<ref>`), adequado ao runtime serverless.
- `MIGRATE_DATABASE_URL` usa a conexão de sessão ou direta (dono do schema) para migrações, seed e rotinas administrativas.
- O driver `pg` não usa prepared statements nomeados, então não é necessário parâmetro extra de pgbouncer.

A API abre uma transação curta por operação e define `app.usuario_id` com `set_config(..., true)`, o que funciona no modo de transação do pooler. Detalhes em [banco.md](banco.md).

## Perfis de execução

### Docker Compose

O `.env` alimenta o Compose; o entrypoint aguarda o PostgreSQL, aplica as migrações, define a senha do papel e inicia a API servindo a SPA. Ver [operacao.md](operacao.md).

### Sem Docker

Com um PostgreSQL gerenciado e Node instalado:

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev:api
VITE_API_URL=http://localhost:3001 npm run dev:web
```

Para subir tudo em um processo único, que serve a SPA e a API na mesma origem:

```bash
npm run build-only
npm run build -w @buscapp/api
node apps/api/dist/src/server.js
```

### Vercel

O perfil full-stack usa `DATABASE_URL` no pooler de transação, `MIGRATE_DATABASE_URL` como dono do schema, `TRUST_PROXY=true`, `DB_POOL_MAX=1`, `STORAGE_DRIVER=s3` e `WEB_DIST` apontando para um caminho inexistente, o que desativa a SPA na API. Detalhes em [deploy.md](deploy.md).

## Seed de desenvolvimento

```bash
npm run seed -w @buscapp/api
```

O seed é idempotente e cria perfis, turmas, alunos, frequências e demais fixtures. Os códigos de redefinição de exemplo são gravados apenas como HMAC, coerentes com o fluxo real. Credenciais:

| Papel       | Email                | Senha     |
| ----------- | -------------------- | --------- |
| Gestão      | gestao@escola.edu.br | Admin123! |
| Professor   | prof1@escola.edu.br  | Prof123!  |
| Responsável | resp1@email.com      | Resp123!  |

Usuários adicionais: `prof2` e `prof3@escola.edu.br` (`Prof123!`) e `resp2` e `resp3@email.com` (`Resp123!`). O `prof2` não possui o módulo de ocorrências, o que permite testar o gating.

## Regras

- Nunca reutilize segredos de desenvolvimento em produção.
- `AUTH_PEPPER` é obrigatória e precisa ter ao menos 32 caracteres em produção.
- Em produção, use `COOKIE_SECURE=true` e `TRUST_PROXY=true` quando houver proxy.
- Segredos ficam apenas no ambiente, nunca versionados.
