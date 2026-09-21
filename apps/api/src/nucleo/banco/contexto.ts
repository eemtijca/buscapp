import { AsyncLocalStorage } from 'node:async_hooks';

export interface ContextoBanco {
  usuarioId: string | null;
  emTransacao: boolean;
  /** Escopo de alunos resolvido nesta requisição; `null` significa "todos". */
  escopoAlunos?: string[] | null;
  escopoAlunosResolvido?: boolean;
}

/** Contexto por requisição usado para definir `app.usuario_id` nas transações. */
export const contextoBanco = new AsyncLocalStorage<ContextoBanco>();
