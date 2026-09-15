export interface PerfilAutenticado {
  id: string;
  nome: string;
  email: string | null;
  papel: 'professor' | 'gestao' | 'responsavel';
  status: 'ativo' | 'pendente' | 'inativo';
  telefone: string | null;
  cargo: string | null;
  notificacoes_ativas: boolean;
  acesso_modulos: string[];
}
