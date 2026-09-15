#!/bin/sh
# Aguarda o PostgreSQL, aplica as migrações do Prisma e inicia a API.
set -e

cd /app/apps/api

echo "Aguardando o PostgreSQL ficar disponível..."
# A espera usa a conexão administrativa: o papel de runtime (DATABASE_URL) só existe
# depois que as migrações criam e configuram `buscapp_api`.
until node -e "
import('pg')
  .then(({ Client }) => {
    const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
    const cliente = new Client({ connectionString: url });
    return cliente.connect().then(() => cliente.end());
  })
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
"; do
  sleep 2
done

echo "Aplicando migrações..."
npx prisma migrate deploy

echo "Preparando o papel de runtime..."
node role.mjs

if [ "$SEED" = "true" ]; then
  echo "Populando o banco com dados de desenvolvimento..."
  node dist/prisma/seeds/dev.js
fi

echo "Iniciando a API..."
exec node dist/src/server.js
