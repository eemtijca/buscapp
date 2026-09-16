import type { CodigoRedefinicao } from '@buscapp/contratos';
import { gerarCodigoRedefinicao } from '../../nucleo/autenticacao/codigos.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { publicarEvento } from '../../nucleo/eventos/barramento.js';
import { erroNaoEncontrado } from '../../nucleo/http/erros.js';
import {
  buscarCodigo,
  codigoGeradoParaAuditoria,
  limparCodigosNaoAtivos,
  listarCodigos,
  paraCodigo,
  revogarCodigo,
} from './codigos.repositorio.js';

export async function listar(): Promise<CodigoRedefinicao[]> {
  const agora = new Date();
  const [codigos, tentativas] = await Promise.all([
    listarCodigos(),
    prisma.codigos_redefinicao_tentativas.findMany({
      where: { bloqueado_ate: { gt: agora } },
      select: { email: true },
    }),
  ]);

  const bloqueados = new Set(tentativas.map((tentativa) => tentativa.email));
  return codigos.map((codigo) => paraCodigo(codigo, agora, bloqueados.has(codigo.email)));
}

export async function gerar(perfilId: string, criadoPor: string): Promise<string> {
  const codigo = await gerarCodigoRedefinicao(perfilId, criadoPor);
  await codigoGeradoParaAuditoria(perfilId, criadoPor);
  publicarEvento({ tabela: 'codigos_redefinicao' });
  return codigo;
}

export async function revogar(id: string, usuarioId: string): Promise<CodigoRedefinicao> {
  const existente = await buscarCodigo(id);
  if (!existente) throw erroNaoEncontrado('Código não encontrado.');
  await revogarCodigo(id, usuarioId);
  const atualizado = await buscarCodigo(id);
  publicarEvento({ tabela: 'codigos_redefinicao' });
  return paraCodigo(atualizado!, new Date());
}

export async function limpar(usuarioId: string): Promise<number> {
  const removidos = await limparCodigosNaoAtivos(usuarioId);
  publicarEvento({ tabela: 'codigos_redefinicao' });
  return removidos;
}
