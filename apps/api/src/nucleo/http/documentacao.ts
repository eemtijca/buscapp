// Documentação interativa da API: a especificação OpenAPI 3.1 é gerada dos
// schemas Zod das rotas e a interface Swagger UI é servida em /api/docs.
import { erroApiSchema } from '@buscapp/contratos';
import swagger from '@fastify/swagger';
import { createJsonSchemaTransform } from 'fastify-type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { OpenAPIV3_1 } from 'openapi-types';
import { z } from 'zod';
import { ambiente } from '../../ambiente.js';

/** Rotas internas do Swagger UI que não entram na especificação publicada. */
const ROTAS_OCULTAS = [
  '/api/docs/',
  '/api/docs/json',
  '/api/docs/yaml',
  '/api/docs/static/index.html',
  '/api/docs/static/swagger-initializer.js',
  '/api/docs/static/*',
] as const;

/** Converte os schemas Zod das rotas em JSON Schema no dialeto do OpenAPI 3.1. */
const transformarEsquema = createJsonSchemaTransform({
  skipList: ROTAS_OCULTAS,
});

/**
 * Operações que dispensam sessão. O restante herda o cookie de sessão declarado
 * em `components.securitySchemes.sessao`.
 */
const OPERACOES_PUBLICAS = new Set([
  'GET /api/saude',
  'GET /api/saude/pronto',
  'GET /api/auth/me',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/auth/solicitar-codigo',
  'POST /api/auth/redefinir-senha',
]);

/** Operações autenticadas pelo segredo do agendador, sem sessão de usuário. */
const OPERACOES_COM_SEGREDO = new Set(['POST /api/tarefas/expurgo']);

/**
 * Operações que não têm erro de requisição documentado: sondas de saúde e a
 * sonda de sessão, que sempre respondem 200.
 */
export const OPERACOES_SEM_ERRO_DOCUMENTADO = [
  'GET /api/saude',
  'GET /api/saude/pronto',
  'GET /api/auth/me',
] as const;

/**
 * Respostas de erro documentadas por operação, na forma `METODO /caminho` com
 * os parâmetros no estilo do Fastify (`:id`). Nenhuma operação fica fora do
 * mapa: a guarda `documentacao.test.ts` reprova rota registrada sem entrada.
 */
