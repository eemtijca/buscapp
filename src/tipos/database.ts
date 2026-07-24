// ============================================================================
// Tipos TypeScript — Schema Completo BuscApp
// Gerado a partir de supabase/migrations/0001_schema_completo.sql
// ============================================================================

// -------- Enums --------
export type PapelPerfil = 'professor' | 'gestao' | 'responsavel';
export type PapelUsuario = PapelPerfil;
export type StatusPerfil = 'ativo' | 'pendente' | 'inativo';
export type StatusAluno = 'ativo' | 'egresso' | 'transferido' | 'inativo';
export type StatusAnoLetivo = 'planejado' | 'ativo' | 'arquivado';
export type SerieTurma = '1º' | '2º' | '3º';
export type LetraTurma = 'A' | 'B' | 'C';
export type TipoRegistroFrequencia = 'entrada_portao' | 'chamada_aula' | 'saida';
export type StatusFrequencia = 'presente' | 'ausente' | 'justificado';
export type CategoriaTag = 'positivo' | 'atencao';
export type TipoOcorrencia = 'grave' | 'suspensao';
export type StatusOcorrencia = 'aberta' | 'em_andamento' | 'resolvida' | 'arquivada';
export type TipoContatoBusca = 'telefone' | 'whatsapp' | 'presencial' | 'carta' | 'outro';
export type StatusMonitoramento =
  | 'pendente'
  | 'em_andamento'
  | 'realizado'
  | 'sem_contato'
  | 'cancelado';
export type StatusJustificativa = 'pendente' | 'aceita' | 'recusada';
export type TipoNotificacao =
  | 'ausencia_portao'
  | 'ausencia_aula'
  | 'monitoramento'
  | 'ocorrencia'
  | 'justificativa'
  | 'mensagem'
  | 'sistema'
  | 'codigo_redefinicao';
export type StatusImportacao = 'processando' | 'concluido' | 'parcial' | 'falhou';
export type StatusExportacao = 'agendada' | 'processando' | 'concluida' | 'falhou';
export type PapelAtribuicao = 'titular' | 'substituto';
export type TipoVinculo = 'pai' | 'mae' | 'tutor' | 'avo' | 'irmao' | 'outro';

