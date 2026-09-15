# ADR-005: tempo real por Server-Sent Events

- Estado: aceita.
- Data: 2026.

## Contexto

As telas operacionais precisavam se atualizar quando outro usuário registra frequência, ocorrência, justificativa, mensagem ou notificação. O tráfego é sempre do servidor para o cliente, e o sistema já operava sem WebSocket.

## Decisão

Usar Server-Sent Events em `GET /api/eventos`, autenticado por cookie, publicando eventos de invalidação `{ tabela, escopo }` sem dados sensíveis. O barramento é em memória, com heartbeat de 25 segundos, e o frontend recarrega as telas inscritas na tabela, com debounce e recarga ao reconectar e ao voltar para a aba.

## Alternativas consideradas

- WebSocket: descartado pela complexidade de infraestrutura sem necessidade bidirecional.
- Supabase Realtime: descartado junto com a dependência do fornecedor.
- Polling puro: descartado pelo custo e pela latência.

## Consequências

- O canal é HTTP simples, com reconexão automática do navegador.
- O barramento em memória não cruza instâncias, o que exige recarga na reconexão e no retorno da aba.
- Em serverless, a duração máxima da função encerra o stream periodicamente.
- O popover de notificações mantém polling de segurança.

Referências: [modulos.md](../modulos.md), [interface.md](../interface.md) e [deploy.md](../deploy.md).