const ERROS_POR_OPERACAO: Record<string, readonly number[]> = {
  'GET /api/saude': [],
  'GET /api/saude/pronto': [],
  'GET /api/saude/metricas': [401, 403],
  'GET /api/eventos': [401],

  'POST /api/auth/login': [400, 401, 403, 429],
  'POST /api/auth/logout': [403],
  'GET /api/auth/sessoes': [401],
  'DELETE /api/auth/sessoes': [401, 403],
  'GET /api/auth/me': [],
  'POST /api/auth/solicitar-codigo': [400, 403, 429],
  'POST /api/auth/redefinir-senha': [400, 403, 429],

  'GET /api/usuarios': [400, 401, 403],
  'GET /api/usuarios/:id': [400, 401, 403, 404],
  'POST /api/usuarios': [400, 401, 403, 409],
  'PUT /api/usuarios/:id': [400, 401, 403, 404],
  'PATCH /api/usuarios/:id/status': [400, 401, 403, 404],

  'GET /api/alunos': [400, 401, 403],
  'GET /api/alunos/:id': [400, 401, 403, 404],
  'POST /api/alunos': [400, 401, 403, 409],
  'PUT /api/alunos/:id': [400, 401, 403, 404, 409],

  'GET /api/turmas': [400, 401, 403],
  'POST /api/turmas': [400, 401, 403, 404, 409],
  'PUT /api/turmas/:id': [400, 401, 403, 404, 409],
  'PATCH /api/turmas/:id/status': [400, 401, 403, 404, 409],

  'GET /api/disciplinas': [400, 401, 403],
  'POST /api/disciplinas': [400, 401, 403],
  'PUT /api/disciplinas/:id': [400, 401, 403, 404, 409],
  'PATCH /api/disciplinas/:id/status': [400, 401, 403, 404, 409],

  'GET /api/atribuicoes': [400, 401, 403],
  'POST /api/atribuicoes': [400, 401, 403, 404],
  'PUT /api/atribuicoes/:id': [400, 401, 403, 404],
  'PATCH /api/atribuicoes/:id/status': [400, 401, 403, 404],

  'GET /api/anos-letivos': [401, 403],
  'POST /api/anos-letivos': [400, 401, 403, 409],
  'PUT /api/anos-letivos/:id': [400, 401, 403, 404, 409],
  'POST /api/anos-letivos/:id/ativar': [400, 401, 403, 404, 409],

  'GET /api/enturmacoes': [400, 401, 403],
  'POST /api/enturmacoes': [400, 401, 403, 404, 409],
  'PUT /api/enturmacoes/:id': [400, 401, 403, 404],

  'GET /api/vinculos': [400, 401, 403],
  'POST /api/vinculos': [400, 401, 403, 404, 409],
  'PUT /api/vinculos/:id': [400, 401, 403, 404],

  'POST /api/frequencias/lote': [400, 401, 403],
  'DELETE /api/frequencias/lote': [400, 401, 403],
  'POST /api/frequencias': [400, 401, 403],
  'GET /api/frequencias/resumo': [400, 401, 403],
  'GET /api/frequencias/:id': [400, 401, 403, 404],
  'GET /api/frequencias': [400, 401, 403],

  'GET /api/ocorrencias': [400, 401, 403],
  'GET /api/ocorrencias/:id': [400, 401, 403, 404],
  'POST /api/ocorrencias': [400, 401, 403],
  'PATCH /api/ocorrencias/:id': [400, 401, 403, 404],

  'GET /api/registros-comportamento': [400, 401, 403],
  'POST /api/registros-comportamento': [400, 401, 403],

  'GET /api/justificativas': [400, 401, 403],
  'GET /api/justificativas/:id': [400, 401, 403, 404],
  'POST /api/justificativas': [400, 401, 403],
  'PATCH /api/justificativas/:id': [400, 401, 403, 404, 409],

  'GET /api/conversas': [400, 401, 403],
  'POST /api/conversas': [400, 401, 403, 404],
  'GET /api/conversas/:id/mensagens': [400, 401, 403, 404],
  'POST /api/conversas/:id/mensagens': [400, 401, 403, 404, 409],
  'PATCH /api/conversas/:id/lidas': [400, 401, 403, 404],
  'PATCH /api/conversas/:id': [400, 401, 403, 404],

  'GET /api/notificacoes': [400, 401],
  'PATCH /api/notificacoes/lidas': [401],
  'PATCH /api/notificacoes/conversa/:conversaId/lidas': [400, 401],
  'PATCH /api/notificacoes/:id/lida': [400, 401, 404],
  'DELETE /api/notificacoes': [401],

  'POST /api/anexos/upload': [400, 401, 403, 413, 429],
  'POST /api/anexos/confirmar': [400, 401, 403, 413, 429],
  'POST /api/anexos': [400, 401, 403, 413, 429],
  'GET /api/anexos/:id/arquivo': [400, 401, 403, 404],
  'DELETE /api/anexos/:id': [400, 401, 403, 404],

  'GET /api/configuracoes': [401, 403],
  'GET /api/configuracoes/publicas': [401],
  'PUT /api/configuracoes': [400, 401, 403],
  'GET /api/opcoes': [400, 401],
  'POST /api/opcoes': [400, 401, 403, 409],
  'PUT /api/opcoes/:id': [400, 401, 403, 404, 409],
  'PATCH /api/opcoes/reordenar': [400, 401, 403, 404],
  'DELETE /api/opcoes/:id': [400, 401, 403, 404, 409],
  'GET /api/horarios': [401],
  'POST /api/horarios': [400, 401, 403, 409],
  'PUT /api/horarios/:id': [400, 401, 403, 404, 409],
  'PATCH /api/horarios/:id/status': [400, 401, 403, 404],
  'DELETE /api/horarios/:id': [400, 401, 403, 404],
  'GET /api/tags-comportamento': [400, 401],
  'POST /api/tags-comportamento': [400, 401, 403, 409],
  'PUT /api/tags-comportamento/:id': [400, 401, 403, 404, 409],
  'PATCH /api/tags-comportamento/:id/status': [400, 401, 403, 404],
  'DELETE /api/tags-comportamento/:id': [400, 401, 403, 404, 409],

  'GET /api/auditoria': [400, 401, 403],

  'GET /api/codigos': [400, 401, 403],
  'POST /api/codigos/perfil/:perfilId': [400, 401, 403, 404],
  'PATCH /api/codigos/:id/revogar': [400, 401, 403, 404],
  'POST /api/codigos/limpar': [401, 403],

  'GET /api/lgpd/alunos/:id/exportar': [400, 401, 403, 404],
  'POST /api/lgpd/alunos/:id/anonimizar': [400, 401, 403, 404],

  'POST /api/tarefas/expurgo': [403, 404],
};

