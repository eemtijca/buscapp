import { ErroApi } from './api';
import { inscreverEventos, inscreverStatus } from './eventos';
import {
  gravarRegistro,
  lerNamespace,
  limparPersistencia,
  removerNamespace,
  removerRegistro,
  type RegistroPersistido,
} from './persistenciaCache';

/** Resultado de um fetcher de consulta; `naoModificado` representa o 304 da revalidação. */
export interface ResultadoFetcher<T> {
  dados: T;
  etag: string | null;
  naoModificado?: boolean;
}

export interface OpcoesConsulta<T> {
  /** Identificador estável da consulta (sem o namespace). */
  chave: string;
  executar: (etagAtual: string | null) => Promise<ResultadoFetcher<T>>;
  /** Janela em que os dados são considerados frescos, sem nova requisição. */
  staleTime?: number;
  /** Tempo que os dados permanecem em memória após o último observador. */
  gcTime?: number;
  /** Persiste a consulta no IndexedDB para reuso offline. */
  persistir?: boolean;
  /** Validade do registro persistido. */
  ttl?: number;
  /** Tabelas cuja invalidação em tempo real limpa esta consulta. */
  tabelas?: readonly string[];
  /** Restringe a invalidação por escopo (ex.: `conversa_id`). */
  escopo?: Record<string, string>;
  /** Namespace de isolamento; por padrão, o usuário autenticado. */
  namespace?: string;
  /** Quando falso, a consulta não é executada nem observada. */
  habilitado?: boolean;
}

export interface SnapshotConsulta<T> {
  dados: T | undefined;
  erro: unknown;
  atualizadoEm: number | null;
  atualizando: boolean;
  pendente: boolean;
}

export type ObservadorConsulta<T> = (snapshot: SnapshotConsulta<T>) => void;

const STALE_PADRAO_MS = 30_000;
const GC_PADRAO_MS = 10 * 60_000;
const TTL_PADRAO_MS = 7 * 24 * 60 * 60_000;
const LIMITE_PERSISTENCIA_BYTES = 1024 * 1024;
const MAX_ENTRADAS = 120;
const NAMESPACE_SESSAO = 'sessao';

/** Entrada interna sem genérico para permitir o registro heterogêneo de consultas. */
interface Entrada {
  id: string;
  namespace: string;
  chave: string;
  opcoes: OpcoesConsulta<unknown>;
  dados: unknown;
  erro: unknown;
  atualizadoEm: number | null;
  etag: string | null;
  atualizando: boolean;
  promessa: Promise<void> | null;
  observadores: Set<ObservadorConsulta<unknown>>;
  timerGc: ReturnType<typeof setTimeout> | null;
}

const entradas = new Map<string, Entrada>();
const hidratados = new Map<string, RegistroPersistido>();
const hidratacoes = new Map<string, Promise<void>>();

let namespaceAtual = 'anon';
let namespaceAnterior: string | null = null;
let inicializado = false;
let canal: BroadcastChannel | null = null;
let cancelarEventos: (() => void) | null = null;
let cancelarStatus: (() => void) | null = null;
let tratadorSessaoInvalida: ((erro: ErroApi) => void) | null = null;
let publicando = false;

function idEntrada(namespace: string, chave: string): string {
  return `${namespace}\u0000${chave}`;
}

function namespaceDaConsulta(opcoes: { namespace?: string }): string {
  return opcoes.namespace ?? namespaceAtual;
}

function snapshot(entrada: Entrada): SnapshotConsulta<unknown> {
  return {
    dados: entrada.dados,
    erro: entrada.erro,
    atualizadoEm: entrada.atualizadoEm,
    atualizando: entrada.atualizando,
    pendente: entrada.dados === undefined && entrada.erro == null,
  };
}

function notificar(entrada: Entrada): void {
  const estado = snapshot(entrada);
  for (const observador of entrada.observadores) observador(estado);
}

function estaStale(entrada: Entrada): boolean {
  if (entrada.atualizadoEm === null) return true;
  return Date.now() - entrada.atualizadoEm > (entrada.opcoes.staleTime ?? STALE_PADRAO_MS);
}

