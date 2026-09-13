import { z } from 'zod';
import { uuidSchema } from './comuns.js';

export const papelPerfilSchema = z.enum(['professor', 'gestao', 'responsavel']);
export const statusPerfilSchema = z.enum(['ativo', 'pendente', 'inativo']);

export const usuarioSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
  email: z.string().nullable(),
  papel: papelPerfilSchema,
  status: statusPerfilSchema,
  telefone: z.string().nullable(),
  cargo: z.string().nullable(),
  notificacoes_ativas: z.boolean(),
  acesso_modulos: z.array(z.string()),
  ultimo_acesso_em: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Usuario = z.infer<typeof usuarioSchema>;

export const listarUsuariosSchema = z.object({
  papel: papelPerfilSchema.optional(),
  status: statusPerfilSchema.optional(),
  busca: z.string().trim().min(1).optional(),
});

export type ListarUsuarios = z.infer<typeof listarUsuariosSchema>;

export const criarUsuarioSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().email('Informe um email válido.'),
  papel: papelPerfilSchema,
  telefone: z.string().trim().min(1).nullable().optional(),
  cargo: z.string().trim().min(1).nullable().optional(),
  acesso_modulos: z.array(z.string()).optional(),
});

export type CriarUsuario = z.infer<typeof criarUsuarioSchema>;

export const atualizarUsuarioSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  telefone: z.string().trim().min(1).nullable().optional(),
  cargo: z.string().trim().min(1).nullable().optional(),
  notificacoes_ativas: z.boolean().optional(),
  acesso_modulos: z.array(z.string()).optional(),
});

export type AtualizarUsuario = z.infer<typeof atualizarUsuarioSchema>;

export const atualizarStatusUsuarioSchema = z.object({
  status: z.enum(['ativo', 'inativo']),
});

export type AtualizarStatusUsuario = z.infer<typeof atualizarStatusUsuarioSchema>;
