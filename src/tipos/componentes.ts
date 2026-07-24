import type { PapelPerfil, StatusPerfil, StatusAluno } from './database';

export const TAGS_COMPORTAMENTO: Record<string, { rotulo: string; icone: string }> = {
  agressao_verbal: { rotulo: 'Agressão verbal', icone: 'chat-quote' },
  agressao_fisica: { rotulo: 'Agressão física', icone: 'hand-index' },
  desacato: { rotulo: 'Desacato', icone: 'person-fill-exclamation' },
  dano_patrimonio: { rotulo: 'Dano ao patrimônio', icone: 'building-dash' },
  bullying: { rotulo: 'Bullying', icone: 'people-fill' },
  descumprimento_regras: { rotulo: 'Descumprimento de regras', icone: 'file-earmark-x' },
  saida_nao_autorizada: { rotulo: 'Saída não autorizada', icone: 'door-open' },
};

export interface LinkNav {
  rotulo: string;
  url: string;
  ativo?: boolean;
  icone?: string;
}

export interface ItemBreadcrumb {
  rotulo: string;
  url?: string;
  icone?: string;
  ativo?: boolean;
}

export interface ItemSidebar {
  id: string;
  rotulo: string;
  icone: string;
  url?: string;
  ativo?: boolean;
  filhos?: ItemSidebar[];
  data?: string;
  descricao?: string;
  badge?: number | string;
}

export interface DropdownItem {
  rotulo: string;
  url?: string;
  dividir?: boolean;
  icone?: string;
}

export interface AcaoHero {
  rotulo: string;
  variante: 'primary' | 'outline-secondary' | 'outline-info' | 'outline-light' | 'secondary';
  destaque?: boolean;
  url?: string;
}

export interface Recurso {
  icone: string;
  titulo: string;
  descricao: string;
  url?: string;
  rotuloAcao?: string;
  avatarSrc?: string;
  metadados?: { icone: string; rotulo: string }[];
}

export interface Plano {
  nome: string;
  preco: string;
  periodicidade: string;
  recursos: string[];
  destacado?: boolean;
  rotuloBotao: string;
}

export interface ItemLista {
  id: string | number;
  rotulo: string;
  descricao?: string;
  avatarSrc?: string;
  data?: string;
  horario?: string;
  desabilitado?: boolean;
  checked?: boolean;
}

export interface SecaoRodape {
  titulo?: string;
  links: LinkNav[];
}

export interface Postagem {
  titulo: string;
  resumo: string;
  data: string;
  autor: string;
  categoria?: string;
  imagemUrl?: string;
}

export type CorBadge =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'light'
  | 'dark';

export type VarianteBadge =
  | 'solida'
  | 'sutil'
  | 'borda'
  | 'avatar'
  | 'removivel'
  | 'avatar-removivel';

/**
 * Nível de risco calculado a partir do acúmulo de ausências
 * e ocorrências graves. Usado pelo Termômetro de Atenção.
 */
export type NivelRisco = 'baixo' | 'medio' | 'alto';

/**
 * Período de aula (manhã, tarde, noite) ou nome específico
 * do horário (ex.: "1º Horário", "Almoço").
 */
export interface PeriodoAula {
  id: string;
  rotulo: string;
  horario?: string;
}

/**
 * Aluno com estado de frequência para a tela de Registro
 * por Exceção do professor.
 */
export interface AlunoFrequencia {
  id: string;
  nome: string;
  matricula: string;
  turma: string | null;
  turma_id: string | null;
  ausente: boolean;
  periodosAusentes?: string[];
  observacao?: string | null;
  motivosAusencia?: string[];
}

/**
 * Aluno com contagem de ausências e ocorrências para o
 * Ranking de Priorização de Risco da gestão.
 */
export interface AlunoRisco {
  id: string;
  nome: string;
  matricula: string;
  turma: string | null;
  serie: string | null;
  totalAusencias: number;
  totalOcorrencias: number;
  nivel: NivelRisco;
  ultimaAusencia?: string;
  exigePresencaResponsavel?: boolean;
}

/**
 * Ocorrência grave ou suspensão exibida na Central de
 * Ocorrências Graves da gestão.
 */
export interface OcorrenciaGrave {
  id: string;
  alunoNome: string;
  alunoMatricula: string;
  turma: string | null;
  descricao: string;
  tipo: string[];
  tags_comportamento: string[];
  notificar_coordenacao: boolean;
  notificar_responsavel: boolean;
  data: string;
  professorNome?: string;
  anexoUrl?: string | null;
  anexoNome?: string;
  exigePresencaResponsavel: boolean;
  bloqueado: boolean;
}

