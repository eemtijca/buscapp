import { attachDatabasePool } from '@vercel/functions';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient, type Prisma } from '../../../generated/prisma/client.js';
import { ambiente } from '../../ambiente.js';
import { contextoBanco } from './contexto.js';

function criarCliente(url: string) {
  const pool = new Pool({
    connectionString: url,
    max: ambiente.DB_POOL_MAX,
    idleTimeoutMillis: 10_000,
  });

  // Na Vercel/Fluid, libera as conexões ociosas antes de a instância ser suspensa.
  if (process.env.VERCEL) attachDatabasePool(pool);

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

/** Conexão administrativa (dona do schema): migrações, seed e rotinas de sistema. */
export const prismaAdmin = criarCliente(ambiente.MIGRATE_DATABASE_URL ?? ambiente.DATABASE_URL);

const base = criarCliente(ambiente.DATABASE_URL);

async function definirContexto(
  tx: Prisma.TransactionClient,
  usuarioId: string | null,
): Promise<void> {
  await tx.$executeRawUnsafe("select set_config('app.usuario_id', $1, true)", usuarioId ?? '');
}

/**
 * Executa um bloco em transação única definindo `app.usuario_id` para as políticas RLS.
 * Use em transações explícitas; operações simples são embrulhadas automaticamente.
 */
export async function comEscopo<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  usuarioId?: string | null,
): Promise<T> {
  const contexto = contextoBanco.getStore();
  const id = usuarioId ?? contexto?.usuarioId ?? null;

  return base.$transaction(async (tx) => {
    await definirContexto(tx, id);
    if (contexto) contexto.emTransacao = true;
    try {
      return await fn(tx);
    } finally {
      if (contexto) contexto.emTransacao = false;
    }
  });
}

/**
 * Cliente Prisma da API. Toda operação de modelo fora de uma transação explícita roda
 * em uma transação curta com `app.usuario_id` definido, aplicando o RLS por requisição.
 */
export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const contexto = contextoBanco.getStore();
        if (!contexto || contexto.emTransacao) return query(args as never);

        return base.$transaction(async (tx) => {
          await definirContexto(tx, contexto.usuarioId);
          contexto.emTransacao = true;
          try {
            const delegado = (
              tx as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>
            )[model];
            const metodo = delegado?.[operation];
            if (!metodo) return query(args as never);
            return await metodo.call(delegado, args);
          } finally {
            contexto.emTransacao = false;
          }
        });
      },
    },
  },
}) as unknown as PrismaClient;