function estimarTamanho(dados: unknown): number {
  try {
    return JSON.stringify(dados)?.length ?? 0;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

async function persistirEntrada(entrada: Entrada): Promise<void> {
  if (!entrada.opcoes.persistir || entrada.dados === undefined) return;
  if (estimarTamanho(entrada.dados) > LIMITE_PERSISTENCIA_BYTES) return;

  const registro: RegistroPersistido = {
    id: entrada.id,
    namespace: entrada.namespace,
    chave: entrada.chave,
    dados: entrada.dados,
    atualizadoEm: entrada.atualizadoEm ?? Date.now(),
    etag: entrada.etag,
    expiraEm: Date.now() + (entrada.opcoes.ttl ?? TTL_PADRAO_MS),
  };

  await gravarRegistro(registro);
  // A purga concorrente invalida o registro recém-escrito.
  if (entradas.get(entrada.id) !== entrada) await removerRegistro(registro.id);
}

function agendarGc(entrada: Entrada): void {
  if (entrada.timerGc) clearTimeout(entrada.timerGc);
  if (entrada.observadores.size > 0) return;

  entrada.timerGc = setTimeout(() => {
    entrada.timerGc = null;
    if (entrada.observadores.size > 0 || entrada.promessa) return;
    entradas.delete(entrada.id);
  }, entrada.opcoes.gcTime ?? GC_PADRAO_MS);
}

function executarEntrada(entrada: Entrada): Promise<void> {
  if (entrada.promessa) return entrada.promessa;

  entrada.atualizando = true;
  notificar(entrada);

  const promessa = (async () => {
    try {
      const resultado = await entrada.opcoes.executar(entrada.etag);
      // Uma purga concorrente remove a entrada do registro; a resposta é descartada.
      if (entradas.get(entrada.id) !== entrada) return;

      if (!resultado.naoModificado) {
        entrada.dados = resultado.dados;
      }
      entrada.etag = resultado.etag;
      entrada.atualizadoEm = Date.now();
      entrada.erro = null;
      if (!resultado.naoModificado) void persistirEntrada(entrada);
    } catch (erro) {
      if (entradas.get(entrada.id) !== entrada) return;
      entrada.erro = erro;
      if (erro instanceof ErroApi && erro.status === 401) tratadorSessaoInvalida?.(erro);
    } finally {
      entrada.promessa = null;
      entrada.atualizando = false;
      notificar(entrada);
      agendarGc(entrada);
    }
  })();

  entrada.promessa = promessa;
  return promessa;
}

function criarEntrada<T>(opcoes: OpcoesConsulta<T>): Entrada {
  const namespace = namespaceDaConsulta(opcoes);
  const id = idEntrada(namespace, opcoes.chave);
  const existente = entradas.get(id);
  if (existente) {
    existente.opcoes = opcoes as OpcoesConsulta<unknown>;
    return existente;
  }

  const entrada: Entrada = {
    id,
    namespace,
    chave: opcoes.chave,
    opcoes: opcoes as OpcoesConsulta<unknown>,
    dados: undefined,
    erro: null,
    atualizadoEm: null,
    etag: null,
    atualizando: false,
    promessa: null,
    observadores: new Set(),
    timerGc: null,
  };

  const persistido = hidratados.get(id);
  if (persistido) {
    entrada.dados = persistido.dados;
    // Dados persistidos entram como obsoletos: mostram na hora e revalidam em seguida.
    entrada.atualizadoEm = null;
    entrada.etag = persistido.etag;
  }

  entradas.set(id, entrada);
  podarEntradas();
  return entrada;
}

function podarEntradas(): void {
  if (entradas.size <= MAX_ENTRADAS) return;

  const candidatas = [...entradas.values()]
    .filter((entrada) => entrada.observadores.size === 0 && !entrada.promessa)
    .sort((a, b) => (a.atualizadoEm ?? 0) - (b.atualizadoEm ?? 0));

  for (const entrada of candidatas) {
    if (entradas.size <= MAX_ENTRADAS) break;
    if (entrada.timerGc) clearTimeout(entrada.timerGc);
    entradas.delete(entrada.id);
  }
}

/** Lê a consulta do cache e agenda a revalidação quando necessário. */
export function consultar<T>(opcoes: OpcoesConsulta<T>): SnapshotConsulta<T> {
  if (opcoes.habilitado === false) {
    return {
      dados: undefined,
      erro: null,
      atualizadoEm: null,
      atualizando: false,
      pendente: false,
    };
  }

  const namespace = namespaceDaConsulta(opcoes);
  void hidratarNamespace(namespace);
  const entrada = criarEntrada(opcoes);

  if (entrada.dados === undefined || estaStale(entrada)) {
    void executarEntrada(entrada);
  }

  return snapshot(entrada) as SnapshotConsulta<T>;
}

/** Registra um observador reativo; devolve a função de cancelamento. */
export function observar<T>(
  opcoes: OpcoesConsulta<T>,
  observador: ObservadorConsulta<T>,
): () => void {
  const namespace = namespaceDaConsulta(opcoes);
  void hidratarNamespace(namespace);
  const entrada = criarEntrada(opcoes);

  if (entrada.timerGc) {
    clearTimeout(entrada.timerGc);
    entrada.timerGc = null;
  }

  entrada.observadores.add(observador as ObservadorConsulta<unknown>);
  observador(snapshot(entrada) as SnapshotConsulta<T>);

  return () => {
    entrada.observadores.delete(observador as ObservadorConsulta<unknown>);
    agendarGc(entrada);
  };
}

/** Força a revalidação da consulta; sem `forcar`, respeita o `staleTime`. */
export function recarregar(chave: string, forcar = false, namespace?: string): Promise<void> {
  const id = idEntrada(namespace ?? namespaceAtual, chave);
  const entrada = entradas.get(id);
  if (!entrada) return Promise.resolve();
  if (!forcar && !estaStale(entrada) && entrada.dados !== undefined) return Promise.resolve();
  return executarEntrada(entrada);
}

/** Atualiza os dados de uma consulta já existente, sem nova requisição (uso otimista). */
export function definirDados<T>(chave: string, dados: T, namespace = namespaceAtual): void {
  const entrada = entradas.get(idEntrada(namespace, chave));
  if (!entrada) return;

  entrada.dados = dados;
  entrada.atualizadoEm = Date.now();
  entrada.erro = null;
  notificar(entrada);
  void persistirEntrada(entrada);
}

function invalidarEntrada(entrada: Entrada, revalidar: boolean): void {
  entrada.atualizadoEm = null;
  notificar(entrada);
  if (revalidar && entrada.observadores.size > 0) void executarEntrada(entrada);
}

function invalidarPrefixo(prefixo: string, propagar: boolean): void {
  for (const entrada of entradas.values()) {
    if (entrada.chave === prefixo || entrada.chave.startsWith(`${prefixo}:`)) {
      invalidarEntrada(entrada, true);
    }
  }
  if (propagar) publicarInvalidacao({ tipo: 'chave', chave: prefixo });
}

/** Marca uma consulta como obsoleta e a revalida quando há observadores. */
export function invalidarChave(chave: string, propagar = true): void {
  invalidarPrefixo(chave, propagar);
}

/** Invalida as consultas inscritas em uma tabela, respeitando o escopo quando informado. */
export function invalidarTabela(
  tabela: string,
  escopo?: Record<string, string>,
  propagar = true,
): void {
  for (const entrada of entradas.values()) {
    if (!entrada.opcoes.tabelas?.includes(tabela)) continue;
    if (escopo && entrada.opcoes.escopo) {
      const conflita = Object.entries(escopo).some(
        ([campo, valor]) => entrada.opcoes.escopo?.[campo] !== valor,
      );
      if (conflita) continue;
    }
    invalidarEntrada(entrada, true);
  }
  if (propagar) publicarInvalidacao({ tipo: 'tabela', tabela, escopo });
}

function invalidarAtivas(): void {
  for (const entrada of entradas.values()) {
    if (entrada.observadores.size > 0) invalidarEntrada(entrada, true);
  }
}

/** Abre o stream SSE e a observação de status apenas com sessão ativa. */
function ativarTempoReal(): void {
  if (cancelarEventos) return;
  cancelarEventos = inscreverEventos((tabela, escopo) => invalidarTabela(tabela, escopo));
  cancelarStatus = inscreverStatus((status) => {
    if (status === 'conectado') invalidarAtivas();
  });
}

/** Encerra o stream SSE; a última inscrição fecha a conexão. */
function desativarTempoReal(): void {
  cancelarEventos?.();
  cancelarEventos = null;
  cancelarStatus?.();
  cancelarStatus = null;
}

/** Limpa memória, IndexedDB e notifica as outras abas. */
export async function limparTudo(propagar = true): Promise<void> {
  desativarTempoReal();

  const vazio: SnapshotConsulta<unknown> = {
    dados: undefined,
    erro: null,
    atualizadoEm: null,
    atualizando: false,
    pendente: false,
  };
  for (const entrada of entradas.values()) {
    if (entrada.timerGc) clearTimeout(entrada.timerGc);
    for (const observador of entrada.observadores) observador(vazio);
    entrada.observadores.clear();
  }

  entradas.clear();
  hidratados.clear();
  await limparPersistencia();
  if (propagar) publicarInvalidacao({ tipo: 'limpar' });
}

/** Troca o namespace e remove os dados persistidos de outros usuários. */
export function definirNamespace(namespace: string): void {
  if (namespace === namespaceAtual) return;

  const anterior = namespaceAnterior ?? namespaceAtual;
  namespaceAnterior = namespace;
  namespaceAtual = namespace;

  for (const entrada of entradas.values()) {
    if (entrada.namespace !== NAMESPACE_SESSAO) {
      if (entrada.timerGc) clearTimeout(entrada.timerGc);
      entradas.delete(entrada.id);
    }
  }
  for (const id of hidratados.keys()) {
    if (!id.startsWith(`${NAMESPACE_SESSAO}\u0000`)) hidratados.delete(id);
  }

  if (anterior && anterior !== NAMESPACE_SESSAO) void removerNamespace(anterior);
  void removerNamespace('anon');
  void hidratarNamespace(namespace);

  if (namespace === NAMESPACE_SESSAO || namespace === 'anon') {
    desativarTempoReal();
  } else {
    ativarTempoReal();
  }
}

/** Aguarda a leitura do IndexedDB de um namespace antes de decidir com base no cache. */
export function hidratar(namespace = namespaceAtual): Promise<void> {
  return hidratarNamespace(namespace);
}

function hidratarNamespace(namespace: string): Promise<void> {
  const emAndamento = hidratacoes.get(namespace);
  if (emAndamento) return emAndamento;

  const promessa = (async () => {
    const registros = await lerNamespace(namespace);
    for (const registro of registros) {
      hidratados.set(registro.id, registro);
      const entrada = entradas.get(registro.id);
      if (entrada && entrada.dados === undefined) {
        entrada.dados = registro.dados;
        entrada.atualizadoEm = null;
        entrada.etag = registro.etag;
        if (entrada.observadores.size > 0) void executarEntrada(entrada);
      }
    }
  })();

  hidratacoes.set(namespace, promessa);
  return promessa;
}

/** Delega ao app a reação a um 401 (limpeza de sessão e redirecionamento). */
export function definirTratadorSessaoInvalida(tratador: (erro: ErroApi) => void): void {
  tratadorSessaoInvalida = tratador;
}

type MensagemInvalidacao =
  | { tipo: 'limpar' }
  | { tipo: 'chave'; chave: string }
  | { tipo: 'tabela'; tabela: string; escopo?: Record<string, string> };

function publicarInvalidacao(mensagem: MensagemInvalidacao): void {
  if (!canal || publicando) return;
  try {
    canal.postMessage(mensagem);
  } catch {
    /* canal indisponível */
  }
}

function aplicarMensagem(mensagem: MensagemInvalidacao): void {
  publicando = true;
  try {
    if (mensagem.tipo === 'limpar') {
      void limparTudo(false);
    } else if (mensagem.tipo === 'chave') {
      invalidarPrefixo(mensagem.chave, false);
    } else if (mensagem.tipo === 'tabela') {
      invalidarTabela(mensagem.tabela, mensagem.escopo, false);
    }
  } finally {
    publicando = false;
  }
}

function aoMudarVisibilidade(): void {
  if (document.visibilityState === 'visible') invalidarAtivas();
}

/** Liga visibilidade, reconexão de rede e o canal entre abas ao cache. */
export function inicializarCache(): void {
  if (inicializado) return;
  inicializado = true;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', invalidarAtivas);
  }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      canal = new BroadcastChannel('buscapp-cache');
      canal.onmessage = (evento: MessageEvent<MensagemInvalidacao>) => {
        aplicarMensagem(evento.data);
      };
    } catch {
      canal = null;
    }
  }
}
