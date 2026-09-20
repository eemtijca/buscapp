import { existsSync } from 'node:fs';
import path from 'node:path';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { ambiente, origensPermitidas } from './ambiente.js';
import { contextoBanco } from './nucleo/banco/contexto.js';
import { registrarCacheHttp } from './nucleo/http/etag.js';
import { ErroHttp } from './nucleo/http/erros.js';
import { encerrarBarramento, iniciarBarramento } from './nucleo/eventos/barramento.js';
import { registrarRequisicao } from './nucleo/http/metricas.js';
import { StoreRateLimitPostgres } from './nucleo/rate-limit/store-postgres.js';
import { rotasEventos } from './nucleo/http/rotas-eventos.js';
import { rotasSaude } from './nucleo/http/rotas-saude.js';
import { rotasAlunos } from './modulos/alunos/alunos.rotas.js';
import { rotasAnexos } from './modulos/anexos/anexos.rotas.js';
import { rotasAuth } from './modulos/auth/auth.rotas.js';
import { rotasChat } from './modulos/chat/chat.rotas.js';
import { rotasCodigos } from './modulos/codigos/codigos.rotas.js';
import { rotasConfiguracoes } from './modulos/configuracoes/configuracoes.rotas.js';
import { rotasEstrutura } from './modulos/estrutura/estrutura.rotas.js';
import { rotasFrequencias } from './modulos/frequencias/frequencias.rotas.js';
import { rotasJustificativas } from './modulos/justificativas/justificativas.rotas.js';
import { rotasNotificacoes } from './modulos/notificacoes/notificacoes.rotas.js';
import { rotasOcorrencias } from './modulos/ocorrencias/ocorrencias.rotas.js';
import { rotasUsuarios } from './modulos/usuarios/usuarios.rotas.js';
import { rotasVinculos } from './modulos/vinculos/vinculos.rotas.js';

/** Código do envelope para erros 4xx gerados pelo próprio Fastify. */
function codigoDoFastify(status: number): string {
  if (status === 413) return 'payload_grande';
  if (status === 415) return 'tipo_nao_suportado';
  if (status === 429) return 'muitas_requisicoes';
  return 'requisicao_invalida';
}

/** Mensagem do envelope para erros 4xx gerados pelo próprio Fastify. */
function mensagemDoFastify(status: number): string {
  if (status === 413) return 'O corpo da requisição excede o limite permitido.';
  if (status === 415) return 'Tipo de conteúdo não suportado.';
  if (status === 429) return 'Muitas requisições. Aguarde e tente novamente.';
  return 'Requisição inválida.';
}

