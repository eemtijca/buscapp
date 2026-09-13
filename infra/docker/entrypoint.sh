#!/bin/sh
# Aguarda o PostgreSQL, aplica as migrações do Prisma e inicia a API.
set -e

cd /app/apps/api

echo "Aguardando o PostgreSQL ficar disponível..."
until node -e "
import('pg')
  .then(({ Client }) => {
    const cliente = new Client({ connectionString: process.env.DATABASE_URL });
    return cliente.connect().then(() => cliente.end());
  })
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
"; do
  sleep 2
done

echo "Aplicando migrações..."
npx prisma migrate deploy

if [ "$SEED" = "true" ]; then
  echo "Populando o banco com dados de desenvolvimento..."
  npm run seed
fi

echo "Iniciando a API..."
exec node dist/src/principal.js
