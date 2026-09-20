-- Integridade: ano letivo ativo único, storage_path único, código ativo único por email
-- e coerência entre turma e ano letivo na enturmação.

set local lock_timeout = '5s';

-- Um único ano letivo ativo.
create unique index "uq_anos_letivo_ativo" on public."anos_letivos"("ativo") where ativo;

-- Um registro por objeto no storage (idempotência real da confirmação de upload).
create unique index "uq_anexos_storage_path" on public."anexos"("storage_path");

-- Um código ativo por email.
create unique index "uq_codigo_ativo_email" on public."codigos_redefinicao"("email")
  where usado_em is null and revogado_em is null;

-- Coerência entre turma e ano letivo na enturmação.
create or replace function public.fn_validar_enturmacao_ano()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.turmas t
    where t.id = new.turma_id and t.ano_letivo_id = new.ano_letivo_id
  ) then
    raise exception 'A turma % não pertence ao ano letivo %', new.turma_id, new.ano_letivo_id
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_validar_enturmacao_ano
before insert or update of turma_id, ano_letivo_id on public.enturmacoes
for each row execute function public.fn_validar_enturmacao_ano();

create or replace function public.fn_proteger_ano_da_turma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ano_letivo_id <> old.ano_letivo_id
     and exists (select 1 from public.enturmacoes e where e.turma_id = old.id) then
    raise exception 'Não é possível alterar o ano letivo de uma turma com enturmações'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_proteger_ano_da_turma
before update of ano_letivo_id on public.turmas
for each row execute function public.fn_proteger_ano_da_turma();

-- Coerência entre status e flag de ano ativo; NOT VALID para não falhar com dados legados.
alter table public.anos_letivos
  add constraint chk_ano_letivo_ativo_coerente check (ativo = (status = 'ativo')) not valid;
