import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

// A API sempre roda com cwd em apps/api (dev e container); o .env fica na raiz do repositório.
config({ path: path.resolve(process.cwd(), '../../.env') });

const esquema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    HOST: z.string().default('0.0.0.0'),
    TZ_ESCOLA: z
      .string()
      .default('America/Sao_Paulo')
      .refine((fuso) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: fuso });
          return true;
        } catch {
          return false;
        }
      }, 'TZ_ESCOLA deve ser um fuso horário IANA válido (ex.: America/Sao_Paulo).'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
    MIGRATE_DATABASE_URL: z.string().optional(),
    APP_URL: z.string().url().default('http://localhost:5173'),
    APP_ORIGINS: z.string().default(''),
    WEB_DIST: z.string().default('../web/dist'),
    AUTH_PEPPER: z.string().min(16, 'AUTH_PEPPER deve ter ao menos 16 caracteres'),
    SESSAO_COOKIE: z.string().default('buscapp_sessao'),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    STORAGE_DRIVER: z.enum(['disco', 's3']).default('disco'),
    UPLOAD_DIR: z.string().default('uploads'),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_UPLOAD_URL_EXPIRA_S: z.coerce.number().int().positive().default(300),
    UPLOAD_DIRETO_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(20 * 1024 * 1024),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .optional()
      .transform((valor) => (valor === undefined ? undefined : valor === 'true')),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((valor) => valor === 'true'),
    REDIS_URL: z.string().min(1, 'REDIS_URL é obrigatória para o barramento de eventos.'),
    // Conexão de sessão usada no LISTEN; sem ela, cai para MIGRATE_DATABASE_URL ou DATABASE_URL.
    DATABASE_URL_ESCUTA: z.string().optional(),
  })
  .superRefine((valores, contexto) => {
    if (valores.NODE_ENV === 'production' && valores.AUTH_PEPPER.length < 32) {
      contexto.addIssue({
        code: 'custom',
        path: ['AUTH_PEPPER'],
        message: 'AUTH_PEPPER deve ter ao menos 32 caracteres em produção',
      });
    }
  });

export type Ambiente = z.infer<typeof esquema>;

export const ambiente: Ambiente = esquema.parse(process.env);

export const cookieSeguro = ambiente.COOKIE_SECURE ?? ambiente.NODE_ENV === 'production';

/** Origens autorizadas a consumir a API com credenciais (CORS). */
export const origensPermitidas = [
  ambiente.APP_URL,
  ...ambiente.APP_ORIGINS.split(',')
    .map((origem) => origem.trim())
    .filter(Boolean),
];
