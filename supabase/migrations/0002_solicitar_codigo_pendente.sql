-- ============================================================================
-- Migration: solicitar_codigo_pendente
-- Descrição: Corrige a solicitação de código para usuários criados pela gestão.
--            O fluxo de redefinição de senha dependia de `perfis.status = 'ativo'`,
--            mas usuários recém-criados via tela de gestão ficam com status
--            'pendente' até usarem um código pela primeira vez. Quando o código
--            inicial expira (1h) ou é revogado antes da ativação, a solicitação
--            feita pela tela de login não gerava notificação — o pedido nunca
--            aparecia para a gestão.
--
--            Alterações:
--              1. Aceita perfis 'ativo' OU 'pendente' (espelha fn_gerar_codigo_redefinicao)
--              2. Evita duplicar solicitações pendentes por destinatário (anti-spam):
--                 não insere nova notificação se o gestor já possui uma não lida
--                 do tipo codigo_redefinicao para o mesmo perfil
-- ============================================================================

create or replace function public.fn_solicitar_codigo_redefinicao(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil_id uuid;
  v_papel     text;
  v_nome      text;
begin
  select id, papel::text, nome into v_perfil_id, v_papel, v_nome
  from public.perfis
  where email = p_email and status in ('ativo', 'pendente');

  if v_perfil_id is not null then
    insert into public.notificacoes (destinatario_id, tipo, titulo, corpo, metadados)
    select
      p.id,
      'codigo_redefinicao',
      'Solicitação de redefinição de senha',
      'O usuário ' || v_nome || ' (' || p_email || ', ' || v_papel || ') solicitou um código para redefinir a senha.',
      jsonb_build_object('email', p_email, 'perfil_id', v_perfil_id)
    from public.perfis p
    where p.papel = 'gestao'
      and p.status = 'ativo'
      and not exists (
        select 1
        from public.notificacoes n
        where n.destinatario_id = p.id
          and n.tipo = 'codigo_redefinicao'
          and n.lida = false
          and n.metadados->>'perfil_id' = v_perfil_id::text
      );
  end if;
end;
$$;

comment on function public.fn_solicitar_codigo_redefinicao is
  'Cria notificações para os usuários de gestão quando alguém solicita redefinição de senha. Aceita perfis ativo ou pendente e evita duplicar solicitações pendentes por gestor.';

grant execute on function public.fn_solicitar_codigo_redefinicao to anon;

-- ============================================================================
-- Migration: codigos_hardening
-- Descrição: Endurece o ciclo de vida dos códigos de redefinição de senha:
--   1. Bloqueio por tentativas por e-mail (anti força bruta no código de 6 dígitos)
--   2. Solicitação com base apenas em pendências: nova solicitação é suprimida
--      somente quando já existe uma solicitação pendente (não lida) — qualquer
--      outro estado (código ativo, expirado ou revogado) gera nova solicitação
--   3. Validade configurável do código
--   4. Auto-limpeza das solicitações pendentes ao gerar o código
--   5. Geração sempre emite código NOVO, revogando o ativo anterior
--   6. Auditoria de geração/revogação/uso
--   7. Retenção configurável para limpeza programada de códigos antigos
-- ============================================================================

-- ============================================================================
-- 1. TABELA — CONTROLE DE TENTATIVAS POR E-MAIL
-- ============================================================================

create table if not exists public.codigos_redefinicao_tentativas (
  email         text        primary key,
  tentativas    integer     not null default 0,
  bloqueado_ate timestamptz,
  updated_at    timestamptz not null default now()
);

comment on table public.codigos_redefinicao_tentativas is
  'Controle anti força bruta: tentativas falhas de redefinição por e-mail. Acessível apenas via funções (security definer) e leitura da gestão.';

alter table public.codigos_redefinicao_tentativas enable row level security;

create policy "CodTentativas: gestao le"
  on public.codigos_redefinicao_tentativas for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

-- Base de acesso via Data API: leitura para a gestão (RLS filtra) e acesso
-- total para o service_role (usado pelas Edge Functions e testes).
grant select on public.codigos_redefinicao_tentativas to authenticated;
grant select, insert, update, delete on public.codigos_redefinicao_tentativas to service_role;

-- ============================================================================
-- 2. CONFIGURAÇÕES DO SISTEMA — PARÂMETROS DOS CÓDIGOS
-- ============================================================================

alter table public.configuracoes_sistema
  add column if not exists minutos_validade_codigo integer not null default 60,
  add column if not exists max_tentativas_codigo   integer not null default 5,
  add column if not exists minutos_bloqueio_codigo integer not null default 15,
  add column if not exists dias_retencao_codigos   integer not null default 30;

-- ============================================================================
-- 3. FUNÇÃO — SOLICITAR CÓDIGO (revisada: pendência única)
-- ============================================================================

create or replace function public.fn_solicitar_codigo_redefinicao(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil_id uuid;
  v_papel     text;
  v_nome      text;
begin
  select id, papel::text, nome into v_perfil_id, v_papel, v_nome
  from public.perfis
  where email = p_email and status in ('ativo', 'pendente');

  if v_perfil_id is not null then
    -- Só suprime quando já existe solicitação pendente (não lida) para o perfil.
    -- Código ativo, expirado ou revogado não bloqueia uma nova solicitação.
    if not exists (
      select 1
      from public.notificacoes
      where tipo = 'codigo_redefinicao'
        and metadados->>'perfil_id' = v_perfil_id::text
        and lida = false
    ) then
      insert into public.notificacoes (destinatario_id, tipo, titulo, corpo, metadados)
      select
        p.id,
        'codigo_redefinicao',
        'Solicitação de redefinição de senha',
        'O usuário ' || v_nome || ' (' || p_email || ', ' || v_papel || ') solicitou um código para redefinir a senha.',
        jsonb_build_object('email', p_email, 'perfil_id', v_perfil_id)
      from public.perfis p
      where p.papel = 'gestao'
        and p.status = 'ativo'
        and not exists (
          select 1
          from public.notificacoes n
          where n.destinatario_id = p.id
            and n.tipo = 'codigo_redefinicao'
            and n.lida = false
            and n.metadados->>'perfil_id' = v_perfil_id::text
        );
    end if;
  end if;
end;
$$;

comment on function public.fn_solicitar_codigo_redefinicao is
  'Cria notificações para os usuários de gestão quando alguém solicita redefinição de senha. Aceita perfis ativo ou pendente. Nova solicitação é suprimida somente se já existir solicitação pendente (não lida) para o perfil.';

-- ============================================================================
-- 4. FUNÇÃO — GERAR CÓDIGO (revisada: sempre novo, revogando o ativo anterior)
-- ============================================================================

create or replace function public.fn_gerar_codigo_redefinicao(
  p_perfil_id uuid,
  p_criado_por uuid default auth.uid()
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo     text;
  v_codigo_id  uuid;
  v_email      text;
  v_validade   interval;
begin
  if public.get_user_papel() != 'gestao' then
    raise exception 'Apenas a gestão pode gerar códigos de redefinição.';
  end if;

  select make_interval(mins => minutos_validade_codigo)
  into v_validade
  from public.configuracoes_sistema
  where id = 1;

  if v_validade is null then
    v_validade := interval '1 hour';
  end if;

  -- Revoga códigos ativos existentes para que a geração sempre emita um NOVO
  -- código (o anterior fica marcado como revogado, exibido em vermelho)
  with revogados as (
    update public.codigos_redefinicao
    set expira_em = now(),
        revogado_em = now()
    where perfil_id = p_perfil_id
      and usado_em is null
      and expira_em > now()
    returning id
  )
  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores)
  select p_criado_por, 'REVOGAR_CODIGO', 'codigos_redefinicao', id,
         jsonb_build_object('motivo', 'substituído por nova geração')
  from revogados;

  -- Busca email do perfil (aceita ativo ou pendente)
  select email into v_email
  from public.perfis
  where id = p_perfil_id and status in ('ativo', 'pendente');

  if v_email is null then
    raise exception 'Perfil não encontrado ou inativo.';
  end if;

  v_codigo := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into public.codigos_redefinicao (email, perfil_id, codigo, criado_por, expira_em)
  values (v_email, p_perfil_id, v_codigo, p_criado_por, now() + v_validade)
  returning id into v_codigo_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_novos)
  values (p_criado_por, 'GERAR_CODIGO', 'codigos_redefinicao', v_codigo_id,
    jsonb_build_object('perfil_id', p_perfil_id, 'email', v_email));

  -- Solicitações pendentes para este perfil são consideradas atendidas
  update public.notificacoes
  set lida = true, lida_em = now()
  where tipo = 'codigo_redefinicao'
    and metadados->>'perfil_id' = p_perfil_id::text
    and lida = false;

  return v_codigo;
end;
$$;

comment on function public.fn_gerar_codigo_redefinicao is
  'Gera um código NOVO de 6 dígitos, revogando qualquer código ativo anterior do perfil. Aceita perfis ativo ou pendente, marca as solicitações pendentes como atendidas e audita a geração/revogação. Apenas gestão.';

-- ============================================================================
-- 5. FUNÇÃO — REVOGAR CÓDIGO (revisada: auditoria)
-- ============================================================================

create or replace function public.fn_revogar_codigo(p_codigo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  if public.get_user_papel() != 'gestao' then
    raise exception 'Apenas a gestão pode revogar códigos.';
  end if;

  update public.codigos_redefinicao
  set expira_em = now(),
      revogado_em = now()
  where id = p_codigo_id
    and usado_em is null
    and expira_em > now();

  if not found then
    raise exception 'Código já foi usado ou já expirou.';
  end if;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id)
  values (v_usuario_id, 'REVOGAR_CODIGO', 'codigos_redefinicao', p_codigo_id);
end;
$$;

comment on function public.fn_revogar_codigo is
  'Revogação manual de código ativo com auditoria. Define expira_em = now() e registra revogado_em. Lança erro se já usado ou expirado.';

-- ============================================================================
-- 6. FUNÇÕES — ANTI FORÇA BRUTA (tentativas por e-mail)
-- ============================================================================

create or replace function public.fn_codigo_email_bloqueado(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select bloqueado_ate > now()
    from public.codigos_redefinicao_tentativas
    where email = p_email
  ), false);
