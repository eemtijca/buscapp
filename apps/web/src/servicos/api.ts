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

/** Tempo máximo de uma requisição comum, em milissegundos. */
const TIMEOUT_MS = 15_000;
/** Tempo máximo de transferências de arquivo (download e upload). */
const TIMEOUT_ARQUIVO_MS = 120_000;
/** Tentativas totais para métodos idempotentes (GET). */
const TENTATIVAS_GET = 3;
const ESPERA_BASE_MS = 300;

export interface OpcoesRequisicao {
  metodo?: Metodo;
  corpo?: unknown;
  parametros?: Record<string, string | number | boolean | string[] | undefined | null>;
  formData?: FormData;
  ifNoneMatch?: string | null;
  /** Sinal externo para cancelar a requisição (somado ao timeout). */
  signal?: AbortSignal;
}

/** Resposta crua da API, incluindo o validador de cache para revalidação condicional. */
export interface RespostaRequisicao<T> {
  status: number;
  dados: T;
  etag: string | null;
  naoModificado: boolean;
}

function esperar(tentativa: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ESPERA_BASE_MS * 2 ** (tentativa - 1)));
}

/** Combina o timeout com um sinal externo; sem `AbortSignal.any`, usa o que existir. */
function sinalDaRequisicao(timeout: number, externo?: AbortSignal): AbortSignal {
  const limite = AbortSignal.timeout(timeout);
  if (!externo) return limite;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([limite, externo]);
  return externo;
}

function erroDeRede(erro: unknown): ErroApi {
  if (erro instanceof ErroApi) return erro;
  const nome = (erro as { name?: string } | null)?.name;
  if (nome === 'TimeoutError') {
    return new ErroApi(0, 'tempo_esgotado', 'A requisição demorou demais. Tente novamente.');
  }
  if (nome === 'AbortError') {
    return new ErroApi(0, 'requisicao_cancelada', 'Requisição cancelada.');
  }
  return new ErroApi(0, 'falha_rede', 'Falha de conexão. Verifique sua internet.');
}

let redirecionandoParaLogin = false;

/**
 * Sessão expirada em rota autenticada: recarrega a SPA no login guardando a rota
 * de origem em `?destino=`. O recarregamento limpa o estado em memória.
 */
function tratarSessaoExpirada(caminho: string): void {
  if (caminho.startsWith('/api/auth/') || redirecionandoParaLogin) return;
  redirecionandoParaLogin = true;
  const destino = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/?destino=${encodeURIComponent(destino)}`);
}

function montarUrl(caminho: string, parametros?: OpcoesRequisicao['parametros']): string {
  // Fora do navegador (testes) a base absoluta evita depender de `window`.
  const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(`${BASE}${caminho}`, base);
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
  const metodo = opcoes.metodo ?? 'GET';
  const temCorpo = opcoes.corpo !== undefined;
  const cabecalhos: Record<string, string> = {};
  if (!opcoes.formData && temCorpo) cabecalhos['Content-Type'] = 'application/json';
  if (opcoes.ifNoneMatch) cabecalhos['If-None-Match'] = opcoes.ifNoneMatch;

  const url = montarUrl(caminho, opcoes.parametros);
  const timeout = opcoes.formData ? TIMEOUT_ARQUIVO_MS : TIMEOUT_MS;
  // Só métodos idempotentes são repetidos: POST/PUT/PATCH podem duplicar efeitos.
  const maxTentativas = metodo === 'GET' ? TENTATIVAS_GET : 1;

  for (let tentativa = 1; ; tentativa += 1) {
    try {
      const resposta = await fetch(url, {
        method: metodo,
        credentials: 'include',
        headers: cabecalhos,
        body: opcoes.formData ?? (temCorpo ? JSON.stringify(opcoes.corpo) : undefined),
        cache: 'no-store',
        signal: sinalDaRequisicao(timeout, opcoes.signal),
      });

      if (resposta.status === 401) tratarSessaoExpirada(caminho);
      if (resposta.status >= 500 && tentativa < maxTentativas) {
        await esperar(tentativa);
        continue;
      }

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
    } catch (erro) {
      // Cancelamento explícito não deve ser repetido; falha de rede/5xx pode.
      const cancelado =
        opcoes.signal?.aborted === true ||
        (erro as { name?: string } | null)?.name === 'AbortError';
      if (erro instanceof ErroApi || cancelado || tentativa >= maxTentativas)
        throw erroDeRede(erro);
      await esperar(tentativa);
    }
  }
}

/** Baixa o conteúdo de um anexo autenticado e devolve um blob para visualização. */
export async function baixarArquivo(caminho: string): Promise<Blob> {
  const resposta = await fetch(montarUrl(caminho), {
    credentials: 'include',
    signal: AbortSignal.timeout(TIMEOUT_ARQUIVO_MS),
  }).catch((erro: unknown) => {
    throw erroDeRede(erro);
  });
  if (resposta.status === 401) tratarSessaoExpirada(caminho);
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
      signal: AbortSignal.timeout(TIMEOUT_ARQUIVO_MS),
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
