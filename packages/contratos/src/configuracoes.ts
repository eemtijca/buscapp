import { z } from 'zod';
import { uuidSchema } from './comuns.js';

/** Tipos de decaimento aceitos para o cálculo do termômetro. */
export const decaimentoOcorrenciaTipoSchema = z.enum(['nenhum', 'janela', 'exponencial']);
export type DecaimentoOcorrenciaTipo = z.infer<typeof decaimentoOcorrenciaTipoSchema>;

/** Horário no formato HH:MM ou HH:MM:SS. */
export const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Hora inválida (use HH:MM).');

const booleanoTexto = z.enum(['true', 'false']);

export const configuracaoSistemaSchema = z.object({
  id: z.number().int(),
  escola_nome: z.string(),
  limite_critico_faltas: z.number().int(),
  limite_preventivo_faltas: z.number().int(),
  dias_expurgo_anexos: z.number().int(),
  mensagem_fora_horario: z.string(),
  minutos_validade_codigo: z.number().int(),
  max_tentativas_codigo: z.number().int(),
  minutos_bloqueio_codigo: z.number().int(),
  dias_retencao_codigos: z.number().int(),
  peso_falta: z.number(),
  peso_ocorrencia: z.number(),
  peso_recencia: z.number(),
  janela_recencia_dias: z.number().int(),
  limite_score_medio: z.number().int(),
  limite_score_alto: z.number().int(),
  peso_ocorrencia_grave: z.number(),
  forcar_medio_em_grave: z.boolean(),
  janela_ocorrencia_dias: z.number().int(),
  decaimento_ocorrencia_tipo: decaimentoOcorrenciaTipoSchema,
  peso_resolvida: z.number(),
  peso_comportamento_positivo: z.number(),
  janela_positivo_dias: z.number().int(),
  bonus_presenca_confirmada: z.number(),
  updated_at: z.string(),
  fuso_horario: z.string(),
});

export type ConfiguracaoSistema = z.infer<typeof configuracaoSistemaSchema>;

export const atualizarConfiguracaoSistemaSchema = z.object({
  escola_nome: z.string().trim().min(1, 'Informe o nome da escola.').max(100).optional(),
  limite_critico_faltas: z.number().int().min(1).max(1000).optional(),
  limite_preventivo_faltas: z.number().int().min(1).max(1000).optional(),
  dias_expurgo_anexos: z.number().int().min(1).max(3650).optional(),
  mensagem_fora_horario: z.string().max(500).optional(),
  minutos_validade_codigo: z.number().int().min(1).max(10080).optional(),
  max_tentativas_codigo: z.number().int().min(1).max(50).optional(),
  minutos_bloqueio_codigo: z.number().int().min(1).max(10080).optional(),
  dias_retencao_codigos: z.number().int().min(1).max(3650).optional(),
  peso_falta: z.number().min(0).max(100).optional(),
  peso_ocorrencia: z.number().min(0).max(100).optional(),
  peso_recencia: z.number().min(0).max(100).optional(),
  janela_recencia_dias: z.number().int().min(7).max(30).optional(),
  limite_score_medio: z.number().int().min(20).max(60).optional(),
  limite_score_alto: z.number().int().min(60).max(90).optional(),
  peso_ocorrencia_grave: z.number().min(0).max(100).optional(),
  forcar_medio_em_grave: z.boolean().optional(),
  janela_ocorrencia_dias: z.number().int().min(30).max(365).optional(),
  decaimento_ocorrencia_tipo: decaimentoOcorrenciaTipoSchema.optional(),
  peso_resolvida: z.number().min(0).max(100).optional(),
  peso_comportamento_positivo: z.number().min(0).max(100).optional(),
  janela_positivo_dias: z.number().int().min(7).max(90).optional(),
  bonus_presenca_confirmada: z.number().min(0).max(100).optional(),
});

export type AtualizarConfiguracaoSistema = z.infer<typeof atualizarConfiguracaoSistemaSchema>;

