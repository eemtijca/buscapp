import { randomUUID } from 'node:crypto';
import type { Anexo } from '@buscapp/contratos';
import type { PerfilAutenticado } from '../../nucleo/autenticacao/tipos.js';
import { podeVerAluno } from '../../nucleo/autorizacao/escopo.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { erroNaoEncontrado } from '../../nucleo/http/erros.js';

interface AnexoBruto {
  id: string;
  storage_path: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
  criado_por: string | null;
  expurgo_em: Date;
  processado_em: Date | null;
  created_at: Date;
}

export function paraAnexo(anexo: AnexoBruto): Anexo {
  return {
    id: anexo.id,
    storage_path: anexo.storage_path,
    nome_arquivo: anexo.nome_arquivo,
    mime_type: anexo.mime_type,
    tamanho_bytes: anexo.tamanho_bytes,
    criado_por: anexo.criado_por,
    expurgo_em: anexo.expurgo_em.toISOString(),
    processado_em: anexo.processado_em?.toISOString() ?? null,
    created_at: anexo.created_at.toISOString(),
  };
}

async function alunoDoAnexo(anexoId: string): Promise<string | null> {
  const justificativa = await prisma.justificativa_anexos.findFirst({
    where: { anexo_id: anexoId },
    select: { justificativa_id: true },
  });
  if (justificativa) {
    const registro = await prisma.justificativas_faltas.findUnique({
      where: { id: justificativa.justificativa_id },
      select: { aluno_id: true },
    });
    return registro?.aluno_id ?? null;
  }

  const ocorrencia = await prisma.ocorrencia_anexos.findFirst({
    where: { anexo_id: anexoId },
    select: { ocorrencia_id: true },
  });
  if (ocorrencia) {
    const registro = await prisma.ocorrencias.findUnique({
      where: { id: ocorrencia.ocorrencia_id },
      select: { aluno_id: true },
    });
    return registro?.aluno_id ?? null;
  }

  return null;
}

/** Autoriza leitura do anexo: gestão tudo; demais apenas se criador ou via aluno visível. */
export async function garantirAcessoAnexo(
  usuario: PerfilAutenticado,
  anexoId: string,
): Promise<AnexoBruto> {
  const anexo = await prisma.anexos.findUnique({ where: { id: anexoId } });
  if (!anexo) throw erroNaoEncontrado('Anexo não encontrado.');

  if (usuario.papel === 'gestao' || anexo.criado_por === usuario.id) return anexo;

  const alunoId = await alunoDoAnexo(anexoId);
  if (alunoId && (await podeVerAluno(usuario, alunoId))) return anexo;

  throw erroNaoEncontrado('Anexo não encontrado.');
}

export function gerarChaveAnexo(usuarioId: string, nomeArquivo: string) {
  return `${usuarioId}/${randomUUID()}-${nomeArquivo}`;
}
