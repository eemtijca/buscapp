#!/usr/bin/env bash
# Valida o schema do PostgreSQL do Docker Compose: migrações aplicadas e objetos essenciais.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! docker compose ps --status running --format '{{.Name}}' | grep -q buscapp-postgres; then
  echo "ERRO: o PostgreSQL do Compose não está em execução. Rode 'npm run compose:up'."
  exit 1
fi

URL_BANCO="${DATABASE_URL_TESTE:-postgresql://buscapp:buscapp@127.0.0.1:5433/buscapp}"

echo "==> Aplicando migrações pendentes"
DATABASE_URL="$URL_BANCO" npx -w @buscapp/api prisma migrate deploy

echo "==> Conferindo objetos essenciais"
docker compose exec -T postgres psql -U buscapp -d buscapp -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  v_tabelas int;
  v_checks int;
  v_triggers int;
  v_indice int;
begin
  select count(*) into v_tabelas
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE';
  -- 32 tabelas de domínio e operação + sessoes + _prisma_migrations
  if v_tabelas <> 34 then
    raise exception 'Esperadas 34 tabelas em public, encontradas %', v_tabelas;
  end if;

  select count(*) into v_checks
  from pg_constraint
  where contype = 'c' and connamespace = 'public'::regnamespace;
  if v_checks < 40 then
    raise exception 'Esperadas ao menos 40 CHECKs, encontradas %', v_checks;
  end if;

  select count(*) into v_triggers
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal;
  if v_triggers < 29 then
    raise exception 'Esperados ao menos 29 triggers de domínio, encontrados %', v_triggers;
  end if;

  select count(*) into v_indice
  from pg_indexes
  where schemaname = 'public' and indexname = 'idx_frequencias_unicidade';
  if v_indice <> 1 then
    raise exception 'Índice parcial idx_frequencias_unicidade ausente';
  end if;
end
$$;
select 'Schema validado com sucesso.' as resultado;
SQL
