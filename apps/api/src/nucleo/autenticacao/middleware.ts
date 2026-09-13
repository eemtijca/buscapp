import type { FastifyRequest } from 'fastify';
import { ambiente } from '../../ambiente.js';
import { erroNaoAutenticado, erroNaoAutorizado } from '../http/erros.js';
import { perfilDaSessao } from './sessoes.js';
import type { PerfilAutenticado } from './tipos.js';

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: PerfilAutenticado;
  }
}

/** PreHandler de rotas autenticadas: valida a sessão e carrega o perfil. */
export async function autenticar(pedido: FastifyRequest): Promise<void> {
  const token = pedido.cookies[ambiente.SESSAO_COOKIE];
  if (!token) throw erroNaoAutenticado();

  const perfil = await perfilDaSessao(token);
  if (!perfil) throw erroNaoAutenticado();

  pedido.usuario = perfil;
}

export function usuarioAtual(pedido: FastifyRequest): PerfilAutenticado {
  if (!pedido.usuario) throw erroNaoAutenticado();
  return pedido.usuario;
}

export function exigirPapel(pedido: FastifyRequest, ...papeis: PerfilAutenticado['papel'][]): void {
  const usuario = usuarioAtual(pedido);
  if (!papeis.includes(usuario.papel)) throw erroNaoAutorizado();
  if (usuario.status !== 'ativo') throw erroNaoAutorizado('Conta inativa.');
}

/** Exige um módulo de acesso com semântica fail-closed (lista vazia nega). */
export function exigirModulo(pedido: FastifyRequest, modulo: string): void {
  const usuario = usuarioAtual(pedido);
  if (!usuario.acesso_modulos.includes(modulo)) {
    throw erroNaoAutorizado(`Módulo "${modulo}" não habilitado para o seu perfil.`);
  }
}
