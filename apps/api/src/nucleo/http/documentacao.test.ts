// Guarda da documentação interativa: confere a especificação publicada em
// /api/docs, a cobertura de rotas, o mapa de respostas de erro e o CSP por URL.
import type { FastifyInstance } from 'fastify';
import type { OpenAPIV3_1 } from 'openapi-types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../aplicacao.js';
import {
  errosDocumentados,
  OPERACOES_SEM_ERRO_DOCUMENTADO,
  operacoesDocumentadas,
  paginaMinima,
  politicaDeSeguranca,
} from './documentacao.js';

let app: FastifyInstance;
let documento: OpenAPIV3_1.Document;

const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

/** Operações da especificação no formato `METODO /caminho` com `:param`. */
function operacoesDoDocumento(aberto: OpenAPIV3_1.Document): Set<string> {
  const conjunto = new Set<string>();
  for (const [caminho, item] of Object.entries(aberto.paths ?? {})) {
    if (!item) continue;
    for (const metodo of METODOS) {
      if (item[metodo]) {
        conjunto.add(`${metodo.toUpperCase()} ${caminho.replace(/\{([^}]+)\}/g, ':$1')}`);
      }
    }
  }
  return conjunto;
}

/** Operação da especificação a partir da chave `METODO /caminho`. */
function operacaoPorChave(
  aberto: OpenAPIV3_1.Document,
  chave: string,
): OpenAPIV3_1.OperationObject {
  const [metodo = '', caminho = ''] = chave.split(' ');
  const item = aberto.paths?.[caminho.replace(/:([^/]+)/g, '{$1}')];
  const operacao = item?.[metodo.toLowerCase() as (typeof METODOS)[number]];
  if (!operacao) throw new Error(`Operação ausente na especificação: ${chave}`);
  return operacao;
}

