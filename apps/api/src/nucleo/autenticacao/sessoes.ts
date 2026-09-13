import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import { ambiente, cookieSeguro } from '../../ambiente.js';
import { prisma } from '../banco/cliente.js';
import type { PerfilAutenticado } from './tipos.js';

const DURACAO_PADRAO_MS = 12 * 60 * 60 * 1000;
const DURACAO_LEMBRAR_MS = 30 * 24 * 60 * 60 * 1000;

export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function criarSessao(
  perfilId: string,
  opcoes: { lembrar: boolean; userAgent?: string; ip?: string },
): Promise<{ token: string; expiraEm: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + (opcoes.lembrar ? DURACAO_LEMBRAR_MS : DURACAO_PADRAO_MS));

  await prisma.sessoes.create({
    data: {
      perfil_id: perfilId,
      token_hash: hashDeToken(token),
      expira_em: expiraEm,
      user_agent: opcoes.userAgent ?? null,
      ip: opcoes.ip ?? null,
    },
  });

  return { token, expiraEm };
}

export async function perfilDaSessao(token: string): Promise<PerfilAutenticado | null> {
  const sessao = await prisma.sessoes.findUnique({
    where: { token_hash: hashDeToken(token) },
    include: { perfis: true },
  });

  if (!sessao || sessao.revogada_em || sessao.expira_em <= new Date()) return null;

  const perfil = sessao.perfis;
  if (perfil.status === 'inativo') return null;

  void prisma.sessoes
    .update({ where: { id: sessao.id }, data: { ultimo_uso_em: new Date() } })
    .catch(() => undefined);

  return {
    id: perfil.id,
    nome: perfil.nome,
    email: perfil.email,
    papel: perfil.papel,
    status: perfil.status,
    telefone: perfil.telefone,
    cargo: perfil.cargo,
    notificacoes_ativas: perfil.notificacoes_ativas,
    acesso_modulos: perfil.acesso_modulos,
  };
}

export async function revogarSessao(token: string): Promise<void> {
  await prisma.sessoes.updateMany({
    where: { token_hash: hashDeToken(token), revogada_em: null },
    data: { revogada_em: new Date() },
  });
}

export async function revogarSessoesDoPerfil(perfilId: string): Promise<void> {
  await prisma.sessoes.updateMany({
    where: { perfil_id: perfilId, revogada_em: null },
    data: { revogada_em: new Date() },
  });
}

export function definirCookieSessao(resposta: FastifyReply, token: string, lembrar: boolean): void {
  void resposta.setCookie(ambiente.SESSAO_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: ambiente.COOKIE_SAMESITE,
    secure: cookieSeguro,
    ...(lembrar ? { maxAge: Math.floor(DURACAO_LEMBRAR_MS / 1000) } : {}),
  });
}

export function limparCookieSessao(resposta: FastifyReply): void {
  void resposta.clearCookie(ambiente.SESSAO_COOKIE, { path: '/' });
}
