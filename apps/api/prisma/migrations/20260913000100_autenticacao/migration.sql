-- Autenticação própria: credenciais, sessões e códigos de redefinição com HMAC.

alter table public.perfis
  add column senha_hash text,
  add column senha_alterada_em timestamptz(6);

create table public.sessoes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  token_hash text not null,
  criado_em timestamptz(6) not null default now(),
  expira_em timestamptz(6) not null,
  ultimo_uso_em timestamptz(6),
  revogada_em timestamptz(6),
  user_agent text,
  ip inet,
  constraint uq_sessoes_token_hash unique (token_hash)
);

create index idx_sessoes_perfil on public.sessoes (perfil_id);
create index idx_sessoes_expira on public.sessoes (expira_em);

-- Os códigos deixam de ser armazenados em texto puro; a coluna legada permanece
-- apenas durante a transição e é removida na Fase 6.
alter table public.codigos_redefinicao
  add column codigo_hash text,
  alter column codigo drop not null;

alter table public.sessoes enable row level security;
