import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '../../../generated/prisma/client.js';

export interface ContextoBanco {
  usuarioId: string | null;
  emTransacao: boolean;
  /** Cliente da transação corrente, quando houver; o cliente global o reutiliza. */
  tx?: Prisma.TransactionClient;
  /** Escopo de alunos resolvido nesta requisição; `null` significa "todos". */
  escopoAlunos?: string[] | null;
  escopoAlunosResolvido?: boolean;
}

/** Contexto por requisição usado para definir `app.usuario_id` nas transações. */
export const contextoBanco = new AsyncLocalStorage<ContextoBanco>();
