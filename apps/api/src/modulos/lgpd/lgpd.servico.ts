import type { ExportacaoTitular } from '@buscapp/contratos';
import { armazenamento } from '../../nucleo/armazenamento/index.js';
import { auditar } from '../../nucleo/auditoria/registrar.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { erroNaoEncontrado } from '../../nucleo/http/erros.js';

/** Data civil `yyyy-mm-dd` a partir de uma coluna `date`. */
function dataCivil(data: Date | null): string | null {
  return data ? data.toISOString().slice(0, 10) : null;
}

/** Pacote de dados do titular (aluno), para atender ao direito de acesso. */
export async function exportarTitular(alunoId: string): Promise<ExportacaoTitular> {
  const aluno = await prisma.alunos.findUnique({ where: { id: alunoId } });
  if (!aluno) throw erroNaoEncontrado('Aluno não encontrado.');

  const [vinculos, frequencias, ocorrencias, justificativas, registros] = await Promise.all([
    prisma.vinculos_responsaveis.findMany({
      where: { aluno_id: alunoId },
      include: { perfis: { select: { id: true, nome: true, email: true, telefone: true } } },
    }),
    prisma.frequencias.findMany({ where: { aluno_id: alunoId }, orderBy: { data_aula: 'asc' } }),
    prisma.ocorrencias.findMany({
      where: { aluno_id: alunoId },
      orderBy: { data_ocorrencia: 'asc' },
    }),
    prisma.justificativas_faltas.findMany({
      where: { aluno_id: alunoId },
      orderBy: { data_falta: 'asc' },
    }),
    prisma.registros_comportamento.findMany({
      where: { aluno_id: alunoId },
      orderBy: { data_hora: 'asc' },
    }),
  ]);

  const justificativaIds = justificativas.map((justificativa) => justificativa.id);
  const ocorrenciaIds = ocorrencias.map((ocorrencia) => ocorrencia.id);
  const [vinculosJustificativa, vinculosOcorrencia] = await Promise.all([
    prisma.justificativa_anexos.findMany({
      where: { justificativa_id: { in: justificativaIds } },
      select: { anexo_id: true },
    }),
    prisma.ocorrencia_anexos.findMany({
      where: { ocorrencia_id: { in: ocorrenciaIds } },
      select: { anexo_id: true },
    }),
  ]);

  const anexoIds = [
    ...new Set([
      ...vinculosJustificativa.map((vinculo) => vinculo.anexo_id),
      ...vinculosOcorrencia.map((vinculo) => vinculo.anexo_id),
    ]),
  ];
  const anexos = anexoIds.length
    ? await prisma.anexos.findMany({ where: { id: { in: anexoIds } } })
    : [];

  return {
    gerado_em: new Date().toISOString(),
    aluno: {
      id: aluno.id,
      nome: aluno.nome,
      matricula: aluno.matricula,
      codigo_inep: aluno.codigo_inep,
      status: aluno.status,
      data_nascimento: dataCivil(aluno.data_nascimento),
      data_matricula: dataCivil(aluno.data_matricula),
      observacoes: aluno.observacoes,
      documentos_recebidos: aluno.documentos_recebidos,
      transporte_escolar: aluno.transporte_escolar,
      alimentacao_diferenciada: aluno.alimentacao_diferenciada,
      necessidades_especiais: aluno.necessidades_especiais,
    },
    responsaveis: vinculos.map((vinculo) => ({
      id: vinculo.perfis.id,
      nome: vinculo.perfis.nome,
      email: vinculo.perfis.email,
      telefone: vinculo.perfis.telefone,
      tipo_relacao: vinculo.tipo_relacao,
      ativo: vinculo.ativo,
    })),
    frequencias: frequencias.map((frequencia) => ({
      data_aula: dataCivil(frequencia.data_aula) as string,
      periodo: frequencia.periodo,
      tipo_registro: frequencia.tipo_registro,
      status: frequencia.status,
      motivos_ausencia: frequencia.motivos_ausencia,
      deleted_at: frequencia.deleted_at?.toISOString() ?? null,
    })),
    ocorrencias: ocorrencias.map((ocorrencia) => ({
      id: ocorrencia.id,
      titulo: ocorrencia.titulo,
      descricao: ocorrencia.descricao,
      tipo: ocorrencia.tipo,
      status: ocorrencia.status,
      data_ocorrencia: ocorrencia.data_ocorrencia.toISOString(),
    })),
    justificativas: justificativas.map((justificativa) => ({
      id: justificativa.id,
      data_falta: dataCivil(justificativa.data_falta) as string,
      data_fim: dataCivil(justificativa.data_fim),
      motivo: justificativa.motivo,
      status: justificativa.status,
      parecer: justificativa.parecer,
    })),
    registros_comportamento: registros.map((registro) => ({
      id: registro.id,
      data_hora: registro.data_hora.toISOString(),
      observacao: registro.observacao,
    })),
    anexos: anexos.map((anexo) => ({
      id: anexo.id,
      nome_arquivo: anexo.nome_arquivo,
      mime_type: anexo.mime_type,
      tamanho_bytes: anexo.tamanho_bytes,
    })),
  };
}

