import { existsSync } from 'node:fs';
import path from 'node:path';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { ambiente } from './ambiente.js';
import { ErroHttp } from './nucleo/http/erros.js';
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
import { rotasMonitoramento } from './modulos/monitoramento/monitoramento.rotas.js';
import { rotasNotificacoes } from './modulos/notificacoes/notificacoes.rotas.js';
import { rotasOcorrencias } from './modulos/ocorrencias/ocorrencias.rotas.js';
import { rotasUsuarios } from './modulos/usuarios/usuarios.rotas.js';

/** Monta a aplicação Fastify; exposta separadamente para testes com `inject`. */
export async function construirApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      ambiente.NODE_ENV === 'test'
        ? false
        : {
            level: ambiente.NODE_ENV === 'production' ? 'info' : 'debug',
          },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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

    app.log.error(erro);
    resposta.status(500).send({
      erro: { codigo: 'interno', mensagem: 'Erro interno do servidor.' },
    });
  });

  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  await app.register(rotasSaude);
  await app.register(rotasEventos);
  await app.register(rotasAuth);
  await app.register(rotasAlunos);
  await app.register(rotasUsuarios);
  await app.register(rotasAnexos);
  await app.register(rotasCodigos);
  await app.register(rotasEstrutura);
  await app.register(rotasFrequencias);
  await app.register(rotasOcorrencias);
  await app.register(rotasJustificativas);
  await app.register(rotasChat);
  await app.register(rotasNotificacoes);
  await app.register(rotasConfiguracoes);
  await app.register(rotasMonitoramento);

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

  return app;
}
