import { randomInt, randomUUID } from 'node:crypto';
import type {
  AtualizarStatusUsuario,
  AtualizarUsuario,
  CriarUsuario,
  ListarUsuarios,
  Usuario,
} from '@buscapp/contratos';
import { gerarCodigoRedefinicao } from '../../nucleo/autenticacao/codigos.js';
import { auditar } from '../../nucleo/auditoria/registrar.js';
import { prismaAdmin } from '../../nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../nucleo/autenticacao/senhas.js';
import { revogarSessoesDoPerfil } from '../../nucleo/autenticacao/sessoes.js';
import { publicarEvento } from '../../nucleo/eventos/barramento.js';
import { ErroHttp, erroNaoEncontrado } from '../../nucleo/http/erros.js';
import {
  atualizarStatusUsuario,
  atualizarUsuario,
  buscarUsuarioPorId,
  listarUsuarios,
} from './usuarios.repositorio.js';

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
  ultimo_acesso_em: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function paraUsuario(perfil: PerfilBruto): Usuario {
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
    ultimo_acesso_em: perfil.ultimo_acesso_em?.toISOString() ?? null,
    created_at: perfil.created_at.toISOString(),
    updated_at: perfil.updated_at.toISOString(),
  };
}

const CLASSES = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghjkmnpqrstuvwxyz',
  '0123456789',
  '!#$%&()*+-./:=?@^_~',
];
const ALFABETO = CLASSES.join('');

/** Senha temporária forte gerada com CSPRNG (o legado usava Math.random). */
export function gerarSenhaTemporaria(): string {
  const caracteres = CLASSES.map((classe) => classe[randomInt(0, classe.length)] as string);
  for (let i = caracteres.length; i < 10; i += 1) {
    caracteres.push(ALFABETO[randomInt(0, ALFABETO.length)] as string);
  }
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j] as string, caracteres[i] as string];
  }
  return caracteres.join('');
}

function traduzirErroBanco(erro: unknown): never {
  const erroTipado = erro as {
    code?: string;
    message?: string;
    cause?: { code?: string };
  };
  const codigoPostgres = erroTipado.cause?.code ?? erroTipado.code;
  const mensagem = erroTipado.message ?? '';

  if (erroTipado.code === 'P2002') {
    throw new ErroHttp(409, 'email_duplicado', 'Este e-mail já está cadastrado no sistema.');
  }
  if (codigoPostgres === '23514' || mensagem.includes('chk_perfis_modulos_catalogo')) {
    throw new ErroHttp(400, 'modulos_invalidos', 'Módulo de acesso inválido para este perfil.');
  }
  throw erro;
}

export async function listar(consulta: ListarUsuarios): Promise<Usuario[]> {
  const perfis = await listarUsuarios(consulta);
  return perfis.map(paraUsuario);
}

export async function obter(id: string): Promise<Usuario> {
  const perfil = await buscarUsuarioPorId(id);
  if (!perfil) throw erroNaoEncontrado('Usuário não encontrado.');
  return paraUsuario(perfil);
}

export interface UsuarioCriado {
  usuario: Usuario;
  codigo: string;
  senha_temporaria: string;
}

export async function criar(dados: CriarUsuario, criadoPor: string): Promise<UsuarioCriado> {
  const email = dados.email.toLowerCase();
  const senhaTemporaria = gerarSenhaTemporaria();
  const id = randomUUID();
  const senhaHash = await gerarHashSenha(senhaTemporaria);

  // Usuário e código são criados na mesma transação: não há estado parcial.
  const resultado = await prismaAdmin
    .$transaction(async (tx) => {
      const perfil = await tx.perfis.create({
        data: {
          id,
          nome: dados.nome,
          email,
          papel: dados.papel,
          status: 'pendente',
          telefone: dados.telefone ?? null,
          cargo: dados.cargo ?? null,
          acesso_modulos: dados.acesso_modulos ?? [],
          senha_hash: senhaHash,
          senha_alterada_em: new Date(),
        },
      });
      const codigo = await gerarCodigoRedefinicao(id, criadoPor, tx);
      return { perfil, codigo };
    })
    .catch((erro: unknown) => traduzirErroBanco(erro));

  publicarEvento({ tabela: 'perfis' });
  await auditar({
    usuarioId: criadoPor,
    acao: 'CRIAR_USUARIO',
    entidade: 'perfis',
    entidadeId: resultado.perfil.id,
    dadosNovos: { email, papel: resultado.perfil.papel, status: resultado.perfil.status },
  });
  return {
    usuario: paraUsuario(resultado.perfil),
    codigo: resultado.codigo,
    senha_temporaria: senhaTemporaria,
  };
}

export async function atualizar(
  id: string,
  dados: AtualizarUsuario,
  atualizadoPor: string,
): Promise<Usuario> {
  const existente = await buscarUsuarioPorId(id);
  if (!existente) throw erroNaoEncontrado('Usuário não encontrado.');

  try {
    const perfil = await atualizarUsuario(
      id,
      dados,
      dados.email !== undefined ? dados.email.toLowerCase() : undefined,
    );
    publicarEvento({ tabela: 'perfis' });
    await auditar({
      usuarioId: atualizadoPor,
      acao: 'ATUALIZAR_USUARIO',
      entidade: 'perfis',
      entidadeId: id,
      dadosAnteriores: {
        nome: existente.nome,
        email: existente.email,
        papel: existente.papel,
        status: existente.status,
        acesso_modulos: existente.acesso_modulos,
        notificacoes_ativas: existente.notificacoes_ativas,
      },
      dadosNovos: dados,
    });
    return paraUsuario(perfil);
  } catch (erro) {
    traduzirErroBanco(erro);
  }
}

export async function atualizarStatus(
  id: string,
  dados: AtualizarStatusUsuario,
  solicitanteId: string,
): Promise<Usuario> {
  const existente = await buscarUsuarioPorId(id);
  if (!existente) throw erroNaoEncontrado('Usuário não encontrado.');
  if (id === solicitanteId && dados.status === 'inativo') {
    throw new ErroHttp(400, 'auto_inativacao', 'Não é possível inativar o próprio usuário.');
  }

  const perfil = await atualizarStatusUsuario(id, dados.status);
  if (dados.status === 'inativo') await revogarSessoesDoPerfil(id);
  publicarEvento({ tabela: 'perfis' });
  await auditar({
    usuarioId: solicitanteId,
    acao: 'ALTERAR_STATUS_USUARIO',
    entidade: 'perfis',
    entidadeId: id,
    dadosAnteriores: { status: existente.status },
    dadosNovos: { status: dados.status },
  });
  return paraUsuario(perfil);
}
