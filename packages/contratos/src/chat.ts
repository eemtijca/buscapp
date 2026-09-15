import { z } from 'zod';
import { uuidSchema } from './comuns.js';
import { papelPerfilSchema } from './usuarios.js';

/** Resumo enxuto de um participante (responsável ou aluno) usado na listagem do chat. */
export const pessoaConversaSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
});

export type PessoaConversa = z.infer<typeof pessoaConversaSchema>;

/** Resumo da turma vinculada à conversa. */
export const turmaConversaSchema = z.object({
  id: uuidSchema,
  nome_completo: z.string(),
});

export type TurmaConversa = z.infer<typeof turmaConversaSchema>;

/** Prévia da última mensagem trocada na conversa. */
export const ultimaMensagemConversaSchema = z.object({
  conteudo: z.string(),
  created_at: z.string(),
});

export type UltimaMensagemConversa = z.infer<typeof ultimaMensagemConversaSchema>;

/** Contato do chat exibido na barra lateral de conversas. */
export const conversaSchema = z.object({
  id: uuidSchema,
  responsavel: pessoaConversaSchema,
  aluno: pessoaConversaSchema,
  turma: turmaConversaSchema,
  ultima_mensagem_em: z.string().nullable(),
  ultima_mensagem: ultimaMensagemConversaSchema.nullable(),
  nao_lidas: z.number().int(),
  ativa: z.boolean(),
  iniciada_pela_gestao: z.boolean(),
});

export type Conversa = z.infer<typeof conversaSchema>;

export const criarConversaSchema = z.object({
  aluno_id: uuidSchema,
  responsavel_id: uuidSchema.optional(),
});

export type CriarConversa = z.infer<typeof criarConversaSchema>;

/** Papel do autor de uma mensagem, espelhando o enum `papel_perfil` do banco. */
export type PapelAutorMensagem = z.infer<typeof papelPerfilSchema>;

/** Autor de uma mensagem: perfil enxuto com papel para a interface. */
export const autorMensagemSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
  papel: papelPerfilSchema,
});

export type AutorMensagem = z.infer<typeof autorMensagemSchema>;

export const mensagemSchema = z.object({
  id: uuidSchema,
  conversa_id: uuidSchema,
  remetente_id: uuidSchema,
  autor: autorMensagemSchema,
  conteudo: z.string(),
  is_system_message: z.boolean(),
  lida_em: z.string().nullable(),
  created_at: z.string(),
});

export type Mensagem = z.infer<typeof mensagemSchema>;

export const enviarMensagemSchema = z.object({
  conteudo: z.string().trim().min(1, 'Informe a mensagem.').max(2000),
  /** Identificador gerado no cliente para envio idempotente (offline-first). */
  client_request_id: uuidSchema.optional(),
});

export type EnviarMensagem = z.infer<typeof enviarMensagemSchema>;

export const marcarMensagensLidasRespostaSchema = z.object({
  atualizadas: z.number().int(),
});

export type MarcarMensagensLidasResposta = z.infer<typeof marcarMensagensLidasRespostaSchema>;

export const atualizarConversaSchema = z.object({
  ativa: z.boolean(),
});

export type AtualizarConversa = z.infer<typeof atualizarConversaSchema>;
