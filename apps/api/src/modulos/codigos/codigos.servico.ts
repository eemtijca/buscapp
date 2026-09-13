import type { CodigoRedefinicao } from '@buscapp/contratos';
import { gerarCodigoRedefinicao } from '../../nucleo/autenticacao/codigos.js';
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
  const codigos = await listarCodigos();
  const agora = new Date();
  return codigos.map((codigo) => paraCodigo(codigo, agora));
}

export async function gerar(perfilId: string, criadoPor: string): Promise<string> {
  const codigo = await gerarCodigoRedefinicao(perfilId, criadoPor);
  await codigoGeradoParaAuditoria(perfilId, criadoPor);
  return codigo;
}

export async function revogar(id: string, usuarioId: string): Promise<CodigoRedefinicao> {
  const existente = await buscarCodigo(id);
  if (!existente) throw erroNaoEncontrado('Código não encontrado.');
  await revogarCodigo(id, usuarioId);
  const atualizado = await buscarCodigo(id);
  return paraCodigo(atualizado!, new Date());
}

export async function limpar(usuarioId: string): Promise<number> {
  return limparCodigosNaoAtivos(usuarioId);
}
