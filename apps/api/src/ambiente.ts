import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

// A API sempre roda com cwd em apps/api (dev e container); o .env fica na raiz do repositório.
config({ path: path.resolve(process.cwd(), '../../.env') });

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  APP_ORIGINS: z.string().default(''),
  WEB_DIST: z.string().default('../web/dist'),
});

export type Ambiente = z.infer<typeof esquema>;

export const ambiente: Ambiente = esquema.parse(process.env);