/** Operações que a guarda de cobertura deve encontrar na especificação. */
export function operacoesDocumentadas(): string[] {
  return Object.keys(ERROS_POR_OPERACAO);
}

/** Códigos de erro documentados para uma operação, na chave `METODO /caminho`. */
export function errosDocumentados(chave: string): readonly number[] {
  return ERROS_POR_OPERACAO[chave] ?? [];
}

interface ErroDocumentado {
  descricao: string;
  exemplo: { erro: { codigo: string; mensagem: string } };
}

/** Explicação e exemplo de cada erro, com orientação de recuperação. */
const ERROS: Record<number, ErroDocumentado> = {
  400: {
    descricao:
      'Corpo, parâmetros ou consulta inválidos. Confira os campos indicados e repita a chamada.',
    exemplo: { erro: { codigo: 'validacao', mensagem: 'Dados inválidos.' } },
  },
  401: {
    descricao: 'Sessão ausente ou expirada. Faça login para obter um cookie novo.',
    exemplo: { erro: { codigo: 'nao_autenticado', mensagem: 'Sessão inválida ou expirada.' } },
  },
  403: {
    descricao: 'Operação negada: papel sem permissão, módulo desabilitado ou origem não confiável.',
    exemplo: { erro: { codigo: 'nao_autorizado', mensagem: 'Sem permissão para esta ação.' } },
  },
  404: {
    descricao:
      'Registro inexistente ou fora do escopo do perfil, sem revelar a existência do recurso.',
    exemplo: { erro: { codigo: 'nao_encontrado', mensagem: 'Registro não encontrado.' } },
  },
  409: {
    descricao:
      'Conflito com o estado atual do recurso, como duplicidade, uso em outros registros ou avaliação repetida.',
    exemplo: { erro: { codigo: 'conflito', mensagem: 'O recurso está em uso.' } },
  },
  413: {
    descricao: 'Arquivo ou corpo acima do limite permitido. Reduza o conteúdo e tente de novo.',
    exemplo: {
      erro: { codigo: 'arquivo_grande', mensagem: 'O arquivo excede o limite de 10 MB.' },
    },
  },
  429: {
    descricao: 'Muitas requisições na janela. Aguarde o tempo indicado e repita a chamada.',
    exemplo: {
      erro: {
        codigo: 'muitas_requisicoes',
        mensagem: 'Muitas requisições. Aguarde e tente novamente.',
      },
    },
  },
};

/** Descrição padrão para respostas sem comentário declarado na rota. */
const DESCRICAO_DE_RESPOSTA: Record<string, string> = {
  '200': 'Requisição concluída.',
  '201': 'Recurso criado.',
  '204': 'Sem conteúdo.',
  '400': 'Requisição inválida.',
  '401': 'Sessão ausente ou expirada.',
  '403': 'Acesso negado.',
  '404': 'Recurso não encontrado.',
  '409': 'Conflito com o estado atual.',
  '413': 'Conteúdo acima do limite.',
  '415': 'Tipo de conteúdo não suportado.',
  '429': 'Limite de requisições excedido.',
  '500': 'Erro interno do servidor.',
  '503': 'Serviço indisponível.',
};

const METODOS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