export const opcaoConfiguracaoSchema = z.object({
  id: uuidSchema,
  tipo: z.string(),
  chave: z.string(),
  rotulo: z.string(),
  icone: z.string().nullable(),
  ordem: z.number().int(),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type OpcaoConfiguracao = z.infer<typeof opcaoConfiguracaoSchema>;

export const criarOpcaoConfiguracaoSchema = z.object({
  tipo: z.string().trim().min(1, 'Informe o tipo.'),
  chave: z.string().trim().min(1, 'Informe a chave.'),
  rotulo: z.string().trim().min(1, 'Informe o rótulo.'),
  icone: z.string().trim().min(1).nullable().optional(),
  ordem: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
});

export type CriarOpcaoConfiguracao = z.infer<typeof criarOpcaoConfiguracaoSchema>;

export const atualizarOpcaoConfiguracaoSchema = z.object({
  rotulo: z.string().trim().min(1, 'Informe o rótulo.').optional(),
  icone: z.string().trim().min(1).nullable().optional(),
  ordem: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
});

export type AtualizarOpcaoConfiguracao = z.infer<typeof atualizarOpcaoConfiguracaoSchema>;

export const listarOpcoesConfiguracaoSchema = z.object({
  tipo: z.string().trim().min(1).optional(),
  ativo: booleanoTexto.optional(),
});

export type ListarOpcoesConfiguracao = z.infer<typeof listarOpcoesConfiguracaoSchema>;

export const reordenarOpcoesConfiguracaoSchema = z.object({
  itens: z
    .array(
      z.object({
        id: uuidSchema,
        ordem: z.number().int().min(0),
      }),
    )
    .min(1, 'Informe ao menos um item.'),
});

export type ReordenarOpcoesConfiguracao = z.infer<typeof reordenarOpcoesConfiguracaoSchema>;

export const horarioLetivoSchema = z.object({
  id: uuidSchema,
  dia_semana: z.number().int(),
  hora_inicio: z.string(),
  hora_fim: z.string(),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type HorarioLetivo = z.infer<typeof horarioLetivoSchema>;

export const criarHorarioLetivoSchema = z.object({
  dia_semana: z.number().int().min(0, 'Dia da semana inválido.').max(6, 'Dia da semana inválido.'),
  hora_inicio: horaSchema,
  hora_fim: horaSchema,
  ativo: z.boolean().optional(),
});

export type CriarHorarioLetivo = z.infer<typeof criarHorarioLetivoSchema>;

export const atualizarHorarioLetivoSchema = z.object({
  dia_semana: z.number().int().min(0).max(6).optional(),
  hora_inicio: horaSchema.optional(),
  hora_fim: horaSchema.optional(),
  ativo: z.boolean().optional(),
});

export type AtualizarHorarioLetivo = z.infer<typeof atualizarHorarioLetivoSchema>;

export const atualizarStatusHorarioLetivoSchema = z.object({
  ativo: z.boolean(),
});

export type AtualizarStatusHorarioLetivo = z.infer<typeof atualizarStatusHorarioLetivoSchema>;

export const categoriaTagSchema = z.enum(['positivo', 'atencao', 'critico']);
export type CategoriaTag = z.infer<typeof categoriaTagSchema>;

export const tagComportamentoCatalogoSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
  categoria: categoriaTagSchema,
  icone: z.string().nullable(),
  descricao: z.string().nullable(),
  peso_pontuacao: z.number().int(),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TagComportamentoCatalogo = z.infer<typeof tagComportamentoCatalogoSchema>;

export const criarTagComportamentoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da tag.').max(80),
  categoria: categoriaTagSchema,
  icone: z.string().trim().min(1).nullable().optional(),
  descricao: z.string().trim().max(500).nullable().optional(),
  peso_pontuacao: z.number().int().min(-50).max(50).optional(),
  ativo: z.boolean().optional(),
});

export type CriarTagComportamento = z.infer<typeof criarTagComportamentoSchema>;

export const atualizarTagComportamentoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da tag.').max(80).optional(),
  categoria: categoriaTagSchema.optional(),
  icone: z.string().trim().min(1).nullable().optional(),
  descricao: z.string().trim().max(500).nullable().optional(),
  peso_pontuacao: z.number().int().min(-50).max(50).optional(),
  ativo: z.boolean().optional(),
});

export type AtualizarTagComportamento = z.infer<typeof atualizarTagComportamentoSchema>;

export const atualizarStatusTagComportamentoSchema = z.object({
  ativo: z.boolean(),
});

export type AtualizarStatusTagComportamento = z.infer<typeof atualizarStatusTagComportamentoSchema>;

export const listarTagsComportamentoSchema = z.object({
  ativo: booleanoTexto.optional(),
});

export type ListarTagsComportamento = z.infer<typeof listarTagsComportamentoSchema>;
