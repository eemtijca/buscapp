import { AsyncLocalStorage } from 'node:async_hooks';

export interface ContextoBanco {
  usuarioId: string | null;
  emTransacao: boolean;
}

/** Contexto por requisição usado para definir `app.usuario_id` nas transações. */
export const contextoBanco = new AsyncLocalStorage<ContextoBanco>();