type Resposta = OpenAPIV3_1.ResponseObject | OpenAPIV3_1.ReferenceObject;

/** Monta a resposta de erro reutilizável com descrição e exemplo. */
function respostaDeErro(codigo: number): OpenAPIV3_1.ResponseObject {
  const erro = ERROS[codigo];
  return {
    description: erro?.descricao ?? DESCRICAO_DE_RESPOSTA[String(codigo)] ?? 'Erro.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErroApi' },
        ...(erro ? { example: erro.exemplo } : {}),
      },
    },
  };
}

/** Converte o caminho do OpenAPI (`{id}`) para a chave do mapa (`:id`). */
function rotaNoFormatoDaApi(caminho: string): string {
  return caminho.replace(/\{([^}]+)\}/g, ':$1');
}

/**
 * Enriquece o documento com respostas de erro por operação, segurança por rota
 * e as mídias que o schema da rota não descreve (SSE, download e multipart).
 * Roda depois da montagem, então nada disso afeta a validação em tempo real.
 */
function enriquecerDocumento(documento: OpenAPIV3_1.Document): void {
  for (const [caminho, item] of Object.entries(documento.paths ?? {})) {
    if (!item) continue;

    for (const metodo of METODOS) {
      const operacao = item[metodo];
      if (!operacao) continue;

      operacao.responses ??= {};
      const respostas = operacao.responses as Record<string, Resposta>;

      const chave = `${metodo.toUpperCase()} ${rotaNoFormatoDaApi(caminho)}`;
      for (const codigo of ERROS_POR_OPERACAO[chave] ?? []) {
        const status = String(codigo);
        respostas[status] ??= respostaDeErro(codigo);
      }

      for (const [status, resposta] of Object.entries(respostas)) {
        if ('$ref' in resposta) continue;
        // O plugin grava "Default Response" quando a rota não declara descrição.
        if (!resposta.description || resposta.description === 'Default Response') {
          resposta.description = DESCRICAO_DE_RESPOSTA[status] ?? 'Resposta.';
        }
      }

      const chaveNaRota = `${metodo.toUpperCase()} ${caminho}`;
      if (OPERACOES_PUBLICAS.has(chaveNaRota)) {
        operacao.security = [];
      } else if (OPERACOES_COM_SEGREDO.has(chaveNaRota)) {
        operacao.security = [{ segredoAgendador: [] }];
      }

      if (metodo === 'get' && caminho === '/api/eventos') {
        respostas['200'] = {
          description:
            'Stream SSE aberto; cada evento usa `event: invalidar` com o nome da tabela.',
          content: {
            'text/event-stream': {
              schema: {
                type: 'string',
                description:
                  'Eventos separados por linha vazia, no formato `data: {"tabela":"...","escopo":{}}`.',
              },
            },
          },
        };
      }

      if (metodo === 'post' && caminho === '/api/anexos') {
        operacao.requestBody = {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['arquivo'],
                properties: {
                  arquivo: {
                    type: 'string',
                    format: 'binary',
                    description: 'Imagem JPG, PNG ou WEBP, ou PDF, até 10 MB.',
                  },
                },
              },
            },
          },
        };
      }

      if (metodo === 'get' && caminho === '/api/anexos/{id}/arquivo') {
        respostas['200'] = {
          description: 'Conteúdo binário do anexo, com o tipo e o nome originais.',
          content: {
            '*/*': { schema: { type: 'string', format: 'binary' } },
          },
        };
      }
    }
  }
}

/** Componente reutilizável do envelope de erro, derivado do contrato Zod. */
function esquemaDoErroApi(): OpenAPIV3_1.SchemaObject {
  const esquema = z.toJSONSchema(erroApiSchema) as Record<string, unknown>;
  delete esquema.$schema;
  return esquema as unknown as OpenAPIV3_1.SchemaObject;
}

