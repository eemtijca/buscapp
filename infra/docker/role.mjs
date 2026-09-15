// Define a senha do papel de runtime (criado pelas migrações) a partir do ambiente.
import { Client } from 'pg';

const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
const senha = process.env.APP_DB_PASSWORD ?? 'buscapp_api';

if (!url) {
  console.error('MIGRATE_DATABASE_URL (ou DATABASE_URL) é obrigatória para preparar o papel.');
  process.exit(1);
}

const cliente = new Client({ connectionString: url });
await cliente.connect();
try {
  await cliente.query(`alter role buscapp_api with password '${senha.replace(/'/g, "''")}'`);
  console.log('Papel buscapp_api atualizado.');
} finally {
  await cliente.end();
}
