# BuscApp

Plataforma de comunicação em tempo real entre escola e família para o Ensino Médio de Tempo Integral.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ECF8E)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF)](https://vitejs.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-1.61-45BA4B)](https://playwright.dev/)

## Índice

- [Sobre](#sobre)
- [Funcionalidades](#funcionalidades)
- [Em Desenvolvimento](#em-desenvolvimento)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Banco de Dados](#banco-de-dados)
- [Edge Functions](#edge-functions)
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

| Papel | Atribuições principais |
|-------|------------------------|
| Professor | Registro de frequência por exceção, ausências por período e ocorrências graves. |
| Gestão | Painel de monitoramento com ranking de risco, central de ocorrências com registro próprio, validação de justificativas e gestão completa de cadastros. |
| Responsável | Alertas de ausência e ocorrências, termômetro de atenção, envio de justificativas com anexo e chat com a equipe da gestão escolar. |

A interface do módulo do responsável foi projetada para usuários com pouca familiaridade com tecnologia: vocabulário acessível, mensagens curtas e indicadores visuais de leitura imediata. O termômetro de atenção traduz dados de frequência e ocorrências em três cores, e o upload de documentos aceita formatos universais disponíveis em qualquer dispositivo.

Três decisões de design orientam o sistema:

- **Frequência por exceção**: em vez de percorrer toda a lista, o professor marca apenas os ausentes, reduzindo o tempo de registro.
- **Código de redefinição de senha**: elimina a dependência de email; responsáveis sem endereço eletrônico recuperam o acesso com um código fornecido pela gestão.
- **Horário protegido no chat**: o envio de mensagens fica indisponível fora das janelas letivas configuradas, com instruções de contato alternativo exibidas ao usuário.

Privacidade e resiliência completam os princípios do projeto. Cada perfil enxerga apenas os dados que lhe competem (Row-Level Security por papel), alterações em informações de alunos geram trilha de auditoria visível somente à gestão, nenhum registro é apagado fisicamente e os alunos são identificados apenas por nome e matrícula, sem dados sensíveis. Em conexões instáveis, mensagens de erro são apresentadas em português com instruções claras, um indicador mostra o status da conexão e a recuperação após quedas de rede é automática.

## Funcionalidades

### Gerenciamento de Acesso

| Funcionalidade | Descrição |
|----------------|-----------|
| Autenticação | Login e logout com email e senha via Supabase Auth. |
| Sessão persistente | Opção "lembrar-me" que alterna entre localStorage (permanente) e sessionStorage (temporária). |
| Recuperação de senha | Fluxo unificado com o primeiro acesso: código de 6 dígitos para redefinir a senha sem depender de email (gerado pela gestão, solicitado pelo usuário). Expiração em 1 hora. |
| JWT com custom claims | Token JWT contém nome e papel do usuário, injetados via Custom Access Token Hook do Supabase. |
| RBAC | Guardas de rota no Vue Router que redirecionam usuários não autenticados e bloqueiam rotas não autorizadas. |
| Módulos de acesso | Catálogo em `perfis.acesso_modulos` gerenciado pela gestão na criação e edição de qualquer usuário (professor: frequência e ocorrências; responsável: alertas, termômetro, justificativa e chat), com aplicação fail-closed em políticas RLS, guardas de rota por papel e filtragem dos cartões da home. |
| Redirecionamento pós-login | Redirecionamento automático para a página inicial do perfil após login bem-sucedido. |
| Força e visibilidade de senha | Validação de requisitos mínimos no frontend e checkbox "Mostrar senha" nas telas de login e redefinição. |

### Plataforma

| Funcionalidade | Descrição |
|----------------|-----------|
| Atualização em tempo real | Todas as telas operacionais dos três papéis assinam canais do Supabase Realtime e se atualizam sem recarregar (detalhes na seção [Tempo Real](#tempo-real)). O guard de rotas garante o usuário carregado antes das views montarem, evitando telas sem carga ou sem inscrição após reload direto. |
| Indicador de conexão | Indicador visual verde/amarelo/vermelho do status da conexão com o Supabase, atualizado a cada 30s. |
| Tratamento de erros | Tradução dos erros do Supabase Auth (inclusive limite de tentativas, com contagem regressiva) para mensagens em português. |
| Páginas de erro | Páginas dedicadas para 403, 404 e 500, além de tela própria para conta desativada. |
| Auditoria | Tabela `auditoria` no banco para rastreabilidade das operações administrativas. |
| Modal de confirmação | Confirmação genérica para ações destrutivas (ativar/inativar usuário, salvar chamada, limpar notificações). |

### Módulo Professor

| Funcionalidade | Descrição |
|----------------|-----------|
| Frequência por exceção | Todos os alunos considerados presentes por padrão; o professor marca apenas quem faltou. Seleção por período e busca por nome. Atualização em tempo real. |
| Ausência em período | Registro de aluno presente na escola que faltou a um período específico, com seleção de período e observação opcional. |
| Ocorrências graves | Registro de comportamento que ameace a permanência do aluno, classificado como grave ou suspensão, com descrição, tags de comportamento e opção de exigir presença do responsável. |
| Módulos de acesso | Home exibe apenas os cartões habilitados em `perfis.acesso_modulos`; rotas sem o módulo redirecionam para a home com aviso e a escrita no banco é negada por RLS. |

### Módulo Gestão

| Funcionalidade | Descrição |
|----------------|-----------|
| Painel de monitoramento | Página central com cartões de navegação para todos os módulos administrativos. |
| Ranking de risco | Lista priorizada de alunos do caso mais crítico ao mais leve, com filtros por nível (crítico, atenção, estável), busca por nome e atualização em tempo real. Botão "Chat" em cada aluno abre conversa com o responsável. |
| Central de ocorrências | Lista de ocorrências graves e suspensões com indicadores de tipo, status e bloqueio. Alternância de bloqueio/desbloqueio de retorno em tempo real. Registro de novas ocorrências pela própria gestão (aluno, tipo, tags, descrição, exigência de presença e notificações). |
| Registro de infrequências | Chamada por exceção para qualquer turma e registro individual de ausências por período, com motivo e observação. Confirmação em modal antes de salvar. Acessível pelo cartão próprio e pelo botão "Falta" no ranking, que pré-seleciona o aluno. |
| Validação de justificativas | Fila de pendentes com anexos em modal (imagem ou PDF via blob), intervalo de datas e opção de aceitar ou recusar. Ao aceitar, as frequências do período são auto-justificadas via trigger no banco. Atualização em tempo real. |
| CRUD de usuários | Cadastro, edição, ativação e inativação com confirmação em modal nas mudanças de status. Geração automática de código de redefinição ao criar usuário, criação sincronizada em `auth.users` e perfil, módulos de acesso editáveis para todos os papéis. |
| CRUD de alunos | Cadastro e edição com dados pseudonimizados. Criação simultânea de vínculo com responsável existente ou novo. Transferência de enturmação mantendo uma matrícula ativa por ano. |
| CRUD de turmas | Cadastro, edição, ativação e inativação com série e letra do catálogo. |
| Anos letivos | CRUD com período e status (planejado, ativo, arquivado). A "virada de ano" arquiva atomicamente o ano vigente e ativa o novo via RPC `ativar_ano_letivo`, com trilha de auditoria. |
| CRUD de disciplinas | Cadastro e edição com código SIGE para integração com a SEDUC. |
| Atribuições | Vínculo professor-turma-disciplina com titular/substituto e período de vigência. |
| Gestão de códigos | Fila de solicitações, lista de códigos com status, revogação e expiração automática após 1 hora. Limpeza de códigos não ativos com auditoria. |
| Notificações | Badge não lidas em tempo real. Notificações de mensagem são limpas automaticamente ao ler a conversa (trigger no banco + limpeza imediata no cliente). Responsáveis recebem aviso quando a gestão registra ocorrência com notificação habilitada. |
| Catálogos genéricos | CRUD completo para módulos, documentos, períodos, motivos de ausência, tipos de ocorrência, vínculos, papéis de atribuição, séries e letras de turma sobre a tabela `opcoes_configuracao`. Chave interna gerada pelo nome, validações por tipo, bloqueio de duplicatas e exclusão de opções referenciadas. Reordenação por arrastar com modo protegido e seletor visual de ícones. |
| Tags de comportamento | Catálogo com nome, categoria, ícone, descrição e peso de pontuação. Exclusão e renomeação de tags referenciadas em ocorrências são bloqueadas. |
| Parâmetros do sistema | Limites crítico e preventivo de faltas, dias de expurgo de anexos e nome da escola. |
| Horários letivos | Janelas de atendimento do chat por dia da semana e horário, com todas desativadas o canal permanece fechado. |

### Módulo Responsável

| Funcionalidade | Descrição |
|----------------|-----------|
| Alertas | Ausências (escola e aula) e ocorrências (grave e suspensão) com distinção visual e badge de urgência. Botão para enviar justificativa direto do alerta. Modal de detalhes com status da justificativa, motivo, anexo via blob e tags de comportamento. Indicadores "Aguardando validação", "Aceita" ou "Recusada". |
| Termômetro de atenção | Barra de progresso colorida (verde/amarelo/vermelho) com o nível de risco acumulado, calculado de ausências e ocorrências. Suporte a múltiplos filhos com seletor. |
| Justificativas | Envio com suporte a múltiplos dias. Anexo por seleção ou arrastar e soltar, com validação de tipo e tamanho, compressão automática via Canvas API (máximo 1600px, JPEG 0.6) e otimização serverless via Edge Function em segundo plano. Formulário permanece na tela após o envio. |
| Aviso de presença obrigatória | Badge urgente quando uma ocorrência exige a presença física do responsável na escola para liberar o retorno do aluno. |
| Chat com horário protegido | Conversa com a equipe da gestão escolar, com indicador online/offline baseado nos horários letivos cadastrados. Auto-scroll para novas mensagens e leitura de mensagens limpa as notificações correspondentes. |
| Acessibilidade e simplicidade | Telas limpas com Bootstrap 5, linguagem clara sem jargão, indicadores visuais de leitura imediata e instruções passo a passo. Compressão automática de imagens no cliente suporta fotos de qualquer dispositivo. |

## Em Desenvolvimento

- Gamificação entre turmas (estrutura de dados e views prontas, frontend não conectado).
- Notificações push.

## Tecnologias

### Frontend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Vue 3 | ^3.5.32 | Framework reativo com Composition API e `<script setup lang="ts">` |
| TypeScript | ~6.0.0 | Tipagem estática e verificação em tempo de compilação |
| Vite | ^8.0.8 | Build tool e dev server com hot-module replacement |
| Vue Router | ^5.0.4 | Roteamento SPA com guardas de navegação RBAC |
| Bootstrap | ^5.3.8 | Framework CSS responsivo com grid e componentes |
| Bootstrap Icons | ^1.13.1 | Biblioteca de ícones |
| Geist Sans / Geist Mono | ^5.x | Fontes tipográficas via @fontsource |
| jwt-decode | ^4.0.0 | Decodificação do JWT no cliente, sem requisição extra ao servidor |
| sortablejs | ^1.15.7 | Arrastar e soltar com suporte a toque, usado na reordenação de catálogos |
| @popperjs/core | ^2.11.8 | Dependência do Bootstrap JS para tooltips e popovers |
| vite-plugin-pwa | ^1.3.0 | Suporte a Progressive Web App com service worker |

### Backend e Infraestrutura

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Supabase | - | Backend-as-a-Service: banco PostgreSQL, autenticação, realtime e storage |
| PostgreSQL | 17 | Banco relacional com extensões pgcrypto e pg_trgm |
| Supabase Auth | - | Autenticação por email/senha com Custom Access Token Hook |
| Supabase Realtime | - | Subscrições PostgreSQL via logical replication |
| Supabase Edge Functions | - | Funções serverless em Deno para operações administrativas |
| Deno | - | Runtime das Edge Functions |

### Qualidade e DevOps

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Playwright | ^1.61.1 | Testes E2E multiplataforma (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari) |
| oxlint | ~1.60.0 | Linter de alta performance escrito em Rust |
| ESLint | ^10.2.1 | Linter com configuração flat para Vue + TypeScript |
| Prettier | 3.8.3 | Formatador de código |
| GitHub Actions | - | Integração contínua: CodeQL, deploy de funções, reset de banco |
| Dependabot | - | Atualização automática de dependências do devcontainer |
| Vercel | - | Deploy contínuo com rewrites de SPA |
| GitHub Codespaces / Dev Containers | - | Ambiente de desenvolvimento em nuvem e containerizado |

## Arquitetura

### Estrutura de Diretórios

```
buscapp/
├── src/
│   ├── App.vue                          # Componente raiz
│   ├── main.ts                          # Ponto de entrada (fontes, Bootstrap, ícones, CSS customizado)
│   ├── assets/
│   │   └── cores.css                    # Variáveis CSS (primária verde #008241, fontes Geist)
│   ├── componentes/                     # Componentes reutilizáveis
│   │   ├── CabecalhoNavegacao.vue       # Cabeçalho de navegação com 6 variantes
│   │   ├── CampoFormulario.vue          # Campo de formulário com label, erro e dica
│   │   ├── CartaoAlertaResponsavel.vue  # Cartão de alerta para o responsável
│   │   ├── CartaoAlunoFrequencia.vue    # Cartão de aluno para registro de frequência
│   │   ├── CartaoAlunoRisco.vue         # Cartão de aluno no ranking de risco (com botão de chat)
│   │   ├── CartaoNavegacao.vue          # Cartão de navegação para módulos
│   │   ├── CartaoSelecao.vue            # Cartão selecionável (altura uniforme, hover legível)
│   │   ├── ChatContatos.vue             # Sidebar de contatos do chat
│   │   ├── ChatHorarioProtegido.vue     # Componente de chat com controle de horário
│   │   ├── ChatPainelDuplo.vue          # Layout de chat com sidebar e painel de mensagens
│   │   ├── FilaJustificativas.vue       # Fila de justificativas para validação com exibição de anexos
│   │   ├── FormularioJustificativa.vue  # Formulário de justificativa com múltiplos dias e anexo por seleção ou arraste
│   │   ├── GrupoCheckbox.vue            # Grupo de checkboxes reutilizável
│   │   ├── IndicadorConexao.vue         # Indicador de status da conexão (verde/amarelo/vermelho)
│   │   ├── ListaOcorrencias.vue         # Lista de ocorrências graves
│   │   ├── ModalConfirmacao.vue         # Modal genérico de confirmação
│   │   ├── NotificacoesPopover.vue      # Popover de notificações (sino)
│   │   ├── SeletorIcone.vue             # Seletor visual de ícones Bootstrap com busca e categorias
│   │   ├── TermometroRisco.vue          # Termômetro visual de risco
│   │   └── VisualizadorAnexo.vue        # Modal de anexos (imagem/PDF) via blob, sem tokens na URL
│   ├── composables/                     # Lógica de apresentação reutilizável
│   │   ├── useAlturaUniformeCards.ts    # Mede e uniformiza a altura de cartões de seleção (CSS var)
│   │   ├── useAnoLetivo.ts              # Busca padronizada do ano letivo ativo (status + flag)
│   │   ├── useAutenticacao.ts           # Login, logout, sessão e redefinição de senha por código
│   │   ├── useGestaoUsuarios.ts         # CRUD de usuários, alunos, turmas, disciplinas, atribuições, códigos
│   │   ├── useMonitoramento.ts          # Frequência, comportamento, ocorrências, ranking, risco, termômetro, chat. Limites e horários lidos do banco com cache em memória
│   │   ├── useNotificacoes.ts           # Leitura, marcação de lidas e limpeza de notificações
│   │   ├── useOpcoesConfiguracao.ts     # Busca em cache de opções configuráveis por tipo
│   │   ├── useRealtimeRefresh.ts        # Canal de conexão Realtime e auto-refresh
│   │   ├── useStatusConexao.ts          # Health check periódico no Supabase Auth
│   │   └── useStatusConta.ts            # Estado da conta do usuário autenticado
│   ├── layouts/
│   │   └── LayoutPrincipal.vue          # Layout padrão após autenticação (navbar, dropdown, sino, footer)
│   ├── paginas/
│   │   ├── auth/                        # Páginas de autenticação
│   │   │   ├── LoginView.vue
│   │   │   ├── RedefinirSenhaCodigoView.vue
│   │   │   └── SolicitarCodigoView.vue
│   │   ├── professor/                   # Páginas do professor
│   │   │   ├── HomeView.vue
│   │   │   ├── FrequenciaView.vue
│   │   │   ├── AusenciaView.vue
│   │   │   └── OcorrenciaView.vue
│   │   ├── gestao/                      # Páginas da gestão
│   │   │   ├── GestaoHomeView.vue
│   │   │   ├── GestaoRankingView.vue
│   │   │   ├── GestaoOcorrenciasView.vue                # Central com lista em tempo real e registro de ocorrências
│   │   │   ├── GestaoInfrequenciasView.vue              # Chamada por turma e registro individual de faltas
│   │   │   ├── GestaoJustificativasView.vue
│   │   │   ├── UsuariosView.vue
│   │   │   ├── UsuarioFormView.vue
│   │   │   ├── AlunosView.vue
│   │   │   ├── AlunoFormView.vue
│   │   │   ├── CodigosView.vue
│   │   │   ├── TurmasView.vue
│   │   │   ├── AnosLetivosView.vue                      # Gestão de anos letivos e virada de ano
│   │   │   ├── DisciplinasView.vue
│   │   │   ├── AtribuicoesView.vue
│   │   │   ├── GestaoChatView.vue                       # Chat da gestão com responsáveis
│   │   │   ├── GestaoConfiguracaoView.vue               # Hub central com cartões de navegação
│   │   │   ├── GestaoConfiguracaoOpcoesView.vue         # CRUD genérico com arrastar e soltar
│   │   │   ├── GestaoConfiguracaoTagsView.vue           # Gerenciamento de tags de comportamento
│   │   │   ├── GestaoConfiguracaoSistemaView.vue        # Parâmetros globais do sistema
│   │   │   └── GestaoConfiguracaoHorariosView.vue       # Janelas de atendimento do chat
│   │   ├── responsavel/                 # Páginas do responsável
│   │   │   ├── HomeView.vue
│   │   │   ├── AlertasView.vue
│   │   │   ├── TermometroView.vue
│   │   │   ├── JustificativaView.vue
│   │   │   └── ChatView.vue
│   │   └── error/                       # Páginas de erro e estado de conta
│   │       ├── ErrorView.vue
│   │       ├── Status403View.vue
│   │       ├── Status404View.vue
│   │       ├── Status500View.vue
│   │       └── StatusContaDesativadaView.vue
│   ├── rotas/
│   │   └── index.ts                     # Vue Router com guardas RBAC e módulos de acesso
│   ├── servicos/
│   │   ├── supabase.ts                  # Cliente Supabase, decodificação JWT, extração de claims
│   │   └── armazenamentoAdaptavel.ts    # Storage adaptativo (localStorage/sessionStorage)
│   ├── tipos/
│   │   ├── database.ts                  # Tipos do schema do banco de dados
│   │   ├── componentes.ts               # Tipos de props dos componentes
│   │   ├── bootstrap.d.ts               # Declarações de tipos do Bootstrap JS
│   │   └── index.ts                     # Reexportações
│   └── utils/
│       ├── chatUtils.ts                 # Utilitários do chat (cor do avatar, horário protegido)
│       ├── comprimirImagem.ts           # Compressão de imagens via Canvas API (1600px, JPEG q0.6)
│       ├── opcoesConfiguracao.ts        # Regras por tipo de opção de configuração (label, placeholder, validação)
│       └── traduzirErro.ts              # Tradução de erros do Supabase Auth para português
├── supabase/
│   ├── config.toml                      # Configuração local do Supabase (portas, auth, storage, edge)
│   ├── seed.sql                         # Dados de teste de desenvolvimento (7 usuários, 3 turmas, 9 alunos, frequências e ocorrências de exemplo)
│   ├── migrations/
│   │   └── 0001_schema_completo.sql     # Migration única: schema completo + dados canônicos (squash das migrations antigas)
│   ├── functions/                       # Edge Functions (Deno)
│   │   ├── solicitar-codigo/            # Notifica a gestão sobre solicitação de código
│   │   ├── redefinir-senha-codigo/      # Valida o código e atualiza a senha
│   │   ├── criar-usuario/               # Cria usuário com senha temporária e código automático
│   │   ├── processar-anexo/             # Otimiza anexos de justificativas (ImageMagick WASM + pdf-lib)
│   │   ├── limpar-anexos/               # Expurga anexos expirados e objetos de storage órfãos
│   │   └── limpar-codigos/              # Remove códigos de redefinição fora da janela de retenção
│   ├── templates/                       # Templates de email
│   │   └── senha_alterada_notificacao.html
│   └── tests/
│       ├── 0001_validacao_completa.sql  # Testes PL/pgSQL transacionais do schema completo
│       └── 0002_anos_letivos.sql        # Testes da virada de ano letivo (RPC, RLS por papel, auditoria)
├── scripts/
│   ├── gerar-icones.sh                  # Gera ícones PWA a partir da imagem fonte
│   ├── seed-users.sh                    # Cria usuários de teste via Auth Admin API
│   ├── test-api.sh                      # Testes de API com bash/curl
│   └── test-db.sh                       # Executa testes SQL no container Docker do Supabase
├── tests/
│   ├── app.spec.ts                      # Testes E2E Playwright (fluxos completos)
│   ├── modulos-infrequencias.spec.ts    # Testes E2E de módulos, infrequências e termômetro
│   └── pwa.spec.ts                      # Testes do build PWA (config dedicada, roda contra preview)
├── .github/workflows/
│   ├── codeql.yml                       # Análise de segurança CodeQL
│   ├── deploy-functions.yml             # Deploy das Edge Functions para o projeto vinculado
│   ├── reset-database.yml               # Reset manual do banco de produção (destrutivo)
│   └── dependabot.yml                   # Atualizações automáticas do devcontainer
├── .devcontainer/                       # Configuração do ambiente de desenvolvimento
├── .env.example                         # Template de variáveis de ambiente
├── vite.config.ts                       # Configuração do Vite (plugin Vue, alias @, plugin PWA)
├── playwright.config.ts                 # Configuração do Playwright (5 projetos)
├── playwright.pwa.config.ts             # Configuração dedicada aos testes de PWA
├── vercel.json                          # Rewrites SPA para deploy no Vercel
├── tsconfig.json                        # Referências para tsconfig.app.json e tsconfig.node.json
├── eslint.config.ts                     # Configuração flat do ESLint com Vue + TypeScript + oxlint
├── .oxlintrc.json                       # Regras do oxlint (correctness, plugins)
└── .prettierrc.json                     # Configuração do Prettier (semi, singleQuote, printWidth 100)
```

### Fluxo de Dados

```
Navegador (SPA Vue 3 + TypeScript + Vite)
       |
       | Vue Router (createWebHistory)
       | Guardas RBAC via JWT claims (nome, papel)
       |
       +--> Componentes Vue 3 (Composition API, <script setup>)
       |       |
       |       +--> Composables (useAutenticacao, useMonitoramento, useGestaoUsuarios, ...)
       |       |
       |       +--> @supabase/supabase-js
       |               |
       |               +--> Supabase Auth
       |               |       +--> POST /auth/v1/token?grant_type=password (login)
       |               |       +--> Custom Access Token Hook (injeta nome + papel no JWT)
       |               |       +--> Admin API (criação/atualização de usuários)
       |               |
       |               +--> Supabase Data API (PostgREST)
       |               |       +--> REST /rest/v1/* (CRUD com RLS)
       |               |       +--> RPC /rest/v1/rpc/* (funções customizadas)
       |               |
       |               +--> Supabase Realtime
       |               |       +--> postgres_changes (notificações, telas operacionais)
       |               |
       |               +--> Supabase Edge Functions
       |                       +--> /functions/v1/solicitar-codigo
       |                       +--> /functions/v1/redefinir-senha-codigo
       |                       +--> /functions/v1/criar-usuario
       |                       +--> /functions/v1/processar-anexo
       |                       +--> /functions/v1/limpar-anexos
       |                       +--> /functions/v1/limpar-codigos
       |
       v
PostgreSQL 17 (gerenciado pelo Supabase)
       +--> auth schema (GoTrue: usuários, sessões)
       +--> public schema (30 tabelas, 5 views, 14 enums, 40+ índices)
       +--> RLS: políticas por linha para cada papel
       +--> Extensões: pgcrypto, pg_trgm
       +--> Realtime: publicação de tabelas via logical replication
```

### Funcionamento do JWT com Custom Claims

1. O usuário faz login via Supabase Auth.
2. O Supabase Auth dispara o Custom Access Token Hook (função PL/pgSQL `custom_access_token_hook`).
3. O hook consulta a view `v_perfil_com_credenciais` para obter nome e papel do usuário.
4. O hook injeta `{"nome": "...", "papel": "..."}` no JWT como claims customizados.
5. O frontend decodifica o JWT utilizando `jwt-decode`, sem requisição extra ao servidor.
6. O Vue Router utiliza as claims para aplicar as guardas RBAC.
7. Toda requisição ao banco inclui o JWT no header `Authorization` e as políticas RLS utilizam `auth.jwt()` para determinar o acesso.

## Banco de Dados

O banco é gerenciado pelo Supabase (PostgreSQL 17) com 30 tabelas, 5 views analíticas, 14 enums e mais de 40 índices. Todas as tabelas possuem Row-Level Security habilitado, com políticas específicas para cada papel (professor, gestão, responsável).

### Principais Tabelas

**Entidades**

| Tabela | Descrição |
|--------|-----------|
| `perfis` | Perfis de usuário (1:1 com `auth.users`). Status: ativo, pendente, inativo. Papéis: professor, gestão, responsável. |
| `alunos` | Alunos com dados pseudonimizados (sem CPF ou endereço). |
| `turmas` | Turmas escolares. Série + letra do catálogo. |
| `anos_letivos` | Anos letivos. Status: planejado, ativo, arquivado. |
| `enturmacoes` | Vínculo aluno-turma temporal (único por aluno por ano). |
| `disciplinas` | Disciplinas com código SIGE para integração com a SEDUC. |

**Relacionamentos**

| Tabela | Descrição |
|--------|-----------|
| `vinculos_responsaveis` | Relação responsável-aluno N:N com tipo de vínculo do catálogo. |
| `atribuicoes_professores` | Atribuição professor-turma-disciplina temporal. Suporte a titular e substituto. |

**Operacionais**

| Tabela | Descrição |
|--------|-----------|
| `frequencias` | Registro unificado de frequência (portão, chamada, saída). Soft delete via `deleted_at`. Idempotência via `client_request_id`. |
| `registros_comportamento` | Registros de comportamento com vínculo N:N a tags. |
| `ocorrencias` | Ocorrências graves e suspensões. Workflow de status, opção `exige_presenca_responsavel` e flags de notificação. |
| `justificativas_faltas` | Justificativas de falta. Status: pendente, aceita, recusada. Suporte a múltiplos dias via `data_fim`. Auto-justify de frequências via trigger `fn_auto_justificar_frequencias`. |
| `monitoramento_acoes` | Log de ações de monitoramento. |
| `notificacoes` | Fila de notificações in-app por destinatário. |

**Chat**

| Tabela | Descrição |
|--------|-----------|
| `conversas` | Conversas (única por par responsável-aluno). |
| `mensagens` | Mensagens com proteção contra excesso de envio fora do horário letivo e chave de idempotência. |

**Apoio**

| Tabela | Descrição |
|--------|-----------|
| `tags_comportamento` | Catálogo de tags de comportamento com peso para gamificação. |
| `pontuacao_turmas` | Pontuação mensal de turmas. Coluna gerada para o total. |
| `anexos` | Metadados de anexos (limite de 10 MB, expiração de 30 dias, coluna `processado_em` para rastrear a otimização serverless). Expurgo via Edge Function `limpar-anexos`. |
| `ocorrencia_anexos` | Join N:N ocorrência-anexo. |
| `justificativa_anexos` | Join N:N justificativa-anexo. |
| `codigos_redefinicao` | Códigos de 6 dígitos para redefinição de senha (expiração em 1 hora, revogáveis). |
| `codigos_redefinicao_tentativas` | Proteção contra força bruta: tentativas erradas por email e bloqueio temporário. Escrita apenas via funções `SECURITY DEFINER`; leitura pela gestão. |
| `horarios_letivos` | Janelas de atendimento do chat por dia da semana e horário. |

**Administrativas e Auditoria**

| Tabela | Descrição |
|--------|-----------|
| `importacoes_log` | Auditoria de importação de planilhas SIGE. |
| `exportacoes` | Registro de exportação do diário de classe. |
| `auditoria` | Trilha de auditoria geral. |
| `convites` | Registro de convites de usuário. |

**Configuração**

| Tabela | Descrição |
|--------|-----------|
| `configuracoes_sistema` | Parâmetros globais (limites de ausência crítica e preventiva, dias de expurgo, nome da escola). |
| `opcoes_configuracao` | Catálogo genérico de opções configuráveis pela gestão (módulos, documentos, períodos, motivos de ausência, tipos de ocorrência, vínculos, papéis de atribuição, séries e letras de turma). Chaves validadas por restrições `CHECK` nas tabelas que as referenciam. |

### Views Analíticas

Todas as views utilizam `security_invoker = true` para respeitar as políticas RLS do usuário que as consulta.

| View | Descrição |
|------|-----------|
| `v_ranking_monitoramento` | Ranking de priorização de risco com dados de contato dos responsáveis. |
| `v_termometro_aluno` | Termômetro de atenção por aluno com classificação por cor. |
| `v_feed_aluno` | Linha do tempo unificada do aluno (frequência, comportamento, ocorrências). |
| `v_gamificacao_ranking` | Ranking de gamificação entre turmas. |
| `v_pontuacao_diaria_turmas` | Pontuação diária das turmas para gamificação. |

### Segurança

- RLS habilitado em todas as tabelas, com políticas específicas por papel.
- Funções auxiliares para políticas: `get_user_papel()`, `get_user_acesso_modulos()`, `is_professor_da_turma()`, `is_responsavel_do_aluno()`.
- Módulos de acesso (`perfis.acesso_modulos`) com semântica fail-closed: as políticas de professor em `frequencias` e `ocorrencias` e as telas do responsável (alertas, termômetro, justificativa e chat) exigem o módulo correspondente; lista vazia significa nenhum acesso. Aplicação simultânea em RLS, guardas de rota e cartões da home.
- Trigger `requisicao_exige_jwt()` no gancho `request.jwt.claim` do PostgREST para rejeitar requisições sem JWT válido.
- Trigger de criação automática de perfil ao inserir usuário em `auth.users`.
- Trigger `fn_auto_justificar_frequencias` que marca as frequências como `'justificado'` quando uma justificativa é aceita.
- RLS em `storage.objects` para o bucket `justificativas`: gestão tem acesso total, responsável insere e lê apenas seus próprios anexos.
- **Visualização de anexos sem tokens na URL**: o frontend baixa o arquivo com `storage.download()`, autenticando com o JWT da sessão no header `Authorization`, e renderiza via `URL.createObjectURL()` (blob). Não são usados signed URLs, portanto nenhum token aparece na barra de endereço ou nas requisições de rede.
- Soft delete em `frequencias` para preservação de dados históricos.
- Índices parciais para dados ativos (otimização de consultas frequentes).
- **Integridade referencial do catálogo**: restrições `CHECK` validam toda escrita de chaves de `opcoes_configuracao` e nomes de `tags_comportamento` nas tabelas que as referenciam (turmas, vínculos, atribuições, frequências, perfis, alunos, ocorrências), impedindo referências órfãs. As funções de validação são `SECURITY DEFINER` para funcionar com qualquer role.
- **Exclusão protegida na interface**: opções de catálogo e tags ainda referenciadas não podem ser excluídas (ou renomeadas, no caso de tags); a interface orienta a desativação.
- **Exclusão de turmas com `ON DELETE RESTRICT`** em conversas e atribuições, evitando apagamento silencioso do histórico de chat.
- **Chave `service_role` restrita ao servidor**: usada somente pelas Edge Functions e pela suíte de testes, nunca exposta ao navegador.
- Relatório de órfãos `fn_relatorio_orfas()` para auditoria de referências pendentes.

## Edge Functions

Seis funções serverless em Deno, usadas para operações que exigem a chave `service_role` ou processamento pesado de mídia.

| Função | Rota | Método | Autenticação | Descrição |
|--------|------|--------|--------------|-----------|
| `solicitar-codigo` | `/functions/v1/solicitar-codigo` | POST | Usuário autenticado | Registra a solicitação de código de redefinição e notifica a gestão, suprimindo duplicatas pendentes. |
| `redefinir-senha-codigo` | `/functions/v1/redefinir-senha-codigo` | POST | Código como autenticação | Valida o código de 6 dígitos (existência, expiração, revogação), atualiza a senha em `auth.users` e ativa o perfil se estiver pendente. |
| `criar-usuario` | `/functions/v1/criar-usuario` | POST | Papel gestão | Cria o usuário em `auth.users` com senha temporária, insere o perfil e gera o código de redefinição automaticamente. |
| `processar-anexo` | `/functions/v1/processar-anexo` | POST | Usuário autenticado | Otimiza anexos de justificativas: converte imagens para JPEG (qualidade 50, máximo 2000px, via magick-wasm) e compacta metadados de PDFs (via pdf-lib). Atualiza `tamanho_bytes`, `mime_type` e `processado_em`. Chamada assíncrona a partir do frontend. |
| `limpar-anexos` | `/functions/v1/limpar-anexos` | POST | `cron-secret` (opcional) | Job de manutenção: remove anexos expirados e não processados (`expurgo_em` vencido) com seus objetos do bucket `justificativas`, além de objetos de storage órfãos. Pode ser agendado via cron no Dashboard do Supabase. |
| `limpar-codigos` | `/functions/v1/limpar-codigos` | POST | `cron-secret` (opcional) | Job de manutenção: remove códigos de redefinição fora da janela de retenção configurada (`dias_retencao_codigos`). |

### Exemplo de Payload

**redefinir-senha-codigo**
```json
{
  "email": "resp1@email.com",
  "codigo": "482913",
  "nova_senha": "NovaSenha123!"
}
```

**criar-usuario**
```json
{
  "email": "novo@email.com",
  "senha_temporaria": "Temp123!",
  "nome": "Novo Usuario",
  "papel": "professor"
}
```

## Tempo Real

Toda a atualização automática da aplicação usa canais `postgres_changes` do Supabase Realtime sobre a publicação `supabase_realtime`, com entrega filtrada pelas políticas RLS de quem assina.

**Tabelas publicadas:** `notificacoes`, `codigos_redefinicao`, `alunos`, `perfis`, `ocorrencias`, `justificativas_faltas`, `frequencias`, `conversas`, `mensagens` e `enturmacoes`.

As tabelas operacionais `frequencias`, `ocorrencias` e `justificativas_faltas` utilizam `REPLICA IDENTITY FULL`, garantindo que eventos UPDATE e DELETE carreguem todas as colunas (necessário para filtros por coluna e para a checagem de RLS em exclusões).

**Canais por tela:**

| Tela | Tabelas assinadas |
|------|-------------------|
| Global (badges do sino) | `notificacoes` filtrada por destinatário |
| Responsável: Alertas | `frequencias`, `ocorrencias`, `justificativas_faltas` |
| Responsável: Termômetro | `frequencias`, `ocorrencias` |
| Responsável e Gestão: Chat | `mensagens` (conversa ativa) e `mensagens`/`conversas` (lista de contatos) |
| Professor: Frequência e Ausência | `frequencias`, `enturmacoes` |
| Gestão: Ranking | `frequencias`, `ocorrencias` |
| Gestão: Infrequências | `frequencias` |
| Gestão: Justificativas | `justificativas_faltas` |
| Gestão: Ocorrências | `ocorrencias` |
| Gestão: Usuários | `perfis` |
| Gestão: Alunos | `alunos`, `enturmacoes` |
| Gestão: Códigos | `notificacoes`, `codigos_redefinicao` |

**Triggers de domínio ligados ao tempo real:**

- `fn_notificar_nova_mensagem`: notifica o destinatário (responsável ou gestão) a cada nova mensagem.
- `fn_notificar_mensagem_lida`: limpa as notificações de mensagem da conversa quando ela é lida pelo grupo destinatário.
- `fn_notificar_ocorrencia`: avisa os responsáveis vinculados quando uma ocorrência é registrada com notificação habilitada.

**Comportamentos complementares:**

- O composável `useRealtimeRefresh` gerencia inscrição, reconexão com backoff e recarga ao retornar à aba.
- O guard de rotas garante o usuário carregado antes das views montarem, de modo que carga inicial e inscrição aconteçam sempre.
- No horário protegido do chat, se todas as janelas de `horarios_letivos` estiverem desativadas, o canal é considerado permanentemente fechado; o fallback para a janela padrão ocorre apenas quando nenhuma janela está cadastrada.

## Configuração

Variáveis definidas em `.env` (local) ou no painel do provedor de deploy (produção). Consulte `.env.example`.

| Variável | Onde é usada | Descrição |
|----------|--------------|-----------|
| `VITE_SUPABASE_URL` | Frontend | URL do projeto Supabase. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Chave publishable (pública) do Supabase. |
| `VITE_EDGE_FUNCTIONS_URL` | Frontend | URL base das Edge Functions (opcional; padrão `{VITE_SUPABASE_URL}/functions/v1`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor e testes | Chave administrativa. Nunca exposta ao navegador. |
| `SEED_SENHA_ADMIN` | Testes | Senha do usuário de gestão do seed. |
| `SEED_SENHA_PROF` | Testes | Senha dos usuários professores do seed. |
| `SEED_SENHA_RESP` | Testes | Senha dos usuários responsáveis do seed. |

## Como Executar

### Pré-requisitos

- Node.js 22.12+ (ou 20.19+)
- Docker em execução (para o Supabase local)
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

4. Inicie o Supabase local:

```bash
npx supabase start
```

5. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

Os valores de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` podem ser obtidos com:

```bash
npx supabase status
```

6. Aplique a migration única e popule o banco com dados de teste:

```bash
npx supabase db reset
```

7. Crie os usuários de teste no Supabase Auth:

```bash
bash scripts/seed-users.sh
```

8. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

9. Acesse a aplicação em `http://localhost:5173`.

### Credenciais de Teste

| Papel | Email | Senha |
|-------|-------|-------|
| Gestão | gestao@escola.edu.br | Admin123! |
| Professor | prof1@escola.edu.br | Prof123! |
| Responsável | resp1@email.com | Resp123! |

Usuários adicionais: prof2/prof3@escola.edu.br (Prof123!) e resp2/resp3@email.com (Resp123!).

### Parando o Ambiente Local

```bash
npx supabase stop
```

### Solução de Problemas do Ambiente Local

- **Versão do CLI:** use Supabase CLI **>= 2.115** (`npx supabase --version`). Versões antigas falham ao subir a stack local em imagens recentes do Docker (healthchecks de storage/realtime).
- **Analytics desabilitado:** o `supabase/config.toml` mantém `[analytics] enabled = false`. O Logflare não aquece dentro da janela de healthcheck em devcontainers e nenhum módulo do BuscApp depende do Studio Analytics. Para reabilitar, ajuste a chave e execute `npx supabase stop && npx supabase start`.
- **Reset com dados canônicos:** o `db reset` já popula catálogos, horários, tags, disciplinas, parâmetros e o ano letivo ativo pela migration única; o seed adiciona apenas pessoas e atividade de exemplo.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento Vite com HMR |
| `npm run build` | Verificação de tipos e build de produção |
| `npm run preview` | Preview do build de produção |
| `npm run type-check` | `vue-tsc --build` para verificação de tipos |
| `npm run lint` | oxlint e ESLint com auto-fix |
| `npm run format` | Prettier em todos os arquivos de `src/` |
| `npm run test:typecheck` | Verificação de tipos TypeScript |
| `npm run test:lint` | Verificação de lint |
| `npm run test:build` | Build de produção como teste |
| `npm run test:db` | Testes de banco de dados (requer Supabase local) |
| `npm run test:api` | Testes de API (requer Supabase local; reseta o banco antes) |
| `npm run test:e2e` | Testes E2E Playwright (requer Supabase local + seed; sobe o dev server automaticamente) |
| `npm run test:pwa` | Testes de PWA contra o build de produção (build + preview + Playwright) |
| `npm run test` | Typecheck + lint + build + testes de API |

Para acelerar a suíte E2E em máquinas locais, execute com workers adicionais:

```bash
npx playwright test --workers=6
```

## Testes

O projeto possui quatro camadas de teste independentes.

### Tipos (TypeScript)

- **Ferramenta:** vue-tsc.
- **Cobertura:** verificação estática de tipos em todo o código TypeScript e nos componentes Vue.
- **Execução:** `npm run test:typecheck`.

### Banco de Dados (PL/pgSQL)

- **Arquivos:** `supabase/tests/*.sql`. Cada arquivo roda em transação própria com `ROLLBACK` final (não altera o banco); `scripts/test-db.sh` executa todos em sequência e falha se houver qualquer `[FAIL]`.
- **`0001_validacao_completa.sql`:** validação completa do schema:
  - Constraints (chaves estrangeiras, unicidade, check)
  - Triggers (criação automática de perfil, nome completo da turma)
  - RLS para todos os papéis (gestão, professor, responsável, usuário não autenticado)
  - Soft delete em frequências
  - Views analíticas
  - Geração, expiração, revogação e validação de códigos de redefinição
  - Casos extremos (limites, dados maliciosos)
  - Estrutura, RLS e UNIQUE da tabela `opcoes_configuracao` e restrições `CHECK` de catálogo
  - Colunas de catálogo como texto validado (séries/letras fora do catálogo são rejeitadas)
  - Integridade de catálogo (referências órfãs, `auth.users` ↔ `perfis` 1:1, enturmação ativa por aluno, anexos sem vínculo)
- **`0002_anos_letivos.sql`:** virada de ano letivo:
  - Ano corrente ativo garantido pela migration, com flags consistentes
  - RPC `ativar_ano_letivo`: gestão ativa, professor é bloqueado, ano vigente arquivado atomicamente
  - Rejeição de reativação do ano corrente e de ano inexistente
  - Trilha de auditoria (`ARQUIVAR_ANO_LETIVO` / `ATIVAR_ANO_LETIVO`) e virada de retorno
- **Execução:** `npm run test:db` (usa `psql` no container Docker do Supabase).

### API (Bash + curl)

- **Arquivo:** `scripts/test-api.sh`, com 323 verificações distribuídas em cerca de 29 seções. Reseta o banco antes de executar.
- **Cobertura:**
  - Autenticação (login, logout, claims do JWT)
  - Edge Functions (todas as seis, incluindo jobs de manutenção)
  - Funções RPC (gerar código, revogar código, relatório de órfãos)
  - Operações CRUD completas
  - Casos extremos (tabelas inexistentes, permissão negada, payloads inválidos)
  - Idempotência de frequência
  - Ciclo de vida completo dos códigos de redefinição
  - Campos de ocorrências, frequências, perfis e alunos
  - Ciclo completo de justificativas com anexos (upload, RLS, auto-justify via trigger)
  - Compressão de anexos via Edge Function (upload, processamento, verificação de metadados)
  - Chat: conversas, envio de mensagens, RLS, triggers de notificação e leitura, integridade (unicode, SQL injection, textos longos), concorrência
  - Catálogo de configuração: CRUD de `opcoes_configuracao`, RLS por papel e restrições (valores fora do catálogo rejeitados)
  - CASCADE → RESTRICT: exclusão de turma com conversas/atribuições bloqueada no banco
  - Expurgo: remoção de anexos expirados e objetos de storage órfãos
  - Visualizador de anexo: download autenticado via Storage API com o JWT no header `Authorization`, integridade do conteúdo e negação sem autenticação
- **Execução:** `npm run test:api` (requer Supabase local).

### E2E (Playwright)

- **Arquivos:** `tests/app.spec.ts` e `tests/modulos-infrequencias.spec.ts`, totalizando 146 testes coletados por projeto.
- **Projetos:** Chromium, Firefox, WebKit, Mobile Chrome (Pixel 5) e Mobile Safari (iPhone 12).
- **Cobertura:**
  - Login, logout e credenciais inválidas
  - Gestão: home, usuários com confirmação de ativação/desativação, módulos de acesso para todos os papéis, infrequências (chamada por turma e registro individual), alunos, códigos, turmas, anos letivos (virada e reversão), atribuições, ranking com botões de chat e falta
  - Professor: frequência, ausência e ocorrências
  - Responsável: chat, home com cartões por módulo, alertas, justificativas (incluindo anexo por arrastar e soltar)
  - Tempo real: alertas, notificações, ocorrências, ranking e lista de frequência atualizam sem reload
  - Visualizador de anexo (modal blob, sem token na URL)
  - Notificações (popover, marcar lidas, limpar todas)
  - Chat completo (sidebar, mensagens, busca, header, horário protegido)
  - Configurações do sistema (catálogos, tags, parâmetros, horários)
  - Integridade de catálogo e transferência de enturmação
  - Resiliência e casos extremos
- **Execução:** `npm run test:e2e` (o dev server é iniciado automaticamente; requer Supabase local + seed).
- **Configuração:** `playwright.config.ts` com worker único por padrão e timeout de expect de 10 segundos; em máquinas locais recomenda-se elevar os workers via CLI (`npx playwright test --workers=6`) para reduzir o tempo total.

## PWA

A aplicação é instalável como Progressive Web App.

- **Plugin:** `vite-plugin-pwa` registrado no `vite.config.ts`, com service worker e manifest gerados apenas no build de produção.
- **Ícones:** gerados a partir de imagem fonte pelo script `scripts/gerar-icones.sh`.
- **Testes dedicados:** `tests/pwa.spec.ts` executa contra o build de produção via `vite preview`, com Supabase simulado por variáveis de ambiente de teste.
- **Execução:** `npm run test:pwa` (configuração em `playwright.pwa.config.ts`, projetos Desktop Chrome e Mobile Chrome).

## CI/CD e Deploy

### Integração Contínua (GitHub Actions)

- **Workflow:** `.github/workflows/codeql.yml`
- **Análise:** CodeQL Advanced para javascript-typescript
- **Gatilhos:** push e pull request para `main`, além de agendamento semanal
- **Resultados:** GitHub Security > Code scanning alerts

### Deploy das Edge Functions

- **Workflow:** `.github/workflows/deploy-functions.yml`
- **Gatilhos:** push para `main` e execução manual
- **Ação:** `supabase functions deploy` para o projeto Supabase vinculado (requer os secrets `SUPABASE_ACCESS_TOKEN` e `PROJECT_ID`)

### Dependências (Dependabot)

- **Configuração:** `.github/dependabot.yml`
- **Escopo:** atualizações semanais para o ecossistema `devcontainers`

### Reset Database (workflow manual)

- **Workflow:** `.github/workflows/reset-database.yml`
- **Gatilho:** `workflow_dispatch` (execução manual na aba Actions)
- **O que faz:** executa `supabase db reset --linked --no-seed --yes`, que apaga e recria o banco de produção aplicando a migration única (`0001_schema_completo.sql`), que já inclui todos os dados canônicos (catálogos, horários, tags, disciplinas, parâmetros e ano letivo ativo). O seed de desenvolvimento não é aplicado.

> [!CAUTION]
> Operação destrutiva: remove todos os dados, usuários e storage do ambiente. Use apenas quando a reconstrução completa for intencional.

- **Após o reset:** recriar a conta de gestão no Dashboard (Authentication > Add users), definindo o *Raw User Meta Data* com `{"nome": "...", "papel": "gestao"}`; o trigger `fn_handle_new_user` cria o perfil correspondente. Os demais usuários podem se cadastrar normalmente pela tela de login.

### Deploy (Vercel)

- **Configuração:** `vercel.json` com rewrites que direcionam todas as rotas para `index.html` (modo SPA)
- **Branch de produção:** `main`
- **Previews:** deploys de preview automáticos para cada pull request
- **Build:** `npm run build` (type-check + build Vite)

## Licença

Este projeto é desenvolvido sob licença MIT para fomentar a tecnologia educacional pública. Consulte o arquivo [LICENSE](./LICENSE) para mais detalhes.