/** Texto de apresentação da API renderizado no topo da interface. */
function descricaoDaApi(): string {
  return [
    'API HTTP do BuscApp para gestão escolar: frequência, ocorrências, justificativas de falta e comunicação entre professores, gestão e responsáveis.',
    '',
    '## Como consumir',
    '',
    '- Base única na mesma origem da aplicação: o "Try it out" reaproveita o cookie de sessão do navegador.',
    '- Autenticação: `POST /api/auth/login` grava o cookie HttpOnly de sessão. Para consumir fora do navegador, repita o cookie nas chamadas seguintes.',
    '- Erros seguem o envelope `{ "erro": { "codigo", "mensagem", "detalhes?" } }`, com exemplo em cada operação.',
    `- Datas civis usam \`yyyy-mm-dd\` e timestamps usam ISO 8601 no fuso ${ambiente.TZ_ESCOLA}.`,
    '- Listagens usam `limite` (1 a 200, padrão 50) e `offset`; o chat usa `cursor`.',
    '- Frequências e mensagens aceitam `client_request_id` para chamadas idempotentes.',
    '- Respostas de sucesso usam `Cache-Control: private, no-store` e ETag para revalidação.',
    '- Login e uploads têm limite de requisições e respondem 429 ao exceder.',
    '',
    '## Documentação',
    '',
    '- [Referência da API, convenções e catálogo de erros](https://github.com/eemtijca/buscapp/blob/main/docs/api.md)',
    '- [Índice para agentes de IA](https://github.com/eemtijca/buscapp/blob/main/apps/web/public/llms.txt)',
  ].join('\n');
}

/** Registra o gerador da especificação; deve vir antes das rotas. */
export async function registrarDocumentacao(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'API do BuscApp',
        summary: 'API de gestão escolar',
        description: descricaoDaApi(),
        version: '0.1.0',
        contact: {
          name: 'BuscApp no GitHub',
          url: 'https://github.com/eemtijca/buscapp',
        },
        license: {
          name: 'MIT',
          url: 'https://github.com/eemtijca/buscapp/blob/main/LICENSE',
        },
      },
      servers: [{ url: '/', description: 'Mesma origem da aplicação.' }],
      externalDocs: {
        url: 'https://github.com/eemtijca/buscapp/blob/main/docs/api.md',
        description: 'Referência da API, convenções e catálogo de erros.',
      },
      tags: [
        { name: 'auth', description: 'Sessão, login e códigos de redefinição de senha.' },
        { name: 'usuarios', description: 'Perfis da equipe, papéis e módulos de acesso.' },
        { name: 'alunos', description: 'Cadastro de alunos e dados complementares.' },
        {
          name: 'estrutura',
          description: 'Turmas, disciplinas, atribuições, anos letivos e enturmações.',
        },
        { name: 'vinculos', description: 'Vínculos entre responsáveis e alunos.' },
        {
          name: 'frequencias',
          description: 'Lançamento e consulta de faltas, com resumo para painéis.',
        },
        { name: 'ocorrencias', description: 'Ocorrências e registros de comportamento.' },
        { name: 'justificativas', description: 'Envio e avaliação de justificativas de falta.' },
        { name: 'chat', description: 'Conversas entre responsáveis, professores e gestão.' },
        { name: 'anexos', description: 'Envio, download e remoção de anexos.' },
        { name: 'notificacoes', description: 'Caixa de notificações do usuário.' },
        {
          name: 'configuracoes',
          description:
            'Parâmetros do sistema, catálogos, horários letivos e tags de comportamento.',
        },
        { name: 'codigos', description: 'Códigos de redefinição de senha geridos pela gestão.' },
        { name: 'auditoria', description: 'Trilha de auditoria das ações sensíveis.' },
        { name: 'lgpd', description: 'Exportação e anonimização de dados pessoais do titular.' },
        { name: 'tarefas', description: 'Rotinas agendadas de retenção e expurgo.' },
        { name: 'saude', description: 'Sondas de disponibilidade e métricas operacionais.' },
        {
          name: 'eventos',
          description: 'Stream SSE de invalidação para atualização em tempo real.',
        },
      ],
      components: {
        securitySchemes: {
          sessao: {
            type: 'apiKey',
            in: 'cookie',
            name: ambiente.SESSAO_COOKIE,
            description:
              'Cookie de sessão HttpOnly gravado por `POST /api/auth/login`. O navegador o envia automaticamente na mesma origem.',
          },
          segredoAgendador: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            description:
              'Segredo do agendador no formato `Bearer <CRON_SECRET>`. Sem CRON_SECRET configurado a rota responde 404.',
          },
        },
        schemas: {
          ErroApi: esquemaDoErroApi(),
        },
      },
      security: [{ sessao: [] }],
    },
    transform: (documento) => {
      // Só rotas da API entram na especificação; o SPA servido pela API fica fora.
      if (!documento.url.startsWith('/api/')) {
        return { schema: { ...documento.schema, hide: true }, url: documento.url };
      }
      return transformarEsquema(documento);
    },
    transformObject: (documento) => {
      const aberto = documento as { openapiObject?: Partial<OpenAPIV3_1.Document> };
      if (aberto.openapiObject) {
        enriquecerDocumento(aberto.openapiObject as OpenAPIV3_1.Document);
      }
      return aberto.openapiObject ?? {};
    },
  });
}

