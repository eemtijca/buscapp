import { createHash, randomBytes } from 'node:crypto';
import type { Sessao } from '@buscapp/contratos';
import type { FastifyReply } from 'fastify';
import { ambiente, cookieSeguro } from '../../ambiente.js';
import { prismaAdmin as prisma } from '../banco/cliente.js';
import type { PerfilAutenticado } from './tipos.js';

const DURACAO_PADRAO_MS = 12 * 60 * 60 * 1000;
const DURACAO_LEMBRAR_MS = 30 * 24 * 60 * 60 * 1000;
/** Inatividade máxima antes de exigir novo login. */
const INATIVIDADE_MAXIMA_MS = 2 * 60 * 60 * 1000;
/** Intervalo mínimo entre gravações de `ultimo_uso_em`, para não escrever a cada requisição. */
const INTERVALO_ATUALIZACAO_MS = 5 * 60 * 1000;

export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Nome do cookie de sessão. Em HTTPS usa o prefixo `__Host-`, que exige `Secure`,
 * `Path=/` e ausência de `Domain`; em desenvolvimento mantém o nome simples.
 */
export function nomeCookieSessao(): string {
  return cookieSeguro ? `__Host-${ambiente.SESSAO_COOKIE}` : ambiente.SESSAO_COOKIE;
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

  const agora = Date.now();
  const ultimoUso = sessao.ultimo_uso_em ?? sessao.criado_em;

  if (agora - ultimoUso.getTime() > INATIVIDADE_MAXIMA_MS) {
    await prisma.sessoes
      .update({ where: { id: sessao.id }, data: { revogada_em: new Date() } })
      .catch(() => undefined);
    return null;
  }

  // Atualiza o último uso no máximo a cada intervalo, evitando um UPDATE por requisição.
  if (agora - ultimoUso.getTime() > INTERVALO_ATUALIZACAO_MS) {
    void prisma.sessoes
      .update({ where: { id: sessao.id }, data: { ultimo_uso_em: new Date() } })
      .catch(() => undefined);
  }

  const perfil = sessao.perfis;

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

/** Sessões ativas do perfil, com marcação da sessão atual. */
export async function listarSessoesAtivas(perfilId: string, tokenAtual: string): Promise<Sessao[]> {
  const hashAtual = hashDeToken(tokenAtual);
  const sessoes = await prisma.sessoes.findMany({
    where: { perfil_id: perfilId, revogada_em: null, expira_em: { gt: new Date() } },
    select: {
      id: true,
      token_hash: true,
      criado_em: true,
      ultimo_uso_em: true,
      expira_em: true,
      user_agent: true,
      ip: true,
    },
    orderBy: { criado_em: 'desc' },
  });

  return sessoes.map((sessao) => ({
    id: sessao.id,
    criado_em: sessao.criado_em.toISOString(),
    ultimo_uso_em: sessao.ultimo_uso_em?.toISOString() ?? null,
    expira_em: sessao.expira_em.toISOString(),
    user_agent: sessao.user_agent,
    ip: sessao.ip,
    atual: sessao.token_hash === hashAtual,
  }));
}

/** Revoga todas as sessões do perfil, preservando a sessão atual. */
export async function revogarOutrasSessoes(perfilId: string, tokenAtual: string): Promise<number> {
  const resultado = await prisma.sessoes.updateMany({
    where: { perfil_id: perfilId, revogada_em: null, token_hash: { not: hashDeToken(tokenAtual) } },
    data: { revogada_em: new Date() },
  });
  return resultado.count;
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
  void resposta.setCookie(nomeCookieSessao(), token, {
    path: '/',
    httpOnly: true,
    sameSite: ambiente.COOKIE_SAMESITE,
    secure: cookieSeguro,
    ...(lembrar ? { maxAge: Math.floor(DURACAO_LEMBRAR_MS / 1000) } : {}),
  });
}

export function limparCookieSessao(resposta: FastifyReply): void {
  void resposta.clearCookie(nomeCookieSessao(), { path: '/' });
}
