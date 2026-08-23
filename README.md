# BuscApp

Plataforma de comunicação em tempo real entre escola e família para o Ensino Médio de Tempo Integral.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ECF8E)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF)](https://vitejs.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-1.61-45BA4B)](https://playwright.dev/)

## Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Status do Projeto](#status-do-projeto)
- [Stack Tecnológico](#stack-tecnológico)
- [Funcionalidades Implementadas](#funcionalidades-implementadas)
- [Funcionalidades Previstas](#funcionalidades-previstas)
- [Arquitetura](#arquitetura)
- [Banco de Dados](#banco-de-dados)
- [Edge Functions](#edge-functions)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Como Executar o Projeto](#como-executar-o-projeto)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Testes](#testes)
- [CI/CD e Deploy](#cicd-e-deploy)
- [Licença](#licença)

## Sobre o Projeto

O BuscApp é uma plataforma de comunicação digital entre escola e família projetada para escolas de Ensino Médio de Tempo Integral. O sistema substitui o modelo de comunicação baseado em avisos impressos e reuniões presenciais por notificações em tempo real sobre frequência e comportamento dos estudantes, permitindo que a escola realize intervenções pedagógicas antes que o vínculo do estudante com a escola se rompa.

O modelo tradicional de comunicação escola-família ainda depende de bilhetes em papel e reuniões de pais que ocorrem a cada dois ou três meses. Quando a família descobre que o estudante está faltando ou enfrentando dificuldades, semanas ou meses já se passaram. No Ensino Médio de Tempo Integral, onde a carga horária é estendida, cada falta tem impacto maior no aproveitamento e no vínculo com a instituição. Intervenções pedagógicas acontecem tarde demais, quando o estudante já está em processo de desengajamento.

O BuscApp trata esse problema com três perfis de acesso. O professor registra frequência por exceção, assumindo que todos estão presentes e marcando apenas os ausentes. Também registra ausências em aulas específicas quando o aluno estava na escola mas faltou a um período, e ocorrências que ameacem a permanência do estudante. A gestão escolar opera um painel de monitoramento com ranking de risco, central de ocorrências, validação de justificativas e gestão de cadastros. O responsável recebe alertas de ausência, consulta um indicador visual de atenção e se comunica diretamente com a coordenação.

A interface do módulo do responsável foi desenvolvida para usuários com pouca familiaridade com tecnologia. Utiliza vocabulário não técnico, mensagens curtas e indicadores visuais de leitura instantânea. O termômetro de atenção traduz dados de frequência e ocorrências em três cores. O upload de documentos aceita apenas formatos universais capturáveis por qualquer celular.

Três diferenciais conceituais orientam o design do sistema. A frequência por exceção inverte a lógica tradicional de chamada: em vez de percorrer todos os alunos, o professor marca apenas os ausentes, reduzindo o tempo de registro em turmas com alta frequência. O código de redefinição de senha elimina a dependência de email, permitindo que responsáveis sem endereço eletrônico recuperem o acesso. O chat com horário protegido desativa automaticamente o envio de mensagens fora do período letivo para resguardar o descanso dos educadores, com instruções de contato alternativo exibidas ao usuário.

Cada perfil de acesso enxerga apenas os dados que lhe competem. Toda alteração em informações de estudantes é registrada com os dados anteriores e o momento da modificação, acessível somente à gestão. Nenhum registro é apagado fisicamente, garantindo rastreabilidade histórica. Os estudantes são identificados por nome e matrícula, sem armazenamento de dados sensíveis como documentos ou endereço.

O sistema foi desenvolvido para operar em conexões instáveis. Mensagens de erro são apresentadas em português com instruções claras, incluindo contagem regressiva em caso de limite de tentativas. Um indicador visual mostra o status da conexão com o servidor, e a recuperação após quedas de rede é automática. O usuário pode optar por manter a sessão ativa entre visitas. Mecanismos internos evitam o registro duplicado de informações em caso de instabilidade.

O banco de dados possui estrutura robusta com tabelas, visões analíticas e índices para consultas eficientes. Funções serverless executam operações administrativas. O projeto conta com testes automatizados em múltiplas camadas, integração contínua e deploy automatizado.

Funcionalidades em andamento incluem gamificação entre turmas e notificações push.

## Status do Projeto

Projeto em desenvolvimento ativo. A infraestrutura central está concluída e os módulos principais possuem funcionalidades implementadas e testadas.

### Concluído

- Autenticação com Supabase Auth (email/senha) e JWT com custom claims (nome, papel) via Custom Access Token Hook
- RBAC com três papéis (professor, gestão, responsável) e guardas de rota no Vue Router
- Storage adaptativo: localStorage para "lembrar-me", sessionStorage para sessões temporárias
- Banco de dados PostgreSQL com 31 tabelas, 5 views analíticas, 14 enums, 40+ índices
- Row-Level Security (RLS) em todas as tabelas com políticas por papel
- Triggers: criação automática de perfil ao criar usuário em auth.users
- Extensões pgcrypto e pg_trgm
- 5 Edge Functions em Deno (solicitar-codigo, redefinir-senha-codigo, criar-usuario, processar-anexo, limpar-anexos)
- Registro de frequência por exceção
- Registro de ausência em período específico
- Registro de ocorrências graves com bloqueio de retorno
- CRUD de usuários, alunos, turmas, disciplinas e atribuições
- Sistema de código de redefinição de senha (geração, solicitação, validação, revogação, expiração em 1h)
- Justificativas com validação (aceitar/recusar), anexo (upload com compressão e otimização serverless, visualização em modal via blob sem tokens na URL), suporte a múltiplos dias (data_fim) e auto-justify de frequências via trigger
- Ranking de priorização de risco com filtros e busca em tempo real
- Termômetro visual de atenção (verde/amarelo/vermelho)
- Alertas para responsáveis (ausência e ocorrências) com status de justificativa, visualização de anexos em modal (via blob) e modal de detalhes
- Chat integrado com três papéis (gestão e responsável) e layout responsivo de dois painéis
- Sistema de notificações em tempo real: sino com tipos separados (mensagens vs administrativas)
- Chat com auto-resize de textarea, indicador de leitura (✓✓), merge incremental em tempo real
- Notificações: marcar como lidas ao clicar, "Limpar todas" com confirmação, distinção visual lidas/não lidas
- Exclusão suave de conversas com ocultação e reaparecimento automático via trigger
- Presença em tempo real via Supabase Realtime (canais seletivos por necessidade)
- Botão manual "Atualizar" com timestamp em páginas administrativas sem realtime
- Modal de confirmação para ações destrutivas
- Indicador de status de conexão com Supabase
- Tratamento e tradução de erros do Supabase Auth para português
- Páginas de erro personalizadas (403, 404, 500) com redirecionamento automático
- Páginas responsivas com Bootstrap 5
- Sistema de configuração 100% data-driven com catálogo genérico `opcoes_configuracao`: módulos, documentos, períodos, motivos de ausência, tipos de ocorrência, vínculos, papéis de atribuição, séries e letras de turma, todos configuráveis via interface de administração
- Tags de comportamento gerenciáveis via interface dedicada (anteriormente hardcoded no código-fonte)
- Parâmetros globais do sistema (limite crítico de faltas, limite preventivo, dias de expurgo de anexos, nome da escola) configuráveis via interface
- Horários letivos (janelas de atendimento do chat) gerenciáveis via CRUD
- Testes em 4 camadas: TypeScript, Banco de Dados (PL/pgSQL), API (bash/curl), E2E (Playwright)
- CI/CD: CodeQL (GitHub Actions) + Vercel

### Em Andamento

- Gamificação entre turmas (estrutura de dados e views prontas, frontend não conectado)
- Notificações push

## Stack Tecnológico

### Frontend

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Vue 3 | ^3.5.32 | Framework reativo progressivo com Composition API e `<script setup lang="ts">` |
| TypeScript | ~6.0 | Tipagem estática e verificação em tempo de compilação |
| Vite | ^8.0 | Build tool e dev server com hot-module replacement |
| Vue Router | ^5.0.4 | Roteamento SPA com guardas de navegação RBAC |
| Bootstrap | 5.3.8 | Framework CSS responsivo com sistema de grid e componentes |
| Bootstrap Icons | 1.13.1 | Biblioteca de ícones |
| Geist Sans / Geist Mono | 5.x | Fontes tipográficas via @fontsource |
| jwt-decode | ^4.0.0 | Decodificação de JWT no cliente (evita requisição extra ao servidor) |
| sortablejs | ^3.0.0 | Arrastar e soltar responsivo com suporte a toque, usado na reordenação de catálogos |
| @popperjs/core | ^2.11.8 | Dependência do Bootstrap JS para tooltips e popovers |

### Backend e Infraestrutura

| Tecnologia | Propósito |
|------------|-----------|
| Supabase | Backend-as-a-Service: banco de dados PostgreSQL, autenticação, realtime, storage |
| PostgreSQL 17 | Banco de dados relacional com extensões pgcrypto e pg_trgm |
| Supabase Auth | Autenticação por email/senha com Custom Access Token Hook |
| Supabase Realtime | Subscrições PostgreSQL via logical replication para notificações em tempo real |
| Supabase Edge Functions | Funções serverless em Deno para operações administrativas |
| Deno | Runtime para Edge Functions |

### Qualidade e DevOps

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| oxlint | ~1.60.0 | Liner rústico de alta performance |
| ESLint | ^10.2.1 | Linter com configuração flat para Vue + TypeScript |
| Prettier | 3.8.3 | Formatador de código |
| Playwright | ^1.61.1 | Testes E2E multiplataforma (Chromium, Firefox, WebKit, mobile) |
| PL/pgSQL |  | Testes de banco de dados transacionais |
| GitHub Actions |  | CI com CodeQL security analysis |
| Dependabot |  | Atualização automática de dependências do devcontainer |
| Vercel |  | Deploy contínuo com SPA rewrites |
| GitHub Codespaces |  | Ambiente de desenvolvimento em nuvem |
| Dev Containers |  | Ambiente de desenvolvimento containerizado |

## Funcionalidades Implementadas

### Gerenciamento de Acesso

| Funcionalidade | Descrição |
|----------------|-----------|
| Autenticação | Login e logout com email e senha via Supabase Auth |
| Sessão persistente | Opção "lembrar-me" que alterna entre localStorage (permanente) e sessionStorage (temporária) |
| Recuperação de senha | Fluxo unificado com o primeiro acesso: código de 6 dígitos para redefinir a senha sem depender de email (gerado por admin, solicitado pelo usuário) |
| JWT com custom claims | Token JWT contém nome e papel do usuário, injetado via Custom Access Token Hook do Supabase |
| RBAC | Guardas de rota no Vue Router que redirecionam usuários não autenticados e bloqueiam acesso a rotas não autorizadas |
| Redirecionamento pós-login | Redirecionamento automático para a página inicial do perfil após login bem-sucedido |
| Força de senha | Validação de requisitos mínimos de senha no frontend |
| Visibilidade de senha | Checkbox "Mostrar senha(s)" nas telas de login e redefinição de senha (substitui o ícone de olho) |

### Infraestrutura

| Funcionalidade | Descrição |
|----------------|-----------|
| Indicador de conexão | Indicador visual verde/amarelo/vermelho do status da conexão com Supabase, atualizado a cada 30s |
| Atualização em tempo real | Composável useRealtimeRefresh que gerencia canais do Supabase Realtime para notificações |
| Tratamento de erros | Tradução de erros do Supabase Auth (inclusive rate-limit) para mensagens em português |
| Páginas de erro | Páginas para 403, 404 e 500 com contagem regressiva para redirecionamento à página inicial |
| Auditoria | Tabela `auditoria` no banco para conformidade com requisitos de rastreabilidade |

### Módulo Professor

| Funcionalidade | Descrição |
|----------------|-----------|
| Frequência por exceção | Todos os alunos são considerados presentes por padrão. O professor marca apenas quem faltou. Suporte à seleção por período e busca por nome. |
| Ausência em período | Registro de aluno que esteve presente na escola mas ausentou-se de um período específico de aula. Inclui seleção de período e campo opcional de observação. |
| Ocorrências graves | Registro de comportamento extremo que ameace a permanência do aluno na escola. Opção de classificar como grave ou suspensão, com campo de descrição e opção de exigir presença do responsável. |

### Módulo Gestão

| Funcionalidade | Descrição |
|----------------|-----------|
| Painel de monitoramento | Página central com cartões de navegação para todos os módulos administrativos |
| Ranking de risco | Lista priorizada de alunos organizados do caso mais crítico ao mais leve. Filtros por nível de risco (crítico, atenção, estável). Busca em tempo real por nome. Atualização por subscription Realtime. Botão "Chat" em cada aluno que abre uma conversa com o responsável (sem envio automático de mensagens). |
| Central de ocorrências | Lista de todas as ocorrências graves e suspensões com indicadores visuais de tipo, status e bloqueio. Alternância de bloqueio/desbloqueio de retorno em tempo real. |
| Validação de justificativas | Fila de justificativas pendentes com exibição de anexos em modal (imagem ou PDF carregados via blob), intervalo de datas e opção de aceitar ou recusar. Ao aceitar, as frequências no período são auto-justificadas via trigger no banco. Atualização em tempo real. |
| CRUD de usuários | Cadastro, edição, ativação e inativação de usuários. Geração automática de código de redefinição de senha ao criar usuário. Criação sincronizada no auth.users e perfil. |
| CRUD de alunos | Cadastro e edição de alunos com dados pseudonimizados. Criação simultânea de vínculo com responsável existente ou novo. |
| CRUD de turmas | Cadastro, edição, ativação e inativação de turmas com série e letra. |
| Anos letivos | CRUD de anos letivos com período (datas de início/fim) e status (planejado, ativo, arquivado). A "virada de ano" é feita pelo botão Ativar: arquiva atomicamente o ano vigente e ativa o novo via RPC `ativar_ano_letivo`, com trilha de auditoria. Novos anos são criados como planejados. |
| CRUD de disciplinas | Cadastro e edição de disciplinas com código SIGE para integração com SEDUC. |
| Atribuições | Vínculo professor-turma-disciplina com suporte a professor titular e substituto e período de vigência. |
| Gestão de códigos | Tela com fila de solicitações de código, lista de códigos ativos com status, opção de revogação e expiração automática após 1 hora. |
| Notificações em tempo real | Badge de notificações não lidas atualizado via Supabase Realtime. |
| Catálogos genéricos | CRUD completo para módulos, documentos, períodos, motivos de ausência, tipos de ocorrência, vínculos, papéis de atribuição, séries e letras de turma via interface unificada sobre a tabela `opcoes_configuracao`. A chave interna é gerada automaticamente a partir do nome. Validação de entrada específica por tipo (séries numéricas com sufixo `ª`, letras únicas maiúsculas), bloqueio de duplicatas e exclusão de opções ainda referenciadas. Reordenação por arrastar com modo protegido (salvar ou cancelar, sem escrita automática no banco). Seletor visual de ícones com busca e categorias. |
| Tags de comportamento | Interface dedicada para gerenciar o catálogo de tags comportamentais com nome, categoria, ícone, descrição e peso de pontuação. Exclusão e renomeação de tags referenciadas em ocorrências são bloqueadas. |
| Parâmetros do sistema | Edição dos limites crítico e preventivo de faltas, dias de expurgo de anexos e nome da escola. |
| Horários letivos | CRUD de janelas de atendimento do chat com suporte a dias da semana e horários customizáveis. |

### Módulo Responsável

| Funcionalidade | Descrição |
|----------------|-----------|
| Alertas | Lista de alertas de ausência (portão e aula) e ocorrências (grave e suspensão), com distinção visual por tipo e badge de urgência. Botão para enviar justificativa diretamente do alerta. Modal de detalhes com status da justificativa, motivo, anexo (aberto em modal via blob) e tags de comportamento. Indicador "Aguardando validação", "Aceita" ou "Recusada" conforme o andamento. |
| Termômetro de atenção | Indicador visual com barra de progresso colorida (verde/amarelo/vermelho) que mostra o nível de risco acumulado do estudante. Cálculo baseado em ausências e ocorrências. Suporte a múltiplos filhos com seletor. |
| Justificativas | Envio de justificativa de falta com suporte a múltiplos dias (checkbox "Justificativa para múltiplos dias"). Upload de anexo com compressão automática via Canvas API (redimensionamento para 1600px, qualidade JPEG 0.6) e otimização serverless via Edge Function. Envio fire-and-forget sem bloqueio da interface. Formulário permanece na tela após envio. |
| Aviso de presença obrigatória | Badge urgente em alertas quando uma ocorrência exige a presença física do responsável na escola para liberar o retorno do estudante. |
| Chat com horário protegido | Interface de chat com a coordenação escolar. Indicador de horário comercial (online/offline) baseado nos horários letivos cadastrados na tabela `horarios_letivos`. Auto-scroll para novas mensagens. |
| Acessibilidade e simplicidade | Telas limpas com Bootstrap 5, mensagens em português claro sem jargão técnico, indicadores visuais de leitura instantânea (termômetro, badges), botões objetivos e instruções passo a passo. Compressão automática de imagens no cliente suporta qualquer câmera de celular. |

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
│   │   ├── FormularioJustificativa.vue  # Formulário de envio de justificativa com suporte a múltiplos dias
│   │   ├── GrupoCheckbox.vue            # Grupo de checkboxes reutilizável
│   │   ├── IndicadorConexao.vue         # Indicador de status da conexão (verde/amarelo/vermelho)
│   │   ├── ListaOcorrencias.vue         # Lista de ocorrências graves
│   │   ├── NotificacoesPopover.vue      # Popover de notificações (sino)
│   │   ├── SeletorIcone.vue            # Seletor visual de ícones Bootstrap com busca e categorias
│   │   ├── TermometroRisco.vue          # Termômetro visual de risco
│   │   └── VisualizadorAnexo.vue        # Modal de anexos (imagem/PDF) via blob, sem tokens na URL
│   ├── composables/                     # Lógica de apresentação reutilizável
│   │   ├── useAlturaUniformeCards.ts    # Mede e uniformiza a altura de cartões de seleção (CSS var)
│   │   ├── useAnoLetivo.ts              # Busca padronizada do ano letivo ativo (status + flag)
│   │   ├── useAutenticacao.ts           # Login, logout, sessão e redefinição de senha por código
│   │   ├── useGestaoUsuarios.ts         # CRUD de usuários, alunos, turmas, disciplinas, atribuições, códigos
│   │   ├── useMonitoramento.ts          # Frequência, comportamento, ocorrências, ranking, risco, termômetro, chat. Limites e horários lidos do banco com cache em memória.
│   │   ├── useNotificacoes.ts           # Leitura, marcação de lidas e limpeza de notificações
│   │   ├── useOpcoesConfiguracao.ts     # Busca em cache de opções configuráveis por tipo
│   │   ├── useRealtimeRefresh.ts        # Canal de conexão Realtime e auto-refresh
│   │   └── useStatusConexao.ts          # Health check periódico no Supabase Auth
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
│   │   │   ├── GestaoOcorrenciasView.vue
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
│   │   │   ├── GestaoChatView.vue                      # Chat da gestão com pais/responsáveis
│   │   │   ├── GestaoConfiguracaoView.vue              # Hub central com cartões de navegação
│   │   │   ├── GestaoConfiguracaoOpcoesView.vue        # CRUD genérico com arrastar e soltar
│   │   │   ├── GestaoConfiguracaoTagsView.vue          # Gerenciamento de tags de comportamento
│   │   │   ├── GestaoConfiguracaoSistemaView.vue        # Parâmetros globais do sistema
│   │   │   └── GestaoConfiguracaoHorariosView.vue       # Janelas de atendimento do chat
│   │   ├── responsavel/                 # Páginas do responsável
│   │   │   ├── HomeView.vue
│   │   │   ├── AlertasView.vue
│   │   │   ├── TermometroView.vue
│   │   │   ├── JustificativaView.vue
│   │   │   └── ChatView.vue
│   │   └── error/                       # Páginas de erro
│   │       ├── ErrorView.vue
│   │       ├── Status403View.vue
│   │       ├── Status404View.vue
│   │       └── Status500View.vue
│   ├── rotas/
│   │   └── index.ts                    # Configuração do Vue Router com guardas RBAC
│   ├── servicos/
│   │   ├── supabase.ts                 # Cliente Supabase, decodificação JWT, extração de claims
│   │   └── armazenamentoAdaptavel.ts   # Storage adaptativo (localStorage/sessionStorage)
│   ├── tipos/
│   │   ├── database.ts                 # Tipos do schema do banco de dados
│   │   ├── componentes.ts              # Tipos de props dos componentes
│   │   ├── bootstrap.d.ts              # Declarações de tipos do Bootstrap JS
│   │   └── index.ts                    # Re-exportações
│   └── utils/
│       ├── chatUtils.ts                # Utilitários do chat (cor do avatar, horário protegido)
│       ├── comprimirImagem.ts          # Compressão de imagens via Canvas API (1600px, JPEG q0.6)
│       ├── opcoesConfiguracao.ts       # Regras por tipo de opção de configuração (label, placeholder, validação)
│       └── traduzirErro.ts             # Tradução de erros do Supabase Auth para português
├── supabase/
│   ├── config.toml                     # Configuração local do Supabase (portas, auth, storage, edge)
│   ├── seed.sql                        # Dados de teste de desenvolvimento (7 usuários, 3 turmas, 9 alunos, frequências e ocorrências de exemplo)
│   ├── migrations/
│   │   └── 0001_schema_completo.sql    # Migration única: schema completo + dados canônicos out-of-the-box (squash das antigas migrations 0001 a 0005)
│   ├── functions/                      # Edge Functions (Deno)
│   │   ├── solicitar-codigo/           # Notifica admins sobre solicitação de código
│   │   ├── redefinir-senha-codigo/     # Valida código e atualiza senha
│   │   ├── criar-usuario/             # Cria usuário com senha temporária e código automático
│   │   ├── processar-anexo/           # Otimiza anexos de justificativas (Imagemagick WASM + pdf-lib)
│   │   └── limpar-anexos/             # Expurga anexos expirados e objetos de storage órfãos
│   ├── templates/                      # Templates de email
│   │   └── senha_alterada_notificacao.html
│   └── tests/
│       ├── 0001_validacao_completa.sql # Testes PL/pgSQL transacionais do schema completo
│       └── 0002_anos_letivos.sql       # Testes da virada de ano letivo (RPC, RLS por papel, auditoria)
├── scripts/
│   ├── seed-users.sh                   # Cria usuários de teste via Auth Admin API
│   ├── test-api.sh                     # Testes de API com bash/curl (297 asserts)
│   └── test-db.sh                      # Executa testes SQL no container Docker do Supabase
├── tests/
│   └── app.spec.ts                     # Testes E2E Playwright (128 casos, 5 browsers)
├── .github/
│   ├── workflows/codeql.yml            # CodeQL security analysis
│   └── dependabot.yml                  # Atualizações semanais do devcontainer
├── .devcontainer/                      # Configuração do ambiente de desenvolvimento
├── .env.example                        # Template de variáveis de ambiente
├── vite.config.ts                      # Configuração do Vite (plugin Vue, alias @)
├── playwright.config.ts                # Configuração do Playwright (5 projetos)
├── vercel.json                         # Rewrites SPA para deploy no Vercel
├── tsconfig.json                       # Referências para tsconfig.app.json e tsconfig.node.json
├── eslint.config.ts                    # Configuração flat do ESLint com Vue + TypeScript + oxlint
├── .oxlintrc.json                      # Regras do oxlint (correctness, plugins)
└── .prettierrc.json                    # Configuração do Prettier (semi, singleQuote, printWidth 100)
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
       |               |       +--> postgres_changes (notificações, ranking)
       |               |
        |               +--> Supabase Edge Functions
        |                       +--> /functions/v1/solicitar-codigo
        |                       +--> /functions/v1/redefinir-senha-codigo
        |                       +--> /functions/v1/criar-usuario
        |                       +--> /functions/v1/processar-anexo
        |                       +--> /functions/v1/limpar-anexos
        |
        v
PostgreSQL 17 (gerenciado pelo Supabase)
       +--> auth schema (GoTrue: usuários, sessões)
       +--> public schema (31 tabelas, 5 views, 14 enums, 40+ índices)
       +--> RLS: políticas por linha para cada papel
       +--> Extensões: pgcrypto, pg_trgm
       +--> Realtime: publicação de tabelas via logical replication
```

### Funcionamento do JWT com Custom Claims

1. O usuário faz login via Supabase Auth.
2. O Supabase Auth dispara o Custom Access Token Hook (função PL/pgSQL `custom_access_token_hook`).
3. O hook consulta a view `v_perfil_com_credenciais` para obter nome e papel do usuário.
4. O hook injeta `{"nome": "...", "papel": "..."}` no JWT como claims customizados.
5. O frontend decodifica o JWT utilizando `jwt-decode` (sem requisição extra ao servidor).
6. O Vue Router utiliza as claims para aplicar as guardas RBAC.
7. Todas as requisições ao banco incluem o JWT no header `Authorization`, e as políticas RLS utilizam `auth.jwt()` para determinar o acesso.

## Banco de Dados

O banco de dados é gerenciado pelo Supabase (PostgreSQL 17) com 31 tabelas, 5 views, 14 enums e mais de 40 índices. Todas as tabelas possuem RLS (Row-Level Security) habilitado, com políticas específicas para cada papel (professor, gestão, responsável).

### Principais Tabelas

**Entidades**

| Tabela | Descrição |
|--------|-----------|
| `perfis` | Perfis de usuário (1:1 com `auth.users`). Status: ativo, pendente, inativo. Papéis: professor, gestão, responsável. |
| `alunos` | Estudantes. Dados pseudonimizados (sem CPF ou endereço). |
| `turmas` | Turmas escolar. Série + letra. |
| `anos_letivos` | Anos letivos. Status: planejado, ativo, arquivado. |
| `enturmacoes` | Vínculo aluno-turma temporal (único por aluno por ano). |
| `disciplinas` | Disciplinas com código SIGE para integração com SEDUC. |

**Relacionamentos**

| Tabela | Descrição |
|--------|-----------|
| `vinculos_responsaveis` | Relação responsável-aluno N:N com tipo de vínculo (mãe, pai, outro). |
| `atribuicoes_professores` | Atribuição professor-turma-disciplina temporal. Suporte a titular e substituto. |

**Operacionais**

| Tabela | Descrição |
|--------|-----------|
| `frequencias` | Registro unificado de frequência (portão, chamada, saída). Soft delete via `deleted_at`. Idempotência via `client_request_id`. |
| `registros_comportamento` | Registros de comportamento com vínculo N:N a tags. |
| `ocorrencias` | Ocorrências graves e suspensões. Workflow de status e opção `exige_presenca_responsavel`. |
| `justificativas_faltas` | Justificativas de falta. Status: pendente, aceita, recusada. Suporte a múltiplos dias via `data_fim`. Auto-justify de frequências via trigger `fn_auto_justificar_frequencias`. |
| `monitoramento_acoes` | Log de ações de monitoramento. |
| `notificacoes` | Fila de notificações. |

**Chat**

| Tabela | Descrição |
|--------|-----------|
| `conversas` | Conversas (única por par responsável-aluno). |
| `mensagens` | Mensagens com trigger anti-burnout e chave de idempotência. |

**Apoio**

| Tabela | Descrição |
|--------|-----------|
| `tags_comportamento` | Catálogo de tags de comportamento com peso para gamificação. |
| `pontuacao_turmas` | Pontuação mensal de turmas. Coluna gerada para total. |
| `anexos` | Metadados de anexos (limite de 10MB, expiração de 30 dias, coluna `processado_em` para rastrear otimização serverless). Expurgo de anexos expirados e objetos órfãos via Edge Function `limpar-anexos`. |
| `ocorrencia_anexos` | Join N:N ocorrência-anexo. |
| `justificativa_anexos` | Join N:N justificativa-anexo. |
| `codigos_redefinicao` | Códigos de 6 dígitos para redefinição de senha (expiração 1h, revogável). |
| `codigos_redefinicao_tentativas` | Anti força bruta: tentativas erradas por e-mail e bloqueio temporário. Escrita apenas via funções `SECURITY DEFINER`; leitura pela gestão. |
| `horarios_letivos` | Horários de aula (para chat anti-burnout). |

**Administrativas e Auditoria**

| Tabela | Descrição |
|--------|-----------|
| `importacoes_log` | Auditoria de importação de planilhas SIGE. |
| `exportacoes` | Registro de exportação de diário de classe. |
| `auditoria` | Trilha de auditoria. |
| `convites` | Registro de convites de usuário. |

**Configuração**

| Tabela | Descrição |
|--------|-----------|
| `configuracoes_sistema` | Parâmetros do sistema (limites de ausência crítica, dias de expiração). |
| `opcoes_configuracao` | Catálogo genérico de opções configuráveis pela gestão (módulos, documentos, períodos, motivos de ausência, tipos de ocorrência, vínculos, papéis de atribuição, séries e letras de turma). Chaves validadas por restrições `CHECK` nas tabelas que as referenciam. |

### Views Analíticas

Todas as views utilizam `security_invoker = true` para respeitar as políticas RLS do usuário que as consulta.

| View | Descrição |
|------|-----------|
| `v_ranking_monitoramento` | Ranking de priorização de risco com dados de contato dos responsáveis. |
| `v_termometro_aluno` | Termômetro de atenção por aluno com classificação por cor. |
| `v_feed_aluno` | Linha do tempo unificada do estudante (frequência, comportamento, ocorrências). |
| `v_gamificacao_ranking` | Ranking de gamificação entre turmas. |
| `v_pontuacao_diaria_turmas` | Pontuação diária das turmas para gamificação. |

### Segurança

- RLS habilitado em todas as tabelas.
- Funções auxiliares para políticas: `get_user_papel()`, `is_professor_da_turma()`, `is_responsavel_do_aluno()`.
- Trigger `requisicao_exige_jwt()` no gancho `request.jwt.claim` do PostgREST para rejeitar requisições sem JWT válido.
- Trigger de criação automática de perfil ao inserir usuário em `auth.users`.
- Trigger `fn_auto_justificar_frequencias` que atualiza o status das frequências para `'justificado'` quando uma justificativa é aceita.
- RLS em `storage.objects` para o bucket `justificativas`: gestão tem acesso total, responsável insere e lê apenas seus próprios anexos.
- Políticas `"JustAnexos: responsavel le proprio"` e `"Anexos: responsavel le proprio"` que permitem ao responsável visualizar os anexos de suas próprias justificativas.
- **Visualização de anexos sem tokens na URL**: o frontend baixa o arquivo com `storage.download()` autenticando com o JWT da sessão no header `Authorization` e renderiza via `URL.createObjectURL()` (blob). Não são usados signed URLs, portanto nenhum token aparece na barra de endereço ou nas requisições de rede.
- Soft delete em `frequencias` para preservação de dados históricos.
- Índices parciais para dados ativos (otimização de consultas frequentes).
- **Integridade referencial do catálogo**: restrições `CHECK` validam toda escrita de chaves de `opcoes_configuracao` e nomes de `tags_comportamento` nas tabelas que as referenciam (turmas, vínculos, atribuições, frequências, perfis, alunos, ocorrências), impedindo a gravação de referências órfãs. As funções de validação são `SECURITY DEFINER` para funcionar com qualquer role.
- **Exclusão protegida na interface**: opções de catálogo e tags ainda referenciadas não podem ser excluídas (ou renomeadas, no caso de tags); a interface orienta a desativação.
- **Exclusão de turmas com `ON DELETE RESTRICT`** em conversas e atribuições, evitando apagamento silencioso de histórico de chat.
- **`service_role` com acesso administrativo total** (espelha o Supabase hospedado); a chave é usada somente no servidor (Edge Functions) e nos testes, nunca no frontend.
- Relatório de órfãos `fn_relatorio_orfas()` para auditoria de referências pendentes.

## Edge Functions

Cinco funções serverless implementadas em Deno, utilizadas para operações que exigem a chave `service_role` do Supabase ou processamento pesado de mídia. A chave `service_role` é usada apenas no servidor (Edge Functions) e na suíte de testes, nunca exposta ao navegador.

| Função | Rota | Método | Autenticação | Descrição |
|--------|------|--------|--------------|-----------|
| `solicitar-codigo` | `/functions/v1/solicitar-codigo` | POST | Usuário autenticado | Responsável solicita um código de redefinição de senha. A função notifica os admins registrando uma solicitação na tabela. |
| `redefinir-senha-codigo` | `/functions/v1/redefinir-senha-codigo` | POST | Nenhuma (código como autenticação) | Valida o código de 6 dígitos (existência, expiração, revogação), atualiza a senha no auth.users e ativa o perfil se estiver pendente. |
| `criar-usuario` | `/functions/v1/criar-usuario` | POST | Usuário autenticado (papel gestão) | Cria usuário no `auth.users` com senha temporária, insere perfil, gera código de redefinição automaticamente. |
| `processar-anexo` | `/functions/v1/processar-anexo` | POST | Usuário autenticado | Otimiza anexos de justificativas: converte imagens para JPEG com quality 50 e redimensiona para no máximo 2000px (via magick-wasm) e compacta metadados de PDFs (via pdf-lib). Atualiza `tamanho_bytes`, `mime_type` e `processado_em` na tabela `anexos`. Fire-and-forget a partir do frontend. |
| `limpar-anexos` | `/functions/v1/limpar-anexos` | POST | `cron-secret` (opcional) | Job de manutenção: remove anexos expirados e não processados (`expurgo_em` vencido) e seus objetos do bucket `justificativas`, e remove objetos de storage órfãos (sem linha correspondente em `anexos`). Pode ser agendado via cron no Dashboard do Supabase. |

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

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição | Valor Padrão |
|----------|-------------|-----------|--------------|
| `VITE_SUPABASE_URL` | Sim | URL do projeto Supabase | `http://127.0.0.1:54321` (desenvolvimento local) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sim | Chave anônima/publishable do Supabase |  |
| `VITE_EDGE_FUNCTIONS_URL` | Não | URL base das Edge Functions (utilizado quando o proxy do Supabase não está disponível) | `{VITE_SUPABASE_URL}/functions/v1` |

## Como Executar o Projeto

### Pré-requisitos

- Node.js >= 22.12.0 (ou 20.19.0+)
- Docker (para execução local do Supabase)
- npm (gerenciador de pacotes)

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

4. Inicie o Supabase local (requer Docker em execução):

```bash
npx supabase start
```

5. Copie o arquivo de ambiente e configure as variáveis:

```bash
cp .env.example .env
```

Os valores de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` podem ser obtidos com:

```bash
npx supabase status
```

6. Aplique as migrations e popule o banco com dados de teste:

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

### Parando o Ambiente Local

```bash
npx supabase stop
```

### Solução de Problemas do Ambiente Local

- **Versão do CLI:** use Supabase CLI **≥ 2.115** (`npx supabase --version`). Versões antigas falham ao subir a stack local em Docker recentes (healthchecks de storage/realtime).
- **Analytics desabilitado:** o `supabase/config.toml` mantém `[analytics] enabled = false`. O Logflare não aquece dentro da janela de healthcheck em devcontainers e nenhum módulo do BuscApp depende do Studio Analytics. Se precisar dele, reabilite a chave e execute `npx supabase stop && npx supabase start`.
- **Reset com dados canônicos:** o `db reset` já popula catálogos, horários, tags, disciplinas, parâmetros e o ano letivo ativo pela migration única; o seed adiciona apenas pessoas e atividade de exemplo.

## Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento Vite com HMR |
| `npm run build` | Executa type-check e build de produção |
| `npm run preview` | Inicia servidor para preview do build de produção |
| `npm run type-check` | Executa `vue-tsc --build` para verificação de tipos |
| `npm run lint` | Executa oxlint e ESLint com auto-fix |
| `npm run format` | Executa Prettier em todos os arquivos de `src/` |
| `npm run test:typecheck` | Verificação de tipos TypeScript |
| `npm run test:lint` | Verificação de lint |
| `npm run test:build` | Verificação de build |
| `npm run test:db` | Testes de banco de dados (requer Supabase local) |
| `npm run test:api` | Testes de API (requer Supabase local + seed) |
| `npm run test:e2e` | Testes E2E Playwright (requer Supabase local + seed + dev server) |
| `npm run test` | Executa todos os testes acima em série |

## Testes

O projeto possui quatro camadas de teste independentes.

### Testes de Tipo (TypeScript)

- **Ferramenta:** vue-tsc
- **Cobertura:** Verificação estática de tipos em todo o código TypeScript e Vue SFC.
- **Execução:** `npm run test:typecheck`

### Testes de Banco de Dados (PL/pgSQL)

- **Arquivos:** `supabase/tests/*.sql`, em que cada arquivo roda dentro de uma transação própria com `ROLLBACK` final (não altera o banco); `scripts/test-db.sh` executa todos em sequência e falha se houver qualquer `[FAIL]`.
- **`0001_validacao_completa.sql`:** validação completa do schema. Inclui:
  - Testes de constraints (chaves estrangeiras, unicidade, check)
  - Testes de triggers (criação automática de perfil, nome_completo da turma)
  - Testes de RLS para todos os papéis (gestão, professor, responsável, usuário não autenticado)
  - Testes de soft delete em frequências
  - Testes de todas as views analíticas
  - Testes de geração, expiração, revogação e validação de códigos de redefinição
  - Testes de casos extremos (limites, dados maliciosos)
  - Testes da tabela `opcoes_configuracao` (estrutura, RLS, UNIQUE) e das restrições `CHECK` de catálogo
  - Testes de que as colunas de catálogo são `text` validado (séries/letras fora do catálogo são rejeitadas)
  - Testes de integridade de catálogo (ausência de referências órfãs, `auth.users`↔`perfis` 1:1, enturmação ativa por aluno, anexos sem vínculo)
- **`0002_anos_letivos.sql`:** virada de ano letivo (RF13/RF25). Inclui:
  - Ano corrente ativo garantido pela migration, com flags `status`/`ativo` consistentes
  - RPC `ativar_ano_letivo`: gestão ativa, professor é bloqueado, ano vigente é arquivado atomicamente
  - Rejeição de reativação do ano corrente e de ano inexistente
  - Trilha de auditoria (`ARQUIVAR_ANO_LETIVO` / `ATIVAR_ANO_LETIVO`) e virada de retorno
- **Execução:** `npm run test:db` (requer `npx supabase start`; executa via `psql` no container Docker do Supabase)

### Testes de API (Bash + curl)

- **Arquivo:** `scripts/test-api.sh` (297 asserts em 29 seções)
- **Cobertura:** 297 asserts distribuídos em:
  - Autenticação (login, logout, claims do JWT)
  - Edge Functions (solicitar-codigo, redefinir-senha-codigo, criar-usuario, processar-anexo, limpar-anexos)
  - Funções RPC (gerar código, revogar código, relatório de órfãos)
  - Operações CRUD (criar, ler, atualizar, deletar registros)
  - Casos extremos (tabelas inexistentes, permissão negada, payloads inválidos)
  - Idempotência de frequência
  - Ciclo de vida completo de códigos
  - Novos campos de ocorrências, frequências, perfis e alunos
  - Ciclo completo de justificativas com anexos (upload, RLS, auto-justify via trigger)
  - Compressão de anexos via Edge Function (upload, processamento, verificação de metadados)
  - Chat: CRUD de conversas, envio de mensagens, RLS, trigger de notificação, integridade (unicode, SQL injection, 10k caracteres), concorrência
  - Catálogo de configuração: CRUD completo da tabela `opcoes_configuracao`, verificação de RLS por papel e validação das restrições de catálogo (valores fora do catálogo, como `serie="4ª"`, `tipo_relacao="primo"` e `papel="monitor"`, são rejeitados; valores válidos e arrays vazios são aceitos)
  - CASCADE → RESTRICT: exclusão de turma com conversas/atribuições bloqueada no banco
  - Expurgo: remoção de anexos expirados e objetos de storage órfãos via `limpar-anexos`
  - Visualizador de anexo: download autenticado via Storage API com o JWT no header `Authorization` (gestão com acesso total, responsável apenas os próprios anexos), integridade do conteúdo baixado e negação de acesso sem autenticação
- **Execução:** `npm run test:api` (requer Supabase local + seed executado)

### Testes E2E (Playwright)

- **Arquivo:** `tests/app.spec.ts`
- **Cobertura:** 128 casos de teste em 5 configurações de navegador:
  - Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
  - Gestão: anos letivos (listagem com ano ativo, criação de ano planejado, virada de ano via RPC, reversão, botão desabilitado no ano vigente)
  - Fluxos testados: login, logout, credenciais inválidas, gestão (home, usuários, alunos, códigos, turmas, modal de atribuições, ranking com botão de chat), professor (frequência, ausência, ocorrências), responsável (chat, home, alertas, justificativas), visualizador de anexo (modal blob em justificativas e alertas, com botões de baixar/fechar e ausência de token na URL), notificações (popover, marcar lidas, limpar todas), chat completo (sidebar, mensagens, busca, header), resiliência, casos extremos
  - **Configuração do sistema:** hub de configuração, CRUD de opções genéricas (incluindo restrições de entrada e exclusão bloqueada de opções referenciadas), gerenciamento de tags de comportamento (exclusão/renomeação de tags referenciadas bloqueadas), parâmetros do sistema, horários letivos, verificações de carregamento dinâmico de opções do banco de dados em formulários
  - **Integridade de catálogo:** exclusão de opção/tag referenciada bloqueada, transferência de enturmação mantendo uma enturmação ativa por aluno
- **Execução:** `npm run test:e2e` (requer Supabase local + seed + servidor dev em execução)
- **Configuração:** `playwright.config.ts` com 5 projetos, worker único por padrão, dev server auto-start, CI detection

## CI/CD e Deploy

### Integração Contínua (GitHub Actions)

- **Workflow:** `.github/workflows/codeql.yml`
- **Análise:** CodeQL Advanced para javascript-typescript
- **Gatilhos:** Push e Pull Request para a branch `main`, além de agendamento semanal (sábado às 23:20 UTC)
- **Resultados:** Reportados em GitHub Security > Code scanning alerts

### Dependências (Dependabot)

- **Configuração:** `.github/dependabot.yml`
- **Escopo:** Atualizações semanais para o ecossistema `devcontainers`

### Reset Database (workflow manual)

- **Workflow:** `.github/workflows/reset-database.yml`
- **Gatilho:** `workflow_dispatch` (execução manual na aba Actions)
- **O que faz:** executa `supabase db reset --linked --no-seed --yes`, que **apaga e recria o banco de produção** aplicando a migration única (`0001_schema_completo.sql`), que já inclui todos os dados canônicos out-of-the-box (catálogos, horários, tags, disciplinas, parâmetros e ano letivo ativo). O seed de desenvolvimento não é aplicado.

> [!CAUTION]
> Operação destrutiva: remove todos os dados, usuários e storage do ambiente. Use apenas quando a reconstrução completa for intencional.

- **Após o reset:** recriar a conta de gestão no Dashboard (Authentication → Add Users), definindo o *Raw User Meta Data* com `{"nome": "...", "papel": "gestao"}`; o trigger `fn_handle_new_user` cria o perfil correspondente no primeiro acesso. Os demais usuários podem se cadastrar normalmente pela tela de login.

### Deploy (Vercel)

- **Configuração:** `vercel.json` com rewrites que direcionam todas as rotas para `index.html` (modo SPA)
- **Branch de produção:** `main`
- **Previews:** Deploys de preview automáticos para cada Pull Request (via integração Vercel GitHub)
- **Build:** `npm run build` (type-check + build Vite)

## Licença

Este projeto é desenvolvido sob licença MIT para fomentar a tecnologia educacional pública. Consulte o arquivo [LICENSE](./LICENSE) para mais detalhes.
