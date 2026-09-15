# Arquitetura

Monorepo npm workspaces com três pacotes: a SPA Vue 3 (`apps/web`), a API Fastify 5 (`apps/api`) e os contratos Zod compartilhados (`packages/contratos`). O PostgreSQL é acessado via Prisma 7.10 com `@prisma/adapter-pg`. A topologia padrão é de mesma origem: a API serve o build da SPA, o que mantém o cookie de sessão first-party.

## Visão geral

```mermaid
flowchart LR
  N[Navegador] -->|SPA Vue 3| W[apps/web]
  W -->|fetch com cookie| A[apps/api Fastify]
  W -->|EventSource /api/eventos| A
  A -->|Prisma + adapter-pg| D[(PostgreSQL)]
  A -->|driver disco ou S3| F[Armazenamento de anexos]
  C[packages/contratos] -.-> W
  C -.-> A
```

## Camadas

- `apps/web/src/servicos/api.ts`: cliente HTTP tipado único, com `credentials: 'include'`, envelope de erro `ErroApi` e suporte a FormData.
- `apps/web/src/servicos/eventos.ts`: conexão SSE única por aba, com assinatura por tabela e status da conexão.
- `apps/api/src/aplicacao.ts`: fábrica Fastify, testável com `inject`. Registra cookie, CORS, multipart, rotas e, quando existe `WEB_DIST`, o `@fastify/static` com fallback da SPA.
- `apps/api/src/server.ts`: entrada do processo. Instancia a aplicação com `construirApp()` e chama `listen()`.
- `apps/api/src/ambiente.ts`: validação Zod das variáveis, com falha antecipada.
- `apps/api/src/nucleo/`: infraestrutura transversal (`banco`, `autenticacao`, `autorizacao`, `armazenamento`, `eventos`, `http`).
- `apps/api/src/modulos/<dominio>/`: padrão `.rotas.ts`, `.servico.ts` e `.repositorio.ts`.
- `packages/contratos/src/`: schemas Zod de entrada e saída por domínio, compartilhados entre API e frontend.
- `tests/`: Playwright e helpers de apoio. Os testes de integração da API ficam no próprio módulo, em `apps/api/src/**/*.test.ts`.

## Fluxo de uma requisição autenticada

```mermaid
sequenceDiagram
  participant C as Cliente
  participant R as Rota Fastify
  participant M as Middleware de sessão
  participant S as Serviço
  participant B as Prisma e banco
  C->>R: Requisição com cookie HttpOnly
  R->>M: autenticar resolve a sessão
  M->>B: perfilDaSessao consulta o hash do token
  M-->>R: usuário e papel
  R->>S: regra de negócio e escopo de visibilidade
  S->>B: consulta em transação com app.usuario_id
  B-->>S: linhas dentro do escopo e do RLS
  S-->>C: JSON no envelope próprio
```

O token de sessão tem 32 bytes aleatórios e só existe no cookie; o banco guarda o SHA-256. A validade é de 12 horas, ou 30 dias com `lembrar`. Logout, inativação e redefinição de senha revogam as sessões. Detalhes em [seguranca.md](seguranca.md).

## Isolamento entre perfis

Duas camadas independentes:

1. A API filtra por papel, módulo e escopo em cada serviço (`nucleo/autorizacao/escopo.ts`): gestão vê todos os alunos, professor vê as turmas em que leciona e responsável vê apenas os alunos vinculados.
2. O banco aplica RLS com o papel restrito `buscapp_api` e `app.usuario_id` definido por transação, funcionando como backstop de erros de escopo. Ver [ADR-003](adr/003-rls-backstop.md).

Leituras fora do escopo respondem 404, para não revelar a existência do registro.

## Tempo real

O stream `GET /api/eventos` usa Server-Sent Events e publica eventos de invalidação `{ tabela, escopo }`, sem dados sensíveis. O barramento é em memória, com heartbeat de 25 segundos, e o frontend recarrega as telas inscritas com debounce, além de recarregar ao reconectar e ao voltar para a aba. Ver [ADR-005](adr/005-tempo-real-sse.md) e [modulos.md](modulos.md).

## Topologia

| Perfil              | Frontend         | API                | Cookie           |
| ------------------- | ---------------- | ------------------ | ---------------- |
| Compose e self-host | servida pela API | mesmo processo     | first-party      |
| Desenvolvimento     | Vite em `:5173`  | Fastify em `:3001` | CORS credenciado |
| Vercel SPA separada | projeto estático | outro host         | CORS credenciado |
| Vercel Services     | serviço `web`    | serviço `api`      | first-party      |

Quando a SPA está em outro host, basta definir `VITE_API_URL` e liberar a origem em `APP_ORIGINS`. Ver [deploy.md](deploy.md).

## Organização de diretórios

```
apps/
  web/
    src/
      assets/            tokens de cor e fontes
      componentes/       componentes reutilizáveis
      composables/       estado e orquestração (autenticação, monitoramento, SSE)
      layouts/           shell da aplicação
      paginas/           auth, professor, gestao, responsavel e error
      rotas/             Vue Router com guardas de papel e módulo
      servicos/          cliente da API, EventSource e cálculo do termômetro
      tipos/             tipos do banco e de componentes
      utils/             compressão de imagem, mensagens e formatação
  api/
    prisma/
      schema.prisma      contrato do banco
      migrations/        seis migrações SQL
      seeds/dev.ts       fixtures de desenvolvimento
    src/
      ambiente.ts        validação das variáveis
      aplicacao.ts       fábrica Fastify
      server.ts          entrada do processo
      nucleo/            banco, autenticação, autorização, armazenamento, eventos e http
      modulos/<dominio>/ rotas, serviço e repositório por domínio
packages/contratos       schemas Zod compartilhados
tests/e2e                Playwright
tests/suporte            helpers de API, banco, fixtures e sessão
infra/docker             Dockerfile, entrypoint e preparação do papel
docs/                    esta documentação
```

## Decisões registradas

- [ADR-001: Prisma 7 com driver adapter pg](adr/001-prisma-v7.md)
- [ADR-002: autenticação própria com sessão opaca e códigos HMAC](adr/002-autenticacao-propria.md)
- [ADR-003: isolamento por papel com RLS de barreira](adr/003-rls-backstop.md)
- [ADR-004: anexos atrás de interface, com upload direto](adr/004-anexos-armazenamento.md)
- [ADR-005: tempo real por Server-Sent Events](adr/005-tempo-real-sse.md)
- [ADR-006: mesma origem e perfis de implantação](adr/006-same-origin-e-perfis.md)