/** Monta a aplicação Fastify; exposta separadamente para testes com `inject`. */
export async function construirApp(): Promise<FastifyInstance> {  const app = Fastify({
    trustProxy: ambiente.TRUST_PROXY,
    // O corpo JSON fica limitado a 1 MB; o multipart de anexos tem limite próprio de 10 MB.
    bodyLimit: 1024 * 1024,
    keepAliveTimeout: 72_000,
    connectionTimeout: 0,
    // Sem timeout de requisição: o SSE permanece aberto e é encerrado pela função ou pelo cliente.
    requestTimeout: 0,
    pluginTimeout: 10_000,
    requestIdHeader: 'x-request-id',
    logger:
      ambiente.NODE_ENV === 'test'
        ? false
        : {
            level: ambiente.NODE_ENV === 'production' ? 'info' : 'debug',
            redact: [
              'req.headers.cookie',
              'req.headers.authorization',
              'res.headers["set-cookie"]',
            ],
          },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registrarCacheHttp(app);

  // Contexto por requisição: o middleware de autenticação preenche `usuarioId`.
  app.addHook('onRequest', (_pedido, _resposta, concluir) => {
    contextoBanco.run({ usuarioId: null, emTransacao: false }, concluir);
  });

  // Defesa em profundidade contra CSRF: métodos mutantes precisam vir de origem autorizada.
  app.addHook('onRequest', async (pedido, resposta) => {
    if (!pedido.url.startsWith('/api/')) return;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(pedido.method)) return;

    const origem = pedido.headers.origin;
    if (!origem || origensPermitidas.includes(origem)) return;

    return resposta.status(403).send({
      erro: { codigo: 'origem_invalida', mensagem: 'Origem não autorizada.' },
    });
  });

  // Identificador de correlação em todas as respostas, útil para rastrear logs.
  app.addHook('onSend', (_pedido, resposta, payload, concluir) => {
    resposta.header('x-request-id', resposta.request.id);
    concluir(null, payload);
  });

  // Métricas mínimas por resposta: volume, erros e latência média.
  app.addHook('onResponse', (pedido, resposta, concluir) => {
    registrarRequisicao(resposta.statusCode, resposta.elapsedTime);
    concluir();
  });

  app.setErrorHandler((erro: FastifyError, _pedido, resposta) => {
    if (erro instanceof ErroHttp) {
      resposta.status(erro.status).send({
        erro: { codigo: erro.codigo, mensagem: erro.message },
      });
      return;
    }

    if (erro.validation) {
      resposta.status(400).send({
        erro: { codigo: 'validacao', mensagem: erro.message },
      });
      return;
    }

    // Erros do próprio Fastify (JSON malformado, corpo grande, tipo não suportado) mantêm o status.
    const status = erro.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      resposta.status(status).send({
        erro: { codigo: codigoDoFastify(status), mensagem: mensagemDoFastify(status) },
      });
      return;
    }

    app.log.error(erro);
    resposta.status(500).send({
      erro: { codigo: 'interno', mensagem: 'Erro interno do servidor.' },
    });
  });

  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        // O upgrade só faz sentido em HTTPS de produção; em desenvolvimento quebraria o localhost.
        ...(ambiente.NODE_ENV === 'production'
          ? { 'upgrade-insecure-requests': [] as string[] }
          : {}),
      },
    },
  });
  await app.register(cors, {
    origin: origensPermitidas,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['ETag'],
    maxAge: 86_400,
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  await app.register(rateLimit, {
    // O limitador é opt-in por rota; apenas autenticação e uploads usam o store.
    global: false,
    hook: 'preHandler',
    store: StoreRateLimitPostgres,
    // Indisponibilidade do store não derruba a API; o erro é registrado e a requisição segue.
    skipOnError: true,
    onExceeded: (pedido) => {
      // Alerta para monitoração: picos de 429 por rota e IP.
      app.log.warn(
        { rota: pedido.url, ip: pedido.ip },
        'Limite de requisições excedido',
      );
    },
    errorResponseBuilder: (_pedido, contexto) => ({
      erro: {
        codigo: 'muitas_requisicoes',
        mensagem: `Muitas requisições. Tente novamente em ${contexto.after}.`,
      },
    }),
  });
  await app.register(rotasSaude);
  await app.register(rotasEventos);
  await app.register(rotasAuth);
  await app.register(rotasAlunos);
  await app.register(rotasUsuarios);
  await app.register(rotasAnexos);
  await app.register(rotasCodigos);
  await app.register(rotasVinculos);
  await app.register(rotasEstrutura);
  await app.register(rotasFrequencias);
  await app.register(rotasOcorrencias);
  await app.register(rotasJustificativas);
  await app.register(rotasChat);
  await app.register(rotasNotificacoes);
  await app.register(rotasConfiguracoes);

  const distWeb = path.resolve(process.cwd(), ambiente.WEB_DIST);
  if (existsSync(path.join(distWeb, 'index.html'))) {
    await app.register(fastifyStatic, { root: distWeb, wildcard: false });
    app.setNotFoundHandler((pedido, resposta) => {
      if (pedido.url.startsWith('/api/')) {
        resposta.status(404).send({
          erro: { codigo: 'nao_encontrado', mensagem: 'Rota não encontrada.' },
        });
        return;
      }
      resposta.sendFile('index.html');
    });
  }

  await iniciarBarramento();
  app.addHook('onClose', async () => {
    await encerrarBarramento();
  });

  return app;
}
