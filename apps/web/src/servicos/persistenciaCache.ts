/** Registro persistido de uma consulta do cache. */
export interface RegistroPersistido {
  /** Chave primária composta: `namespace|chave`. */
  id: string;
  namespace: string;
  chave: string;
  dados: unknown;
  atualizadoEm: number;
  etag: string | null;
  expiraEm: number;
}

const NOME_BANCO = 'buscapp-cache';
const VERSAO_BANCO = 1;
const LOJA = 'consultas';
const LIMITE_REGISTROS = 80;

let bancoPromessa: Promise<IDBDatabase | null> | null = null;
let indisponivel = false;
let avisouQuota = false;

function abrirBanco(): Promise<IDBDatabase | null> {
  if (bancoPromessa) return bancoPromessa;

  let bloqueado = false;

  const promessa = new Promise<IDBDatabase | null>((resolver) => {
    if (indisponivel || typeof indexedDB === 'undefined') {
      resolver(null);
      return;
    }

    try {
      const requisicao = indexedDB.open(NOME_BANCO, VERSAO_BANCO);

      requisicao.onupgradeneeded = () => {
        const banco = requisicao.result;
        if (!banco.objectStoreNames.contains(LOJA)) {
          const loja = banco.createObjectStore(LOJA, { keyPath: 'id' });
          loja.createIndex('namespace', 'namespace', { unique: false });
        }
      };
      requisicao.onsuccess = () => resolver(requisicao.result);
      requisicao.onerror = () => {
        indisponivel = true;
        resolver(null);
      };
      // Outra aba pode estar migrando o banco; libera a promessa para tentar de novo depois.
      requisicao.onblocked = () => {
        bloqueado = true;
        resolver(null);
      };
    } catch {
      indisponivel = true;
      resolver(null);
    }
  });

  bancoPromessa = promessa;
  void promessa.then((banco) => {
    if (!banco) {
      if (bloqueado) bancoPromessa = null;
      return;
    }
    // Conexão encerrada ou substituída por outra aba: permite reabrir na próxima operação.
    banco.onclose = () => {
      bancoPromessa = null;
    };
    banco.onversionchange = () => {
      banco.close();
      bancoPromessa = null;
    };
  });

  return promessa;
}

/** Trata falhas de transação; em cota excedida, limpa a persistência e segue sem ela. */
function tratarFalhaDeTransacao(transacao: IDBTransaction): void {
  if (transacao.error?.name !== 'QuotaExceededError' || avisouQuota) return;
  avisouQuota = true;
  console.warn('[cache] Cota do IndexedDB excedida; limpando a persistência local.');
  void limparPersistencia();
}

/** Executa uma operação na loja de consultas; devolve `null` quando o IndexedDB não está disponível. */
async function comLoja<T>(
  modo: IDBTransactionMode,
  operacao: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const banco = await abrirBanco();
  if (!banco) return null;

  return new Promise((resolver) => {
    try {
      const transacao = banco.transaction(LOJA, modo);
      const requisicao = operacao(transacao.objectStore(LOJA));
      requisicao.onsuccess = () => resolver(requisicao.result);
      requisicao.onerror = () => {
        tratarFalhaDeTransacao(transacao);
        resolver(null);
      };
      transacao.onabort = () => {
        tratarFalhaDeTransacao(transacao);
        resolver(null);
      };
    } catch {
      resolver(null);
    }
  });
}

/** Indica se o IndexedDB está operacional neste navegador. */
export function persistenciaDisponivel(): boolean {
  return !indisponivel && typeof indexedDB !== 'undefined';
}

/** Lê os registros válidos de um namespace, descartando expirados. */
export async function lerNamespace(namespace: string): Promise<RegistroPersistido[]> {
  const banco = await abrirBanco();
  if (!banco) return [];

  return new Promise((resolver) => {
    try {
      const transacao = banco.transaction(LOJA, 'readonly');
      const indice = transacao.objectStore(LOJA).index('namespace');
      const requisicao = indice.getAll(namespace);
      requisicao.onsuccess = () => {
        const agora = Date.now();
        const registros = (requisicao.result as RegistroPersistido[]).filter(
          (registro) => registro.expiraEm > agora,
        );
        const expirados = (requisicao.result as RegistroPersistido[]).filter(
          (registro) => registro.expiraEm <= agora,
        );
        for (const expirado of expirados) void removerRegistro(expirado.id);
        resolver(registros);
      };
      requisicao.onerror = () => resolver([]);
    } catch {
      resolver([]);
    }
  });
}

export async function gravarRegistro(registro: RegistroPersistido): Promise<void> {
  await comLoja('readwrite', (loja) => loja.put(registro));
  await podarExcedente();
}

export async function removerRegistro(id: string): Promise<void> {
  await comLoja('readwrite', (loja) => loja.delete(id));
}

export async function removerNamespace(namespace: string): Promise<void> {
  const banco = await abrirBanco();
  if (!banco) return;

  return new Promise((resolver) => {
    try {
      const transacao = banco.transaction(LOJA, 'readwrite');
      const indice = transacao.objectStore(LOJA).index('namespace');
      const requisicao = indice.openCursor(namespace);
      requisicao.onsuccess = () => {
        const cursor = requisicao.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
          return;
        }
        resolver();
      };
      requisicao.onerror = () => resolver();
    } catch {
      resolver();
    }
  });
}

export async function limparPersistencia(): Promise<void> {
  await comLoja('readwrite', (loja) => loja.clear());
}

/** Remove os registros mais antigos quando o total passa do limite. */
async function podarExcedente(): Promise<void> {
  const banco = await abrirBanco();
  if (!banco) return;

  return new Promise((resolver) => {
    try {
      const transacao = banco.transaction(LOJA, 'readwrite');
      const loja = transacao.objectStore(LOJA);
      const requisicao = loja.getAll();
      requisicao.onsuccess = () => {
        const registros = requisicao.result as RegistroPersistido[];
        if (registros.length <= LIMITE_REGISTROS) {
          resolver();
          return;
        }
        registros
          .sort((a, b) => a.atualizadoEm - b.atualizadoEm)
          .slice(0, registros.length - LIMITE_REGISTROS)
          .forEach((registro) => loja.delete(registro.id));
        resolver();
      };
      requisicao.onerror = () => resolver();
    } catch {
      resolver();
    }
  });
}