// -------- Interfaces --------
export interface AnoLetivo {
  id: string;
  ano: number;
  status: StatusAnoLetivo;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConfiguracaoEscola {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
  updated_at: string;
}

export interface ConfiguracaoSistema {
  id: number;
  limite_critico_faltas: number;
  limite_preventivo_faltas: number;
  dias_expurgo_anexos: number;
  escola_nome: string;
  updated_at: string;
}

export interface HorarioLetivo {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Disciplina {
  id: string;
  nome: string;
  codigo_sige: string | null;
  carga_horaria: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Perfil {
  id: string;
  nome: string;
  papel: PapelPerfil;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  notificacoes_ativas: boolean;
  acesso_modulos: string[];
  permissoes: string[];
  status: StatusPerfil;
  ultimo_acesso_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface Turma {
  id: string;
  ano_letivo_id: string;
  serie: SerieTurma;
  letra: LetraTurma;
  nome_completo: string;
  capacidade: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  codigo_inep: string | null;
  status: StatusAluno;
  observacoes: string | null;
  data_nascimento: string | null;
  data_matricula: string | null;
  transporte_escolar: boolean;
  alimentacao_diferenciada: boolean;
  necessidades_especiais: boolean;
  documentos_recebidos: string[];
  created_at: string;
  updated_at: string;
}

export interface Enturmacao {
  id: string;
  aluno_id: string;
  turma_id: string;
  ano_letivo_id: string;
  status: string;
  data_matricula: string;
  data_encerramento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VinculoResponsavel {
  id: string;
  responsavel_id: string;
  aluno_id: string;
  tipo_relacao: TipoVinculo;
  contato_prioritario: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AtribuicaoProfessor {
  id: string;
  professor_id: string;
  turma_id: string;
  disciplina_id: string | null;
  papel: PapelAtribuicao;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TagComportamento {
  id: string;
  nome: string;
  categoria: CategoriaTag;
  icone: string | null;
  descricao: string | null;
  peso_pontuacao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Frequencia {
  id: string;
  aluno_id: string;
  professor_id: string;
  turma_id: string;
  disciplina_id: string | null;
  ano_letivo_id: string;
  data_aula: string;
  tipo_registro: TipoRegistroFrequencia;
  periodo: string;
  status: StatusFrequencia;
  observacao: string | null;
  motivos_ausencia: string[];
  client_request_id: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface RegistroComportamento {
  id: string;
  aluno_id: string;
  professor_id: string;
  turma_id: string;
  disciplina_id: string | null;
  ano_letivo_id: string;
  data_hora: string;
  observacao: string | null;
  client_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistroComportamentoTag {
  registro_id: string;
  tag_id: string;
  created_at: string;
}

export interface Ocorrencia {
  id: string;
  aluno_id: string;
  professor_id: string | null;
  coordenador_id: string | null;
  turma_id: string;
  ano_letivo_id: string;
  titulo: string;
  descricao: string;
  tipo: string[];
  status: StatusOcorrencia;
  exige_presenca_responsavel: boolean;
  tags_comportamento: string[];
  notificar_coordenacao: boolean;
  notificar_responsavel: boolean;
  presenca_responsavel_confirmada: boolean;
  data_confirmacao_presenca: string | null;
  data_ocorrencia: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Anexo {
  id: string;
  storage_path: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
  criado_por: string | null;
  expurgo_em: string;
  expurgado_em: string | null;
  processado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface OcorrenciaAnexo {
  ocorrencia_id: string;
  anexo_id: string;
  created_at: string;
}

export interface JustificativaFalta {
  id: string;
  responsavel_id: string;
  aluno_id: string;
  frequencia_id: string | null;
  data_falta: string;
  data_fim: string | null;
  motivo: string;
  status: StatusJustificativa;
  avaliado_por: string | null;
  avaliado_em: string | null;
  parecer: string | null;
  created_at: string;
  updated_at: string;
}

export interface JustificativaAnexo {
  justificativa_id: string;
  anexo_id: string;
  created_at: string;
}

export interface Conversa {
  id: string;
  turma_id: string;
  responsavel_id: string;
  aluno_id: string;
  assunto: string | null;
  ativa: boolean;
  ultima_mensagem_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  remetente_id: string;
  conteudo: string;
  is_system_message: boolean;
  lida_em: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  client_request_id: string | null;
  created_at: string;
}

export interface MonitoramentoAcao {
  id: string;
  aluno_id: string;
  responsavel_id: string | null;
  tipo_contato: TipoContatoBusca;
  status: StatusMonitoramento;
  realizado_por: string | null;
  observacao: string | null;
  agendado_para: string | null;
  realizado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface PontuacaoTurma {
  id: string;
  turma_id: string;
  ano_letivo_id: string;
  mes_referencia: string;
  pontos_presenca: number;
  pontos_comportamento: number;
  pontos_total: number;
  created_at: string;
  updated_at: string;
}

export interface Notificacao {
  id: string;
  destinatario_id: string;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string | null;
  metadados: Record<string, unknown> | null;
  lida: boolean;
  lida_em: string | null;
  created_at: string;
}

export interface ImportacaoLog {
  id: string;
  coordenador_id: string | null;
  ano_letivo_id: string;
  arquivo_nome: string;
  formato: string;
  mapeamento: Record<string, unknown>;
  total_registros: number | null;
  registros_criados: number | null;
  registros_atualizados: number | null;
  erros: Record<string, unknown> | null;
  status: StatusImportacao;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Exportacao {
  id: string;
  coordenador_id: string | null;
  tipo: string;
  turma_id: string | null;
  ano_letivo_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  formato: string;
  arquivo_path: string | null;
  status: StatusExportacao;
  created_at: string;
  finished_at: string | null;
}

export interface Auditoria {
  id: string;
  usuario_id: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  ip_origem: string | null;
  created_at: string;
}

export interface Convite {
  id: string;
  email: string;
  papel: PapelPerfil;
  nome_convidado: string | null;
  enviado_por: string;
  status: string;
  expira_em: string;
  aceito_em: string | null;
  created_at: string;
}

export interface CodigoRedefinicao {
  id: string;
  email: string;
  perfil_id: string;
  codigo: string;
  criado_por: string | null;
  usado_em: string | null;
  revogado_em: string | null;
  expira_em: string;
  created_at: string;
  updated_at: string;
}

// -------- Supabase Database Type Map --------
export interface Database {
  public: {
    Tables: {
      anos_letivos: {
        Row: AnoLetivo;
        Insert: Omit<AnoLetivo, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AnoLetivo, 'id'>>;
      };
      configuracoes_escola: {
        Row: ConfiguracaoEscola;
        Insert: Omit<ConfiguracaoEscola, 'id' | 'updated_at'>;
        Update: Partial<Omit<ConfiguracaoEscola, 'id'>>;
      };
      configuracoes_sistema: {
        Row: ConfiguracaoSistema;
        Insert: Partial<Omit<ConfiguracaoSistema, 'updated_at'>>;
        Update: Partial<Omit<ConfiguracaoSistema, 'id'>>;
      };
      horarios_letivos: {
        Row: HorarioLetivo;
        Insert: Omit<HorarioLetivo, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<HorarioLetivo, 'id'>>;
      };
      disciplinas: {
        Row: Disciplina;
        Insert: Omit<Disciplina, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Disciplina, 'id'>>;
      };
      perfis: {
        Row: Perfil;
        Insert: Omit<Perfil, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Perfil, 'id' | 'created_at' | 'updated_at'>>;
      };
      turmas: {
        Row: Turma;
        Insert: Omit<Turma, 'id' | 'nome_completo' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Turma, 'id' | 'nome_completo'>>;
      };
      alunos: {
        Row: Aluno;
        Insert: Omit<Aluno, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Aluno, 'id'>>;
      };
      enturmacoes: {
        Row: Enturmacao;
        Insert: Omit<Enturmacao, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Enturmacao, 'id'>>;
      };
      vinculos_responsaveis: {
        Row: VinculoResponsavel;
        Insert: Omit<VinculoResponsavel, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VinculoResponsavel, 'id'>>;
      };
      atribuicoes_professores: {
        Row: AtribuicaoProfessor;
        Insert: Omit<AtribuicaoProfessor, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AtribuicaoProfessor, 'id'>>;
      };
      tags_comportamento: {
        Row: TagComportamento;
        Insert: Omit<TagComportamento, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TagComportamento, 'id'>>;
      };
      anexos: {
        Row: Anexo;
        Insert: Omit<Anexo, 'id' | 'expurgo_em' | 'processado_em' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Anexo, 'id'>>;
      };
      ocorrencia_anexos: {
        Row: OcorrenciaAnexo;
        Insert: Omit<OcorrenciaAnexo, 'created_at'>;
        Update: Partial<Omit<OcorrenciaAnexo, 'created_at'>>;
      };
      justificativa_anexos: {
        Row: JustificativaAnexo;
        Insert: Omit<JustificativaAnexo, 'created_at'>;
        Update: Partial<Omit<JustificativaAnexo, 'created_at'>>;
      };
      frequencias: {
        Row: Frequencia;
        Insert: Omit<Frequencia, 'id' | 'created_at'>;
        Update: Partial<Omit<Frequencia, 'id'>>;
      };
      registros_comportamento: {
        Row: RegistroComportamento;
        Insert: Omit<RegistroComportamento, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<RegistroComportamento, 'id'>>;
      };
      registro_comportamento_tags: {
        Row: RegistroComportamentoTag;
        Insert: Omit<RegistroComportamentoTag, 'created_at'>;
        Update: Partial<Omit<RegistroComportamentoTag, 'created_at'>>;
      };
      ocorrencias: {
        Row: Ocorrencia;
        Insert: Omit<Ocorrencia, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Ocorrencia, 'id'>>;
      };
      justificativas_faltas: {
        Row: JustificativaFalta;
        Insert: Omit<JustificativaFalta, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<JustificativaFalta, 'id'>>;
      };
      conversas: {
        Row: Conversa;
        Insert: Omit<Conversa, 'id' | 'ultima_mensagem_em' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Conversa, 'id'>>;
      };
      mensagens: {
        Row: Mensagem;
        Insert: Omit<Mensagem, 'id' | 'created_at'>;
        Update: Partial<Omit<Mensagem, 'id'>>;
      };
      monitoramento_acoes: {
        Row: MonitoramentoAcao;
        Insert: Omit<MonitoramentoAcao, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MonitoramentoAcao, 'id'>>;
      };
      pontuacao_turmas: {
        Row: PontuacaoTurma;
        Insert: Omit<PontuacaoTurma, 'id' | 'pontos_total' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PontuacaoTurma, 'id' | 'pontos_total'>>;
      };
      notificacoes: {
        Row: Notificacao;
        Insert: Omit<Notificacao, 'id' | 'lida' | 'lida_em' | 'created_at'>;
        Update: Partial<Omit<Notificacao, 'id'>>;
      };
      importacoes_log: {
        Row: ImportacaoLog;
        Insert: Omit<ImportacaoLog, 'id' | 'started_at' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ImportacaoLog, 'id'>>;
      };
      exportacoes: {
        Row: Exportacao;
        Insert: Omit<Exportacao, 'id' | 'created_at'>;
        Update: Partial<Omit<Exportacao, 'id'>>;
      };
      auditoria: {
        Row: Auditoria;
        Insert: Omit<Auditoria, 'id' | 'created_at'>;
        Update: Partial<Omit<Auditoria, 'id'>>;
      };
      convites: {
        Row: Convite;
        Insert: Omit<Convite, 'id' | 'created_at'>;
        Update: Partial<Omit<Convite, 'id'>>;
      };
      codigos_redefinicao: {
        Row: CodigoRedefinicao;
        Insert: Omit<CodigoRedefinicao, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CodigoRedefinicao, 'id'>>;
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
