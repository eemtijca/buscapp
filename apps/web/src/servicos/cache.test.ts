import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as cache from './cache';
import * as persistencia from './persistenciaCache';

vi.mock('./persistenciaCache', () => ({
  gravarRegistro: vi.fn().mockResolvedValue(undefined),
  lerNamespace: vi.fn().mockResolvedValue([]),
  limparPersistencia: vi.fn().mockResolvedValue(undefined),
  removerNamespace: vi.fn().mockResolvedValue(undefined),
  removerRegistro: vi.fn().mockResolvedValue(undefined),
}));

function dados<T>(dados: T, etag: string | null = null) {
  return { dados, etag };
}

beforeEach(async () => {
  vi.useRealTimers();
  vi.clearAllMocks();
  await cache.limparTudo(false);
  cache.definirNamespace('anon');
});

describe('cache de consultas', () => {
  it('busca uma vez e reaproveita dentro do staleTime', async () => {
    const executar = vi.fn().mockResolvedValue(dados({ n: 1 }));
    const opcoes = { chave: 'basico', executar, staleTime: 10_000 };

    const inicial = cache.consultar(opcoes);
    expect(inicial.pendente).toBe(true);

    await vi.waitFor(() => expect(cache.consultar(opcoes).dados).toEqual({ n: 1 }));
    expect(executar).toHaveBeenCalledTimes(1);

    cache.consultar(opcoes);
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('deduplica requisições em voo para a mesma chave', async () => {
    const executar = vi.fn(
      () =>
        new Promise<{ dados: number; etag: string | null }>((resolver) =>
          setTimeout(() => resolver(dados(1, null)), 20),
        ),
    );
    const opcoes = { chave: 'dedup', executar };

    cache.consultar(opcoes);
    cache.consultar(opcoes);

    expect(executar).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(cache.consultar(opcoes).dados).toBe(1));
  });

  it('revalida quando o staleTime expira', async () => {
    const executar = vi.fn().mockResolvedValue(dados({ v: 1 }));
    const opcoes = { chave: 'stale', executar, staleTime: -1 };

    cache.consultar(opcoes);
    await vi.waitFor(() => expect(executar).toHaveBeenCalledTimes(1));

    cache.consultar(opcoes);
    await vi.waitFor(() => expect(executar).toHaveBeenCalledTimes(2));
  });

  it('mantém os dados no 304 e reenvia o validador anterior', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));

    const executar = vi
      .fn()
      .mockResolvedValueOnce(dados({ v: 1 }, '"e1"'))
      .mockResolvedValueOnce({ dados: undefined, etag: '"e1"', naoModificado: true });
    const opcoes = { chave: 'condicional', executar, staleTime: 0 };

    cache.consultar(opcoes);
    await vi.advanceTimersByTimeAsync(0);
    const primeiro = cache.consultar(opcoes).atualizadoEm;

    vi.advanceTimersByTime(1_000);
    cache.consultar(opcoes);
    await vi.advanceTimersByTimeAsync(0);

    const estado = cache.consultar(opcoes);
    expect(estado.dados).toEqual({ v: 1 });
    expect(estado.erro).toBeNull();
    expect(estado.atualizadoEm).toBe((primeiro ?? 0) + 1_000);
    expect(executar).toHaveBeenLastCalledWith('"e1"');

    vi.useRealTimers();
  });

  it('invalida por tabela respeitando o escopo', async () => {
    const executarA = vi.fn().mockResolvedValue(dados([]));
    const executarB = vi.fn().mockResolvedValue(dados([]));
    const opcoesA = {
      chave: 'mensagens:{"conversaId":"a"}',
      executar: executarA,
      tabelas: ['mensagens'],
      escopo: { conversa_id: 'a' },
    };
    const opcoesB = {
      chave: 'mensagens:{"conversaId":"b"}',
      executar: executarB,
      tabelas: ['mensagens'],
      escopo: { conversa_id: 'b' },
    };

    cache.consultar(opcoesA);
    cache.consultar(opcoesB);
    await vi.waitFor(() => expect(executarA).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(executarB).toHaveBeenCalledTimes(1));

    cache.invalidarTabela('mensagens', { conversa_id: 'a' }, false);
    cache.consultar(opcoesA);
    cache.consultar(opcoesB);

    await vi.waitFor(() => expect(executarA).toHaveBeenCalledTimes(2));
    expect(executarB).toHaveBeenCalledTimes(1);
  });

  it('invalida por prefixo sem afetar chaves parecidas', async () => {
    const executarRaiz = vi.fn().mockResolvedValue(dados([]));
    const executarFiltro = vi.fn().mockResolvedValue(dados([]));
    const executarOutra = vi.fn().mockResolvedValue(dados([]));
    const opcoesRaiz = { chave: 'frequencias', executar: executarRaiz };
    const opcoesFiltro = { chave: 'frequencias:{"status":"ausente"}', executar: executarFiltro };
    const opcoesOutra = { chave: 'frequenciasx', executar: executarOutra };

    cache.consultar(opcoesRaiz);
    cache.consultar(opcoesFiltro);
    cache.consultar(opcoesOutra);
    await vi.waitFor(() => expect(executarRaiz).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(executarFiltro).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(executarOutra).toHaveBeenCalledTimes(1));

    cache.invalidarChave('frequencias', false);
    cache.consultar(opcoesRaiz);
    cache.consultar(opcoesFiltro);
    cache.consultar(opcoesOutra);

    await vi.waitFor(() => expect(executarRaiz).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(executarFiltro).toHaveBeenCalledTimes(2));
    expect(executarOutra).toHaveBeenCalledTimes(1);
  });

  it('remove a entrada após o gcTime sem observadores', async () => {
    vi.useFakeTimers();
    const executar = vi.fn().mockResolvedValue(dados(1));
    const opcoes = { chave: 'gc', executar, staleTime: 10_000, gcTime: 1_000 };

    cache.consultar(opcoes);
    const cancelar = cache.observar(opcoes, () => undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(1);
    cancelar();

    await vi.advanceTimersByTimeAsync(1_001);
    cache.consultar(opcoes);
    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('limparTudo notifica os observadores e zera a memória', async () => {
    const executar = vi.fn().mockResolvedValue(dados(1));
    const opcoes = { chave: 'limpeza', executar };
    const recebidos: unknown[] = [];

    cache.consultar(opcoes);
    const cancelar = cache.observar(opcoes, (estado) => recebidos.push(estado.dados));
    await vi.waitFor(() => expect(recebidos).toContain(1));

    await cache.limparTudo(false);
    expect(recebidos.at(-1)).toBeUndefined();

    cache.consultar(opcoes);
    await vi.waitFor(() => expect(executar).toHaveBeenCalledTimes(2));
    cancelar();
  });

  it('isola entradas por namespace', async () => {
    const executar = vi.fn().mockResolvedValue(dados('u1'));
    const opcoes = { chave: 'namespace', executar };

    cache.definirNamespace('u1');
    cache.consultar(opcoes);
    await vi.waitFor(() => expect(executar).toHaveBeenCalledTimes(1));

    cache.definirNamespace('u2');
    expect(cache.consultar(opcoes).dados).toBeUndefined();

    await vi.waitFor(() => expect(executar).toHaveBeenCalledTimes(2));
  });

  it('não busca nem fica pendente quando desabilitado', () => {
    const executar = vi.fn();
    const estado = cache.consultar({ chave: 'desabilitado', executar, habilitado: false });

    expect(executar).not.toHaveBeenCalled();
    expect(estado.pendente).toBe(false);
    expect(estado.dados).toBeUndefined();
  });

  it('definirDados atualiza a entrada e persiste quando configurado', async () => {
    const executar = vi.fn().mockResolvedValue(dados({ v: 1 }));
    const opcoes = { chave: 'manual', executar, persistir: true };

    cache.consultar(opcoes);
    await vi.waitFor(() => expect(cache.consultar(opcoes).dados).toEqual({ v: 1 }));

    vi.mocked(persistencia.gravarRegistro).mockClear();
    cache.definirDados('manual', { v: 2 });

    expect(executar).toHaveBeenCalledTimes(1);
    expect(cache.consultar(opcoes).dados).toEqual({ v: 2 });
    await vi.waitFor(() => expect(persistencia.gravarRegistro).toHaveBeenCalledTimes(1));
  });
});