$$;

create or replace function public.fn_registrar_tentativa_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max      int;
  v_minutos  int;
  v_bloqueou boolean := false;
begin
  select max_tentativas_codigo, minutos_bloqueio_codigo
  into v_max, v_minutos
  from public.configuracoes_sistema
  where id = 1;

  if v_max is null then v_max := 5; end if;
  if v_minutos is null then v_minutos := 15; end if;

  -- Se ainda está bloqueado, mantém o bloqueio (não conta nova tentativa)
  if exists (
    select 1 from public.codigos_redefinicao_tentativas
    where email = p_email and bloqueado_ate > now()
  ) then
    return true;
  end if;

  insert into public.codigos_redefinicao_tentativas (email, tentativas)
  values (p_email, 1)
  on conflict (email) do update
    set tentativas = case
          when codigos_redefinicao_tentativas.bloqueado_ate is not null
            and codigos_redefinicao_tentativas.bloqueado_ate <= now()
            then 1
          else codigos_redefinicao_tentativas.tentativas + 1
        end,
        bloqueado_ate = null,
        updated_at = now();

  update public.codigos_redefinicao_tentativas
  set tentativas = 0,
      bloqueado_ate = now() + make_interval(mins => v_minutos)
  where email = p_email
    and tentativas >= v_max
    and (bloqueado_ate is null or bloqueado_ate <= now());

  if found then
    v_bloqueou := true;
  end if;

  return v_bloqueou;