/** Resolve um `$ref` interno (`#/a/b`) dentro do documento. */
function resolverRef(aberto: OpenAPIV3_1.Document, referencia: string): unknown {
  return referencia
    .replace(/^#\//, '')
    .split('/')
    .reduce<unknown>((atual, parte) => {
      if (atual && typeof atual === 'object') {
        return (atual as Record<string, unknown>)[parte];
      }
      return undefined;
    }, aberto);
}

function coletarRefs(valor: unknown, destino: Set<string>): void {
  if (Array.isArray(valor)) {
    for (const item of valor) coletarRefs(item, destino);
    return;
  }
  if (valor && typeof valor === 'object') {
    for (const [chave, filho] of Object.entries(valor)) {
      if (chave === '$ref' && typeof filho === 'string' && filho.startsWith('#/')) {
        destino.add(filho);
      }
      coletarRefs(filho, destino);
    }
  }
}

beforeAll(async () => {
  app = await construirApp();
  await app.ready();
  documento = app.swagger() as OpenAPIV3_1.Document;
});

afterAll(async () => {
  await app?.close();
});

describe('documentação interativa', () => {
  it('serve a interface e a especificação a partir de /api/docs', async () => {
    const interfaceHtml = await app.inject({ method: 'GET', url: '/api/docs' });
    expect(interfaceHtml.statusCode).toBe(200);
    expect(interfaceHtml.headers['content-type']).toContain('text/html');
    expect(interfaceHtml.body).toContain('swagger-ui');

    const especificacao = await app.inject({ method: 'GET', url: '/api/docs/openapi.json' });
    expect(especificacao.statusCode).toBe(200);
    expect(especificacao.json().openapi).toBe('3.1.0');
    expect(especificacao.json().paths['/api/alunos']).toBeTruthy();
  });

  it('cobre exatamente as rotas da API sem vazar rotas internas', () => {
    const documentadas = [...operacoesDoDocumento(documento)].sort();
    const mapeadas = [...operacoesDocumentadas()].sort();

    expect(mapeadas).toEqual(documentadas);

    for (const caminho of Object.keys(documento.paths ?? {})) {
      expect(caminho.startsWith('/api/'), `rota fora da API na especificação: ${caminho}`).toBe(
        true,
      );
    }
  });

  it('dá operação única, resumo e descrição a cada rota', () => {
    const ids = new Set<string>();
    for (const [caminho, item] of Object.entries(documento.paths ?? {})) {
      for (const metodo of METODOS) {
        const operacao = item?.[metodo];
        if (!operacao) continue;
        const referencia = `${metodo.toUpperCase()} ${caminho}`;

        expect(operacao.operationId, `operationId ausente em ${referencia}`).toMatch(
          /^[a-z][a-zA-Z0-9]+$/,
        );
        expect(
          ids.has(operacao.operationId ?? ''),
          `operationId repetido: ${operacao.operationId}`,
        ).toBe(false);
        ids.add(operacao.operationId ?? '');

        expect(operacao.summary, `summary ausente em ${referencia}`).toBeTruthy();
        expect(operacao.description, `description ausente em ${referencia}`).toBeTruthy();
        expect(operacao.tags?.length, `tags ausentes em ${referencia}`).toBeGreaterThan(0);
      }
    }
  });

  it('documenta os erros de cada operação conforme o mapa', () => {
    for (const chave of operacoesDocumentadas()) {
      const operacao = operacaoPorChave(documento, chave);
      const respostas = operacao.responses ?? {};
      const temErro = Object.keys(respostas).some((status) => /^4\d\d$/.test(status));

      if ((OPERACOES_SEM_ERRO_DOCUMENTADO as readonly string[]).includes(chave)) {
        expect(temErro, `${chave} não deveria ter 4xx`).toBe(false);
      } else {
        expect(temErro, `4xx ausente em ${chave}`).toBe(true);
      }

      for (const codigo of errosDocumentados(chave)) {
        expect(respostas[String(codigo)], `${codigo} ausente em ${chave}`).toBeTruthy();
      }

      for (const [status, resposta] of Object.entries(respostas)) {
        if (!('$ref' in resposta)) {
          expect(resposta.description, `descrição ausente em ${chave} ${status}`).toBeTruthy();
        }
      }
    }
  });

  it('aplica segurança por cookie, isenta as públicas e usa o segredo no expurgo', () => {
    expect(documento.security).toEqual([{ sessao: [] }]);
    expect(documento.components?.securitySchemes).toHaveProperty('sessao');
    expect(documento.components?.securitySchemes).toHaveProperty('segredoAgendador');

    const login = operacaoPorChave(documento, 'POST /api/auth/login');
    expect(login.security).toEqual([]);

    const expurgo = operacaoPorChave(documento, 'POST /api/tarefas/expurgo');
    expect(expurgo.security).toEqual([{ segredoAgendador: [] }]);

    const alunos = operacaoPorChave(documento, 'GET /api/alunos');
    expect(alunos.security).toBeUndefined();
  });

  it('mantém a especificação estruturalmente íntegra', () => {
    expect(documento.info.title).toBe('API do BuscApp');
    expect(documento.servers?.length).toBeGreaterThan(0);

    const tagsDeclaradas = new Set((documento.tags ?? []).map((tag) => tag.name));
    for (const item of Object.values(documento.paths ?? {})) {
      for (const metodo of METODOS) {
        const operacao = item?.[metodo];
        for (const tag of operacao?.tags ?? []) {
          expect(tagsDeclaradas.has(tag), `tag não declarada: ${tag}`).toBe(true);
        }
      }
    }

    const refs = new Set<string>();
    coletarRefs(documento, refs);
    expect(refs.size).toBeGreaterThan(0);
    for (const referencia of refs) {
      expect(resolverRef(documento, referencia), `$ref não resolvido: ${referencia}`).toBeTruthy();
    }
  });

  it('mantém a especificação acessível quando o runtime não carrega o Swagger UI', () => {
    const pagina = paginaMinima();
    expect(pagina).toContain('API do BuscApp');
    expect(pagina).toContain('/api/docs/openapi.json');
  });

  it('restringe o unsafe-eval à documentação interativa', () => {
    const api = politicaDeSeguranca('/api/alunos');
    expect(api).toContain("script-src 'self'");
    expect(api).not.toContain('unsafe-eval');
    expect(api).toContain("default-src 'self'");
    expect(api).toContain("frame-ancestors 'none'");

    for (const url of ['/api/docs', '/api/docs/', '/api/docs/openapi.json', '/api/docs?x=1']) {
      const csp = politicaDeSeguranca(url);
      expect(csp, url).toContain("script-src 'self' 'unsafe-eval'");
    }
  });
});
