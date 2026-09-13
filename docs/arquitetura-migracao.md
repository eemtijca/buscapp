# Migração Supabase → stack própria

Documento de acompanhamento da migração para uma stack agnóstica de fornecedor:
aplicação Vue servida pela própria API, autenticação e autorização próprias,
armazenamento abstraído e tempo real por SSE.

## Decisões de arquitetura

| Tema                   | Decisão                                                                                                                         | Motivo                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ORM                    | Prisma 7.10 (estável)                                                                                                           | Evita o RC da v8; mesmo caminho do projeto de referência `caderno-aberto`                 |
| DDL                    | RLS, triggers, views, CHECKs e funções permanecem em SQL dentro das migrações do Prisma                                         | O Prisma não representa esses objetos; SQL de migração não é "SQL de aplicação"           |
| API                    | Fastify 5 + Zod + `fastify-type-provider-zod`                                                                                   | Streaming/SSE, `inject` para testes, validação no limite                                  |
| Autenticação           | Sessão opaca própria (`sessoes`, token só em cookie HttpOnly; banco guarda SHA-256), senha scrypt com verificação bcrypt legada | Revogação e desativação imediatas; permite verificar hashes do GoTrue e regravar no login |
| Códigos de redefinição | HMAC-SHA256 com `AUTH_PEPPER`, 6 dígitos via CSPRNG, expiração/revogação/limite no banco                                        | Corrige armazenamento em texto puro e gerador não criptográfico do legado                 |
| Autorização            | Serviço como fonte da verdade + escopo por papel; RLS vira backstop na Fase 7                                                   | A API é o único cliente; funções de escopo replicam cada política RLS                     |
| Armazenamento          | Interface `Armazenamento` com drivers disco e S3 (MinIO/R2/AWS), disco como padrão no Compose                                   | Portabilidade e dois containers obrigatórios apenas                                       |
| Tempo real             | SSE `/api/eventos` com roteamento por usuário                                                                                   | O tráfego é servidor → cliente; sem dependência de WebSocket                              |
| Topologia              | Mesma origem por padrão (API serve o `dist/`), com `VITE_API_URL` + CORS quando o front estiver em outro host                   | Cookies first-party por padrão; deploy flexível                                           |
| Estrutura              | npm workspaces: `apps/web`, `apps/api`, `packages/contratos`                                                                    | Impede importar Prisma no navegador; contratos Zod compartilhados                         |

## Estrutura do repositório

```
apps/web                       # SPA Vue 3 (antigo src/)
apps/api
  prisma/
    schema.prisma              # contrato do banco
    migrations/                # baseline, autenticação, dados canônicos, rotinas de domínio
    seeds/dev.ts               # usuários de desenvolvimento
  src/
    ambiente.ts                # validação das variáveis (Zod, fail-fast)
    app.ts                     # fábrica Fastify (testável com inject)
    nucleo/
      banco/                   # PrismaClient + adapter-pg
      autenticacao/            # senhas, sessões, códigos, middleware
      autorizacao/             # escopo por papel (alunos visíveis etc.)
      http/                    # envelope de erros, saúde
    modulos/<dominio>/          # .rotas.ts → .servico.ts → .repositorio.ts
packages/contratos             # schemas Zod + tipos compartilhados
tests/e2e                      # Playwright (legado Supabase, migra para a API)
infra/docker                   # Dockerfile multi-stage + entrypoint
compose.yaml                   # app + PostgreSQL 17
```

## Como executar

```bash
npm install
npm run compose:up          # sobe app + PostgreSQL e aplica as migrações
npm run dev:web             # SPA em http://localhost:5173
npm run dev:api             # API em http://localhost:3001 (usa DATABASE_URL do .env)
npm run db:migrate          # aplica migrações no DATABASE_URL
npm run seed -w @buscapp/api # usuários de desenvolvimento com scrypt
npm run test:unit           # testes de senha, autenticação e isolamento
```

Usuários de desenvolvimento: `gestao@escola.edu.br` / `Admin123!`,
`prof1@escola.edu.br` / `Prof123!`, `resp1@email.com` / `Resp123!`.

## Status

- [x] Fase 0 — baseline verificado (E2E e API legados verdes antes do corte)
- [x] Fase 1A — workspaces npm sem mudança de comportamento
- [x] Fase 1B — Fastify + Prisma 7.10 + Docker Compose + baseline do schema
- [x] Fase 1C — workflows de qualidade, testes, migrações e publicação
- [x] Fase 2 — autenticação própria (sessões, senhas, códigos HMAC) + dados canônicos + seed
- [~] Fase 3 — data layer por domínio: autorização por escopo e domínio `alunos` concluídos;
  demais domínios pendentes (usuários, frequências, ocorrências, justificativas, anexos,
  chat, notificações, configurações, estrutura escolar, monitoramento)
- [ ] Fase 4 — cutover do frontend para cookies
- [ ] Fase 5 — armazenamento e SSE
- [ ] Fase 6 — remoção do Supabase (SDK, CLI, edge functions, skills, docs)
- [ ] Fase 7 — RLS como backstop com `app.usuario_id`

## Template de um novo domínio

1. Contratos em `packages/contratos/src/<dominio>.ts` (Zod de entrada e saída) e reexport no `index`.
2. `apps/api/src/modulos/<dominio>/<dominio>.repositorio.ts` — apenas Prisma.
3. `<dominio>.servico.ts` — regras, mapeamento para DTO e escopo com
   `filtroAlunosVisiveis`/`podeVerAluno`/`garantirTurmaDoProfessor`.
4. `<dominio>.rotas.ts` — `preHandler: [autenticar, exigirPapel('gestao')]` (as fábricas de
   hook são assíncronas; não use arrow síncrona em `preHandler`).
5. Testes de integração no próprio módulo, cobrindo cada papel e o caso anônimo.
6. Registrar as rotas em `app.ts` e rodar `npm run test:unit`, `npm run type-check` e `npm run lint`.

### Regras de segurança já implementadas

- Erros sempre no envelope `{ erro: { codigo, mensagem } }`.
- Sem cadastro público; usuários são criados pela gestão (fluxo a migrar para `/api/usuarios`).
- Login com tempo equalizado e mensagem genérica; perfil inativo responde 403.
- Redefinição de senha revoga todas as sessões e ativa perfil pendente.
- Recurso fora do escopo de leitura responde 404 (não revela existência).
