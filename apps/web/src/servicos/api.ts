const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Erro padronizado devolvido pela API no envelope `{ erro: { codigo, mensagem } }`. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OpcoesRequisicao {
  metodo?: Metodo;
  corpo?: unknown;
  parametros?: Record<string, string | number | boolean | string[] | undefined | null>;
  formData?: FormData;
}

function montarUrl(caminho: string, parametros?: OpcoesRequisicao['parametros']): string {
  const url = new URL(`${BASE}${caminho}`, window.location.origin);
  for (const [chave, valor] of Object.entries(parametros ?? {})) {
    if (valor === undefined || valor === null || valor === '') continue;
    if (Array.isArray(valor)) {
      for (const item of valor) url.searchParams.append(chave, String(item));
    } else {
      url.searchParams.set(chave, String(valor));
    }
  }
  return url.toString();
}

async function interpretarResposta<T>(resposta: Response): Promise<T> {
  if (resposta.status === 204) return undefined as T;

  const texto = await resposta.text();
  let dados: unknown = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = texto;
    }
  }

  if (!resposta.ok) {
    const erro = (dados as { erro?: { codigo?: string; mensagem?: string } } | null)?.erro;
    throw new ErroApi(
      resposta.status,
      erro?.codigo ?? 'erro_desconhecido',
      erro?.mensagem ?? `Falha na requisição (${resposta.status}).`,
    );
  }

  return dados as T;
}

/** Cliente tipado da API própria; usa cookies de sessão first-party. */
export async function api<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const resposta = await fetch(montarUrl(caminho, opcoes.parametros), {
    method: opcoes.metodo ?? 'GET',
    credentials: 'include',
    headers: opcoes.formData ? undefined : { 'Content-Type': 'application/json' },
    body:
      opcoes.formData ?? (opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined),
  });

  return interpretarResposta<T>(resposta);
}

/** Baixa o conteúdo de um anexo autenticado e devolve um blob para visualização. */
export async function baixarArquivo(caminho: string): Promise<Blob> {
  const resposta = await fetch(montarUrl(caminho), { credentials: 'include' });
  if (!resposta.ok) {
    const erro = await interpretarResposta<unknown>(resposta).catch((e: unknown) => e);
    if (erro instanceof ErroApi) throw erro;
    throw new ErroApi(resposta.status, 'erro_arquivo', 'Falha ao baixar o arquivo.');
  }
  return resposta.blob();
}

/** Envia um arquivo multipart autenticado. */
export async function enviarArquivo<T>(caminho: string, arquivo: Blob, nome: string): Promise<T> {
  const formData = new FormData();
  formData.append('arquivo', arquivo, nome);
  return api<T>(caminho, { metodo: 'POST', formData });
}
