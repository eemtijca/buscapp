import { z } from 'zod';
import { uuidSchema } from './comuns.js';

export const PAPEIS = ['professor', 'gestao', 'responsavel'] as const;

export const perfilAutenticadoSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
  email: z.string().email().nullable(),
  papel: z.enum(PAPEIS),
  status: z.enum(['ativo', 'pendente', 'inativo']),
  telefone: z.string().nullable(),
  cargo: z.string().nullable(),
  notificacoes_ativas: z.boolean(),
  acesso_modulos: z.array(z.string()),
});

export type PerfilAutenticado = z.infer<typeof perfilAutenticadoSchema>;

export const loginSchema = z.object({
  email: z.string().email('Informe um email válido.'),
  senha: z.string().min(1, 'Informe a senha.').max(128, 'A senha é muito longa.'),
  lembrar: z.boolean().optional().default(false),
});

export type Login = z.infer<typeof loginSchema>;

export const solicitarCodigoSchema = z.object({
  email: z.string().email('Informe um email válido.'),
});

export type SolicitarCodigo = z.infer<typeof solicitarCodigoSchema>;

export const redefinirSenhaSchema = z.object({
  email: z.string().email('Informe um email válido.'),
  codigo: z.string().regex(/^\d{6}$/, 'O código deve ter 6 dígitos.'),
  novaSenha: z
    .string()
    .min(8, 'A senha deve ter ao menos 8 caracteres.')
    .max(128, 'A senha é muito longa.'),
});

export type RedefinirSenha = z.infer<typeof redefinirSenhaSchema>;

export const sessaoSchema = z.object({
  id: uuidSchema,
  criado_em: z.string(),
  ultimo_uso_em: z.string().nullable(),
  expira_em: z.string(),
  user_agent: z.string().nullable(),
  ip: z.string().nullable(),
  atual: z.boolean(),
});

export type Sessao = z.infer<typeof sessaoSchema>;

export const listarSessoesRespostaSchema = z.object({ sessoes: z.array(sessaoSchema) });

export const revogarSessoesRespostaSchema = z.object({
  ok: z.literal(true),
  revogadas: z.number().int(),
});

/** Política de senha forte: mínimo 8 com maiúscula, minúscula, dígito e símbolo. */
export function senhaForte(senha: string): boolean {
  return (
    senha.length >= 8 &&
    /[A-Z]/.test(senha) &&
    /[a-z]/.test(senha) &&
    /\d/.test(senha) &&
    /[^A-Za-z0-9]/.test(senha)
  );
}
