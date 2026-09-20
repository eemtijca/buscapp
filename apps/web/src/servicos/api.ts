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
  ifNoneMatch?: string | null;
}

/** Resposta crua da API, incluindo o validador de cache para revalidação condicional. */
export interface RespostaRequisicao<T> {
  status: number;
  dados: T;
  etag: string | null;
  naoModificado: boolean;
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
  const resposta = await requisitar<T>(caminho, opcoes);
  return resposta.dados;
}

/**
 * Executa a requisição e devolve status, corpo e ETag. A revalidação condicional
 * envia `If-None-Match` e trata o 304 sem corpo, mantendo o dado do cache local.
 */
export async function requisitar<T>(
  caminho: string,
  opcoes: OpcoesRequisicao = {},
): Promise<RespostaRequisicao<T>> {
  const temCorpo = opcoes.corpo !== undefined;
  const cabecalhos: Record<string, string> = {};
  if (!opcoes.formData && temCorpo) cabecalhos['Content-Type'] = 'application/json';
  if (opcoes.ifNoneMatch) cabecalhos['If-None-Match'] = opcoes.ifNoneMatch;

  const resposta = await fetch(montarUrl(caminho, opcoes.parametros), {
    method: opcoes.metodo ?? 'GET',
    credentials: 'include',
    headers: cabecalhos,
    body: opcoes.formData ?? (temCorpo ? JSON.stringify(opcoes.corpo) : undefined),
    cache: 'no-store',
  });

  if (resposta.status === 304) {
    return {
      status: resposta.status,
      dados: undefined as T,
      etag: resposta.headers.get('etag'),
      naoModificado: true,
    };
  }

  const dados = await interpretarResposta<T>(resposta);
  return {
    status: resposta.status,
    dados,
    etag: resposta.headers.get('etag'),
    naoModificado: false,
  };
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

interface UploadDiretoAnexo {
  chave: string;
  url: string;
  expira_em: string;
}

/**
 * Envia um anexo pelo caminho mais eficiente: tenta a URL pré-assinada
 * (upload direto ao provedor, sem passar pela API) e recorre ao multipart
 * quando o ambiente não oferece envio direto.
 */
export async function enviarAnexo<T = { anexo: { id: string } }>(
  arquivo: Blob,
  nome: string,
  mimeType = arquivo.type || 'application/octet-stream',
): Promise<T> {
  try {
    const { upload } = await api<{ upload: UploadDiretoAnexo }>('/api/anexos/upload', {
      metodo: 'POST',
      corpo: { nome_arquivo: nome, mime_type: mimeType, tamanho_bytes: arquivo.size },
    });

    const envio = await fetch(upload.url, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: arquivo,
    });
    if (!envio.ok) {
      throw new ErroApi(
        envio.status,
        'upload_falhou',
        `Falha ao enviar o arquivo (${envio.status}).`,
      );
    }

    return await api<T>('/api/anexos/confirmar', {
      metodo: 'POST',
      corpo: {
        chave: upload.chave,
        nome_arquivo: nome,
        mime_type: mimeType,
        tamanho_bytes: arquivo.size,
      },
    });
  } catch (erro) {
    if (erro instanceof ErroApi && erro.codigo === 'upload_direto_indisponivel') {
      return enviarArquivo<T>('/api/anexos', arquivo, nome);
    }
    // Falha do provedor (403, URL expirada) ou de rede no PUT também recorre ao multipart.
    if (erro instanceof ErroApi && erro.codigo === 'upload_falhou') {
      return enviarArquivo<T>('/api/anexos', arquivo, nome);
    }
    if (erro instanceof TypeError) {
      return enviarArquivo<T>('/api/anexos', arquivo, nome);
    }
    throw erro;
  }
}
