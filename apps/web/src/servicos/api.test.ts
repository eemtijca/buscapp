import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, requisitar } from './api';

function respostaJson(status: number, corpo: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cliente HTTP', () => {
  it('repete GET em 5xx e devolve o resultado da tentativa seguinte', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respostaJson(503))
      .mockResolvedValueOnce(respostaJson(200, { valor: 7 }));
    vi.stubGlobal('fetch', fetchFalso);

    const resposta = await requisitar<{ valor: number }>('/api/teste');
    expect(resposta.dados).toEqual({ valor: 7 });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('não repete métodos não idempotentes', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson(500, { erro: { codigo: 'x' } }));
    vi.stubGlobal('fetch', fetchFalso);

    await expect(requisitar('/api/teste', { metodo: 'POST', corpo: {} })).rejects.toBeInstanceOf(
      ErroApi,
    );
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('não repete erros 4xx e preserva o código da API', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respostaJson(422, {
        erro: { codigo: 'dados_invalidos', mensagem: 'Dados inválidos.' },
      }),
    );
    vi.stubGlobal('fetch', fetchFalso);

    await expect(requisitar('/api/teste')).rejects.toMatchObject({
      status: 422,
      codigo: 'dados_invalidos',
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('traduz falha de rede em erro tipado', async () => {
    const fetchFalso = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchFalso);

    await expect(requisitar('/api/teste')).rejects.toMatchObject({ codigo: 'falha_rede' });
    expect(fetchFalso).toHaveBeenCalledTimes(3);
  });

  it('traduz timeout em erro tipado', async () => {
    const fetchFalso = vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    vi.stubGlobal('fetch', fetchFalso);

    await expect(requisitar('/api/teste')).rejects.toMatchObject({ codigo: 'tempo_esgotado' });
  });

  it('redireciona ao login com ?destino= em 401 de rota autenticada', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost',
        pathname: '/gestao/alunos',
        search: '?busca=ana',
        assign,
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(401, { erro: {} })));

    await expect(requisitar('/api/alunos')).rejects.toBeInstanceOf(ErroApi);
    expect(assign).toHaveBeenCalledWith('/?destino=%2Fgestao%2Falunos%3Fbusca%3Dana');
  });

  it('não redireciona em 401 das rotas de autenticação', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost', pathname: '/', search: '', assign },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(401, { erro: {} })));

    await expect(requisitar('/api/auth/me')).rejects.toBeInstanceOf(ErroApi);
    expect(assign).not.toHaveBeenCalled();
  });

  it('respeita o sinal externo de cancelamento', async () => {
    const controlador = new AbortController();
    const fetchFalso = vi.fn().mockImplementation((_url: string, opcoes: RequestInit) => {
      return new Promise((_resolver, rejeitar) => {
        opcoes.signal?.addEventListener('abort', () =>
          rejeitar(new DOMException('abortado', 'AbortError')),
        );
      });
    });
    vi.stubGlobal('fetch', fetchFalso);

    const promessa = requisitar('/api/teste', { signal: controlador.signal });
    controlador.abort();
    await expect(promessa).rejects.toMatchObject({ codigo: 'requisicao_cancelada' });
  });
});
