import type { AtribuicaoProfessor, Enturmacao, TagComportamento, Frequencia } from './database';

/** Usuário devolvido pela API de perfis. */
export interface UsuarioApi {
  id: string;
  nome: string;
  email: string | null;
  papel: 'professor' | 'gestao' | 'responsavel';
  status: 'ativo' | 'pendente' | 'inativo';
  telefone: string | null;
  cargo: string | null;
  notificacoes_ativas: boolean;
  acesso_modulos: string[];
  ultimo_acesso_em: string | null;
  created_at: string;
  updated_at: string;
}

/** Código de redefinição devolvido pela listagem da API. */
export interface CodigoApi {
  id: string;
  email: string;
  perfil_id: string;
  perfil_nome: string | null;
  usado_em: string | null;
  revogado_em: string | null;
  expira_em: string;
  created_at: string;
  status: 'ativo' | 'usado' | 'expirado' | 'revogado';
  bloqueado: boolean;
}

/** Vínculo responsável-aluno conforme o escopo do usuário. */
export interface VinculoApi {
  id: string;
  responsavel_id: string;
  aluno_id: string;
  tipo_relacao: string;
  contato_prioritario: boolean;
  ativo: boolean;
  created_at: string;
  responsavel_nome?: string | null;
}

/** Atribuição devolvida pela API, com professor, turma e disciplina já resolvidos. */
export interface AtribuicaoApi extends AtribuicaoProfessor {
  professor: { id: string; nome: string };
  turma: { id: string; nome_completo: string };
  disciplina: { id: string; nome: string } | null;
}

/** Enturmação com os joins devolvidos pela API (`turma` e `ano_letivo`). */
export interface EnturmacaoApi extends Enturmacao {
  turma: { id: string; nome_completo: string };
  ano_letivo: { id: string; ano: number };
}

/** Ocorrência com aluno, professor e catálogo de tags já resolvidos pela API. */
export interface OcorrenciaApi {
  id: string;
  aluno_id: string;
  aluno: { id: string; nome: string };
  professor_id: string | null;
  professor: { id: string; nome: string } | null;
  turma_id: string;
  ano_letivo_id: string;
  titulo: string;
  descricao: string;
  tipo: string[];
  status: 'aberta' | 'em_andamento' | 'resolvida' | 'arquivada';
  exige_presenca_responsavel: boolean;
  presenca_responsavel_confirmada: boolean;
  data_confirmacao_presenca: string | null;
  data_ocorrencia: string;
  closed_at: string | null;
  tags_comportamento: string[];
  lista_tags: TagComportamento[];
  notificar_coordenacao: boolean;
  notificar_responsavel: boolean;
  created_at: string;
  updated_at: string;
}

/** Anexo enxuto retornado dentro da justificativa. */
export interface AnexoJustificativaApi {
  id: string;
  nome_arquivo: string;
  mime_type: string;
  storage_path: string;
}

/** Justificativa com aluno, responsável e anexos já resolvidos pela API. */
export interface JustificativaApi {
  id: string;
  responsavel_id: string;
  aluno_id: string;
  frequencia_id: string | null;
  data_falta: string;
  data_fim: string | null;
  motivo: string;
  status: 'pendente' | 'aceita' | 'recusada';
  avaliado_por: string | null;
  avaliado_em: string | null;
  parecer: string | null;
  aluno: { id: string; nome: string };
  responsavel: { id: string; nome: string };
  anexos: AnexoJustificativaApi[];
  created_at: string;
  updated_at: string;
}

/** Registro de comportamento com as tags do catálogo embutidas. */
export interface RegistroComportamentoApi {
  id: string;
  aluno_id: string;
  professor_id: string;
  turma_id: string;
  ano_letivo_id: string;
  data_hora: string;
  descricao: string | null;
  tags: TagComportamento[];
}

/** Conversa do chat com contatos, prévia da última mensagem e não lidas. */
export interface ConversaApi {
  id: string;
  responsavel: { id: string; nome: string };
  aluno: { id: string; nome: string };
  turma: { id: string; nome_completo: string };
  ultima_mensagem_em: string | null;
  ultima_mensagem: { conteudo: string; created_at: string } | null;
  nao_lidas: number;
  ativa: boolean;
  iniciada_pela_gestao: boolean;
}

/** Mensagem do chat com o autor resolvido pela API. */
export interface MensagemApi {
  id: string;
  conversa_id: string;
  remetente_id: string;
  autor: { id: string; nome: string; papel: 'professor' | 'gestao' | 'responsavel' };
  conteudo: string;
  is_system_message: boolean;
  lida_em: string | null;
  created_at: string;
}

/** Envelope de respostas que devolvem frequências. */
export interface RespostaFrequencias {
  frequencias: Frequencia[];
}

/** Evento de auditoria devolvido pela API (somente gestão). */
export interface AuditoriaApi {
  id: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  dados_anteriores: unknown;
  dados_novos: unknown;
  ip_origem: string | null;
  created_at: string;
}
