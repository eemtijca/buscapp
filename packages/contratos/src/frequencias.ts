import { z } from 'zod';
import { paginacaoSchema, uuidSchema } from './comuns.js';

/** Formas de coleta da frequência: chamada da aula, entrada pelo portão e saída. */
export const tipoRegistroFrequenciaSchema = z.enum(['chamada_aula', 'entrada_portao', 'saida']);

export type TipoRegistroFrequencia = z.infer<typeof tipoRegistroFrequenciaSchema>;

export const statusFrequenciaSchema = z.enum(['presente', 'ausente', 'justificado']);

export type StatusFrequencia = z.infer<typeof statusFrequenciaSchema>;

/** Registro de frequência retornado pela API; datas civis em `yyyy-mm-dd` e timestamps ISO. */
export const frequenciaSchema = z.object({
  id: uuidSchema,
  aluno_id: uuidSchema,
  professor_id: uuidSchema,
  turma_id: uuidSchema,
  disciplina_id: uuidSchema.nullable(),
  ano_letivo_id: uuidSchema,
  data_aula: z.string(),
  tipo_registro: tipoRegistroFrequenciaSchema,
  periodo: z.string(),
  status: statusFrequenciaSchema,
  observacao: z.string().nullable(),
  motivos_ausencia: z.array(z.string()),
  client_request_id: uuidSchema.nullable(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Frequencia = z.infer<typeof frequenciaSchema>;

export const ausenciaLoteSchema = z.object({
  aluno_id: uuidSchema,
  observacao: z.string().trim().max(2000).nullable().optional(),
  motivos_ausencia: z.array(z.string().trim().min(1)).optional(),
});

export type AusenciaLote = z.infer<typeof ausenciaLoteSchema>;

/** Chamada por exceção: envia apenas os ausentes da turma em um período. */
export const registrarLoteFrequenciaSchema = z.object({
  turma_id: uuidSchema,
  data_aula: z.string().date(),
  periodo: z.string().trim().min(1).max(80),
  tipo_registro: tipoRegistroFrequenciaSchema,
  ausentes: z.array(ausenciaLoteSchema),
  client_request_id: uuidSchema,
});

export type RegistrarLoteFrequencia = z.infer<typeof registrarLoteFrequenciaSchema>;

/** Desfaz a chamada lançada para a turma, data, período e tipo informados. */
export const removerLoteFrequenciaSchema = z.object({
  turma_id: uuidSchema,
  data_aula: z.string().date(),
  periodo: z.string().trim().min(1).max(80),
  tipo_registro: tipoRegistroFrequenciaSchema,
});

export type RemoverLoteFrequencia = z.infer<typeof removerLoteFrequenciaSchema>;

/** Registro individual de ausência em um período (FrequenciaView/AusenciaView). */
export const criarFrequenciaSchema = z.object({
  aluno_id: uuidSchema,
  data_aula: z.string().date(),
  periodo: z.string().trim().min(1).max(80),
  observacao: z.string().trim().max(2000).nullable().optional(),
  motivos_ausencia: z.array(z.string().trim().min(1)).optional(),
  tipo_registro: tipoRegistroFrequenciaSchema.default('chamada_aula'),
  client_request_id: uuidSchema.nullable().optional(),
});

export type CriarFrequencia = z.infer<typeof criarFrequenciaSchema>;

/** Aceita um único valor ou repetição da chave e normaliza para lista. */
const listaDeUuIdsSchema = z.preprocess(
  (valor) => (valor === undefined ? undefined : Array.isArray(valor) ? valor : [valor]),
  z.array(uuidSchema).optional(),
);

export const listarFrequenciasSchema = z.object({
  aluno_id: uuidSchema.optional(),
  aluno_ids: listaDeUuIdsSchema,
  turma_id: uuidSchema.optional(),
  data_aula: z.string().date().optional(),
  data_inicio: z.string().date().optional(),
  data_fim: z.string().date().optional(),
  periodo: z.string().trim().min(1).max(80).optional(),
  status: statusFrequenciaSchema.optional(),
  tipo_registro: tipoRegistroFrequenciaSchema.optional(),
  incluir_deletadas: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((valor) => valor === true || valor === 'true'),
  ...paginacaoSchema.shape,
});

export type ListarFrequencias = z.infer<typeof listarFrequenciasSchema>;

export const registroResumoFrequenciaSchema = z.object({
  aluno_id: uuidSchema,
  data_aula: z.string(),
  periodo: z.string(),
  status: statusFrequenciaSchema,
  motivos_ausencia: z.array(z.string()),
});

export type RegistroResumoFrequencia = z.infer<typeof registroResumoFrequenciaSchema>;

export const resumoAlunoFrequenciaSchema = z.object({
  aluno_id: uuidSchema,
  total_ausentes: z.number().int(),
  total_justificados: z.number().int(),
  registros: z.array(registroResumoFrequenciaSchema),
});

export type ResumoAlunoFrequencia = z.infer<typeof resumoAlunoFrequenciaSchema>;

export const resumirFrequenciasSchema = z.object({
  aluno_ids: listaDeUuIdsSchema,
  data_inicio: z.string().date().optional(),
  data_fim: z.string().date().optional(),
});

export type ResumirFrequencias = z.infer<typeof resumirFrequenciasSchema>;
