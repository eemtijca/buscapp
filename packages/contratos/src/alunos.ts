import { z } from 'zod';
import { paginacaoSchema, uuidSchema } from './comuns.js';

export const statusAlunoSchema = z.enum(['ativo', 'egresso', 'transferido', 'inativo']);

export const alunoSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
  matricula: z.string(),
  codigo_inep: z.string().nullable(),
  status: statusAlunoSchema,
  observacoes: z.string().nullable(),
  data_nascimento: z.string().nullable(),
  data_matricula: z.string().nullable(),
  transporte_escolar: z.boolean(),
  alimentacao_diferenciada: z.boolean(),
  necessidades_especiais: z.boolean(),
  documentos_recebidos: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Aluno = z.infer<typeof alunoSchema>;

export const criarAlunoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  matricula: z.string().trim().min(1, 'Informe a matrícula.'),
  codigo_inep: z.string().trim().min(1).nullable().optional(),
  status: statusAlunoSchema.optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  data_nascimento: z.string().date().nullable().optional(),
  data_matricula: z.string().date().nullable().optional(),
  transporte_escolar: z.boolean().optional(),
  alimentacao_diferenciada: z.boolean().optional(),
  necessidades_especiais: z.boolean().optional(),
  documentos_recebidos: z.array(z.string()).optional(),
});

export type CriarAluno = z.infer<typeof criarAlunoSchema>;

export const atualizarAlunoSchema = criarAlunoSchema.partial();
export type AtualizarAluno = z.infer<typeof atualizarAlunoSchema>;

export const listarAlunosSchema = z.object({
  busca: z.string().trim().min(1).optional(),
  status: statusAlunoSchema.optional(),
  ...paginacaoSchema.shape,
});

export type ListarAlunos = z.infer<typeof listarAlunosSchema>;
