# ADR-008: cache de dados do cliente com IndexedDB e ETag

- Estado: aceita.
- Data: 2026.

## Contexto

A SPA refazia cada leitura ao montar a tela, sem cache compartilhado. Os caches existentes eram locais e desconectados (configuração, horários e opções), não havia deduplicação de requisições e cada navegação podia exibir uma tela de carregamento global mesmo quando os dados estavam disponíveis. O SSE já publicava invalidação por tabela, mas cada página precisava se inscrever e recarregar por conta própria.

## Decisão

Centralizar o estado remoto em um cache de consultas próprio, integrado ao SSE:

1. `apps/web/src/servicos/cache.ts` mantém entradas por chave com `stale-while-revalidate`: dados persistidos ou antigos aparecem imediatamente e são revalidados em segundo plano, com deduplicação de requisições em voo, revalidação ao reconectar, ao voltar para a aba e ao voltar a rede.
2. `apps/web/src/servicos/persistenciaCache.ts` persiste uma lista explícita de consultas no IndexedDB (referência, listas e notificações; mensagens de chat e anexos ficam apenas em memória), com namespace por usuário, validade, limite de tamanho e purga no logout.
3. `apps/web/src/servicos/consultas.ts` concentra chave, política de frescor e tabelas de invalidação de cada recurso. Os composables de domínio derivam view models em objetos novos, para que edições locais não contaminem o cache.
4. A API adiciona `Cache-Control: private, no-store` e ETag próprio às respostas `/api`, com 304 para `If-None-Match` correspondente. O cliente guarda o validador e o envia na revalidação; a tela de carregamento global é removida em favor de esqueletos por região e do esqueleto do shell no boot.

## Alternativas consideradas

- TanStack Query Vue: descartada para manter o projeto sem dependências novas e aproveitar diretamente o barramento SSE já existente.
- Pinia Colada: descartada pelo mesmo motivo, somado à introdução do Pinia apenas para o cache.
- Cache apenas em memória: insuficiente para o modo offline do PWA e para recarregamentos completos.
- ETag via `@fastify/etag`: descartada porque o plugin gera ETag também em respostas de erro; o hook próprio restringe a geração a `GET` e `HEAD` com status 2xx.

## Consequências

- Navegações para telas já visitadas exibem dados retidos e revalidam em segundo plano, sem bloqueio visual.
- O offline passa a abrir o aplicativo com o perfil em cache e um aviso de dados possivelmente desatualizados, até a sonda de sessão ser verificada.
- O logout e a troca de usuário purgam memória e IndexedDB; dados de um usuário não são lidos por outro no mesmo dispositivo.
- O volume de dados persistidos é limitado por consulta e por registro; o chat fica de fora para reduzir a exposição de dados sensíveis em disco.
- As telas usam `pendente` para a primeira carga e `atualizando` para a revalidação, sem desabilitar formulários durante a atualização em segundo plano.
- O stream SSE é aberto somente com sessão ativa e encerrado no logout, evitando reconexões anônimas e o recebimento de eventos após o encerramento da sessão.
- `servicos/prefetch.ts` aquece as consultas da rota na intenção de navegação e os dados de referência do shell autenticado.

Referências: [arquitetura.md](../arquitetura.md), [interface.md](../interface.md), [api.md](../api.md) e [ADR-005](005-tempo-real-sse.md).
