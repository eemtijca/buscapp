-- Contadores do rate limiting, compartilhados entre instâncias.
-- Sem RLS: são contadores operacionais sem dado pessoal, acessados também em contexto anônimo (login).

set local lock_timeout = '5s';

create table "rate_limit_contadores" (
    "chave" text not null,
    "contagem" integer not null default 0,
    "expira_em" timestamptz(6) not null,

    constraint "rate_limit_contadores_pkey" primary key ("chave")
);

create index "idx_rate_limit_expira" on "rate_limit_contadores"("expira_em");

grant select, insert, update, delete on public.rate_limit_contadores to buscapp_api;
