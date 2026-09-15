import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
  },
});
