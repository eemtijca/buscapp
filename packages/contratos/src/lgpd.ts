import { z } from 'zod';
import { uuidSchema } from './comuns.js';

export const anonimizarAlunoSchema = z.object({
  confirmar: z.literal(true, { message: 'Confirme a anonimização.' }),
});

export type AnonimizarAluno = z.infer<typeof anonimizarAlunoSchema>;

export const anonimizacaoRespostaSchema = z.object({
  ok: z.literal(true),
  anexos_removidos: z.number().int(),
});

const alunoExportadoSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
  matricula: z.string(),
  codigo_inep: z.string().nullable(),
  status: z.string(),
  data_nascimento: z.string().nullable(),
  data_matricula: z.string().nullable(),
  observacoes: z.string().nullable(),
  documentos_recebidos: z.array(z.string()),
  transporte_escolar: z.boolean(),
  alimentacao_diferenciada: z.boolean(),
  necessidades_especiais: z.boolean(),
});

export const exportacaoTitularSchema = z.object({
  gerado_em: z.string(),
  aluno: alunoExportadoSchema,
  responsaveis: z.array(
    z.object({
      id: uuidSchema,
      nome: z.string(),
      email: z.string().nullable(),
      telefone: z.string().nullable(),
      tipo_relacao: z.string(),
      ativo: z.boolean(),
    }),
  ),
  frequencias: z.array(
    z.object({
      data_aula: z.string(),
      periodo: z.string(),
      tipo_registro: z.string(),
      status: z.string(),
      motivos_ausencia: z.array(z.string()),
      deleted_at: z.string().nullable(),
    }),
  ),
  ocorrencias: z.array(
    z.object({
      id: uuidSchema,
      titulo: z.string(),
      descricao: z.string(),
      tipo: z.array(z.string()),
      status: z.string(),
      data_ocorrencia: z.string(),
    }),
  ),
  justificativas: z.array(
    z.object({
      id: uuidSchema,
      data_falta: z.string(),
      data_fim: z.string().nullable(),
      motivo: z.string(),
      status: z.string(),
      parecer: z.string().nullable(),
    }),
  ),
  registros_comportamento: z.array(
    z.object({
      id: uuidSchema,
      data_hora: z.string(),
      observacao: z.string().nullable(),
    }),
  ),
  anexos: z.array(
    z.object({
      id: uuidSchema,
      nome_arquivo: z.string(),
      mime_type: z.string(),
      tamanho_bytes: z.number().int(),
    }),
  ),
});

export type ExportacaoTitular = z.infer<typeof exportacaoTitularSchema>;
