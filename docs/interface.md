# Interface

Organização da SPA Vue 3, design system e padrões de interação. Os tokens ficam em `apps/web/src/assets/cores.css` e a base visual é o Bootstrap 5.3.

## Estrutura do frontend

| Diretório                         | Papel                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `src/componentes/`                | 21 componentes reutilizáveis (cartões, chat, combobox, modais e afins).           |
| `src/composables/`                | 8 composables de estado e orquestração, incluindo autenticação e notificações.    |
| `src/composables/consultas/`      | View models reativos derivados do cache, por domínio.                             |
| `src/layouts/LayoutPrincipal.vue` | Shell com cabeçalho, notificações, menu de perfil, rodapé e indicador de conexão. |
| `src/paginas/`                    | Vistas por papel (`auth`, `professor`, `gestao`, `responsavel` e `error`).        |
| `src/rotas/index.ts`              | Vue Router em modo history, com guardas de papel e de módulo.                     |
| `src/servicos/`                   | Cliente HTTP com ETag, cache de consultas, IndexedDB, EventSource e termômetro.   |
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

1. A guarda aguarda a sessão uma única vez, a partir de `/api/auth/me`; a sonda responde `perfil: null` para anônimos, sem `401`. Fora do ar, o perfil hidratado do IndexedDB mantém a navegação com aviso de dados possivelmente desatualizados.
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

Os 21 componentes cobrem os cartões de aluno, alertas e navegação, o chat em painel duplo com contatos e horário protegido, a fila e o formulário de justificativas, o combobox acessível, o visualizador de anexo, o seletor de ícone, a lista de ocorrências, o popover de notificações, o indicador de conexão, o modal de confirmação, o termômetro de risco e estados de carregamento por região.

Os composables concentram autenticação, sessão, navegação, notificações, formulários e status da conexão. As consultas ficam em `servicos/cache.ts` (estado, deduplicação e revalidação) e em `servicos/consultas.ts` (chaves, frescor e tabelas de invalidação); `composables/consultas/` deriva view models reativos por domínio, e `useConsulta` adapta uma consulta ao componente.

## Tempo real

`servicos/eventos.ts` mantém uma conexão SSE única por aba, com assinatura por tabela e status `conectado` ou `desconectado`. O stream só é aberto com sessão ativa: o login o abre e o logout encerra a conexão. Ao receber um evento, o cache invalida as consultas inscritas na tabela (respeitando escopos como `conversa_id`) e revalida as ativas; o mesmo ocorre ao reconectar, ao voltar para a aba e ao voltar a rede. O popover de notificações tem polling de segurança de 30 segundos.

## Estados e mensagens

- Cada região tem estado próprio de carregamento, com esqueletos e `aria-busy` quando aplicável.
- `pendente` indica a primeira carga sem dados; `atualizando` indica revalidação em segundo plano e não desabilita formulários. O boot usa um esqueleto do shell, sem tela de carregamento global.
- `servicos/prefetch.ts` aquece as consultas da rota ao passar o mouse ou focar um cartão de navegação, e os dados de referência do shell após o login.
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

`vite-plugin-pwa` gera manifest e service worker apenas no build de produção, com `navigateFallback` para o shell da aplicação e ícones gerados por `scripts/gerar-icones.sh`. O funcionamento offline cobre o shell, a tela de login e as consultas persistidas no IndexedDB (referência, listas e notificações); mensagens de chat e anexos não são armazenados. A configuração está em `apps/web/vite.config.ts` e os testes em `tests/e2e/pwa.spec.ts`.