export interface ResultadoAnonimizacao {
  anexosRemovidos: number;
}

/**
 * Anonimiza os dados pessoais do aluno e remove os anexos vinculados,
 * preservando frequências e agregados para estatística. Ação irreversível.
 */
export async function anonimizarTitular(
  alunoId: string,
  solicitanteId: string,
  ip?: string,
): Promise<ResultadoAnonimizacao> {
  const aluno = await prisma.alunos.findUnique({ where: { id: alunoId } });
  if (!aluno) throw erroNaoEncontrado('Aluno não encontrado.');

  const justificativas = await prisma.justificativas_faltas.findMany({
    where: { aluno_id: alunoId },
    select: { id: true },
  });
  const ocorrencias = await prisma.ocorrencias.findMany({
    where: { aluno_id: alunoId },
    select: { id: true },
  });

  const [vinculosJustificativa, vinculosOcorrencia] = await Promise.all([
    prisma.justificativa_anexos.findMany({
      where: { justificativa_id: { in: justificativas.map((item) => item.id) } },
      select: { anexo_id: true },
    }),
    prisma.ocorrencia_anexos.findMany({
      where: { ocorrencia_id: { in: ocorrencias.map((item) => item.id) } },
      select: { anexo_id: true },
    }),
  ]);

  const anexoIds = [
    ...new Set([
      ...vinculosJustificativa.map((vinculo) => vinculo.anexo_id),
      ...vinculosOcorrencia.map((vinculo) => vinculo.anexo_id),
    ]),
  ];
  const anexos = anexoIds.length
    ? await prisma.anexos.findMany({ where: { id: { in: anexoIds } } })
    : [];

  for (const anexo of anexos) {
    await armazenamento()
      .remover(anexo.storage_path)
      .catch(() => undefined);
  }

  await prisma.$transaction([
    prisma.anexos.deleteMany({ where: { id: { in: anexoIds } } }),
    prisma.alunos.update({
      where: { id: alunoId },
      data: {
        nome: 'Aluno anonimizado',
        matricula: `anonimizado-${alunoId}`,
        codigo_inep: null,
        observacoes: null,
        data_nascimento: null,
        documentos_recebidos: [],
        transporte_escolar: false,
        alimentacao_diferenciada: false,
        necessidades_especiais: false,
        status: 'inativo',
      },
    }),
    prisma.justificativas_faltas.updateMany({
      where: { aluno_id: alunoId },
      data: { motivo: '[anonimizado]', parecer: null },
    }),
    prisma.ocorrencias.updateMany({
      where: { aluno_id: alunoId },
      data: { titulo: '[anonimizado]', descricao: '[anonimizado]' },
    }),
    prisma.registros_comportamento.updateMany({
      where: { aluno_id: alunoId },
      data: { observacao: null },
    }),
  ]);

  await auditar({
    usuarioId: solicitanteId,
    acao: 'ANONIMIZAR_ALUNO',
    entidade: 'alunos',
    entidadeId: alunoId,
    dadosAnteriores: { nome: aluno.nome, matricula: aluno.matricula },
    dadosNovos: { anexos_removidos: anexos.length },
    ip,
  });

  return { anexosRemovidos: anexos.length };
}
