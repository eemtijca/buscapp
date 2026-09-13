import { z } from 'zod';
import { uuidSchema } from './comuns.js';

/** Booleano aceito em query string (`?ativo=true|false|1|0`). */
export const booleanQuerySchema = z.stringbool();

// --- Turmas ---

export const turmaSchema = z.object({
  id: uuidSchema,
  ano_letivo_id: uuidSchema,
  serie: z.string(),
  letra: z.string(),
  nome_completo: z.string(),
  capacidade: z.number().int().nullable(),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Turma = z.infer<typeof turmaSchema>;

export const listarTurmasSchema = z.object({
  ativo: booleanQuerySchema.optional(),
  ano_letivo_id: uuidSchema.optional(),
});

export type ListarTurmas = z.infer<typeof listarTurmasSchema>;

export const criarTurmaSchema = z.object({
  ano_letivo_id: uuidSchema,
  serie: z.string().trim().min(1, 'Informe a série.'),
  letra: z.string().trim().min(1, 'Informe a letra.'),
  capacidade: z.number().int().nonnegative().nullable().optional(),
  ativo: z.boolean().optional(),
});

export type CriarTurma = z.infer<typeof criarTurmaSchema>;

export const atualizarTurmaSchema = z.object({
  serie: z.string().trim().min(1, 'Informe a série.').optional(),
  letra: z.string().trim().min(1, 'Informe a letra.').optional(),
  capacidade: z.number().int().nonnegative().nullable().optional(),
  ativo: z.boolean().optional(),
});

export type AtualizarTurma = z.infer<typeof atualizarTurmaSchema>;

// --- Disciplinas ---

export const disciplinaSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
  codigo_sige: z.string().nullable(),
  carga_horaria: z.number().int().nullable(),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Disciplina = z.infer<typeof disciplinaSchema>;

export const listarDisciplinasSchema = z.object({
  ativo: booleanQuerySchema.optional(),
});

export type ListarDisciplinas = z.infer<typeof listarDisciplinasSchema>;

export const criarDisciplinaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  codigo_sige: z.string().trim().min(1, 'Informe o código SIGE.').nullable().optional(),
  carga_horaria: z.number().int().nonnegative().nullable().optional(),
  ativo: z.boolean().optional(),
});

export type CriarDisciplina = z.infer<typeof criarDisciplinaSchema>;

export const atualizarDisciplinaSchema = criarDisciplinaSchema.partial();
export type AtualizarDisciplina = z.infer<typeof atualizarDisciplinaSchema>;

// --- Atribuições de professores ---

export const papelAtribuicaoSchema = z.enum(['titular', 'substituto']);
export const statusGenericoSchema = z.object({ ativo: z.boolean() });
export type AtualizarStatusGenerico = z.infer<typeof statusGenericoSchema>;

export const atribuicaoProfessorSchema = z.object({
  id: uuidSchema,
  professor_id: uuidSchema,
  turma_id: uuidSchema,
  disciplina_id: uuidSchema.nullable(),
  papel: z.string(),
  data_inicio: z.string(),
  data_fim: z.string().nullable(),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  professor: z.object({ id: uuidSchema, nome: z.string() }),
  turma: z.object({ id: uuidSchema, nome_completo: z.string() }),
  disciplina: z.object({ id: uuidSchema, nome: z.string() }).nullable(),
});

export type AtribuicaoProfessor = z.infer<typeof atribuicaoProfessorSchema>;

export const listarAtribuicoesSchema = z.object({
  professor_id: uuidSchema.optional(),
  turma_id: uuidSchema.optional(),
  ativo: booleanQuerySchema.optional(),
});

export type ListarAtribuicoes = z.infer<typeof listarAtribuicoesSchema>;

export const criarAtribuicaoSchema = z.object({
  professor_id: uuidSchema,
  turma_id: uuidSchema,
  disciplina_id: uuidSchema.nullable().optional(),
  papel: papelAtribuicaoSchema,
  data_inicio: z.string().date('Informe uma data de início válida.'),
  data_fim: z.string().date('Informe uma data de fim válida.').nullable().optional(),
  ativo: z.boolean().optional(),
});

export type CriarAtribuicao = z.infer<typeof criarAtribuicaoSchema>;

export const atualizarAtribuicaoSchema = z.object({
  professor_id: uuidSchema.optional(),
  turma_id: uuidSchema.optional(),
  disciplina_id: uuidSchema.nullable().optional(),
  papel: papelAtribuicaoSchema.optional(),
  data_inicio: z.string().date('Informe uma data de início válida.').optional(),
  data_fim: z.string().date('Informe uma data de fim válida.').nullable().optional(),
  ativo: z.boolean().optional(),
});

export type AtualizarAtribuicao = z.infer<typeof atualizarAtribuicaoSchema>;

// --- Anos letivos ---

export const statusAnoLetivoSchema = z.enum(['planejado', 'ativo', 'arquivado']);

export const anoLetivoSchema = z.object({
  id: uuidSchema,
  ano: z.number().int(),
  status: statusAnoLetivoSchema,
  data_inicio: z.string(),
  data_fim: z.string(),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AnoLetivo = z.infer<typeof anoLetivoSchema>;

export const criarAnoLetivoSchema = z.object({
  ano: z.number().int().min(2000, 'Ano inválido.').max(2100, 'Ano inválido.'),
  data_inicio: z.string().date('Informe uma data de início válida.'),
  data_fim: z.string().date('Informe uma data de fim válida.'),
});

export type CriarAnoLetivo = z.infer<typeof criarAnoLetivoSchema>;

export const atualizarAnoLetivoSchema = z.object({
  ano: z.number().int().min(2000, 'Ano inválido.').max(2100, 'Ano inválido.').optional(),
  data_inicio: z.string().date('Informe uma data de início válida.').optional(),
  data_fim: z.string().date('Informe uma data de fim válida.').optional(),
});

export type AtualizarAnoLetivo = z.infer<typeof atualizarAnoLetivoSchema>;

// --- Enturmações ---

export const enturmacaoSchema = z.object({
  id: uuidSchema,
  aluno_id: uuidSchema,
  turma_id: uuidSchema,
  ano_letivo_id: uuidSchema,
  status: z.string(),
  data_matricula: z.string(),
  data_encerramento: z.string().nullable(),
  observacoes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  turma: z.object({ id: uuidSchema, nome_completo: z.string() }),
  ano_letivo: z.object({ id: uuidSchema, ano: z.number().int() }),
});

export type Enturmacao = z.infer<typeof enturmacaoSchema>;

export const listarEnturmacoesSchema = z.object({
  aluno_id: uuidSchema.optional(),
  turma_id: uuidSchema.optional(),
  status: z.string().trim().min(1).optional(),
});

export type ListarEnturmacoes = z.infer<typeof listarEnturmacoesSchema>;

export const criarEnturmacaoSchema = z.object({
  aluno_id: uuidSchema,
  turma_id: uuidSchema,
  data_matricula: z.string().date('Informe uma data de matrícula válida.').optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

export type CriarEnturmacao = z.infer<typeof criarEnturmacaoSchema>;

export const atualizarEnturmacaoSchema = z.object({
  turma_id: uuidSchema.optional(),
  status: z.string().trim().min(1, 'Informe o status.').optional(),
  data_encerramento: z
    .string()
    .date('Informe uma data de encerramento válida.')
    .nullable()
    .optional(),
});

export type AtualizarEnturmacao = z.infer<typeof atualizarEnturmacaoSchema>;
