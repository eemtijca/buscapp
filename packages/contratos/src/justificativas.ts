import { z } from 'zod';
import { uuidSchema } from './comuns.js';

/** Fluxo de avaliação da justificativa, espelhando o enum `status_justificativa`. */
export const statusJustificativaSchema = z.enum(['pendente', 'aceita', 'recusada']);

export type StatusJustificativa = z.infer<typeof statusJustificativaSchema>;

/** Referência enxuta de anexo exibida junto da justificativa. */
export const justificativaAnexoSchema = z.object({
  id: uuidSchema,
  nome_arquivo: z.string(),
  mime_type: z.string(),
  storage_path: z.string(),
});

export type JustificativaAnexo = z.infer<typeof justificativaAnexoSchema>;

/** Justificativa de falta retornada pela API; datas civis em `yyyy-mm-dd` e timestamps ISO. */
export const justificativaSchema = z.object({
  id: uuidSchema,
  responsavel_id: uuidSchema,
  aluno_id: uuidSchema,
  frequencia_id: uuidSchema.nullable(),
  data_falta: z.string(),
  data_fim: z.string().nullable(),
  motivo: z.string(),
  status: statusJustificativaSchema,
  avaliado_por: uuidSchema.nullable(),
  avaliado_em: z.string().nullable(),
  parecer: z.string().nullable(),
  aluno: z.object({ id: uuidSchema, nome: z.string() }),
  responsavel: z.object({ id: uuidSchema, nome: z.string() }),
  anexos: z.array(justificativaAnexoSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Justificativa = z.infer<typeof justificativaSchema>;

export const listarJustificativasSchema = z.object({
  status: statusJustificativaSchema.optional(),
  aluno_id: uuidSchema.optional(),
  data_inicio: z.string().date('Data inicial inválida.').optional(),
  data_fim: z.string().date('Data final inválida.').optional(),
});

export type ListarJustificativas = z.infer<typeof listarJustificativasSchema>;

/** Envio do responsável (ou lançamento manual da gestão); anexos já criados via `POST /api/anexos`. */
export const criarJustificativaSchema = z.object({
  aluno_id: uuidSchema,
  data_falta: z.string().date('Data da falta inválida.'),
  data_fim: z
    .preprocess(
      (valor) => (valor === '' || valor === undefined ? undefined : valor),
      z.string().date('Data final inválida.').nullable().optional(),
    )
    .optional(),
  motivo: z.string().trim().min(1, 'Informe o motivo.').max(2000),
  anexo_ids: z.array(uuidSchema).optional(),
});

export type CriarJustificativa = z.infer<typeof criarJustificativaSchema>;

/** Avaliação restrita à gestão; o aceite dispara o trigger que justifica frequências. */
export const avaliarJustificativaSchema = z.object({
  status: z.enum(['aceita', 'recusada']),
});

export type AvaliarJustificativa = z.infer<typeof avaliarJustificativaSchema>;