/**
 * Justificativa enviada pelo responsável e pendente de
 * validação pela gestão.
 */
export interface JustificativaPendente {
  id: string;
  alunoNome: string;
  responsavelNome: string;
  dataAusencia: string;
  dataFim: string | null;
  motivo: string;
  anexoUrl?: string;
  anexoNome?: string;
  anexoId?: string;
  processadoEm?: string;
  status: 'pendente' | 'aceita' | 'recusada';
}

/**
 * Item de estatística do Painel Confidencial de Monitoramento.
 */
export interface EstatisticaPainel {
  id: string;
  rotulo: string;
  valor: string | number;
  icone: string;
  variante: CorBadge;
  rodape?: string;
}

/**
 * Alerta exibido no painel do responsável.
 */
export interface AlertaResponsavel {
  id: string;
  tipo: 'ausencia_escola' | 'ausencia_aula' | 'suspensao' | 'comunicado';
  titulo: string;
  descricao: string;
  data: string;
  periodo?: string;
  frequenciaId?: string;
  justificativaStatus?: 'pendente' | 'aceita' | 'recusada';
  justificativaMotivo?: string;
  anexoUrl?: string;
  anexoNome?: string;
  ocorrenciaTipo?: string[];
  tagsComportamento?: string[];
  exigePresencaResponsavel?: boolean;
  urgente: boolean;
}

/**
 * Termômetro de Atenção Visual exibido para o responsável.
 */
export interface TermometroAtencao {
  nivel: NivelRisco;
  alunoNome: string;
  alunoTurma: string | null;
  totalAusencias: number;
  totalOcorrencias: number;
  mensagem: string;
}

/**
 * Mensagem do canal de diálogo com horário protegido.
 */
export interface MensagemChat {
  id: string;
  autor: 'responsavel' | 'gestao';
  nomeAutor: string;
  texto: string;
  horario: string;
  data: string;
}

/**
 * Configuração do horário protegido do canal de diálogo.
 */
export interface HorarioProtegido {
  inicio: string; // formato "HH:MM"
  fim: string; // formato "HH:MM"
  diasSemana: number[]; // 0 (Dom) a 6 (Sáb)
  mensagemForaHorario: string;
}

/**
 * Item de usuario para listagem na gestao.
 */
export interface UsuarioItem {
  id: string;
  nome: string;
  email: string | null;
  papel: PapelPerfil;
  status: StatusPerfil;
  telefone: string | null;
  cargo: string | null;
  ultimo_acesso: string | null;
  notificacoes_ativas: boolean;
  acesso_modulos: string[];
  permissoes: string[];
}

/**
 * Item de aluno para listagem na gestao.
 */
export interface AlunoItem {
  id: string;
  nome: string;
  matricula: string;
  turma: string | null;
  status: StatusAluno;
  data_nascimento: string | null;
  codigo_inep: string | null;
  data_matricula: string | null;
  observacoes: string | null;
  transporte_escolar: boolean;
  alimentacao_diferenciada: boolean;
  necessidades_especiais: boolean;
  documentos_recebidos: string[];
}

/**
 * Solicitacao de codigo de redefinicao pendente.
 */
export interface SolicitacaoCodigo {
  id: string;
  email: string;
  perfil_id: string;
  nome: string;
  papel: PapelPerfil;
  criado_em: string;
}

/**
 * Codigo de redefinicao gerado (para exibicao na listagem).
 */
export interface CodigoGerado {
  id: string;
  email: string;
  nome: string;
  codigo: string;
  criado_por_nome: string | null;
  usado_em: string | null;
  revogado_em: string | null;
  expira_em: string;
  criado_em: string;
  status: 'ativo' | 'usado' | 'expirado';
}

/**
 * Dados para criacao de usuario.
 */
export interface DadosCriacaoUsuario {
  nome: string;
  email: string;
  papel: PapelPerfil;
  telefone?: string;
  cargo?: string;
}

/**
 * Opcao para GrupoCheckbox.
 */
export interface OpcaoCheckbox {
  valor: string;
  rotulo: string;
  icone?: string;
  desabilitado?: boolean;
}

/**
 * Dados para criacao de aluno.
 */
export interface DadosCriacaoAluno {
  nome: string;
  matricula: string;
  data_nascimento?: string;
  observacoes?: string;
  turma_id?: string;
  responsavel_nome?: string;
  responsavel_email?: string;
  responsavel_telefone?: string;
  tipo_vinculo?: string;
}
