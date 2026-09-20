import type { FastifyRequest } from 'fastify';
import { ambiente } from '../../ambiente.js';
import { contextoBanco } from '../banco/contexto.js';
import { erroNaoAutenticado, erroNaoAutorizado, ErroHttp } from '../http/erros.js';
import { perfilDaSessao } from './sessoes.js';
import type { PerfilAutenticado } from './tipos.js';

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: PerfilAutenticado;
  }
}

/**
 * Resolve a sessão sem exigir autenticação: devolve `null` quando não há cookie válido.
 * Usado pela sonda `GET /api/auth/me`, que não deve falhar para usuários anônimos.
 */
export async function autenticarOpcional(
  pedido: FastifyRequest,
): Promise<PerfilAutenticado | null> {
  const token = pedido.cookies[ambiente.SESSAO_COOKIE];
  if (!token) return null;

  const perfil = await perfilDaSessao(token);
  if (!perfil) return null;

  const contexto = contextoBanco.getStore();
  if (contexto) contexto.usuarioId = perfil.id;

  pedido.usuario = perfil;
  return perfil;
}

/** PreHandler de rotas autenticadas: valida a sessão, o status da conta e carrega o perfil. */
export async function autenticar(pedido: FastifyRequest): Promise<void> {
  const perfil = await autenticarOpcional(pedido);
  if (!perfil) throw erroNaoAutenticado();

  // Sessão de conta pendente ou inativa não acessa rotas privadas, mesmo com cookie válido.
  if (perfil.status !== 'ativo') {
    if (perfil.status === 'pendente') {
      throw new ErroHttp(
        403,
        'conta_pendente',
        'Conta pendente de ativação. Use o código de primeiro acesso para definir a senha.',
      );
    }
    throw new ErroHttp(403, 'conta_inativa', 'Conta inativa.');
  }
}

export function usuarioAtual(pedido: FastifyRequest): PerfilAutenticado {
  if (!pedido.usuario) throw erroNaoAutenticado();
  return pedido.usuario;
}

export function exigirPapel(
  ...papeis: PerfilAutenticado['papel'][]
): (pedido: FastifyRequest) => Promise<void> {
  return async (pedido) => {
    const usuario = usuarioAtual(pedido);
    if (!papeis.includes(usuario.papel)) throw erroNaoAutorizado();
    if (usuario.status !== 'ativo') throw erroNaoAutorizado('Conta inativa.');
  };
}

/** Exige um módulo de acesso com semântica fail-closed (lista vazia nega). */
export function exigirModulo(modulo: string): (pedido: FastifyRequest) => Promise<void> {
  return async (pedido) => {
    const usuario = usuarioAtual(pedido);
    if (!usuario.acesso_modulos.includes(modulo)) {
      throw erroNaoAutorizado(`Módulo "${modulo}" não habilitado para o seu perfil.`);
    }
  };
}
