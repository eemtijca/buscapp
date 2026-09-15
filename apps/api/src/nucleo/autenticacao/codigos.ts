import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { ambiente } from '../../ambiente.js';
import { prismaAdmin } from '../banco/cliente.js';
import { gerarHashSenha } from './senhas.js';

export class ErroCodigoInvalido extends Error {
  constructor() {
    super('Código inválido, expirado ou já utilizado.');
    this.name = 'ErroCodigoInvalido';
  }
}

export class ErroMuitasTentativas extends Error {
  constructor() {
    super('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
    this.name = 'ErroMuitasTentativas';
  }
}

export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashCodigo(email: string, codigo: string): string {
  return createHmac('sha256', ambiente.AUTH_PEPPER)
    .update(`${email.toLowerCase()}:${codigo}`)
    .digest('hex');
}

function hashesIguais(a: string, b: string): boolean {
  const primeiro = Buffer.from(a, 'hex');
  const segundo = Buffer.from(b, 'hex');
  return primeiro.length === segundo.length && timingSafeEqual(primeiro, segundo);
}

/** Notifica a gestão ativa sobre uma solicitação, sem revelar se o email existe. */
export async function solicitarCodigoRedefinicao(email: string): Promise<void> {
  const emailNormalizado = email.toLowerCase();
  const perfil = await prismaAdmin.perfis.findUnique({ where: { email: emailNormalizado } });
  if (!perfil || perfil.status === 'inativo') return;

  const gestores = await prismaAdmin.perfis.findMany({
    where: { papel: 'gestao', status: 'ativo' },
    select: { id: true },
  });

  for (const gestor of gestores) {
    const pendente = await prismaAdmin.notificacoes.findFirst({
      where: {
        destinatario_id: gestor.id,
        tipo: 'codigo_redefinicao',
        lida: false,
        metadados: { path: ['perfil_id'], equals: perfil.id },
      },
      select: { id: true },
    });
    if (pendente) continue;

    await prismaAdmin.notificacoes.create({
      data: {
        destinatario_id: gestor.id,
        tipo: 'codigo_redefinicao',
        titulo: 'Solicitação de código de redefinição',
        corpo: `${perfil.nome} solicitou um código de redefinição de senha.`,
        metadados: { perfil_id: perfil.id, email: emailNormalizado },
      },
    });
  }
}

export async function bloqueadoPorTentativas(email: string): Promise<boolean> {
  const registro = await prismaAdmin.codigos_redefinicao_tentativas.findUnique({
    where: { email: email.toLowerCase() },
  });
  return Boolean(registro?.bloqueado_ate && registro.bloqueado_ate > new Date());
}

/** Registra uma tentativa falha; retorna `true` quando o email passou a ficar bloqueado. */
export async function registrarTentativa(email: string): Promise<boolean> {
  const emailNormalizado = email.toLowerCase();
  const config = await prismaAdmin.configuracoes_sistema.findUnique({ where: { id: 1 } });
  const maximo = config?.max_tentativas_codigo ?? 5;
  const minutos = config?.minutos_bloqueio_codigo ?? 15;

  return prismaAdmin.$transaction(async (tx) => {
    const registro = await tx.codigos_redefinicao_tentativas.upsert({
      where: { email: emailNormalizado },
      create: { email: emailNormalizado, tentativas: 1 },
      update: { tentativas: { increment: 1 }, updated_at: new Date() },
    });

    if (registro.bloqueado_ate && registro.bloqueado_ate > new Date()) return true;

    if (registro.tentativas >= maximo) {
      await tx.codigos_redefinicao_tentativas.update({
        where: { email: emailNormalizado },
        data: {
          tentativas: 0,
          bloqueado_ate: new Date(Date.now() + minutos * 60 * 1000),
          updated_at: new Date(),
        },
      });
      return true;
    }

    return false;
  });
}

export async function limparTentativas(email: string): Promise<void> {
  await prismaAdmin.codigos_redefinicao_tentativas.deleteMany({
    where: { email: email.toLowerCase() },
  });
}

/** Gera e persiste um código (apenas HMAC) para o perfil informado. */
export async function gerarCodigoRedefinicao(
  perfilId: string,
  criadoPor?: string,
): Promise<string> {
  const perfil = await prismaAdmin.perfis.findUnique({ where: { id: perfilId } });
  if (!perfil?.email) throw new Error('Perfil sem email não pode receber código de redefinição.');

  const email = perfil.email.toLowerCase();
  const config = await prismaAdmin.configuracoes_sistema.findUnique({ where: { id: 1 } });
  const validadeMinutos = config?.minutos_validade_codigo ?? 60;
  const agora = new Date();

  await prismaAdmin.codigos_redefinicao.updateMany({
    where: { email, usado_em: null, revogado_em: null, expira_em: { gt: agora } },
    data: { revogado_em: agora, expira_em: agora },
  });

  const codigo = gerarCodigo();
  await prismaAdmin.codigos_redefinicao.create({
    data: {
      email,
      perfil_id: perfil.id,
      codigo_hash: hashCodigo(email, codigo),
      criado_por: criadoPor ?? null,
      expira_em: new Date(agora.getTime() + validadeMinutos * 60 * 1000),
    },
  });

  return codigo;
}

export interface DadosRedefinicao {
  email: string;
  codigo: string;
  novaSenha: string;
  ip?: string;
}

export async function redefinirSenhaComCodigo(dados: DadosRedefinicao): Promise<void> {
  const email = dados.email.toLowerCase();

  if (await bloqueadoPorTentativas(email)) throw new ErroMuitasTentativas();

  const perfil = await prismaAdmin.perfis.findUnique({ where: { email } });
  const registro = await prismaAdmin.codigos_redefinicao.findFirst({
    where: {
      email,
      usado_em: null,
      revogado_em: null,
      expira_em: { gt: new Date() },
      codigo_hash: { not: null },
    },
    orderBy: { created_at: 'desc' },
  });

  const hashEsperado = hashCodigo(email, dados.codigo);
  if (!perfil || !registro?.codigo_hash || !hashesIguais(registro.codigo_hash, hashEsperado)) {
    await registrarTentativa(email);
    throw new ErroCodigoInvalido();
  }

  const consumido = await prismaAdmin.codigos_redefinicao.updateMany({
    where: { id: registro.id, usado_em: null },
    data: { usado_em: new Date() },
  });
  if (consumido.count !== 1) throw new ErroCodigoInvalido();

  const senhaHash = await gerarHashSenha(dados.novaSenha);
  const agora = new Date();

  await prismaAdmin.$transaction(async (tx) => {
    await tx.perfis.update({
      where: { id: perfil.id },
      data: {
        senha_hash: senhaHash,
        senha_alterada_em: agora,
        status: perfil.status === 'pendente' ? 'ativo' : perfil.status,
      },
    });
    await tx.sessoes.updateMany({
      where: { perfil_id: perfil.id, revogada_em: null },
      data: { revogada_em: agora },
    });
    await tx.codigos_redefinicao_tentativas.deleteMany({ where: { email } });
    await tx.auditoria.create({
      data: {
        usuario_id: perfil.id,
        acao: 'USAR_CODIGO',
        entidade: 'perfis',
        entidade_id: perfil.id,
        ip_origem: dados.ip ?? null,
        dados_novos: { via: 'api' },
      },
    });
  });
}