/** Página mínima quando o runtime não carrega o Swagger UI (sem require de ESM). */
export function paginaMinima(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API do BuscApp</title>
  </head>
  <body>
    <h1>API do BuscApp</h1>
    <p>
      A interface interativa não está disponível neste runtime. A especificação OpenAPI está
      publicada em <a href="/api/docs/openapi.json">/api/docs/openapi.json</a> e a referência fica em
      <a href="https://github.com/eemtijca/buscapp/blob/main/docs/api.md">docs/api.md</a>.
    </p>
  </body>
</html>`;
}

/** Registra a interface Swagger UI e a rota direta da especificação. */
export async function registrarInterfaceDocumentacao(app: FastifyInstance): Promise<void> {
  // O Swagger UI depende do @fastify/static (CommonJS), que só é carregado em
  // runtimes com require de módulos ESM. Sem ele, serve a página mínima.
  if (process.features.require_module) {
    const { default: swaggerUi } = await import('@fastify/swagger-ui');
    await app.register(swaggerUi, {
      routePrefix: '/api/docs',
      theme: { title: 'API do BuscApp' },
      uiConfig: {
        deepLinking: true,
        defaultModelsExpandDepth: 1,
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
        withCredentials: true,
      },
    });
  } else {
    app.log.warn(
      'Runtime sem require de módulos ESM: a interface do Swagger UI fica indisponível e a especificação segue em /api/docs/openapi.json.',
    );
    app.get('/api/docs', { schema: { hide: true } }, async (_pedido, resposta) =>
      resposta.type('text/html; charset=utf-8').send(paginaMinima()),
    );
  }

  app.get('/api/docs/openapi.json', { schema: { hide: true } }, async () => app.swagger());
}

const DIRETIVAS_FIXAS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['default-src', ["'self'"]],
  ['script-src', ["'self'"]],
  ['style-src', ["'self'", "'unsafe-inline'"]],
  ['img-src', ["'self'", 'data:', 'blob:']],
  ['font-src', ["'self'"]],
  ['connect-src', ["'self'"]],
  ['object-src', ["'none'"]],
  ['base-uri', ["'self'"]],
  ['form-action', ["'self'"]],
  ['frame-ancestors', ["'none'"]],
];

/**
 * Política de segurança de conteúdo por URL. A documentação interativa recebe
 * `'unsafe-eval'` porque a validação do "Try it out" (ajv) compila o schema em
 * tempo de execução; o restante da API permanece estrito.
 */
export function politicaDeSeguranca(url: string): string {
  const documentacao =
    url === '/api/docs' || url.startsWith('/api/docs/') || url.startsWith('/api/docs?');

  const diretivas = DIRETIVAS_FIXAS.map(([nome, valores]) =>
    nome === 'script-src' && documentacao
      ? `${nome} ${[...valores, "'unsafe-eval'"].join(' ')}`
      : `${nome} ${valores.join(' ')}`,
  );

  if (ambiente.NODE_ENV === 'production') {
    diretivas.push('upgrade-insecure-requests');
  }

  return diretivas.join('; ');
}
