-- RLS e privilégios de coluna nas tabelas administrativas.
-- O fluxo de autenticação passou a usar o cliente administrativo, então o papel de
-- runtime pode perder o acesso a senha_hash e ficar sujeito às políticas.

set local lock_timeout = '5s';

-- perfis: revogar a tabela e reconceder coluna a coluna (o GRANT de tabela cobriria tudo).
revoke select on public.perfis from buscapp_api;
grant select (
  id, nome, email, papel, status, telefone, cargo,
  notificacoes_ativas, acesso_modulos, permissoes,
  ultimo_acesso_em, created_at, updated_at
) on public.perfis to buscapp_api;

alter table public.perfis enable row level security;
create policy leitura_autenticada on public.perfis for select to buscapp_api
  using (public.app_usuario_id() is not null);
create policy gestao_total on public.perfis for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());

alter table public.configuracoes_sistema enable row level security;
create policy leitura_autenticada on public.configuracoes_sistema for select to buscapp_api
  using (public.app_usuario_id() is not null);
create policy gestao_total on public.configuracoes_sistema for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());

alter table public.auditoria enable row level security;
create policy gestao_total on public.auditoria for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());

alter table public.codigos_redefinicao enable row level security;
create policy gestao_total on public.codigos_redefinicao for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());

-- Apenas o cliente administrativo acessa tentativas de código.
alter table public.codigos_redefinicao_tentativas enable row level security;

-- Sessões já tinham RLS sem política; a política explícita documenta a negação.
create policy negado_para_runtime on public.sessoes for all to buscapp_api using (false);
