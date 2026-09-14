# BuscApp

Plataforma de comunicação em tempo real entre escola e família para o Ensino Médio de Tempo Integral.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.10-2D3748)](https://www.prisma.io/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000)](https://fastify.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF)](https://vitejs.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-1.61-45BA4B)](https://playwright.dev/)

## Índice

- [Sobre](#sobre)
- [Funcionalidades](#funcionalidades)
- [Em Desenvolvimento](#em-desenvolvimento)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Autenticação e Segurança](#autenticação-e-segurança)
- [API](#api)
- [Banco de Dados](#banco-de-dados)
- [Tempo Real](#tempo-real)
- [Configuração](#configuração)
- [Como Executar](#como-executar)
- [Scripts](#scripts)
- [Testes](#testes)
- [PWA](#pwa)
- [CI/CD e Deploy](#cicd-e-deploy)
- [Licença](#licença)

## Sobre

O BuscApp é uma plataforma web que moderniza a comunicação entre escola e família em escolas de Ensino Médio de Tempo Integral. O sistema substitui o fluxo baseado em avisos impressos e reuniões presenciais por notificações em tempo real sobre frequência, ocorrências e justificativas, permitindo intervenções pedagógicas no momento adequado.

O acesso é organizado em três papéis:

| Papel       | Atribuições principais                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Professor   | Registro de frequência por exceção, ausências por período e ocorrências graves.                                                                        |
| Gestão      | Painel de monitoramento com ranking de risco, central de ocorrências com registro próprio, validação de justificativas e gestão completa de cadastros. |
| Responsável | Alertas de ausência e ocorrências, termômetro de atenção, envio de justificativas com anexo e chat com a equipe da gestão escolar.                     |

A interface do módulo do responsável foi projetada para usuários com pouca familiaridade com tecnologia: vocabulário acessível, mensagens curtas e indicadores visuais de leitura imediata. O termômetro de atenção traduz dados de frequência e ocorrências em três cores, e o upload de documentos aceita formatos universais disponíveis em qualquer dispositivo.

Três decisões de design orientam o sistema:

- **Frequência por exceção**: em vez de percorrer toda a lista, o professor marca apenas os ausentes, reduzindo o tempo de registro.
- **Código de redefinição de senha**: elimina a dependência de email; responsáveis sem endereço eletrônico recuperam o acesso com um código fornecido pela gestão.
- **Horário protegido no chat**: o envio de mensagens fica indisponível fora das janelas letivas configuradas, com instruções de contato alternativo exibidas ao usuário.

Privacidade e resiliência completam os princípios do projeto. Cada perfil enxerga apenas os dados que lhe competem (escopo de visibilidade por papel aplicado nos serviços da API), alterações em informações de alunos geram trilha de auditoria visível somente à gestão, nenhum registro é apagado fisicamente e os alunos são identificados apenas por nome e matrícula, sem dados sensíveis. Em conexões instáveis, mensagens de erro são apresentadas em português com instruções claras, um indicador mostra o status da conexão com a API e a recuperação após quedas de rede é automática.

## Funcionalidades

### Gerenciamento de Acesso

| Funcionalidade                | Descrição                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação                  | Login e logout com email e senha na API própria; a sessão vira um cookie `HttpOnly` de mesma origem.                                                                                                                                                                                                            |
| Sessão persistente            | Opção "lembrar-me" que mantém a sessão por 30 dias; sem ela, a validade é de 12 horas. O token fica apenas no cookie e o banco guarda o hash SHA-256.                                                                                                                                                           |
| Recuperação de senha          | Fluxo unificado com o primeiro acesso: código de 6 dígitos gerado pela gestão (HMAC-SHA256 com `AUTH_PEPPER`), solicitado pelo usuário, com expiração em 1 hora, revogação e limite de tentativas.                                                                                                              |
| Perfil autenticado            | `GET /api/auth/me` devolve nome, papel, status e módulos de acesso. As guardas do Vue Router usam essa resposta antes de montar as views.                                                                                                                                                                       |
| RBAC                          | Guardas de rota no Vue Router e hooks `exigirPapel` na API redirecionam usuários não autenticados e bloqueiam operações não autorizadas.                                                                                                                                                                        |
| Módulos de acesso             | Catálogo em `perfis.acesso_modulos` gerenciado pela gestão na criação e edição de qualquer usuário (professor: frequência e ocorrências; responsável: alertas, termômetro, justificativa e chat), com semântica fail-closed no hook `exigirModulo`, guardas de rota por módulo e filtragem dos cartões da home. |
| Redirecionamento pós-login    | Redirecionamento automático para a página inicial do perfil após login bem-sucedido.                                                                                                                                                                                                                            |
| Força e visibilidade de senha | Validação de requisitos mínimos no frontend e checkbox "Mostrar senha" nas telas de login e redefinição. As senhas são armazenadas com scrypt, com verificação de hashes bcrypt legados e regravação no próximo login.                                                                                          |

### Plataforma

| Funcionalidade            | Descrição                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atualização em tempo real | Todas as telas operacionais dos três papéis assinam o stream SSE `/api/eventos` e se atualizam sem recarregar (detalhes na seção [Tempo Real](#tempo-real)). O guard de rotas garante o usuário carregado antes das views montarem, evitando telas sem carga ou sem inscrição após reload direto. |
| Indicador de conexão      | Indicador visual verde/amarelo/vermelho do status do stream SSE, combinado à verificação de `/api/saude` a cada 30s.                                                                                                                                                                              |
| Combobox pesquisável      | `Combobox.vue` com `useDebounce` substitui `select`; busca com filtragem insensível a acentos, navegação por teclado e `aria`.                                                                                                                                                                    |
| Indicador de carregamento | Overlay global `TelaCarregamento` com título dinâmico da rota de destino e `lazy` de rotas via `meta.titulo`.                                                                                                                                                                                     |
| Tratamento de erros       | Tradução dos erros da API (envelope `{ erro: { codigo, mensagem } }`) para mensagens explícitas com entidade e horário (ex.: `Usuário "Ana" atualizado com sucesso às 14:32` / `falhou ao salvar: ...`) e `auto-dismiss` em 6s com `btn-close` centralizado (`pe-5` + `top-50`).                  |
| Proteção contra saída     | Detecção de alterações por snapshot JSON (`useFormSnapshot`) com pausa na hidratação; `onBeforeRouteLeave` com `Há alterações não salvas` e limpeza de `draft` em `sessionStorage`.                                                                                                               |
| Bloqueio de ações         | Botões desabilitados durante operações de banco (`carregando`/`salvando`) para evitar duplo envio.                                                                                                                                                                                                |
| Páginas de erro           | Páginas dedicadas para 403, 404 e 500, além de tela própria para conta desativada.                                                                                                                                                                                                                |
| Auditoria                 | Tabela `auditoria` no banco para rastreabilidade das operações administrativas.                                                                                                                                                                                                                   |
| Modal de confirmação      | Confirmação genérica para ações destrutivas (ativar/inativar usuário, salvar chamada, limpar notificações).                                                                                                                                                                                       |

### Módulo Professor

| Funcionalidade         | Descrição                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frequência por exceção | Todos os alunos considerados presentes por padrão; o professor marca apenas quem faltou. Seleção por período e busca por nome. Atualização em tempo real.                          |
| Ausência em período    | Registro de aluno presente na escola que faltou a um período específico, com seleção de período e observação opcional.                                                             |
| Ocorrências graves     | Registro de comportamento que ameace a permanência do aluno, classificado como grave ou suspensão, com descrição, tags de comportamento e opção de exigir presença do responsável. |
| Módulos de acesso      | Home exibe apenas os cartões habilitados em `perfis.acesso_modulos`; rotas sem o módulo redirecionam para a home com aviso e a API nega a operação com 403.                        |

### Módulo Gestão

| Funcionalidade              | Descrição                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Painel de monitoramento     | Página central com cartões de navegação para todos os módulos administrativos.                                                                                                                                                                                                                                                                                                     |
| Ranking de risco            | Lista priorizada de alunos do caso mais crítico ao mais leve, com filtros por nível (crítico, atenção, estável), busca por nome e atualização em tempo real. Botão "Chat" em cada aluno abre conversa com o responsável.                                                                                                                                                           |
| Central de ocorrências      | Lista de ocorrências graves e suspensões com indicadores de tipo, status e bloqueio. Alternância de bloqueio/desbloqueio de retorno em tempo real. Registro de novas ocorrências pela própria gestão (aluno, tipo, tags, descrição, exigência de presença e notificações).                                                                                                         |
| Registro de infrequências   | Chamada por exceção para qualquer turma e registro individual de ausências por período, com motivo e observação. Confirmação em modal antes de salvar. Acessível pelo cartão próprio e pelo botão "Falta" no ranking, que pré-seleciona o aluno.                                                                                                                                   |
| Validação de justificativas | Fila de pendentes com anexos em modal (imagem ou PDF baixado como blob), intervalo de datas e opção de aceitar ou recusar. Ao aceitar, as frequências do período são auto-justificadas via trigger no banco. Atualização em tempo real.                                                                                                                                            |
| CRUD de usuários            | Cadastro, edição, ativação e inativação com confirmação em modal nas mudanças de status. Geração automática de código de primeiro acesso ao criar usuário, senha temporária com scrypt e módulos de acesso editáveis para todos os papéis. A inativação revoga as sessões abertas.                                                                                                 |
| CRUD de alunos              | Cadastro e edição com dados pseudonimizados. Criação simultânea de vínculo com responsável existente ou novo. Transferência de enturmação mantendo uma matrícula ativa por ano.                                                                                                                                                                                                    |
| CRUD de turmas              | Cadastro, edição, ativação e inativação com série e letra do catálogo.                                                                                                                                                                                                                                                                                                             |
| Anos letivos                | CRUD com período e status (planejado, ativo, arquivado). A "virada de ano" arquiva atomicamente o ano vigente e ativa o novo via `POST /api/anos-letivos/:id/ativar`, com trilha de auditoria.                                                                                                                                                                                     |
| CRUD de disciplinas         | Cadastro e edição com código SIGE para integração com a SEDUC.                                                                                                                                                                                                                                                                                                                     |
| Atribuições                 | Vínculo professor-turma-disciplina com titular/substituto e período de vigência.                                                                                                                                                                                                                                                                                                   |
| Gestão de códigos           | Fila de solicitações, lista de códigos com status, revogação e expiração automática após 1 hora. Limpeza de códigos não ativos com auditoria.                                                                                                                                                                                                                                      |
| Notificações                | Badge não lidas em tempo real. Clique leva ao destino correto por papel (responsável: alertas/justificativa/chat; gestão: ranking/ocorrências/justificativas; professor: frequência/ocorrência) com deep-link `?aluno=`/`?conversa=` e nunca 403. Mensagens são limpas ao ler a conversa (trigger + serviço).                                                                      |
| Catálogos genéricos         | CRUD completo para módulos, documentos, períodos, motivos de ausência, tipos de ocorrência, vínculos, papéis de atribuição, séries e letras de turma sobre a tabela `opcoes_configuracao`. Chave interna gerada pelo nome, validações por tipo, bloqueio de duplicatas e exclusão de opções referenciadas. Reordenação por arrastar com modo protegido e seletor visual de ícones. |
| Tags de comportamento       | Catálogo com nome, categoria, ícone, descrição e peso de pontuação. Exclusão e renomeação de tags referenciadas em ocorrências são bloqueadas.                                                                                                                                                                                                                                     |
| Parâmetros do sistema       | Limites crítico/preventivo de faltas, pesos de faltas/ocorrências/recência, janela de recência, limites de score médio/alto, dias de expurgo e nome da escola. Barra do termômetro com prévia em tempo real.                                                                                                                                                                       |
| Horários letivos            | Janelas de atendimento do chat por dia da semana e horário; com todas desativadas, o canal permanece fechado.                                                                                                                                                                                                                                                                      |

### Módulo Responsável

| Funcionalidade                | Descrição                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alertas                       | Ausências (escola e aula) e ocorrências (grave e suspensão) com distinção visual e badge de urgência. Botão para enviar justificativa direto do alerta. Modal de detalhes com status da justificativa, motivo, anexo via blob e tags de comportamento. Indicadores "Aguardando validação", "Aceita" ou "Recusada".                                  |
| Termômetro de atenção         | Barra segmentada fixa verde/amarelo/vermelho com marcador de score 0–100. Score ponderado por faltas injustificadas, peso de tags de ocorrências e recência (janela configurável), com faltas justificadas abatidas e tendência 30 dias. Fatores explicativos e limites configuráveis pela gestão. Suporte a múltiplos filhos com seletor.          |
| Justificativas                | Envio com suporte a múltiplos dias. Anexo por seleção ou arrastar e soltar, com validação de tipo e tamanho e compressão automática via Canvas API (máximo 1600px, JPEG 0.6) antes do envio. O servidor revalida o formato (JPG, PNG, WEBP ou PDF) e o limite de 10 MB antes de gravar no armazenamento. Formulário permanece na tela após o envio. |
| Aviso de presença obrigatória | Badge urgente quando uma ocorrência exige a presença física do responsável na escola para liberar o retorno do aluno.                                                                                                                                                                                                                               |
| Chat com horário protegido    | Conversa com a equipe da gestão escolar, com indicador online/offline baseado nos horários letivos cadastrados. Auto-scroll para novas mensagens e leitura de mensagens limpa as notificações correspondentes.                                                                                                                                      |
| Acessibilidade e simplicidade | Telas limpas com Bootstrap 5, linguagem clara sem jargão, indicadores visuais de leitura imediata e instruções passo a passo. Compressão automática de imagens no cliente suporta fotos de qualquer dispositivo.                                                                                                                                    |

## Em Desenvolvimento

- Gamificação entre turmas (tabelas de pontuação prontas, frontend não conectado).
- Notificações push.

## Tecnologias

### Frontend

| Tecnologia              | Versão  | Uso                                                                      |
| ----------------------- | ------- | ------------------------------------------------------------------------ |
| Vue 3                   | ^3.5.32 | Framework reativo com Composition API e `<script setup lang="ts">`       |
| TypeScript              | ~6.0.0  | Tipagem estática e verificação em tempo de compilação                    |
| Vite                    | ^8.0.8  | Build tool e dev server com hot-module replacement                       |
| Vue Router              | ^5.0.4  | Roteamento SPA com guardas de navegação RBAC e de módulos                |
| Bootstrap               | ^5.3.8  | Framework CSS responsivo com grid e componentes                          |
| Bootstrap Icons         | ^1.13.1 | Biblioteca de ícones                                                     |
| Geist Sans / Geist Mono | ^5.x    | Fontes tipográficas via @fontsource                                      |
| reka-ui                 | ^2.10.4 | Primitivos acessíveis sem estilo para componentes interativos            |
| sortablejs              | ^1.15.7 | Arrastar e soltar com suporte a toque, usado na reordenação de catálogos |
| @popperjs/core          | ^2.11.8 | Dependência do Bootstrap JS para tooltips e popovers                     |
| vite-plugin-pwa         | ^1.3.0  | Suporte a Progressive Web App com service worker                         |

### Backend e Infraestrutura

| Tecnologia                                | Versão                                   | Uso                                                                   |
| ----------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Node.js                                   | 24 no container (20.19+ ou 22.12+ local) | Runtime da API e das ferramentas                                      |
| Fastify                                   | ^5.12.4                                  | Framework HTTP com validação Zod no limite e suporte a streaming/SSE  |
| Prisma                                    | 7.10.0                                   | ORM e migrações SQL versionadas                                       |
| PostgreSQL                                | 17                                       | Banco relacional com extensões pgcrypto e pg_trgm                     |
| Zod                                       | ^4.6.4                                   | Schemas de validação compartilhados (`@buscapp/contratos`)            |
| @fastify/cookie, cors, multipart e static | ^11.x / ^10.x                            | Sessão em cookie, CORS com credenciais, upload e SPA na mesma origem  |
| Armazenamento                             | disco (padrão) ou S3                     | Drivers próprios de anexos, com MinIO/R2/AWS via `@aws-sdk/client-s3` |
| Server-Sent Events                        | nativo                                   | Tempo real em `/api/eventos`, sem WebSocket                           |
| scrypt / bcryptjs                         | node:crypto / ^3.0.3                     | Hash de senhas próprio e verificação de hashes legados                |
| Docker Compose                            | -                                        | Sobe a aplicação e o PostgreSQL 17 com migrações no start             |
| npm workspaces                            | -                                        | Monorepo com `apps/web`, `apps/api` e `packages/contratos`            |

### Qualidade e DevOps

| Tecnologia                         | Versão  | Uso                                                                                  |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| Vitest                             | ^5.0.0  | Testes de integração da API contra o PostgreSQL do Compose                           |
| Playwright                         | ^1.61.1 | Testes E2E multiplataforma (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari) |
| oxlint                             | ~1.60.0 | Linter de alta performance escrito em Rust                                           |
| ESLint                             | ^10.2.1 | Linter com configuração flat para Vue + TypeScript                                   |
| Prettier                           | 3.8.3   | Formatador de código                                                                 |
| GitHub Actions                     | -       | CI: qualidade, testes, migrações, publicação no GHCR e CodeQL                        |
| Dependabot                         | -       | Atualização automática de dependências do devcontainer                               |
| Vercel                             | -       | Deploy contínuo da SPA                                                               |
| GitHub Codespaces / Dev Containers | -       | Ambiente de desenvolvimento em nuvem e containerizado                                |

## Arquitetura

O sistema é um monorepo com três workspaces npm. A SPA e a API compartilham os contratos Zod em `packages/contratos`, e a topologia padrão é de mesma origem: em produção a API Fastify serve o `dist/` da SPA, o que mantém o cookie de sessão first-party. Quando o frontend é hospedado em outro host, basta definir `VITE_API_URL` e liberar a origem em `APP_ORIGINS`.

### Estrutura de Diretórios

```
buscapp/
├── apps/
│   ├── web/                             # SPA Vue 3 + TypeScript + Vite
│   │   ├── public/                      # favicon e ícones do PWA
│   │   ├── src/
│   │   │   ├── assets/cores.css         # Variáveis CSS (primária verde #008241, fontes Geist)
│   │   │   ├── componentes/             # 22 componentes reutilizáveis
│   │   │   ├── composables/             # 13 composables (autenticação, monitoramento, SSE, notificações)
│   │   │   ├── layouts/LayoutPrincipal.vue
│   │   │   ├── paginas/                 # auth, professor, gestao, responsavel e error
│   │   │   ├── rotas/index.ts           # Vue Router com guardas de papel e de módulo
│   │   │   ├── servicos/                # cliente da API, EventSource e cálculo do termômetro
│   │   │   ├── tipos/                   # tipos de banco, componentes e Bootstrap
│   │   │   ├── utils/                   # compressão de imagem, chat, erros e opções
│   │   │   ├── App.vue
│   │   │   └── main.ts                  # Fontes, Bootstrap, PWA e montagem
│   │   └── vite.config.ts               # Vue, PWA e envDir apontando para a raiz
│   └── api/                             # API Fastify 5 + Prisma
│       ├── prisma/
│       │   ├── schema.prisma            # Contrato das tabelas e enums
│       │   ├── migrations/              # baseline, autenticação, dados canônicos e rotinas
│       │   └── seeds/dev.ts             # Usuários e fixtures de desenvolvimento
│       └── src/
│           ├── ambiente.ts              # Validação fail-fast das variáveis de ambiente
│           ├── app.ts                   # Fábrica Fastify (testável com inject)
│           ├── principal.ts             # Bootstrap do servidor
│           ├── modulos/                 # auth, usuarios, alunos, anexos, codigos, vinculos,
│           │                            # estrutura, frequencias, ocorrencias, justificativas,
│           │                            # chat, notificacoes, configuracoes, monitoramento
│           │                            # (cada domínio em .rotas → .servico → .repositorio)
│           └── nucleo/
│               ├── autenticacao/        # scrypt, sessões opacas, códigos HMAC e middleware
│               ├── autorizacao/         # escopo de alunos visíveis por papel
│               ├── armazenamento/       # drivers disco e S3
│               ├── banco/               # PrismaClient com adapter-pg
│               ├── eventos/             # barramento e roteamento SSE
│               └── http/                # envelope de erros, saúde e eventos
├── packages/
│   └── contratos/                       # Schemas Zod e tipos compartilhados entre web e API
├── infra/docker/
│   ├── Dockerfile                       # Build multi-stage em Node 24
│   └── entrypoint.sh                    # Aguarda o banco, aplica migrações e inicia a API
├── tests/
│   ├── e2e/                             # 19 arquivos de especificação Playwright
│   └── suporte/                         # Helpers de API, banco, sessão, fixtures e senhas
├── scripts/
│   ├── gerar-icones.sh                  # Gera os ícones do PWA
│   └── test-db.sh                       # Smoke test do schema no PostgreSQL do Compose
├── .github/workflows/                   # qualidade, testes, migracoes, publicacao e codeql
├── .devcontainer/                       # Ambiente de desenvolvimento
├── compose.yaml                         # app + PostgreSQL 17
├── playwright.config.ts                 # E2E com API e web iniciados automaticamente
├── playwright.pwa.config.ts             # Configuração dedicada aos testes de PWA
├── .env.example                         # Template de variáveis de ambiente
├── tsconfig.base.json                   # Opções TypeScript compartilhadas
└── package.json                         # Workspaces npm e scripts da raiz
```

### Fluxo de Dados

```
Navegador (SPA Vue 3 + TypeScript + Vite)
       |
       |  fetch para a mesma origem com cookies HttpOnly (credentials: include)
       |  Vue Router com guardas de papel e de módulo
       |
       +--> Componentes Vue 3 (Composition API, <script setup>)
       |       |
       |       +--> Composables (useAutenticacao, useMonitoramento, useNotificacoes, ...)
       |       |
       |       +--> servicos/api.ts  --->  API Fastify 5 (apps/api)
       |       +--> servicos/eventos.ts -> EventSource /api/eventos (SSE)
       |
       v
API Fastify 5 (mesma origem em produção; CORS com credenciais quando separada)
       |
       +--> Autenticação: sessão opaca no cookie, scrypt, códigos HMAC
       +--> Autorização: papel + acesso_modulos + escopo de alunos visíveis
       +--> Módulos (.rotas → .servico → .repositorio)
       +--> SSE /api/eventos: invalidação por tabela e escopo, com heartbeat
       +--> Armazenamento: driver disco (UPLOAD_DIR) ou S3 (MinIO/R2/AWS)
       |
       |  Prisma 7.10 com @prisma/adapter-pg
       v
PostgreSQL 17
       +--> 31 tabelas, 14 enums, índices parciais e unicidade
       +--> Triggers de domínio, CHECKs de integridade e funções de validação
       +--> Extensões: pgcrypto, pg_trgm
```

## Autenticação e Segurança

- **Login sem cadastro público**: usuários são criados pela gestão em `POST /api/usuarios`. O login equaliza o tempo de resposta com um hash falso quando o email não existe e devolve mensagem genérica; perfis inativos respondem 403.
- **Sessão opaca**: o token é gerado com CSPRNG, trafega somente no cookie `HttpOnly` (`SESSAO_COOKIE`) e o banco guarda apenas o hash SHA-256. A validade é de 12 horas ou 30 dias com "lembrar-me". Logout e inativação revogam a sessão imediatamente.
- **Redefinição por código**: o usuário solicita e a gestão gera um código de 6 dígitos (CSPRNG) com HMAC-SHA256 sobre `email:código` usando `AUTH_PEPPER`; o código expira em 1 hora, pode ser revogado e o excesso de tentativas bloqueia temporariamente o email. A solicitação notifica a gestão sem revelar se o email existe; a redefinição revoga todas as sessões e ativa perfis pendentes.
- **RBAC e módulos**: `exigirPapel` valida o papel e `exigirModulo` aplica `acesso_modulos` com semântica fail-closed (lista vazia nega). As guardas de rota do Vue Router espelham a mesma regra no cliente.
- **Escopo de dados**: gestão acessa todos os alunos; professor acessa os alunos das turmas em que leciona; responsável acessa apenas os alunos vinculados. Recurso fora do escopo de leitura responde 404, para não revelar a existência do registro.
- **Auditoria**: operações administrativas (geração e revogação de códigos, virada de ano letivo, alterações de alunos) são registradas na tabela `auditoria`.
- **Anexos**: validação de tipo e tamanho no upload (JPG, PNG, WEBP ou PDF; até 10 MB), autorização por criador ou aluno visível e download autenticado. Nenhum token ou caminho de arquivo é exposto na URL.
- **Erros padronizados**: todas as respostas de erro usam o envelope `{ erro: { codigo, mensagem } }`, em português.
- **Defesa em profundidade**: além do escopo na camada de serviços, o banco aplica Row-Level Security com o papel restrito `buscapp_api` e `app.usuario_id` definido por transação; tentativas fora do escopo são barradas mesmo se uma consulta esquecer o filtro.

## API

A API segue o padrão `.rotas → .servico → .repositorio` em cada módulo, com validação Zod no limite e autorização por papel, módulo e escopo. Todos os grupos usam cookie de sessão.

| Grupo          | Rotas principais                                                                                             | Finalidade                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| auth           | `/api/auth/login`, `/logout`, `/me`, `/solicitar-codigo`, `/redefinir-senha`                                 | Sessão, perfil autenticado e redefinição de senha por código.                       |
| usuarios       | `/api/usuarios`, `/api/usuarios/:id/status`                                                                  | CRUD de usuários, módulos de acesso e ativação/inativação.                          |
| alunos         | `/api/alunos`                                                                                                | Cadastro e manutenção de alunos pseudonimizados.                                    |
| estrutura      | `/api/turmas`, `/api/disciplinas`, `/api/atribuicoes`, `/api/anos-letivos` (+ `/ativar`), `/api/enturmacoes` | Turmas, disciplinas, atribuições professor-turma, anos letivos e enturmações.       |
| vinculos       | `/api/vinculos`                                                                                              | Vínculo N:N entre responsáveis e alunos.                                            |
| frequencias    | `/api/frequencias`, `/api/frequencias/lote`, `/api/frequencias/resumo`                                       | Registro por exceção, ausências por período e resumos de frequência.                |
| ocorrencias    | `/api/ocorrencias`, `/api/registros-comportamento`, `/api/tags-comportamento`                                | Ocorrências graves/suspensões, registros de comportamento e tags.                   |
| justificativas | `/api/justificativas`                                                                                        | Envio, listagem e validação de justificativas (com auto-justificativa por trigger). |
| anexos         | `/api/anexos`, `/api/anexos/:id/arquivo`                                                                     | Upload validado, metadados e download autenticado de anexos.                        |
| chat           | `/api/conversas`, `/api/conversas/:id/mensagens`, `/api/conversas/:id/lidas`                                 | Conversas e mensagens com horário protegido.                                        |
| notificacoes   | `/api/notificacoes`, `/lidas`, `/:id/lida`, `/conversa/:id/lidas`                                            | Fila de notificações in-app por destinatário.                                       |
| configuracoes  | `/api/configuracoes`, `/api/opcoes` (+ `/reordenar`), `/api/horarios`                                        | Parâmetros do sistema, catálogos genéricos e janelas de atendimento.                |
| codigos        | `/api/codigos`, `/:id/revogar`, `/limpar`, `/perfil/:perfilId`                                               | Códigos de redefinição e primeiro acesso, com revogação e limpeza.                  |
| monitoramento  | agregações de frequências, ocorrências e configurações                                                       | Ranking de risco e termômetro de atenção consumidos pela gestão e pelo responsável. |
| eventos        | `GET /api/eventos`                                                                                           | Stream SSE de invalidação em tempo real.                                            |
| saúde          | `GET /api/saude`                                                                                             | Disponibilidade da API, usada pelo indicador de conexão.                            |

## Banco de Dados

O banco é um PostgreSQL 17 versionado por quatro migrações Prisma (`baseline`, `autenticacao`, `dados_canonicos` e `rotinas_dominio`), com 31 tabelas de domínio, 14 enums, mais de 40 CHECKs e 29 triggers. As migrações mantêm em SQL os objetos que o Prisma não representa (triggers, CHECKs, funções de validação e índices parciais), e o seed `apps/api/prisma/seeds/dev.ts` cria usuários e fixtures de desenvolvimento.

**Objetos e integridade**

- **Triggers de domínio**: `fn_auto_justificar_frequencias` (marca as frequências como justificadas quando uma justificativa é aceita), `fn_notificar_nova_mensagem`, `fn_notificar_ocorrencia`, `fn_set_turma_nome` e `fn_set_updated_at`.
- **CHECKs de integridade**: chaves de `opcoes_configuracao` e nomes de `tags_comportamento` validados por funções `SECURITY DEFINER`, limites de score e pesos, ordem de datas, anexos de até 10 MB, mensagens não vazias, série/letra de turma e capacidade, entre outros.
- **Índices**: parciais e compostos para consultas ativas, incluindo a unicidade de frequência (`idx_frequencias_unicidade`) e a idempotência por `client_request_id`.
- **Views e agregações**: as views analíticas do projeto original não foram portadas para as migrações; ranking de risco, termômetro e feed do aluno são calculados na aplicação a partir das tabelas base e dos parâmetros de `configuracoes_sistema`.
- **Soft delete**: frequências preservam histórico com `deleted_at`; registros administrativos não são apagados fisicamente.

### Principais Tabelas

**Entidades**

| Tabela         | Descrição                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `perfis`       | Perfis de usuário com credenciais (`senha_hash` scrypt), módulos de acesso e status: ativo, pendente ou inativo. Papéis: professor, gestão, responsável. |
| `alunos`       | Alunos com dados pseudonimizados (sem CPF ou endereço).                                                                                                  |
| `turmas`       | Turmas escolares. Série + letra do catálogo.                                                                                                             |
| `anos_letivos` | Anos letivos. Status: planejado, ativo, arquivado.                                                                                                       |
| `enturmacoes`  | Vínculo aluno-turma temporal (único por aluno por ano).                                                                                                  |
| `disciplinas`  | Disciplinas com código SIGE para integração com a SEDUC.                                                                                                 |

**Autenticação**

| Tabela                           | Descrição                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `sessoes`                        | Sessões opacas: hash SHA-256 do token, expiração, revogação, último uso, user agent e IP.                                         |
| `codigos_redefinicao`            | Códigos de 6 dígitos para redefinição de senha e primeiro acesso, armazenados apenas como HMAC (expiração em 1 hora, revogáveis). |
| `codigos_redefinicao_tentativas` | Proteção contra força bruta: tentativas erradas por email e bloqueio temporário.                                                  |

**Relacionamentos**

| Tabela                    | Descrição                                                                       |
| ------------------------- | ------------------------------------------------------------------------------- |
| `vinculos_responsaveis`   | Relação responsável-aluno N:N com tipo de vínculo do catálogo.                  |
| `atribuicoes_professores` | Atribuição professor-turma-disciplina temporal. Suporte a titular e substituto. |

**Operacionais**

| Tabela                    | Descrição                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frequencias`             | Registro unificado de frequência (portão, chamada, saída). Soft delete via `deleted_at`. Idempotência via `client_request_id`.                                                        |
| `registros_comportamento` | Registros de comportamento com vínculo N:N a tags.                                                                                                                                    |
| `ocorrencias`             | Ocorrências graves e suspensões. Workflow de status, opção `exige_presenca_responsavel` e flags de notificação.                                                                       |
| `justificativas_faltas`   | Justificativas de falta. Status: pendente, aceita, recusada. Suporte a múltiplos dias via `data_fim`. Auto-justificativa de frequências via trigger `fn_auto_justificar_frequencias`. |
| `monitoramento_acoes`     | Log de ações de monitoramento.                                                                                                                                                        |
| `notificacoes`            | Fila de notificações in-app por destinatário.                                                                                                                                         |

**Chat**

| Tabela      | Descrição                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `conversas` | Conversas (única por par responsável-aluno).                                                   |
| `mensagens` | Mensagens com proteção contra excesso de envio fora do horário letivo e chave de idempotência. |

**Apoio**

| Tabela                 | Descrição                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `tags_comportamento`   | Catálogo de tags de comportamento com peso para gamificação.                           |
| `pontuacao_turmas`     | Pontuação mensal de turmas. Coluna gerada para o total.                                |
| `anexos`               | Metadados de anexos (limite de 10 MB, expiração e caminho no driver de armazenamento). |
| `ocorrencia_anexos`    | Join N:N ocorrência-anexo.                                                             |
| `justificativa_anexos` | Join N:N justificativa-anexo.                                                          |
| `horarios_letivos`     | Janelas de atendimento do chat por dia da semana e horário.                            |

**Administrativas e Auditoria**

| Tabela            | Descrição                                   |
| ----------------- | ------------------------------------------- |
| `importacoes_log` | Auditoria de importação de planilhas SIGE.  |
| `exportacoes`     | Registro de exportação do diário de classe. |
| `auditoria`       | Trilha de auditoria geral.                  |
| `convites`        | Registro de convites de usuário.            |

**Configuração**

| Tabela                  | Descrição                                                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `configuracoes_sistema` | Parâmetros globais (limites de faltas, pesos e janela de recência do termômetro, limites de score médio/alto, dias de expurgo, nome da escola e parâmetros de códigos).                                                                                            |
| `opcoes_configuracao`   | Catálogo genérico de opções configuráveis pela gestão (módulos, documentos, períodos, motivos de ausência, tipos de ocorrência, vínculos, papéis de atribuição, séries e letras de turma). Chaves validadas por restrições `CHECK` nas tabelas que as referenciam. |

### Segurança

- Autorização por papel, módulo e escopo na camada de serviços da API, com RLS como backstop no banco (papel restrito + `app.usuario_id` por requisição).
- Módulos de acesso com semântica fail-closed: professor em `frequencias` e `ocorrencias` e responsável nas telas de alertas, termômetro, justificativa e chat exigem o módulo correspondente; lista vazia significa nenhum acesso. Aplicação simultânea na API, nas guardas de rota e nos cartões da home.
- **Integridade referencial do catálogo**: restrições `CHECK` validam toda escrita de chaves de `opcoes_configuracao` e nomes de `tags_comportamento` nas tabelas que as referenciam (turmas, vínculos, atribuições, frequências, perfis, alunos, ocorrências), impedindo referências órfãs.
- **Exclusão protegida na interface**: opções de catálogo e tags ainda referenciadas não podem ser excluídas (ou renomeadas, no caso de tags); a interface orienta a desativação.
- **Exclusão de turmas com `ON DELETE RESTRICT`** em conversas e atribuições, evitando apagamento silencioso do histórico de chat.
- Soft delete em `frequencias` para preservação de dados históricos e índices parciais para dados ativos.
- Hashes de senha bcrypt legados são verificados uma única vez e regravados em scrypt no login, permitindo a migração transparente das bases antigas.

## Tempo Real

A atualização automática usa o stream autenticado `GET /api/eventos` (Server-Sent Events). Cada evento `invalidar` carrega `{ tabela, escopo }`, e o frontend recarrega apenas as telas inscritas naquela tabela, sem enviar dados sensíveis pelo canal.

**Como funciona**

- O `EventSource` é único por aba e se reconecta sozinho com o backoff do navegador; `useRealtimeRefresh` dispara uma recarga ao (re)conectar e ao voltar para a aba, com debounce de 500 ms.
- O servidor envia heartbeat a cada 25 s e pode endereçar eventos a destinatários específicos (notificações por usuário, frequências e justificativas para responsáveis do aluno).
- Escopos: `mensagens` por `conversa_id` e `notificacoes` por destinatário; os demais eventos invalidam a tabela para os usuários autorizados.
- **Fallback**: o popover de notificações também recarrega a cada 30 s caso o stream esteja indisponível.
- **Indicador de conexão**: combina o estado do stream SSE com a verificação periódica de `/api/saude` a cada 30 s.

**Tabelas que publicam invalidações:** `notificacoes`, `mensagens`, `conversas`, `frequencias`, `justificativas_faltas`, `ocorrencias`, `registros_comportamento`, `tags_comportamento`, `turmas`, `enturmacoes`, `atribuicoes_professores`, `anos_letivos`, `vinculos_responsaveis`, `opcoes_configuracao`, `configuracoes_sistema` e `horarios_letivos`.

**Triggers de domínio ligados ao tempo real:**

- `fn_notificar_nova_mensagem`: notifica o destinatário (responsável ou gestão) a cada nova mensagem.
- `fn_notificar_ocorrencia`: avisa os responsáveis vinculados quando uma ocorrência é registrada com notificação habilitada.
- `fn_auto_justificar_frequencias`: dispara a atualização das frequências e dos painéis quando uma justificativa é aceita.

## Configuração

Variáveis definidas em `.env` (local) ou no painel do provedor de deploy (produção). Consulte `.env.example`.

| Variável                                                                            | Onde é usada         | Descrição                                                                                     |
| ----------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                      | API (runtime)        | Conexão com o papel restrito `buscapp_api` (sujeito ao RLS).                                  |
| `MIGRATE_DATABASE_URL`                                                              | Migrações e seed     | Conexão dona do schema, usada por `prisma migrate` e pelo seed.                               |
| `DATABASE_URL_ADMIN`                                                                | Fixtures de teste    | Conexão dona do schema usada apenas nos testes de integração/E2E.                             |
| `APP_DB_PASSWORD`                                                                   | Container            | Senha aplicada ao papel `buscapp_api` pelo entrypoint do Compose.                             |
| `DIRECT_URL`                                                                        | Migrações (opcional) | Conexão direta para aplicar migrações em bancos gerenciados atrás de pooler.                  |
| `PORT` / `HOST`                                                                     | API                  | Porta e interface de escuta (padrão `3001` e `0.0.0.0`).                                      |
| `APP_URL`                                                                           | API                  | Origem do frontend liberada no CORS com credenciais (padrão `http://localhost:5173`).         |
| `APP_ORIGINS`                                                                       | API                  | Origens adicionais para CORS, separadas por vírgula.                                          |
| `WEB_DIST`                                                                          | API                  | Caminho do build da SPA servido na mesma origem (padrão `../web/dist`).                       |
| `AUTH_PEPPER`                                                                       | API                  | Segredo do HMAC dos códigos de redefinição; mínimo de 32 caracteres em produção.              |
| `SESSAO_COOKIE`                                                                     | API                  | Nome do cookie de sessão (padrão `buscapp_sessao`).                                           |
| `COOKIE_SAMESITE`                                                                   | API                  | Atributo `SameSite` do cookie (`lax`, `strict` ou `none`).                                    |
| `COOKIE_SECURE`                                                                     | API                  | Força `Secure` no cookie; por padrão ativo quando `NODE_ENV=production`.                      |
| `STORAGE_DRIVER`                                                                    | API                  | Driver de anexos: `disco` (padrão) ou `s3`.                                                   |
| `UPLOAD_DIR`                                                                        | API (disco)          | Diretório dos uploads (padrão `uploads`).                                                     |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | API (S3)             | Credenciais e endpoint do bucket (MinIO, R2 ou AWS).                                          |
| `SEED_SENHA_ADMIN`, `SEED_SENHA_PROF`, `SEED_SENHA_RESP`                            | Seed                 | Senhas dos usuários de teste criados pelo seed de desenvolvimento.                            |
| `VITE_API_URL`                                                                      | Frontend             | URL base da API. Vazio (padrão) usa a mesma origem; defina ao hospedar a SPA separada da API. |

## Como Executar

### Pré-requisitos

- Node.js 22.12+ (ou 20.19+); o container usa Node 24
- Docker e Docker Compose em execução
- npm

### Passos para Instalação

1. Clone o repositório:

```bash
git clone https://github.com/eemtijca/buscapp.git
```

2. Acesse a pasta do projeto:

```bash
cd buscapp
```

3. Instale as dependências:

```bash
npm install
```

4. Copie o arquivo de ambiente e ajuste o `AUTH_PEPPER`:

```bash
cp .env.example .env
```

5. Suba a aplicação e o PostgreSQL (as migrações são aplicadas automaticamente no start do container):

```bash
npm run compose:up
```

6. Popule o banco com usuários e fixtures de desenvolvimento:

```bash
npm run seed -w @buscapp/api
```

7. Acesse a aplicação em `http://localhost:3000` (SPA servida pela própria API, com cookie de sessão de mesma origem).

Para desenvolver com hot-module replacement, rode os dois processos em terminais separados:

```bash
npm run dev:api    # API em http://localhost:3001
VITE_API_URL=http://localhost:3001 npm run dev:web   # SPA em http://localhost:5173
```

O `APP_URL` do `.env` já aponta para `http://localhost:5173`, liberando o CORS com credenciais do modo de desenvolvimento.

### URLs

| Serviço               | URL                                                  |
| --------------------- | ---------------------------------------------------- |
| SPA no container      | `http://localhost:3000`                              |
| API (desenvolvimento) | `http://localhost:3001/api/saude`                    |
| SPA (desenvolvimento) | `http://localhost:5173`                              |
| PostgreSQL do Compose | `localhost:5433` (usuário, senha e banco: `buscapp`) |

### Credenciais de Teste

| Papel       | Email                | Senha     |
| ----------- | -------------------- | --------- |
| Gestão      | gestao@escola.edu.br | Admin123! |
| Professor   | prof1@escola.edu.br  | Prof123!  |
| Responsável | resp1@email.com      | Resp123!  |

Usuários adicionais: prof2/prof3@escola.edu.br (Prof123!) e resp2/resp3@email.com (Resp123!). O `prof2` não possui o módulo de ocorrências, o que permite testar o gating de módulos.

### Parando o Ambiente Local

```bash
npm run compose:down
```

Para remover também os volumes de dados e uploads, use `docker compose down -v`.

### Solução de Problemas do Ambiente Local

- **Portas ocupadas:** a API usa `3001` (dev) e `3000` (container), a SPA usa `5173` e o PostgreSQL do Compose usa `5433`. Libere-as ou ajuste `PORT` e as portas do `compose.yaml`.
- **Migrações pendentes:** no container elas são aplicadas pelo entrypoint; no desenvolvimento local aplique com `npm run db:migrate` antes de subir a API.
- **`AUTH_PEPPER` inválido:** a API falha no boot se a variável não existir; em produção ela precisa ter ao menos 32 caracteres.
- **Banco desatualizado:** rode `npm run db:migrate` ou `npm run compose:up` novamente para aplicar as migrações do Prisma.

## Scripts

| Comando                | Descrição                                                              |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run dev`          | Inicia a SPA em modo desenvolvimento (alias de `dev:web`).             |
| `npm run dev:web`      | Servidor Vite com HMR em `http://localhost:5173`.                      |
| `npm run dev:api`      | API Fastify em `http://localhost:3001` com `tsx watch`.                |
| `npm run build`        | Verificação de tipos e build de produção.                              |
| `npm run build-only`   | Build de produção da SPA sem verificação de tipos.                     |
| `npm run preview`      | Preview do build de produção com `vite preview`.                       |
| `npm run type-check`   | Verificação de tipos em todos os workspaces (`vue-tsc`/`tsc`).         |
| `npm run lint`         | oxlint e ESLint com auto-fix.                                          |
| `npm run format`       | Prettier em `apps/web/src`, `apps/api/src` e `packages/contratos/src`. |
| `npm run test`         | Typecheck + lint + build + testes de integração da API.                |
| `npm run test:unit`    | Testes de integração da API (Vitest).                                  |
| `npm run test:api`     | Alias de `test:unit`.                                                  |
| `npm run test:db`      | Smoke test do schema no PostgreSQL do Compose.                         |
| `npm run test:e2e`     | Testes E2E Playwright (sobe API e web automaticamente).                |
| `npm run test:pwa`     | Build de produção + preview + testes de PWA.                           |
| `npm run db:generate`  | Gera o Prisma Client.                                                  |
| `npm run db:migrate`   | Aplica as migrações no `DATABASE_URL`.                                 |
| `npm run compose:up`   | Sobe app e PostgreSQL com build e migrações no start.                  |
| `npm run compose:down` | Derruba o ambiente do Compose.                                         |

## Testes

O projeto possui quatro camadas de teste independentes, além das verificações estáticas do `npm run test`.

### Integração da API (Vitest)

- **Arquivos:** `apps/api/src/**/*.test.ts` (11 arquivos, 149 testes).
- **Ferramenta:** Vitest com a fábrica `construirApp()` e requisições via `inject`, contra o PostgreSQL do Compose.
- **Cobertura:** autenticação e sessões, papéis e módulos, escopo de alunos, CRUD dos domínios, códigos de redefinição, anexos, chat, notificações, configurações e regras de segurança (caso anônimo, 403 e 404 fora do escopo).
- **Execução:** `npm run test:unit` (as suítes rodam em série para não competir pelo mesmo banco).

### E2E (Playwright)

- **Arquivos:** `tests/e2e/*.spec.ts` (19 especificações, incluindo a suíte de PWA) com os helpers de `tests/suporte/`.
- **Projetos:** Chromium, Firefox, WebKit, Mobile Chrome (Pixel 5) e Mobile Safari (iPhone 12).
- **Cobertura:** login e recuperação de senha; gestão (navegação, usuários, alunos, códigos, catálogos, estrutura, infrequências, ranking, ocorrências e justificativas); professor (frequência, ausência, ocorrências e gating); responsável (alertas, termômetro, justificativa com arrastar e soltar e chat); tempo real, notificações sem 403, combobox, anexos e resiliência.
- **Execução:** `npm run test:e2e`. O `playwright.config.ts` sobe a API (`http://localhost:3001`) e a web (`http://localhost:5173`) automaticamente, com worker único por padrão e timeout de expect de 10 segundos; em máquinas locais é possível elevar os workers via CLI (`npx playwright test --workers=6`).

### Banco de Dados (smoke test)

- **Arquivo:** `scripts/test-db.sh`, executado contra o PostgreSQL do Docker Compose.
- **Cobertura:** aplica as migrações pendentes e confere as migrações, as 31 tabelas de `public`, os CHECKs, os triggers de domínio e o índice parcial `idx_frequencias_unicidade`.
- **Execução:** `npm run test:db` (requer `npm run compose:up`).

### PWA

- **Arquivo:** `tests/e2e/pwa.spec.ts`, com configuração dedicada em `playwright.pwa.config.ts`.
- **Cobertura:** manifest, service worker e funcionamento offline do build de produção servido por `vite preview`.
- **Execução:** `npm run test:pwa` (executa o build antes dos testes).

## PWA

A aplicação é instalável como Progressive Web App.

- **Plugin:** `vite-plugin-pwa` registrado no `apps/web/vite.config.ts`, com service worker e manifest gerados apenas no build de produção.
- **Ícones:** gerados a partir de imagem fonte pelo script `scripts/gerar-icones.sh`.
- **Testes dedicados:** `tests/e2e/pwa.spec.ts` executa contra o build de produção via `vite preview`, apontando para a API configurada em `VITE_API_URL`.
- **Execução:** `npm run test:pwa` (configuração em `playwright.pwa.config.ts`, projetos Desktop Chrome e Mobile Chrome).

## CI/CD e Deploy

### Integração Contínua (GitHub Actions)

- **`qualidade.yml`:** type-check, lint e build em pushes para `main` e pull requests.
- **`testes.yml`:** sobe o ambiente completo com `docker compose up -d --build`, aguarda `/api/saude` responder, exibe os logs em caso de falha e derruba o ambiente ao final.
- **`migracoes.yml`:** aplica `prisma migrate deploy` com `DATABASE_URL` vindo do secret `DIRECT_URL_PROD` quando há mudanças em `apps/api/prisma/`.
- **`publicacao.yml`:** build da imagem Docker (`infra/docker/Dockerfile`) e push para o GHCR (`ghcr.io/<repo>:latest` e `:<sha>`) em pushes para `main` e tags `v*`.
- **`codeql.yml`:** análise de segurança CodeQL Advanced para javascript-typescript em push, pull request e agendamento semanal.

### Dependências (Dependabot)

- **Configuração:** `.github/dependabot.yml`.
- **Escopo:** atualizações semanais para o ecossistema `devcontainers`.

### Deploy (Vercel)

A SPA pode ser publicada na Vercel a partir do diretório `apps/web`, com o build padrão do workspace (`npm run build`). Quando a API estiver em outro host, defina `VITE_API_URL` no projeto da Vercel e libere a origem em `APP_ORIGINS`; com a API servindo o `dist/` na mesma origem, deixe `VITE_API_URL` vazio. O cookie de sessão é first-party por padrão.

## Licença

Este projeto é desenvolvido sob licença MIT para fomentar a tecnologia educacional pública. Consulte o arquivo [LICENSE](./LICENSE) para mais detalhes.
