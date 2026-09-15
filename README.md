# BuscApp

Plataforma web de gestão escolar para acompanhar frequência, ocorrências, justificativas de falta e a comunicação entre professores, gestão e responsáveis. Aplicação responsiva e instalável como PWA, com autenticação própria, isolamento de dados por perfil e atualização em tempo real.

## Funcionalidades

### Acesso e perfis

- Login sem cadastro público: os perfis são criados pela gestão e o primeiro acesso e a recuperação de senha usam um código de 6 dígitos gerado pela administração.
- Sessão por cookie `HttpOnly` com papéis `professor`, `gestao` e `responsavel`, além de módulos de acesso por perfil.
- Redefinição de senha com política forte, revogação de sessões e trilha de auditoria dos códigos.

### Plataforma

- SPA Vue 3 mobile-first, instalável como PWA, com indicador de conexão e recuperação após quedas de rede.
- Atualização em tempo real por Server-Sent Events, sem recarregar a tela.
- Mensagens de erro em português, com validação no cliente e no servidor.

### Módulo professor

- Frequência por exceção: registra apenas os ausentes, desfaz o lançamento do período e mantém histórico por aluno.
- Registro de ausência individual e de ocorrências, com tags de comportamento e anexos.
- Acesso condicionado aos módulos liberados pela gestão.

### Módulo gestão

- Painel com ranking de turmas e infrequências, a partir do termômetro de risco.
- Central de ocorrências, com confirmação de presença do responsável e registro pela própria gestão.
- Fila de justificativas, com aceite que auto-justifica as frequências ou recusa com parecer.
- Gestão de usuários, códigos, alunos, turmas, anos letivos, disciplinas, atribuições e enturmações.
- Chat com os responsáveis.
- Configurações do sistema, catálogos, tags de comportamento e horários de atendimento.

### Módulo responsável

- Alertas e termômetro de risco dos dependentes.
- Envio de justificativas com anexos.
- Chat com a escola, com horário protegido no servidor.

### Em desenvolvimento

- Gamificação entre turmas (tabelas de pontuação prontas, frontend não conectado).
- Notificações push.

## Começando

Pré-requisitos: Node 20.19 ou superior, ou 22.12 ou superior, e Docker com Compose no modo recomendado. Também é possível usar um PostgreSQL 15 ou superior próprio.

Com Docker Compose:

```bash
cp .env.example .env
# Preencha AUTH_PEPPER com pelo menos 32 caracteres
npm run compose:up
npm run seed -w @buscapp/api
```

A aplicação fica em `http://localhost:3000`, com o PostgreSQL em `localhost:5433`. As migrações são aplicadas na partida e o driver de disco guarda os anexos no volume `uploads`. Instruções sem Docker, com Supabase, estão em [docs/ambiente.md](docs/ambiente.md).

Credenciais de desenvolvimento:

| Papel       | Email                | Senha     |
| ----------- | -------------------- | --------- |
| Gestão      | gestao@escola.edu.br | Admin123! |
| Professor   | prof1@escola.edu.br  | Prof123!  |
| Responsável | resp1@email.com      | Resp123!  |

## Stack

- Frontend: Vue 3 com TypeScript, Vite, Vue Router, Bootstrap 5, Bootstrap Icons e `vite-plugin-pwa`.
- Backend: Node.js com Fastify 5, Zod e `fastify-type-provider-zod`.
- Dados: PostgreSQL 15 ou superior com Prisma 7.10 e `@prisma/adapter-pg`, incluindo RLS como segunda barreira de isolamento.
- Autenticação: scrypt, sessão opaca em cookie `HttpOnly` e códigos de redefinição com HMAC.
- Tempo real: Server-Sent Events em `/api/eventos`.
- Anexos: drivers de disco e S3, com upload direto por URL pré-assinada.
- Infraestrutura: Docker, Docker Compose, imagem no GHCR e Vercel Services para o perfil full-stack.
- Qualidade: Vitest, Playwright, oxlint, ESLint, Prettier, GitHub Actions e CodeQL.

## Documentação

| Documento                                          | Conteúdo                                             |
| -------------------------------------------------- | ---------------------------------------------------- |
| [docs/README.md](docs/README.md)                   | Índice completo da documentação                      |
| [docs/ambiente.md](docs/ambiente.md)               | Variáveis de ambiente e execução local               |
| [docs/arquitetura.md](docs/arquitetura.md)         | Camadas, fluxo de requisição e organização do código |
| [docs/banco.md](docs/banco.md)                     | Migrações, papéis, RLS e retenção                    |
| [docs/api.md](docs/api.md)                         | Referência das rotas HTTP                            |
| [docs/modelo-de-dados.md](docs/modelo-de-dados.md) | Entidades, enums e glossário                         |
| [docs/modulos.md](docs/modulos.md)                 | Regras de cada módulo e módulos de acesso            |
| [docs/interface.md](docs/interface.md)             | Design system, rotas, componentes e acessibilidade   |
| [docs/operacao.md](docs/operacao.md)               | Runbooks, reset e resolução de problemas             |
| [docs/testes.md](docs/testes.md)                   | Suítes, convenções e integração contínua             |
| [docs/seguranca.md](docs/seguranca.md)             | Controles, decisões e lacunas conhecidas             |
| [docs/deploy.md](docs/deploy.md)                   | Compose, Vercel e migrações de produção              |
| [docs/adr/](docs/adr/)                             | Decisões de arquitetura registradas                  |
| [CONTRIBUTING.md](CONTRIBUTING.md)                 | Rotina de desenvolvimento e padrões                  |
| [SECURITY.md](SECURITY.md)                         | Política de reporte de vulnerabilidades              |

## Licença

Este projeto é desenvolvido sob licença MIT para fomentar a tecnologia educacional pública. Consulte o arquivo [LICENSE](LICENSE).
