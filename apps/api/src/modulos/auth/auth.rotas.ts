import {
  erroApiSchema,
  loginSchema,
  perfilAutenticadoSchema,
  redefinirSenhaSchema,
  senhaForte,
  solicitarCodigoSchema,
} from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyRequest } from 'fastify';
import { normalizeIP } from '@fastify/rate-limit';
import { z } from 'zod';
import {
  ErroCodigoInvalido,
  ErroMuitasTentativas,
  redefinirSenhaComCodigo,
  solicitarCodigoRedefinicao,
} from '../../nucleo/autenticacao/codigos.js';
import { autenticarOpcional } from '../../nucleo/autenticacao/middleware.js';
import {
  definirCookieSessao,
  limparCookieSessao,
  revogarSessao,
} from '../../nucleo/autenticacao/sessoes.js';
import { ErroHttp } from '../../nucleo/http/erros.js';
import { ambiente } from '../../ambiente.js';
import {
  autenticar as autenticarServico,
  ErroContaInativa,
  ErroContaPendente,
  ErroCredenciaisInvalidas,
} from './auth.servico.js';

const respostaOkSchema = z.object({ ok: z.literal(true) });

/** Chave do limitador: IP normalizado combinado ao email informado no corpo. */
function chavePorIpEEmail(pedido: FastifyRequest): string {
  const email = String((pedido.body as { email?: unknown } | null)?.email ?? '').toLowerCase();
  return `${normalizeIP(pedido.ip)}|${email}`;
}

export const rotasAuth: FastifyPluginAsyncZod = async (app) => {
  // O login conta apenas tentativas falhas; por isso o limitador é chamado manualmente.
  const limitadorLogin = app.createRateLimit({
    max: 10,
    timeWindow: 60_000,
    keyGenerator: chavePorIpEEmail,
  });

  app.post(
    '/api/auth/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Autentica com email e senha e cria a sessão',
        body: loginSchema,
        response: {
          200: z.object({ perfil: perfilAutenticadoSchema }),
          429: erroApiSchema,
        },
      },
    },
    async (pedido, resposta) => {
      const limite = await limitadorLogin(pedido, { increment: false });
      if (!limite.isAllowed && (limite.isExceeded || limite.remaining <= 0)) {
        return resposta.status(429).send({
          erro: {
            codigo: 'muitas_requisicoes',
            mensagem: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
          },
        });
      }

      try {
        const resultado = await autenticarServico({
          email: pedido.body.email,
          senha: pedido.body.senha,
          lembrar: pedido.body.lembrar,
          userAgent: pedido.headers['user-agent'],
          ip: pedido.ip,
        });

        definirCookieSessao(resposta, resultado.token, pedido.body.lembrar);
        return { perfil: resultado.perfil };
      } catch (erro) {
        if (erro instanceof ErroCredenciaisInvalidas) {
          await limitadorLogin(pedido);
          throw new ErroHttp(401, 'credenciais_invalidas', 'Email ou senha incorretos.');
        }
        if (erro instanceof ErroContaInativa) {
          throw new ErroHttp(403, 'conta_inativa', erro.message);
        }
        if (erro instanceof ErroContaPendente) {
          throw new ErroHttp(403, 'conta_pendente', erro.message);
        }
        throw erro;
      }
    },
  );

  app.post(
    '/api/auth/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Revoga a sessão atual',
        response: { 200: respostaOkSchema },
      },
    },
    async (pedido, resposta) => {
      const token = pedido.cookies[ambiente.SESSAO_COOKIE];
      if (token) await revogarSessao(token);
      limparCookieSessao(resposta);
      return { ok: true as const };
    },
  );

  app.get(
    '/api/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sonda a sessão atual; perfil é null quando não autenticado',
        response: { 200: z.object({ perfil: perfilAutenticadoSchema.nullable() }) },
      },
    },
    async (pedido) => {
      return { perfil: await autenticarOpcional(pedido) };
    },
  );

  app.post(
    '/api/auth/solicitar-codigo',
    {
      config: {
        rateLimit: { max: 3, timeWindow: '5 minutes', keyGenerator: chavePorIpEEmail },
      },
      schema: {
        tags: ['auth'],
        summary: 'Registra a solicitação de código e notifica a gestão',
        body: solicitarCodigoSchema,
        response: { 200: respostaOkSchema },
      },
    },
    async (pedido) => {
      await solicitarCodigoRedefinicao(pedido.body.email);
      return { ok: true as const };
    },
  );

  app.post(
    '/api/auth/redefinir-senha',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '15 minutes', keyGenerator: chavePorIpEEmail },
      },
      schema: {
        tags: ['auth'],
        summary: 'Redefine a senha com código de 6 dígitos',
        body: redefinirSenhaSchema,
        response: { 200: respostaOkSchema },
      },
    },
    async (pedido) => {
      if (!senhaForte(pedido.body.novaSenha)) {
        throw new ErroHttp(
          400,
          'senha_fraca',
          'A senha deve ter ao menos 8 caracteres, com maiúscula, minúscula, número e símbolo.',
        );
      }

      try {
        await redefinirSenhaComCodigo({
          email: pedido.body.email,
          codigo: pedido.body.codigo,
          novaSenha: pedido.body.novaSenha,
          ip: pedido.ip,
        });
        return { ok: true as const };
      } catch (erro) {
        if (erro instanceof ErroMuitasTentativas) {
          throw new ErroHttp(429, 'muitas_tentativas', erro.message);
        }
        if (erro instanceof ErroCodigoInvalido) {
          throw new ErroHttp(400, 'codigo_invalido', erro.message);
        }
        throw erro;
      }
    },
  );
};
