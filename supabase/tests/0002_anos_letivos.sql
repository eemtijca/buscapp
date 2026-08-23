-- ============================================================================
-- Test: 0002_anos_letivos
-- Projeto: BuscApp — EEMTI
-- Descrição: Valida migrations 0004/0005 — ano letivo ativo garantido,
--            função de virada (ativar_ano_letivo), bloqueio por papel,
--            atomicidade das flags e trilha de auditoria.
-- Execução: npx supabase db query --file supabase/tests/<arquivo>.sql
-- ============================================================================
-- ATENÇÃO: Roda dentro de uma transação, faz ROLLBACK no final.
-- Não altera permanentemente o banco.
-- ============================================================================

begin;

create or replace function public.test_msg(tag text, ok boolean)
returns void
language plpgsql
as $helper$
begin
  if ok then
    raise notice '[OK] %', tag;
  else
    raise exception '[FAIL] %', tag;
  end if;
end;
$helper$;

create or replace function public.test_create_auth_user(
  p_email text, p_nome text, p_papel text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $helper$
declare
  v_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    confirmation_sent_at, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated',
    'authenticated', p_email, '', now(),
    jsonb_build_object('nome', p_nome, 'papel', p_papel), now(), now());
  return v_user_id;
end;
$helper$;

do $al$
declare
  v_gestao_id    uuid;
  v_prof_id      uuid;
  v_ano_atual    int := extract(year from current_date)::int;
  v_ano_novo     int := extract(year from current_date)::int + 1;
  v_ano_novo_id  uuid;
  v_anterior_id  uuid;
  v_count        int;
  v_status       text;
  v_ativo        boolean;
begin
  -- Usuários de teste (o trigger cria os perfis correspondentes)
  v_gestao_id := public.test_create_auth_user('al_gestao@escola.edu.br', 'Gestor AL', 'gestao');
  v_prof_id   := public.test_create_auth_user('al_professor@escola.edu.br', 'Professor AL', 'professor');

  -- ==========================================================================
  -- MIGRATION 0004: ano letivo ativo garantido
  -- ==========================================================================

  -- A1: existe exatamente um ano letivo ativo (seed + 0004)
  select count(*) into v_count
  from public.anos_letivos where status = 'ativo' and ativo = true;
  perform public.test_msg('A1: exatamente um ano letivo ativo no banco', v_count = 1);

  -- A2: o ano ativo é o ano corrente (criado pelo seed/0004 com as datas padrão)
  select status, ativo into v_status, v_ativo
  from public.anos_letivos where ano = v_ano_atual;
  perform public.test_msg(
    'A2: ano corrente está ativo com flags consistentes',
    v_status = 'ativo' and v_ativo = true
  );

  -- ==========================================================================
  -- MIGRATION 0005: função de virada ativar_ano_letivo
  -- ==========================================================================

  -- A3: gestão cria ano seguinte como planejado (fluxo da UI)
  execute format('set local request.jwt.claims to ''{"sub":"%s","role":"authenticated"}''', v_gestao_id);
  execute 'set local role authenticated';
  begin
    insert into public.anos_letivos (ano, status, data_inicio, data_fim, ativo)
    values (v_ano_novo, 'planejado',
            make_date(v_ano_novo, 2, 1), make_date(v_ano_novo, 12, 20), false)
    returning id into v_ano_novo_id;
    perform public.test_msg('A3: gestão cria ano planejado', v_ano_novo_id is not null);
  exception when others then
    raise notice 'A3 debug: % %', sqlstate, sqlerrm;
    perform public.test_msg('A3: gestão cria ano planejado', false);
  end;

  -- A4: professor NÃO pode realizar a virada
  execute format('set local request.jwt.claims to ''{"sub":"%s","role":"authenticated"}''', v_prof_id);
  begin
    perform public.ativar_ano_letivo(v_ano_novo_id);
    perform public.test_msg('A4: professor bloqueado na virada', false);
  exception when others then
    perform public.test_msg('A4: professor bloqueado na virada', sqlerrm like 'Apenas a gestão%');
  end;

  -- A5: gestão realiza a virada para o ano seguinte
  execute format('set local request.jwt.claims to ''{"sub":"%s","role":"authenticated"}''', v_gestao_id);
  begin
    perform public.ativar_ano_letivo(v_ano_novo_id);
    perform public.test_msg('A5: gestão ativa o novo ano', true);
  exception when others then
    raise notice 'A5 debug: % %', sqlstate, sqlerrm;
    perform public.test_msg('A5: gestão ativa o novo ano', false);
  end;

  -- A6: após a virada, o novo ano está ativo com flags consistentes
  select status, ativo into v_status, v_ativo
  from public.anos_letivos where id = v_ano_novo_id;
  perform public.test_msg('A6: novo ano ativo (status + flag)', v_status = 'ativo' and v_ativo);

  -- A7: o ano vigente anterior foi arquivado
  select id into v_anterior_id from public.anos_letivos where ano = v_ano_atual;
  select status, ativo into v_status, v_ativo
  from public.anos_letivos where id = v_anterior_id;
  perform public.test_msg('A7: ano anterior arquivado', v_status = 'arquivado' and not v_ativo);

  -- A8: continua existindo exatamente um ano ativo
  select count(*) into v_count
  from public.anos_letivos where status = 'ativo' and ativo = true;
  perform public.test_msg('A8: apenas um ano ativo após a virada', v_count = 1);

  -- A9: ativar um ano que já está ativo falha
  begin
    perform public.ativar_ano_letivo(v_ano_novo_id);
    perform public.test_msg('A9: reativação do ano corrente bloqueada', false);
  exception when others then
    perform public.test_msg(
      'A9: reativação do ano corrente bloqueada',
      sqlerrm like '%já está ativo%'
    );
  end;

  -- A10: ativar ano inexistente falha
  begin
    perform public.ativar_ano_letivo(gen_random_uuid());
    perform public.test_msg('A10: ano inexistente rejeitado', false);
  exception when others then
    perform public.test_msg(
      'A10: ano inexistente rejeitado',
      sqlerrm like '%não encontrado%'
    );
  end;

  -- A11: auditoria registrou ARQUIVAR_ANO_LETIVO e ATIVAR_ANO_LETIVO
  select count(*) into v_count
  from public.auditoria
  where entidade = 'anos_letivos'
    and acao in ('ARQUIVAR_ANO_LETIVO', 'ATIVAR_ANO_LETIVO')
    and entidade_id in (v_anterior_id, v_ano_novo_id);
  perform public.test_msg('A11: auditoria da virada registrada', v_count >= 2);

  -- A12: virada de retorno — reativa o ano anterior arquivando o corrente
  begin
    perform public.ativar_ano_letivo(v_anterior_id);
    select status, ativo into v_status, v_ativo
    from public.anos_letivos where id = v_anterior_id;
    perform public.test_msg('A12: reversão da virada funciona', v_status = 'ativo' and v_ativo);
  exception when others then
    raise notice 'A12 debug: % %', sqlstate, sqlerrm;
    perform public.test_msg('A12: reversão da virada funciona', false);
  end;

  execute 'reset role';
end;
$al$;

rollback;
