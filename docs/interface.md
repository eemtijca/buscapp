# Interface

Organização da SPA Vue 3, design system e padrões de interação. Os tokens ficam em `apps/web/src/assets/cores.css` e a base visual é o Bootstrap 5.3.

## Estrutura do frontend

| Diretório                         | Papel                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `src/componentes/`                | 22 componentes reutilizáveis (cartões, chat, combobox, modais e afins).           |
| `src/composables/`                | 13 composables de estado e orquestração, incluindo autenticação e monitoramento.  |
| `src/layouts/LayoutPrincipal.vue` | Shell com cabeçalho, notificações, menu de perfil, rodapé e indicador de conexão. |
| `src/paginas/`                    | Vistas por papel (`auth`, `professor`, `gestao`, `responsavel` e `error`).        |
| `src/rotas/index.ts`              | Vue Router em modo history, com guardas de papel e de módulo.                     |
| `src/servicos/`                   | Cliente HTTP, EventSource e cálculo do termômetro.                                |
| `src/utils/`                      | Compressão de imagem, formatação de mensagens, tradução de erros e opções.        |

## Design system

- Cor primária institucional `#008241`, com variações de hover e ativo, definida em `cores.css` sobre as variáveis do Bootstrap.
- Fontes Geist Sans e Geist Mono via `@fontsource`, aplicadas nos tokens do Bootstrap.
- Bootstrap Icons para iconografia, com `aria-hidden` em ícones decorativos.
- `reka-ui` fornece primitivos acessíveis para componentes interativos, e `sortablejs` apoia a reordenação por arrastar e soltar.
- Cores de status usam classes contextuais do Bootstrap, sempre com ícone ou texto, sem depender apenas da cor.
- O tema do PWA usa `#008241` sobre fundo `#f8f9fa`.

## Rotas e guardas

As rotas usam `createWebHistory` com fallback para `index.html`, servido pela API ou pelo `vite preview`. A guarda global executa:

1. `iniciarNavegacao` carrega o usuário uma única vez por navegação, a partir de `/api/auth/me`.
2. Perfil `inativo` é redirecionado para `/conta-desativada`, sem saída.
3. Usuário autenticado na raiz vai para a home do próprio papel.
4. Rota protegida sem sessão redireciona para o login.
5. Papel sem permissão vai para `/403`; módulo ausente volta à home com aviso na página.

Páginas públicas: `/login`, `/solicitar-codigo`, `/redefinir-senha`. A raiz anônima é a tela de login.

## Páginas por papel

| Papel       | Páginas                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Professor   | Home, Frequência, Ausência e Ocorrências.                                                                                                                                                               |
| Gestão      | Home e painel, Ranking, Ocorrências, Infrequências, Justificativas, Usuários, Alunos, Códigos, Turmas, Anos letivos, Disciplinas, Atribuições, Chat e Configurações (sistema, opções, tags e horários). |
| Responsável | Home, Alertas, Termômetro, Justificativa e Chat.                                                                                                                                                        |
| Erros       | Genérico, 403, 404, 500 e conta desativada.                                                                                                                                                             |

## Componentes e composables

Os 22 componentes cobrem os cartões de aluno, alertas e navegação, o chat em painel duplo com contatos e horário protegido, a fila e o formulário de justificativas, o combobox acessível, o visualizador de anexo, o seletor de ícone, a lista de ocorrências, o popover de notificações, o indicador de conexão, o modal de confirmação, o termômetro de risco e estados de carregamento.

Os 13 composables concentram autenticação, sessão, navegação, notificações, monitoramento, realtime, status da conexão, ano letivo, categorias, formulários e utilidades. `useMonitoramento.ts` é a principal orquestração de dados das telas operacionais.

## Tempo real

`servicos/eventos.ts` mantém uma conexão SSE única por aba, criada sob demanda, com assinatura por tabela e status `conectado` ou `desconectado`. `useRealtimeRefresh` recarrega a tela com debounce de 500 ms ao receber evento da tabela inscrita, ao reconectar e ao voltar para a aba. O popover de notificações tem polling de segurança de 30 segundos.

## Estados e mensagens

- Cada região tem estado próprio de carregamento, com esqueletos e `aria-busy` quando aplicável.
- Ações destrutivas ou de status passam pelo `ModalConfirmacao`.
- As mensagens seguem o padrão de entidade e horário gerado em `mensagemExplicita.ts`, e erros de rede são traduzidos em `traduzirErro.ts`.
- Formulários usam `useFormSnapshot` e `onBeforeRouteLeave` para evitar perda de dados não salvos.
- Botões entram em estado desabilitado durante o salvamento, e o editor sinaliza salvando, salvo ou erro.

## Acessibilidade e responsividade

- Foco visível, rótulos e atributos ARIA em ícones, filtros, diálogos e regiões; o `Combobox` é navegável por teclado e tolera acentos.
- Estrutura semântica com `header`, `nav`, `main` e `footer`; o conteúdo principal recebe `role="main"` e `tabindex="-1"`.
- Interface mobile-first com Bootstrap: barra superior e navegação inferior no celular, ações com alvos grandes.
- Mensagens curtas e estados explícitos nas telas do responsável.

## PWA

`vite-plugin-pwa` gera manifest e service worker apenas no build de produção, com `navigateFallback` para o shell da aplicação e ícones gerados por `scripts/gerar-icones.sh`. O funcionamento offline cobre o shell e a tela de login, sem armazenar dados da API. A configuração está em `apps/web/vite.config.ts` e os testes em `tests/e2e/pwa.spec.ts`.
