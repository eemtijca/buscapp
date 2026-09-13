import { z } from 'zod';
import { uuidSchema } from './comuns.js';

/** Status possíveis de uma ocorrência, espelhando o enum `status_ocorrencia` do banco. */
export const statusOcorrenciaSchema = z.enum(['aberta', 'em_andamento', 'resolvida', 'arquivada']);
export type StatusOcorrencia = z.infer<typeof statusOcorrenciaSchema>;

/** Categorias do catálogo de tags de comportamento. */
export const categoriaTagComportamentoSchema = z.enum(['positivo', 'atencao', 'critico']);

/** Resumo de uma tag do catálogo de comportamento usada em ocorrências e registros. */
export const tagComportamentoSchema = z.object({
  nome: z.string(),
  categoria: categoriaTagComportamentoSchema,
  icone: z.string().nullable(),
  descricao: z.string().nullable(),
});
export type TagComportamento = z.infer<typeof tagComportamentoSchema>;

/** Referência enxuta de aluno usada nos joins de ocorrências e registros. */
export const alunoResumoSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
});

/** Referência enxuta do professor/registrante usada nos joins. */
export const professorResumoSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
});

export const ocorrenciaSchema = z.object({
  id: uuidSchema,
  aluno_id: uuidSchema,
  aluno: alunoResumoSchema,
  professor_id: uuidSchema.nullable(),
  professor: professorResumoSchema.nullable(),
  turma_id: uuidSchema,
  ano_letivo_id: uuidSchema,
  titulo: z.string(),
  descricao: z.string(),
  tipo: z.array(z.string()),
  status: statusOcorrenciaSchema,
  exige_presenca_responsavel: z.boolean(),
  presenca_responsavel_confirmada: z.boolean(),
  data_confirmacao_presenca: z.string().nullable(),
  data_ocorrencia: z.string(),
  closed_at: z.string().nullable(),
  tags_comportamento: z.array(z.string()),
  lista_tags: z.array(tagComportamentoSchema),
  notificar_coordenacao: z.boolean(),
  notificar_responsavel: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Ocorrencia = z.infer<typeof ocorrenciaSchema>;

/** Query string aceita booleanos textuais; o serviço recebe já convertido. */
const booleanoQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((valor) => valor === true || valor === 'true' || valor === '1');

const listaTextoQuerySchema = z.union([
  z.string().trim().min(1),
  z.array(z.string().trim().min(1)),
]);

export const listarOcorrenciasSchema = z.object({
  aluno_id: uuidSchema.optional(),
  status: statusOcorrenciaSchema.optional(),
  tipo: listaTextoQuerySchema.optional(),
  exige_presenca_pendente: booleanoQuerySchema.optional(),
});
export type ListarOcorrencias = z.infer<typeof listarOcorrenciasSchema>;

export const criarOcorrenciaSchema = z.object({
  aluno_id: uuidSchema,
  titulo: z.string().trim().min(1).max(150).optional(),
  descricao: z
    .string()
    .trim()
    .min(10, 'Descreva a ocorrência com pelo menos 10 caracteres.')
    .max(2000),
  tipo: z.array(z.string().trim().min(1)).min(1, 'Informe ao menos um tipo de ocorrência.'),
  exige_presenca_responsavel: z.boolean().optional().default(false),
  tags_comportamento: z.array(z.string().trim().min(1)).optional(),
  notificar_coordenacao: z.boolean().optional().default(true),
  notificar_responsavel: z.boolean().optional().default(false),
  turma_id: uuidSchema.optional(),
});
export type CriarOcorrencia = z.infer<typeof criarOcorrenciaSchema>;

export const atualizarOcorrenciaSchema = z
  .object({
    exige_presenca_responsavel: z.boolean().optional(),
    status: statusOcorrenciaSchema.optional(),
    presenca_responsavel_confirmada: z.boolean().optional(),
  })
  .refine((dados) => Object.values(dados).some((valor) => valor !== undefined), {
    message: 'Informe ao menos um campo para atualização.',
  });
export type AtualizarOcorrencia = z.infer<typeof atualizarOcorrenciaSchema>;

/** Registro positivo/negativo de comportamento associado a um aluno. */
export const registroComportamentoSchema = z.object({
  id: uuidSchema,
  aluno_id: uuidSchema,
  aluno: alunoResumoSchema,
  professor_id: uuidSchema,
  professor: professorResumoSchema.nullable(),
  turma_id: uuidSchema,
  ano_letivo_id: uuidSchema,
  data_hora: z.string(),
  descricao: z.string().nullable(),
  tags: z.array(tagComportamentoSchema),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RegistroComportamento = z.infer<typeof registroComportamentoSchema>;

export const criarRegistroComportamentoSchema = z.object({
  aluno_id: uuidSchema,
  descricao: z.string().trim().min(1, 'Informe a descrição.').max(2000),
  tags: z.array(z.string().trim().min(1)).optional(),
});
export type CriarRegistroComportamento = z.infer<typeof criarRegistroComportamentoSchema>;

export const listarRegistrosComportamentoSchema = z.object({
  aluno_id: uuidSchema.optional(),
  data_inicio: z.string().date('Data inicial inválida.').optional(),
  data_fim: z.string().date('Data final inválida.').optional(),
});
export type ListarRegistrosComportamento = z.infer<typeof listarRegistrosComportamentoSchema>;
