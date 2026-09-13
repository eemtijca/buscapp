import { prisma } from '../../nucleo/banco/cliente.js';
import {
  HASH_FALSO,
  gerarHashSenha,
  precisaRehash,
  verificarSenha,
} from '../../nucleo/autenticacao/senhas.js';
import { criarSessao } from '../../nucleo/autenticacao/sessoes.js';
import type { PerfilAutenticado } from '../../nucleo/autenticacao/tipos.js';

export class ErroCredenciaisInvalidas extends Error {
  constructor() {
    super('Email ou senha incorretos.');
    this.name = 'ErroCredenciaisInvalidas';
  }
}

export class ErroContaInativa extends Error {
  constructor() {
    super('Conta desativada. Procure a gestão escolar.');
    this.name = 'ErroContaInativa';
  }
}

interface PerfilBruto {
  id: string;
  nome: string;
  email: string | null;
  papel: 'professor' | 'gestao' | 'responsavel';
  status: 'ativo' | 'pendente' | 'inativo';
  telefone: string | null;
  cargo: string | null;
  notificacoes_ativas: boolean;
  acesso_modulos: string[];
}

export function paraPerfilAutenticado(perfil: PerfilBruto): PerfilAutenticado {
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

export interface DadosLogin {
  email: string;
  senha: string;
  lembrar: boolean;
  userAgent?: string;
  ip?: string;
}

export async function autenticar(dados: DadosLogin) {
  const email = dados.email.toLowerCase();
  const perfil = await prisma.perfis.findUnique({ where: { email } });

  // A verificação roda mesmo sem perfil para equalizar o tempo de resposta.
  const hash = perfil?.senha_hash ?? HASH_FALSO;
  const senhaConfere = await verificarSenha(dados.senha, hash);
  if (!perfil || !perfil.senha_hash || !senhaConfere) throw new ErroCredenciaisInvalidas();
  if (perfil.status === 'inativo') throw new ErroContaInativa();

  if (precisaRehash(perfil.senha_hash)) {
    const novoSenhaHash = await gerarHashSenha(dados.senha);
    await prisma.perfis.update({
      where: { id: perfil.id },
      data: { senha_hash: novoSenhaHash, senha_alterada_em: new Date() },
    });
  }

  await prisma.perfis.update({
    where: { id: perfil.id },
    data: { ultimo_acesso_em: new Date() },
  });

  const sessao = await criarSessao(perfil.id, {
    lembrar: dados.lembrar,
    userAgent: dados.userAgent,
    ip: dados.ip,
  });

  return { perfil: paraPerfilAutenticado(perfil), ...sessao };
}