end;
$$;

create or replace function public.fn_limpar_tentativas_email(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.codigos_redefinicao_tentativas where email = p_email;
end;
$$;

comment on function public.fn_codigo_email_bloqueado is
  'Informa se o e-mail está temporariamente bloqueado por excesso de tentativas falhas.';
comment on function public.fn_registrar_tentativa_email is
  'Registra uma tentativa falha de redefinição para o e-mail. Retorna true quando o e-mail atinge o limite e é bloqueado.';
comment on function public.fn_limpar_tentativas_email is
  'Limpa o contador de tentativas falhas de um e-mail após uma redefinição bem-sucedida.';

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

grant execute on function public.fn_solicitar_codigo_redefinicao to anon;
grant execute on function public.fn_gerar_codigo_redefinicao to authenticated;
grant execute on function public.fn_revogar_codigo to authenticated;
grant execute on function public.fn_codigo_email_bloqueado to authenticated;
grant execute on function public.fn_registrar_tentativa_email to authenticated;
grant execute on function public.fn_limpar_tentativas_email to authenticated;

-- Correção: a tela de configuração do sistema salva via cliente autenticado,
-- mas a tabela nunca teve GRANT de UPDATE para `authenticated` (apenas SELECT).
grant insert, update on public.configuracoes_sistema to authenticated;

-- ============================================================================
-- 8. FUNÇÃO — LIMPAR CÓDIGOS NÃO ATIVOS (gestão)
-- Descrição: Remove permanentemente todos os códigos que não estão mais ativos
--            (usados, expirados ou revogados), preservando os ativos. Retorna a
--            quantidade removida e audita a operação. O histórico permanece na
--            tabela de auditoria (GERAR/REVOGAR/USAR_CODIGO).
-- ============================================================================

create or replace function public.fn_limpar_codigos_nao_ativos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removidos  int;
  v_usuario_id uuid := auth.uid();
begin
  if public.get_user_papel() != 'gestao' then
    raise exception 'Apenas a gestão pode limpar códigos.';
  end if;

  with removidos as (
    delete from public.codigos_redefinicao
    where usado_em is not null
       or revogado_em is not null
       or expira_em <= now()
    returning id
  )
  select count(*) into v_removidos from removidos;

  if v_removidos > 0 then
    insert into public.auditoria (usuario_id, acao, entidade, dados_novos)
    values (v_usuario_id, 'LIMPAR_CODIGOS', 'codigos_redefinicao',
      jsonb_build_object('removidos', v_removidos));
  end if;

  return v_removidos;
end;
$$;

comment on function public.fn_limpar_codigos_nao_ativos is
  'Remove permanentemente códigos não ativos (usados, expirados ou revogados), preservando os ativos. Audita a operação e retorna a quantidade removida. Apenas gestão.';

grant execute on function public.fn_limpar_codigos_nao_ativos to authenticated;
