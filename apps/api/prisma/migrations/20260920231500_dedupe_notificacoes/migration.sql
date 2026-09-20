-- Dedupe de notificações: uma pendente por destinatário e chave lógica.
-- A leitura libera a chave, permitindo notificar de novo em uma nova solicitação.

set local lock_timeout = '5s';

alter table public.notificacoes add column "dedupe_key" text;

create unique index "uq_notificacao_dedupe" on public.notificacoes ("destinatario_id", "dedupe_key")
  where "dedupe_key" is not null and not "lida";
