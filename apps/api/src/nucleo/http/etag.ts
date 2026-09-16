import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const CABECALHO_CONDICIONAL = 'if-none-match';

/** Compara ETags pelo algoritmo fraco do RFC 9110, aceitando listas separadas por vírgula. */
function etagCorresponde(cabecalho: string, etag: string): boolean {
  const alvo = etag.replace(/^W\//, '');
  return cabecalho
    .split(',')
    .map((valor) => valor.trim().replace(/^W\//, ''))
    .some((valor) => valor === alvo || valor === '*');
}

function gerarEtag(payload: string | Buffer): string {
  return `"${createHash('sha1').update(payload).digest('base64')}"`;
}

/**
 * Adiciona cache privado e ETag condicional às respostas da API.
 * Respostas autenticadas usam `private, no-store` para impedir cache de intermediários
 * e do próprio navegador; o cliente mantém os dados no cache próprio e revalida por ETag.
 * Streams (SSE e anexos) ficam de fora, pois não são strings nem buffers.
 */
export function registrarCacheHttp(app: FastifyInstance): void {
  app.addHook('onSend', (pedido: FastifyRequest, resposta: FastifyReply, payload, concluir) => {
    if (!pedido.url.startsWith('/api/')) {
      concluir(null, payload);
      return;
    }

    if (!resposta.getHeader('cache-control')) {
      resposta.header('Cache-Control', 'private, no-store');
    }

    const elegivel =
      (pedido.method === 'GET' || pedido.method === 'HEAD') &&
      resposta.statusCode >= 200 &&
      resposta.statusCode < 300 &&
      (typeof payload === 'string' || payload instanceof Buffer);

    if (!elegivel) {
      concluir(null, payload);
      return;
    }

    let etag = resposta.getHeader('etag');
    if (!etag) {
      etag = gerarEtag(payload);
      resposta.header('etag', etag);
    }

    const condicional = pedido.headers[CABECALHO_CONDICIONAL];
    if (typeof etag === 'string' && condicional && etagCorresponde(condicional, etag)) {
      resposta.code(304);
      concluir(null, null);
      return;
    }

    concluir(null, payload);
  });
}
