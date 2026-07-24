-- ============================================================================
-- Migration: 0001_schema_completo
-- Projeto: BuscApp — EEMTI
-- Descrição: Schema completo e definitivo com 25+ tabelas, RLS, views,
--            triggers, índices, JWT hook e pre-request enforcement.
-- Substitui: 0001_schema_inicial.sql, concessao_permissoes_api.sql,
--            custom_access_token_hook.sql, enforce_jwt_verification.sql
-- ============================================================================

-- ============================================================================
-- 1. EXTENSÕES
-- ============================================================================
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============================================================================
-- 2. TIPOS ENUMERADOS
-- ============================================================================
create type public.papel_perfil as enum ('professor', 'gestao', 'responsavel');
create type public.status_perfil as enum ('ativo', 'pendente', 'inativo');
create type public.status_aluno as enum ('ativo', 'egresso', 'transferido', 'inativo');
create type public.status_ano_letivo as enum ('planejado', 'ativo', 'arquivado');
create type public.serie_turma as enum ('1º', '2º', '3º');
create type public.letra_turma as enum ('A', 'B', 'C');
create type public.tipo_registro_frequencia as enum ('entrada_portao', 'chamada_aula', 'saida');
create type public.status_frequencia as enum ('presente', 'ausente', 'justificado');
create type public.categoria_tag as enum ('positivo', 'atencao');
create type public.tipo_ocorrencia as enum ('grave', 'suspensao');
create type public.status_ocorrencia as enum ('aberta', 'em_andamento', 'resolvida', 'arquivada');
create type public.tipo_contato_busca as enum ('telefone', 'whatsapp', 'presencial', 'carta', 'outro');
create type public.status_monitoramento as enum ('pendente', 'em_andamento', 'realizado', 'sem_contato', 'cancelado');
create type public.status_justificativa as enum ('pendente', 'aceita', 'recusada');
create type public.tipo_notificacao as enum ('ausencia_portao', 'ausencia_aula', 'monitoramento', 'ocorrencia', 'justificativa', 'mensagem', 'sistema');
create type public.status_importacao as enum ('processando', 'concluido', 'parcial', 'falhou');
create type public.status_exportacao as enum ('agendada', 'processando', 'concluida', 'falhou');
create type public.papel_atribuicao as enum ('titular', 'substituto');
create type public.tipo_vinculo as enum ('pai', 'mae', 'tutor', 'avo', 'irmao', 'outro');

-- ============================================================================
-- 2. FUNÇÕES AUXILIARES (criadas antes das tabelas que as referenciam)
-- ============================================================================

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 3. TABELAS — CAMADA DE DOMÍNIO E CONFIGURAÇÃO
-- ============================================================================

-- 3.1 anos_letivos
create table public.anos_letivos (
  id          uuid                primary key default gen_random_uuid(),
  ano         integer             not null,
  status      status_ano_letivo   not null default 'planejado',
  data_inicio date                not null,
  data_fim    date                not null,
  ativo       boolean             not null default false,
  created_at  timestamptz         not null default now(),
  updated_at  timestamptz         not null default now(),
  constraint uq_ano_letivo_ano unique (ano),
  constraint chk_ano_letivo_ano check (ano between 2000 and 2100),
  constraint chk_ano_letivo_datas check (data_fim >= data_inicio)
);

comment on table public.anos_letivos is 'RF13/RF25: Ciclo de anos letivos. O wizard de virada desativa o ano anterior e ativa o novo.';

-- 3.2 configuracoes_escola (key-value)
create table public.configuracoes_escola (
  id         uuid        primary key default gen_random_uuid(),
  chave      text        not null,
  valor      text        not null,
  descricao  text,
  updated_at timestamptz not null default now(),
  constraint uq_config_chave unique (chave)
);

comment on table public.configuracoes_escola is 'RF27: Configurações globais (chat horas, limites, etc.).';

-- 3.3 configuracoes_sistema (single-row)
create table public.configuracoes_sistema (
  id                       integer primary key default 1,
  limite_critico_faltas    integer not null default 25,
  limite_preventivo_faltas integer not null default 10,
  dias_expurgo_anexos      integer not null default 30,
  escola_nome              text    not null default 'EEMTI',
  updated_at               timestamptz not null default now(),
  constraint chk_sistema_singleton check (id = 1)
);

insert into public.configuracoes_sistema (id) values (1) on conflict do nothing;

comment on table public.configuracoes_sistema is 'Parâmetros globais de sistema em linha única.';

-- 3.4 horarios_letivos
create table public.horarios_letivos (
  id          uuid        primary key default gen_random_uuid(),
  dia_semana  smallint    not null,
  hora_inicio time        not null,
  hora_fim    time        not null,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint chk_horario_dia check (dia_semana between 0 and 6),
  constraint chk_horario_valido check (hora_fim > hora_inicio),
  constraint uq_horario_dia unique (dia_semana, hora_inicio, hora_fim)
);

comment on table public.horarios_letivos is 'RF27: Janelas de atendimento para chat. Fora delas o envio é bloqueado por trigger.';

-- 3.5 disciplinas
create table public.disciplinas (
  id            uuid        primary key default gen_random_uuid(),
  nome          text        not null,
  codigo_sige   text,
  carga_horaria integer,
  ativo         boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_disciplina_codigo_sige unique (codigo_sige),
  constraint chk_disciplina_carga check (carga_horaria > 0)
);

comment on table public.disciplinas is 'RD04: Catálogo de disciplinas com código SIGE para compatibilidade SEDUC.';

-- ============================================================================
-- 4. TABELAS — ENTIDADES PRINCIPAIS
-- ============================================================================

-- 4.1 perfis
create table public.perfis (
  id                 uuid            primary key references auth.users(id) on delete cascade,
  nome               text            not null,
  papel              papel_perfil    not null,
  email              text,
  telefone           text,
  cargo              text,
  notificacoes_ativas boolean        not null default true,
  status             status_perfil   not null default 'ativo',
  ultimo_acesso_em   timestamptz,
  created_at         timestamptz     not null default now(),
  updated_at         timestamptz     not null default now(),
  constraint uq_perfil_email unique (email)
);

comment on table public.perfis is 'RF01/RF11/RNF03: Perfis 1:1 com auth.users. Sem dados sensíveis (CPF, endereço).';

-- 4.2 turmas
create table public.turmas (
  id             uuid        primary key default gen_random_uuid(),
  ano_letivo_id  uuid        not null references public.anos_letivos(id) on delete restrict,
  serie          serie_turma not null,
  letra          letra_turma not null,
  nome_completo  text        not null,
  capacidade    integer,
  ativo          boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint uq_turma_ano_serie_letra unique (ano_letivo_id, serie, letra),
  constraint chk_turma_capacidade check (capacidade is null or capacidade > 0)
);

comment on table public.turmas is 'RF09/RD02: Turmas normalizadas. Máximo 9 por ano (1º-3º × A-C).';

-- Trigger: auto-set nome_completo from serie and letra
create or replace function public.fn_set_turma_nome()
returns trigger
language plpgsql
as $$
begin
  new.nome_completo := new.serie::text || ' ' || new.letra::text;
  return new;
end;
$$;

create trigger trg_set_turma_nome
  before insert or update on public.turmas
  for each row
  execute function public.fn_set_turma_nome();

-- 4.3 alunos
create table public.alunos (
  id              uuid          primary key default gen_random_uuid(),
  nome            text          not null,
  matricula       text          not null,
  codigo_inep     text,
  status          status_aluno  not null default 'ativo',
  observacoes     text,
  data_nascimento date,
  data_matricula  date,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  constraint uq_aluno_matricula unique (matricula)
);

comment on table public.alunos is 'RF08/RF13/RNF03/RD04: Alunos identificados por matrícula (pseudonimizado). Sem CPF/endereço/foto.';

-- 4.4 enturmacoes (temporal: aluno × turma × ano)
create table public.enturmacoes (
  id                uuid        primary key default gen_random_uuid(),
  aluno_id          uuid        not null references public.alunos(id) on delete cascade,
  turma_id          uuid        not null references public.turmas(id) on delete restrict,
  ano_letivo_id     uuid        not null references public.anos_letivos(id) on delete restrict,
  status            text        not null default 'matriculado',
  data_matricula    date        not null default current_date,
  data_encerramento date,
  observacoes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_enturmacao_aluno_ano unique (aluno_id, ano_letivo_id),
  constraint chk_enturmacao_status check (status in ('matriculado', 'transferido', 'egresso', 'remanejado')),
  constraint chk_enturmacao_datas check (data_encerramento is null or data_encerramento >= data_matricula)
);

comment on table public.enturmacoes is 'RF13/RF25: Vínculo temporal aluno×turma×ano. Substitui campos text turma/serie em alunos.';

-- 4.5 vinculos_responsaveis
create table public.vinculos_responsaveis (
  id                   uuid          primary key default gen_random_uuid(),
  responsavel_id       uuid          not null references public.perfis(id) on delete cascade,
  aluno_id             uuid          not null references public.alunos(id) on delete cascade,
  tipo_relacao         tipo_vinculo  not null default 'outro',
  contato_prioritario  boolean       not null default false,
  ativo                boolean       not null default true,
  created_at           timestamptz   not null default now(),
  updated_at           timestamptz   not null default now(),
  constraint uq_vinculo_responsavel_aluno unique (responsavel_id, aluno_id)
);

comment on table public.vinculos_responsaveis is 'RF05: Vínculo multiparental N:N. Um responsável pode ter múltiplos dependentes.';

-- 4.6 atribuicoes_professores
create table public.atribuicoes_professores (
  id              uuid               primary key default gen_random_uuid(),
  professor_id    uuid               not null references public.perfis(id) on delete cascade,
  turma_id        uuid               not null references public.turmas(id) on delete cascade,
  disciplina_id   uuid               references public.disciplinas(id) on delete set null,
  papel           papel_atribuicao   not null default 'titular',
  data_inicio     date               not null default current_date,
  data_fim        date,
  ativo           boolean            not null default true,
  created_at      timestamptz        not null default now(),
  updated_at      timestamptz        not null default now(),
  constraint chk_atribuicao_datas check (data_fim is null or data_fim >= data_inicio)
);

comment on table public.atribuicoes_professores is 'RF21: Professor titular ou substituto com janela temporal.';

-- ============================================================================
-- 5. TABELAS — CATÁLOGO DE TAGS
-- ============================================================================

create table public.tags_comportamento (
  id              uuid          primary key default gen_random_uuid(),
  nome            text          not null,
  categoria       categoria_tag not null,
  icone           text,
  descricao       text,
  peso_pontuacao  integer       not null default 0,
  ativo           boolean       not null default true,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  constraint uq_tag_nome unique (nome)
);

comment on table public.tags_comportamento is 'RF16: Catálogo de chips/tags de comportamento. peso_pontuacao usado na gamificação (RF28).';

-- ============================================================================
-- 6. TABELAS — OPERACIONAIS (FREQUÊNCIA, COMPORTAMENTO, OCORRÊNCIAS)
-- ============================================================================

-- 6.1 frequencias
create table public.frequencias (
  id                uuid                        primary key default gen_random_uuid(),
  aluno_id          uuid                        not null references public.alunos(id) on delete cascade,
  professor_id      uuid                        not null references public.perfis(id) on delete restrict,
  turma_id          uuid                        not null references public.turmas(id) on delete restrict,
  disciplina_id     uuid                        references public.disciplinas(id) on delete set null,
  ano_letivo_id     uuid                        not null references public.anos_letivos(id) on delete restrict,
  data_aula         date                        not null,
  tipo_registro     tipo_registro_frequencia    not null default 'chamada_aula',
  periodo           text                        not null,
  status            status_frequencia           not null default 'presente',
  observacao        text,
  client_request_id uuid,
  deleted_at        timestamptz,
  created_at        timestamptz                 not null default now(),
  updated_at        timestamptz                 not null default now(),
  constraint uq_frequencia_client_req unique (client_request_id)
);

comment on table public.frequencias is 'RF14/RF15/RD03/RNF06: Registro unificado de entrada (portão), chamada por período e saída.';

-- 6.2 registros_comportamento
create table public.registros_comportamento (
  id                uuid          primary key default gen_random_uuid(),
  aluno_id          uuid          not null references public.alunos(id) on delete cascade,
  professor_id      uuid          not null references public.perfis(id) on delete restrict,
  turma_id          uuid          not null references public.turmas(id) on delete restrict,
  disciplina_id     uuid          references public.disciplinas(id) on delete set null,
  ano_letivo_id     uuid          not null references public.anos_letivos(id) on delete restrict,
  data_hora         timestamptz   not null default now(),
  observacao        text,
  client_request_id uuid,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  constraint uq_comportamento_client_req unique (client_request_id)
);

comment on table public.registros_comportamento is 'RF16/RF18/RF19: Registro de comportamento com suporte a múltiplas tags e ditado por voz.';

-- 6.3 registro_comportamento_tags (N:N)
create table public.registro_comportamento_tags (
  registro_id uuid not null references public.registros_comportamento(id) on delete cascade,
  tag_id      uuid not null references public.tags_comportamento(id) on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (registro_id, tag_id)
);

comment on table public.registro_comportamento_tags is 'RF18: Associação N:N entre registros de comportamento e tags (multitag).';

-- 6.4 ocorrencias
create table public.ocorrencias (
  id                              uuid               primary key default gen_random_uuid(),
  aluno_id                        uuid               not null references public.alunos(id) on delete cascade,
  professor_id                    uuid               references public.perfis(id) on delete set null,
  coordenador_id                  uuid               references public.perfis(id) on delete set null,
  turma_id                        uuid               not null references public.turmas(id) on delete restrict,
  ano_letivo_id                   uuid               not null references public.anos_letivos(id) on delete restrict,
  titulo                          text               not null,
  descricao                       text               not null,
  tipo                            tipo_ocorrencia    not null default 'grave',
  status                          status_ocorrencia  not null default 'aberta',
  exige_presenca_responsavel      boolean            not null default false,
  presenca_responsavel_confirmada boolean            not null default false,
  data_confirmacao_presenca       timestamptz,
  data_ocorrencia                 timestamptz        not null default now(),
  closed_at                       timestamptz,
  created_at                      timestamptz        not null default now(),
  updated_at                      timestamptz        not null default now()
);

comment on table public.ocorrencias is 'Ocorrências graves e suspensões com bloqueio de retorno e workflow de status.';

-- ============================================================================
-- 7. TABELAS — ANEXOS (dedicadas, com integridade referencial)
-- ============================================================================

create table public.anexos (
  id              uuid          primary key default gen_random_uuid(),
  storage_path    text          not null,
  nome_arquivo    text          not null,
  mime_type       text          not null,
  tamanho_bytes   integer       not null,
  criado_por      uuid          references public.perfis(id) on delete set null,
  expurgo_em      timestamptz   not null default (now() + interval '30 days'),
  expurgado_em    timestamptz,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  processado_em    timestamptz,
  constraint chk_anexo_tamanho check (tamanho_bytes <= 10485760)
);

comment on table public.anexos is 'RNF04/RNF07: Metadados de arquivos no Storage. expurgo_em = created_at + 30 dias. Limite de 150KB.';

create table public.ocorrencia_anexos (
  ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  anexo_id      uuid not null references public.anexos(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (ocorrencia_id, anexo_id)
);

comment on table public.ocorrencia_anexos is 'Join dedicado: ocorrências → anexos com integridade referencial.';

-- ============================================================================
-- 8. TABELAS — JUSTIFICATIVAS
-- ============================================================================

create table public.justificativas_faltas (
  id              uuid                primary key default gen_random_uuid(),
  responsavel_id  uuid                not null references public.perfis(id) on delete cascade,
  aluno_id        uuid                not null references public.alunos(id) on delete cascade,
  frequencia_id   uuid                references public.frequencias(id) on delete set null,
  data_falta      date                not null,
  data_fim        date,
  motivo          text                not null,
  status          status_justificativa not null default 'pendente',
  avaliado_por    uuid                references public.perfis(id) on delete set null,
  avaliado_em     timestamptz,
  parecer         text,
  created_at      timestamptz         not null default now(),
  updated_at      timestamptz         not null default now()
);

comment on table public.justificativas_faltas is 'RF24: Justificativas de ausência enviadas pelo responsável. Status workflow: pendente → aceita/recusada.';

create table public.justificativa_anexos (
  justificativa_id uuid not null references public.justificativas_faltas(id) on delete cascade,
  anexo_id         uuid not null references public.anexos(id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (justificativa_id, anexo_id)
);

comment on table public.justificativa_anexos is 'Join dedicado: justificativas → anexos com integridade referencial.';

-- ============================================================================
-- 9. TABELAS — COMUNICAÇÃO (CHAT)
-- ============================================================================

create table public.conversas (
  id                 uuid        primary key default gen_random_uuid(),
  turma_id           uuid        not null references public.turmas(id) on delete cascade,
  responsavel_id     uuid        not null references public.perfis(id) on delete cascade,
  aluno_id           uuid        not null references public.alunos(id) on delete cascade,
  assunto            text,
  ativa              boolean     not null default true,
  ultima_mensagem_em timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint uq_conversa_responsavel_aluno unique (responsavel_id, aluno_id)
);

comment on table public.conversas is 'RF26: Conversas de chat entre responsável e staff (professor/gestão). Única ativa por par.';

create table public.mensagens (
  id                   uuid        primary key default gen_random_uuid(),
  conversa_id          uuid        not null references public.conversas(id) on delete cascade,
  remetente_id         uuid        not null references public.perfis(id) on delete cascade,
  conteudo             text        not null,
  is_system_message    boolean     not null default false,
  lida_em              timestamptz,
  edited_at            timestamptz,
  deleted_at           timestamptz,
  client_request_id    uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint uq_mensagem_client_req unique (client_request_id),
  constraint chk_mensagem_nao_vazia check (length(trim(conteudo)) > 0)
);

comment on table public.mensagens is 'RF26/RF27: Mensagens textuais. client_request_id para idempotência offline. Bloqueio anti-burnout via trigger.';

-- ============================================================================
-- 10. TABELAS — MONITORAMENTO E GAMIFICAÇÃO
-- ============================================================================

create table public.monitoramento_acoes (
  id               uuid                 primary key default gen_random_uuid(),
  aluno_id         uuid                 not null references public.alunos(id) on delete cascade,
  responsavel_id   uuid                 references public.perfis(id) on delete set null,
  tipo_contato     tipo_contato_busca   not null,
  status           status_monitoramento   not null default 'pendente',
  realizado_por    uuid                 references public.perfis(id) on delete set null,
  observacao       text,
  agendado_para    timestamptz,
  realizado_em     timestamptz,
  created_at       timestamptz          not null default now(),
  updated_at       timestamptz          not null default now()
);

comment on table public.monitoramento_acoes is 'RF12: Log de ações de monitoramento (telefonemas, WhatsApp, visitas).';

create table public.pontuacao_turmas (
  id                  uuid        primary key default gen_random_uuid(),
  turma_id            uuid        not null references public.turmas(id) on delete cascade,
  ano_letivo_id       uuid        not null references public.anos_letivos(id) on delete restrict,
  mes_referencia      date        not null,
  pontos_presenca     integer     not null default 0,
  pontos_comportamento integer    not null default 0,
  pontos_total        integer     generated always as (pontos_presenca + pontos_comportamento) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint uq_pontuacao_turma_mes unique (turma_id, ano_letivo_id, mes_referencia)
);

comment on table public.pontuacao_turmas is 'RF28: Snapshots mensais de pontuação para gamificação interturmas.';

-- ============================================================================
-- 11. TABELAS — NOTIFICAÇÕES
-- ============================================================================

create table public.notificacoes (
  id              uuid             primary key default gen_random_uuid(),
  destinatario_id uuid             not null references public.perfis(id) on delete cascade,
  tipo            tipo_notificacao not null,
  titulo          text             not null,
  corpo           text,
  metadados       jsonb,
  lida            boolean          not null default false,
  lida_em         timestamptz,
  created_at      timestamptz      not null default now()
);

comment on table public.notificacoes is 'Fila de notificações push/in-app para todos os perfis.';

-- ============================================================================
-- 12. TABELAS — IMPORTAÇÃO, EXPORTAÇÃO E AUDITORIA
-- ============================================================================

create table public.importacoes_log (
  id                  uuid              primary key default gen_random_uuid(),
  coordenador_id      uuid              references public.perfis(id) on delete set null,
  ano_letivo_id       uuid              not null references public.anos_letivos(id) on delete restrict,
  arquivo_nome        text              not null,
  formato             text              not null,
  mapeamento          jsonb             not null,
  total_registros     integer           default 0,
  registros_criados   integer           default 0,
  registros_atualizados integer         default 0,
  erros               jsonb,
  status              status_importacao not null default 'processando',
  started_at          timestamptz       not null default now(),
  finished_at         timestamptz,
  created_at          timestamptz       not null default now(),
  updated_at          timestamptz       not null default now(),
  constraint chk_importacao_formato check (formato in ('csv', 'xlsx'))
);

comment on table public.importacoes_log is 'RF06-RF09: Auditoria de importação de planilhas SIGE/Aluno Online.';

create table public.exportacoes (
  id              uuid               primary key default gen_random_uuid(),
  coordenador_id  uuid               references public.perfis(id) on delete set null,
  tipo            text               not null,
  turma_id        uuid               references public.turmas(id) on delete set null,
  ano_letivo_id   uuid               not null references public.anos_letivos(id) on delete restrict,
  periodo_inicio  date               not null,
  periodo_fim     date               not null,
  formato         text               not null,
  arquivo_path    text,
  status          status_exportacao  not null default 'agendada',
  created_at      timestamptz        not null default now(),
  updated_at      timestamptz        not null default now(),
  finished_at     timestamptz,
  constraint chk_periodo_exportacao check (periodo_fim >= periodo_inicio),
  constraint chk_exportacao_formato check (formato in ('csv', 'json'))
);

comment on table public.exportacoes is 'RF29: Exportação de diários de classe para ponte SIGE. Formatos CSV/JSON.';

create table public.auditoria (
  id               uuid        primary key default gen_random_uuid(),
  usuario_id       uuid        references public.perfis(id) on delete set null,
  acao             text        not null,
  entidade         text        not null,
  entidade_id      uuid,
  dados_anteriores jsonb,
  dados_novos      jsonb,
  ip_origem        inet,
  created_at       timestamptz not null default now()
);

comment on table public.auditoria is 'RD01: Trilha de auditoria LGPD (Art. 14). Rastreia alterações em dados de menores.';

-- ============================================================================
-- 13. TABELA — CONVITES
-- ============================================================================

create table public.convites (
  id             uuid        primary key default gen_random_uuid(),
  email          text        not null,
  papel          papel_perfil not null,
  nome_convidado text,
  enviado_por    uuid        not null references public.perfis(id) on delete restrict,
  status         text        not null default 'pendente',
  expira_em      timestamptz not null,
  aceito_em      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint chk_convite_status check (status in ('pendente', 'aceito', 'expirado', 'revogado'))
);

comment on table public.convites is 'RF02/RF03: Registro de convites para onboarding via Supabase Admin API.';

-- ============================================================================
-- 14. TRIGGERS — UPDATED_AT (gerados dinamicamente)
-- ============================================================================

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'anos_letivos', 'configuracoes_escola', 'configuracoes_sistema',
    'horarios_letivos', 'disciplinas', 'perfis', 'turmas', 'alunos',
    'enturmacoes', 'vinculos_responsaveis', 'atribuicoes_professores',
    'tags_comportamento', 'frequencias', 'registros_comportamento',
    'ocorrencias', 'anexos', 'justificativas_faltas', 'conversas',
    'mensagens', 'monitoramento_acoes', 'pontuacao_turmas',
    'importacoes_log', 'exportacoes', 'convites'
  ])
  loop
    execute format(
      'create trigger trg_set_updated_at before update on public.%I
       for each row execute function public.fn_set_updated_at();', t
    );
  end loop;
end;
$$;

-- ============================================================================
-- 15. TRIGGER — CRIAÇÃO AUTOMÁTICA DE PERFIL
-- ============================================================================

create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, email, nome, papel)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'papel')::public.papel_perfil, 'responsavel')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.fn_handle_new_user();

comment on function public.fn_handle_new_user is 'Cria perfil automaticamente ao registrar em auth.users. Usa raw_user_meta_data apenas no signup inicial (único momento confiável).';

-- ============================================================================
-- 16. TRIGGER — ANTI-BURNOUT DO CHAT (RF27)
-- ============================================================================

create or replace function public.fn_chk_horario_mensagem()
returns trigger
language plpgsql
as $$
declare
  dia_atual    smallint;
  hora_atual   time;
  dentro_janela boolean;
begin
  if new.is_system_message then
    return new;
  end if;

  dia_atual := extract(dow from now());
  hora_atual := now()::time;

  select exists(
    select 1
    from public.horarios_letivos h
    where h.ativo
      and h.dia_semana = dia_atual
      and hora_atual between h.hora_inicio and h.hora_fim
  ) into dentro_janela;

  if not dentro_janela then
    raise exception 'Chat bloqueado fora do horario letivo (RF27). Horario de atendimento: dias uteis em periodo escolar.';
  end if;

  return new;
end;
$$;

create trigger trg_chk_horario_mensagem
  before insert on public.mensagens
  for each row
  execute function public.fn_chk_horario_mensagem();

-- ============================================================================
-- 17. FUNÇÕES AUXILIARES — RLS
-- ============================================================================

create or replace function public.get_user_papel()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select papel::text
  from public.perfis
  where id = auth.uid()
    and status = 'ativo'
  limit 1;
$$;

create or replace function public.is_professor_da_turma(p_turma_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.atribuicoes_professores
    where professor_id = auth.uid()
      and turma_id = p_turma_id
      and ativo = true
      and (data_fim is null or data_fim >= current_date)
  );
$$;

create or replace function public.is_responsavel_do_aluno(p_aluno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vinculos_responsaveis
    where responsavel_id = auth.uid()
      and aluno_id = p_aluno_id
      and ativo = true
  );
$$;

create or replace function public.get_turma_do_aluno(p_aluno_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.turma_id
  from public.enturmacoes e
  where e.aluno_id = p_aluno_id
    and e.status = 'matriculado'
  limit 1;
$$;

-- Mantida para compatibilidade com código existente, mas prefira get_user_papel()
create or replace function public.pertence_grupo(papel_esperado text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and papel::text = papel_esperado
      and status = 'ativo'
  );
$$;

-- ============================================================================
-- 18. ROW LEVEL SECURITY
-- ============================================================================

alter table public.anos_letivos               enable row level security;
alter table public.configuracoes_escola        enable row level security;
alter table public.configuracoes_sistema       enable row level security;
alter table public.horarios_letivos            enable row level security;
alter table public.disciplinas                 enable row level security;
alter table public.perfis                      enable row level security;
alter table public.turmas                      enable row level security;
alter table public.alunos                      enable row level security;
alter table public.enturmacoes                 enable row level security;
alter table public.vinculos_responsaveis       enable row level security;
alter table public.atribuicoes_professores     enable row level security;
alter table public.tags_comportamento          enable row level security;
alter table public.anexos                      enable row level security;
alter table public.ocorrencia_anexos           enable row level security;
alter table public.justificativa_anexos        enable row level security;
alter table public.frequencias                 enable row level security;
alter table public.registros_comportamento     enable row level security;
alter table public.registro_comportamento_tags enable row level security;
alter table public.ocorrencias                 enable row level security;
alter table public.justificativas_faltas       enable row level security;
alter table public.conversas                   enable row level security;
alter table public.mensagens                   enable row level security;
alter table public.monitoramento_acoes enable row level security;
alter table public.pontuacao_turmas            enable row level security;
alter table public.notificacoes                enable row level security;
alter table public.importacoes_log             enable row level security;
alter table public.exportacoes                 enable row level security;
alter table public.auditoria                   enable row level security;
alter table public.convites                    enable row level security;

-- ============================================================================
-- 18.1 PERFIS
-- ============================================================================

create policy "Perfis: leitura propria"
  on public.perfis for select
  to authenticated
  using (id = auth.uid());

create policy "Perfis: gestao le todos"
  on public.perfis for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

create policy "Perfis: professor le basico"
  on public.perfis for select
  to authenticated
  using (public.get_user_papel() = 'professor');

create policy "Perfis: atualizacao propria"
  on public.perfis for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Perfis: gestao atualiza"
  on public.perfis for update
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

create policy "Perfis: gestao insere"
  on public.perfis for insert
  to authenticated
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.2 ANOS LETIVOS
-- ============================================================================

create policy "Anos: leitura autenticados"
  on public.anos_letivos for select
  to authenticated
  using (true);

create policy "Anos: gestao gerencia"
  on public.anos_letivos for insert
  to authenticated
  with check (public.get_user_papel() = 'gestao');

create policy "Anos: gestao atualiza"
  on public.anos_letivos for update
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.3 CONFIGURAÇÕES
-- ============================================================================

create policy "Config: leitura autenticados"
  on public.configuracoes_escola for select
  to authenticated
  using (true);

create policy "Config: gestao gerencia"
  on public.configuracoes_escola for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

create policy "ConfigSis: leitura autenticados"
  on public.configuracoes_sistema for select
  to authenticated
  using (true);

create policy "ConfigSis: gestao gerencia"
  on public.configuracoes_sistema for update
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.4 HORÁRIOS LETIVOS
-- ============================================================================

create policy "Horarios: leitura autenticados"
  on public.horarios_letivos for select
  to authenticated
  using (true);

create policy "Horarios: gestao gerencia"
  on public.horarios_letivos for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.5 DISCIPLINAS
-- ============================================================================

create policy "Disciplinas: leitura autenticados"
  on public.disciplinas for select
  to authenticated
  using (true);

create policy "Disciplinas: gestao gerencia"
  on public.disciplinas for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.6 TURMAS
-- ============================================================================

create policy "Turmas: leitura autenticados"
  on public.turmas for select
  to authenticated
  using (true);

create policy "Turmas: gestao gerencia"
  on public.turmas for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.7 ALUNOS
-- ============================================================================

create policy "Alunos: gestao tudo"
  on public.alunos for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

create policy "Alunos: professor le da sua turma"
  on public.alunos for select
  to authenticated
  using (
    public.get_user_papel() = 'professor'
    and exists (
      select 1 from public.enturmacoes e
      join public.atribuicoes_professores ap on ap.turma_id = e.turma_id
      where e.aluno_id = alunos.id
        and e.status = 'matriculado'
        and ap.professor_id = auth.uid()
        and ap.ativo = true
        and (ap.data_fim is null or ap.data_fim >= current_date)
    )
  );

create policy "Alunos: responsavel le vinculados"
  on public.alunos for select
  to authenticated
  using (
    public.get_user_papel() = 'responsavel'
    and public.is_responsavel_do_aluno(id)
  );

-- ============================================================================
-- 18.8 ENTURMAÇÕES
-- ============================================================================

create policy "Enturm: gestao tudo"
  on public.enturmacoes for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

create policy "Enturm: professor le da sua turma"
  on public.enturmacoes for select
  to authenticated
  using (
    public.get_user_papel() = 'professor'
    and public.is_professor_da_turma(turma_id)
  );

create policy "Enturm: responsavel le do dependente"
  on public.enturmacoes for select
  to authenticated
  using (
    public.get_user_papel() = 'responsavel'
    and public.is_responsavel_do_aluno(aluno_id)
  );

-- ============================================================================
-- 18.9 VÍNCULOS RESPONSÁVEIS
-- ============================================================================

create policy "Vinculos: responsavel le proprios"
  on public.vinculos_responsaveis for select
  to authenticated
  using (responsavel_id = auth.uid());

create policy "Vinculos: gestao tudo"
  on public.vinculos_responsaveis for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.10 ATRIBUIÇÕES PROFESSORES
-- ============================================================================

create policy "Atrib: leitura autenticados"
  on public.atribuicoes_professores for select
  to authenticated
  using (true);

create policy "Atrib: gestao gerencia"
  on public.atribuicoes_professores for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.11 TAGS COMPORTAMENTO
-- ============================================================================

create policy "Tags: leitura autenticados"
  on public.tags_comportamento for select
  to authenticated
  using (true);

create policy "Tags: gestao gerencia"
  on public.tags_comportamento for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.12 FREQUÊNCIAS
-- ============================================================================

create policy "Freq: gestao le todas"
  on public.frequencias for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

create policy "Freq: professor le da sua turma"
  on public.frequencias for select
  to authenticated
  using (
    public.get_user_papel() = 'professor'
    and public.is_professor_da_turma(turma_id)
  );

create policy "Freq: responsavel le do dependente"
  on public.frequencias for select
  to authenticated
  using (
    public.get_user_papel() = 'responsavel'
    and public.is_responsavel_do_aluno(aluno_id)
  );

create policy "Freq: professor insere"
  on public.frequencias for insert
  to authenticated
  with check (
    public.get_user_papel() = 'professor'
    and professor_id = auth.uid()
  );

create policy "Freq: gestao insere"
  on public.frequencias for insert
  to authenticated
  with check (
    public.get_user_papel() = 'gestao'
  );

create policy "Freq: gestao atualiza"
  on public.frequencias for update
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.13 REGISTROS COMPORTAMENTO
-- ============================================================================

create policy "Comport: gestao le todos"
  on public.registros_comportamento for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

create policy "Comport: professor le da sua turma"
  on public.registros_comportamento for select
  to authenticated
  using (
    public.get_user_papel() = 'professor'
    and public.is_professor_da_turma(turma_id)
  );

create policy "Comport: responsavel le do dependente"
  on public.registros_comportamento for select
  to authenticated
  using (
    public.get_user_papel() = 'responsavel'
    and public.is_responsavel_do_aluno(aluno_id)
  );

create policy "Comport: professor insere"
  on public.registros_comportamento for insert
  to authenticated
  with check (
    public.get_user_papel() = 'professor'
    and professor_id = auth.uid()
  );

-- ============================================================================
-- 18.14 REGISTRO COMPORTAMENTO TAGS
-- ============================================================================

create policy "CompTags: gestao le todos"
  on public.registro_comportamento_tags for select
  to authenticated
  using (
    exists (
      select 1 from public.registros_comportamento rc
      where rc.id = registro_id
        and (public.get_user_papel() = 'gestao'
          or (public.get_user_papel() = 'professor'
            and public.is_professor_da_turma(rc.turma_id))
          or (public.get_user_papel() = 'responsavel'
            and public.is_responsavel_do_aluno(rc.aluno_id))
        )
    )
  );

create policy "CompTags: professor insere"
  on public.registro_comportamento_tags for insert
  to authenticated
  with check (
    exists (
      select 1 from public.registros_comportamento rc
      where rc.id = registro_id
        and rc.professor_id = auth.uid()
    )
  );

-- ============================================================================
-- 18.15 OCORRÊNCIAS
-- ============================================================================

create policy "Ocorr: gestao le todas"
  on public.ocorrencias for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

create policy "Ocorr: professor le da sua turma"
  on public.ocorrencias for select
  to authenticated
  using (
    public.get_user_papel() = 'professor'
    and public.is_professor_da_turma(turma_id)
  );

create policy "Ocorr: responsavel le do dependente"
  on public.ocorrencias for select
  to authenticated
  using (
    public.get_user_papel() = 'responsavel'
    and public.is_responsavel_do_aluno(aluno_id)
  );

create policy "Ocorr: professor insere"
  on public.ocorrencias for insert
  to authenticated
  with check (
    public.get_user_papel() = 'professor'
    and professor_id = auth.uid()
  );

create policy "Ocorr: gestao insere"
  on public.ocorrencias for insert
  to authenticated
  with check (
    public.get_user_papel() = 'gestao'
  );

create policy "Ocorr: gestao atualiza"
  on public.ocorrencias for update
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.16 ANEXOS
-- ============================================================================

create policy "Anexos: gestao tudo"
  on public.anexos for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

create policy "Anexos: gestao ve"
  on public.anexos for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

create policy "Anexos: cria proprio"
  on public.anexos for insert
  to authenticated
  with check (criado_por = auth.uid());

-- ============================================================================
-- 18.17 OCORRENCIA ANEXOS
-- ============================================================================

create policy "OcorrAnexos: gestao tudo"
  on public.ocorrencia_anexos for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

create policy "OcorrAnexos: le quem ve ocorrencia"
  on public.ocorrencia_anexos for select
  to authenticated
  using (
    exists (
      select 1 from public.ocorrencias o
      where o.id = ocorrencia_id
        and (public.get_user_papel() = 'gestao'
          or (public.get_user_papel() = 'professor'
            and public.is_professor_da_turma(o.turma_id))
          or (public.get_user_papel() = 'responsavel'
            and public.is_responsavel_do_aluno(o.aluno_id))
        )
    )
  );

-- ============================================================================
-- 18.18 JUSTIFICATIVAS FALTAS
-- ============================================================================

create policy "JustFaltas: responsavel ve proprias"
  on public.justificativas_faltas for select
  to authenticated
  using (responsavel_id = auth.uid());

create policy "JustFaltas: gestao ve todas"
  on public.justificativas_faltas for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

create policy "JustFaltas: professor ve da sua turma"
  on public.justificativas_faltas for select
  to authenticated
  using (
    public.get_user_papel() = 'professor'
    and exists (
      select 1 from public.frequencias f
      where f.id = frequencia_id
        and public.is_professor_da_turma(f.turma_id)
    )
  );

create policy "JustFaltas: responsavel insere"
  on public.justificativas_faltas for insert
  to authenticated
  with check (
    public.get_user_papel() = 'responsavel'
    and responsavel_id = auth.uid()
  );

create policy "JustFaltas: gestao avalia"
  on public.justificativas_faltas for update
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.19 JUSTIFICATIVA ANEXOS
-- ============================================================================

create policy "JustAnexos: gestao tudo"
  on public.justificativa_anexos for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

create policy "JustAnexos: responsavel insere"
  on public.justificativa_anexos for insert
  to authenticated
  with check (
    public.get_user_papel() = 'responsavel'
    and exists (
      select 1 from public.justificativas_faltas j
      where j.id = justificativa_id
        and j.responsavel_id = auth.uid()
    )
  );

create policy "JustAnexos: gestao le"
  on public.justificativa_anexos for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.20 CONVERSAS
-- ============================================================================

create policy "Conv: participante le"
  on public.conversas for select
  to authenticated
  using (responsavel_id = auth.uid() or auth.uid() in (
    select professor_id from public.atribuicoes_professores where turma_id = conversas.turma_id
  ));

create policy "Conv: gestao le todas"
  on public.conversas for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

create policy "Conv: participante cria"
  on public.conversas for insert
  to authenticated
  with check (responsavel_id = auth.uid());

create policy "Conv: gestao encerra"
  on public.conversas for update
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.21 MENSAGENS
-- ============================================================================

create policy "Msg: participante le"
  on public.mensagens for select
  to authenticated
  using (
    exists (
      select 1 from public.conversas c
      where c.id = conversa_id
        and (c.responsavel_id = auth.uid()
          or auth.uid() in (
            select professor_id from public.atribuicoes_professores where turma_id = c.turma_id
          )
          or public.get_user_papel() = 'gestao')
    )
  );

create policy "Msg: participante envia"
  on public.mensagens for insert
  to authenticated
  with check (remetente_id = auth.uid());

create policy "Msg: marca lida"
  on public.mensagens for update
  to authenticated
  using (
    exists (
      select 1 from public.conversas c
      where c.id = conversa_id
        and (c.responsavel_id = auth.uid()
          or auth.uid() in (
            select professor_id from public.atribuicoes_professores where turma_id = c.turma_id
          ))
    )
  )
  with check (lida_em is not null);

-- ============================================================================
-- 18.22 MONITORAMENTO AÇÕES
-- ============================================================================

create policy "Monitoramento: gestao tudo"
  on public.monitoramento_acoes for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

create policy "Monitoramento: leitura ampla"
  on public.monitoramento_acoes for select
  to authenticated
  using (true);

-- ============================================================================
-- 18.23 PONTUAÇÃO TURMAS
-- ============================================================================

create policy "Pontuacao: leitura autenticados"
  on public.pontuacao_turmas for select
  to authenticated
  using (true);

create policy "Pontuacao: gestao gerencia"
  on public.pontuacao_turmas for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.24 NOTIFICAÇÕES
-- ============================================================================

create policy "Notif: destinatario le proprias"
  on public.notificacoes for select
  to authenticated
  using (destinatario_id = auth.uid());

create policy "Notif: sistema cria"
  on public.notificacoes for insert
  to authenticated
  with check (public.get_user_papel() in ('gestao', 'professor') or destinatario_id <> auth.uid());

-- ============================================================================
-- 18.25 IMPORTAÇÕES LOG
-- ============================================================================

create policy "Import: gestao tudo"
  on public.importacoes_log for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.26 EXPORTAÇÕES
-- ============================================================================

create policy "Export: gestao tudo"
  on public.exportacoes for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.27 AUDITORIA
-- ============================================================================

create policy "Auditoria: gestao le"
  on public.auditoria for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 18.28 CONVITES
-- ============================================================================

create policy "Convites: gestao tudo"
  on public.convites for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- ============================================================================
-- 19. VIEWS (com security_invoker = true para não bypassar RLS)
-- ============================================================================

-- 19.1 Ranking de Monitoramento (RF12)
create or replace view public.v_ranking_monitoramento
with (security_invoker = true)
as
with faltas_aluno as (
  select
    a.id as aluno_id,
    a.nome as aluno_nome,
    a.matricula,
    t.id as turma_id,
    t.nome_completo as turma_nome,
    al.ano,
    count(f.id) filter (where f.status = 'ausente') as faltas_totais,
    count(f.id) filter (where f.status = 'ausente' and f.tipo_registro = 'entrada_portao') as faltas_portao,
    count(f.id) filter (where f.status = 'ausente' and f.tipo_registro = 'chamada_aula') as faltas_aula,
    max(f.data_aula) filter (where f.status = 'ausente') as ultima_falta
  from public.alunos a
  join public.enturmacoes e on e.aluno_id = a.id and e.status = 'matriculado'
  join public.turmas t on t.id = e.turma_id
  join public.anos_letivos al on al.id = e.ano_letivo_id and al.ativo = true
  left join public.frequencias f on f.aluno_id = a.id and f.deleted_at is null
  where a.status = 'ativo'
  group by a.id, a.nome, a.matricula, t.id, t.nome_completo, al.ano
)
select
  fa.*,
  cs.limite_critico_faltas,
  case
    when fa.faltas_totais >= cs.limite_critico_faltas then 'critico'
    when fa.faltas_totais >= cs.limite_preventivo_faltas then 'atencao'
    else 'ok'
  end as nivel_risco,
  (select string_agg(distinct p.telefone, ', ')
   from public.vinculos_responsaveis vr
   join public.perfis p on p.id = vr.responsavel_id
   where vr.aluno_id = fa.aluno_id and vr.ativo and p.telefone is not null
  ) as telefones_responsaveis,
  (select count(*) from public.monitoramento_acoes ba
   where ba.aluno_id = fa.aluno_id and ba.status = 'pendente'
  ) as acoes_pendentes
from faltas_aluno fa
cross join public.configuracoes_sistema cs
order by fa.faltas_totais desc;

comment on view public.v_ranking_monitoramento is 'RF12: Fila de priorização de risco. Alunos que atingiram limite crítico de infrequência.';

-- 19.2 Termômetro do Aluno (verde/amarelo/vermelho)
create or replace view public.v_termometro_aluno
with (security_invoker = true)
as
select
  a.id as aluno_id,
  a.nome,
  t.nome_completo as turma_nome,
  al.ano,
  count(f.id) filter (where f.status = 'ausente') as faltas_totais,
  count(distinct f.data_aula) filter (where f.status = 'ausente' and f.tipo_registro = 'entrada_portao') as dias_ausente,
  case
    when count(f.id) filter (where f.status = 'ausente') >= cs.limite_critico_faltas then 'vermelho'
    when count(f.id) filter (where f.status = 'ausente') >= cs.limite_preventivo_faltas then 'amarelo'
    else 'verde'
  end as cor_termometro
from public.alunos a
join public.enturmacoes e on e.aluno_id = a.id and e.status = 'matriculado'
join public.turmas t on t.id = e.turma_id
join public.anos_letivos al on al.id = e.ano_letivo_id and al.ativo = true
left join public.frequencias f on f.aluno_id = a.id and f.deleted_at is null
cross join public.configuracoes_sistema cs
where a.status = 'ativo'
group by a.id, a.nome, t.nome_completo, al.ano, cs.limite_critico_faltas, cs.limite_preventivo_faltas;

comment on view public.v_termometro_aluno is 'Termômetro visual de atenção: verde (ok), amarelo (preventivo), vermelho (crítico).';

-- 19.3 Feed de Linha do Tempo do Aluno (RF22)
create or replace view public.v_feed_aluno
with (security_invoker = true)
as
select
  f.aluno_id,
  f.data_aula as data_evento,
  f.created_at,
  'frequencia' as tipo_evento,
  jsonb_build_object(
    'tipo_registro', f.tipo_registro,
    'periodo', f.periodo,
    'status', f.status,
    'disciplina', d.nome,
    'observacao', f.observacao
  ) as detalhes
from public.frequencias f
left join public.disciplinas d on d.id = f.disciplina_id
where f.deleted_at is null

union all

select
  rc.aluno_id,
  rc.data_hora::date,
  rc.data_hora,
  'comportamento',
  jsonb_build_object(
    'observacao', rc.observacao,
    'tags', (
      select jsonb_agg(jsonb_build_object('nome', tg.nome, 'categoria', tg.categoria))
      from public.registro_comportamento_tags rct
      join public.tags_comportamento tg on tg.id = rct.tag_id
      where rct.registro_id = rc.id
    )
  )
from public.registros_comportamento rc

union all

select
  o.aluno_id,
  o.data_ocorrencia::date,
  o.data_ocorrencia,
  'ocorrencia',
  jsonb_build_object(
    'titulo', o.titulo,
    'tipo', o.tipo,
    'status', o.status,
    'exige_presenca', o.exige_presenca_responsavel
  )
from public.ocorrencias o

order by data_evento desc, created_at desc;

comment on view public.v_feed_aluno is 'RF22: Timeline unificada do aluno. Consolida frequências, comportamentos e ocorrências.';

-- 19.4 Ranking de Gamificação Interturmas (RF28)
create or replace view public.v_gamificacao_ranking
with (security_invoker = true)
as
select
  t.id as turma_id,
  t.nome_completo as turma_nome,
  t.serie,
  t.letra,
  al.ano,
  coalesce(sum(pt.pontos_total), 0) as pontos_total,
  coalesce(avg(pt.pontos_presenca), 0) as media_presenca,
  coalesce(avg(pt.pontos_comportamento), 0) as media_comportamento,
  rank() over (partition by al.ano order by coalesce(sum(pt.pontos_total), 0) desc) as posicao_ranking
from public.turmas t
join public.anos_letivos al on al.id = t.ano_letivo_id and al.ativo = true
left join public.pontuacao_turmas pt on pt.turma_id = t.id and pt.ano_letivo_id = al.id
group by t.id, t.nome_completo, t.serie, t.letra, al.ano;

comment on view public.v_gamificacao_ranking is 'RF28: Leaderboard interturmas baseado na pontuação mensal acumulada.';

-- 19.5 Pontuação Diária das Turmas (para refresh da gamificação)
create or replace view public.v_pontuacao_diaria_turmas
with (security_invoker = true)
as
select
  t.id as turma_id,
  t.nome_completo as turma_nome,
  f.data_aula as data_referencia,
  count(distinct f.aluno_id) filter (where f.status = 'presente') as total_presentes,
  count(distinct e.aluno_id) as total_alunos,
  round(
    (count(distinct f.aluno_id) filter (where f.status = 'presente'))::numeric /
    nullif(count(distinct e.aluno_id), 0) * 100,
    2
  ) as percentual_presenca,
  count(distinct rc.id) filter (where tc.categoria = 'positivo') as comportamentos_positivos,
  count(distinct rc.id) filter (where tc.categoria = 'atencao') as comportamentos_atencao
from public.turmas t
join public.enturmacoes e on e.turma_id = t.id and e.status = 'matriculado'
left join public.frequencias f on f.turma_id = t.id and f.deleted_at is null
left join public.registros_comportamento rc on rc.turma_id = t.id
left join public.registro_comportamento_tags rct on rct.registro_id = rc.id
left join public.tags_comportamento tc on tc.id = rct.tag_id
group by t.id, t.nome_completo, f.data_aula;

comment on view public.v_pontuacao_diaria_turmas is 'RF28: Base para cálculo dos snapshots mensais de gamificação.';

-- ============================================================================
-- 20. ÍNDICES DE PERFORMANCE
-- ============================================================================

-- Frequências
create index idx_frequencias_aluno_data on public.frequencias (aluno_id, data_aula);
create index idx_frequencias_turma_data on public.frequencias (turma_id, data_aula);
create index idx_frequencias_professor on public.frequencias (professor_id);
create index idx_frequencias_ano on public.frequencias (ano_letivo_id);
create index idx_frequencias_status on public.frequencias (status);
create unique index idx_frequencias_unicidade
  on public.frequencias (aluno_id, data_aula, tipo_registro, periodo, coalesce(disciplina_id::text, ''))
  where deleted_at is null;

-- Registros Comportamento
create index idx_comportamento_aluno_data on public.registros_comportamento (aluno_id, data_hora);
create index idx_comportamento_turma_data on public.registros_comportamento (turma_id, data_hora);
create index idx_comportamento_professor on public.registros_comportamento (professor_id);
create index idx_comportamento_ano on public.registros_comportamento (ano_letivo_id);

-- Tags Comportamento
create index idx_comportamento_tags_tag on public.registro_comportamento_tags (tag_id);
create index idx_comportamento_tags_registro on public.registro_comportamento_tags (registro_id);

-- Ocorrências
create index idx_ocorrencias_aluno on public.ocorrencias (aluno_id);
create index idx_ocorrencias_turma on public.ocorrencias (turma_id);
create index idx_ocorrencias_status on public.ocorrencias (status);
create index idx_ocorrencias_ano on public.ocorrencias (ano_letivo_id);
create index idx_ocorrencias_presenca_pendente
  on public.ocorrencias (aluno_id)
  where exige_presenca_responsavel and not presenca_responsavel_confirmada;

-- Alunos
create index idx_alunos_matricula on public.alunos (matricula);
create index idx_alunos_nome_trgm on public.alunos using gin (nome gin_trgm_ops);

-- Enturmações
create index idx_enturmacoes_aluno on public.enturmacoes (aluno_id);
create index idx_enturmacoes_turma on public.enturmacoes (turma_id);
create index idx_enturmacoes_ano on public.enturmacoes (ano_letivo_id);
create index idx_enturmacoes_status on public.enturmacoes (status);

-- Perfis
create index idx_perfis_papel on public.perfis (papel) where status = 'ativo';

-- Vínculos
create index idx_vinculos_responsavel on public.vinculos_responsaveis (responsavel_id);
create index idx_vinculos_aluno on public.vinculos_responsaveis (aluno_id);

-- Atribuições
create index idx_atribuicoes_professor on public.atribuicoes_professores (professor_id);
create index idx_atribuicoes_turma on public.atribuicoes_professores (turma_id);
create index idx_atribuicoes_vigente on public.atribuicoes_professores (professor_id) where ativo;

-- Justificativas
create index idx_justificativas_aluno on public.justificativas_faltas (aluno_id);
create index idx_justificativas_responsavel on public.justificativas_faltas (responsavel_id);
create index idx_justificativas_status on public.justificativas_faltas (status) where status = 'pendente';

-- Conversas e Mensagens
create index idx_conversas_responsavel on public.conversas (responsavel_id);
create index idx_conversas_turma on public.conversas (turma_id);
create index idx_mensagens_conversa on public.mensagens (conversa_id, created_at);
create index idx_mensagens_remetente on public.mensagens (remetente_id);
create index idx_mensagens_nao_lidas on public.mensagens (conversa_id) where lida_em is null;

-- Monitoramento
create index idx_monitoramento_aluno on public.monitoramento_acoes (aluno_id);
create index idx_monitoramento_status on public.monitoramento_acoes (status) where status in ('pendente', 'em_andamento');

-- Gamificação
create index idx_pontuacao_ranking on public.pontuacao_turmas (ano_letivo_id, mes_referencia, pontos_total desc);

-- Notificações
create index idx_notificacoes_destinatario on public.notificacoes (destinatario_id, lida, created_at desc);

-- Anexos
create index idx_anexos_expurgo on public.anexos (expurgo_em) where expurgado_em is null;

-- Auditoria
create index idx_auditoria_entidade on public.auditoria (entidade, entidade_id);
create index idx_auditoria_usuario on public.auditoria (usuario_id, created_at desc);

-- Convites
create index idx_convites_status on public.convites (status, expira_em);

-- ============================================================================
-- 21. GRANTS — DATA API (Supabase)
-- ============================================================================

-- Leitura para autenticados em todas as tabelas (RLS filtra por linha)
grant select on all tables in schema public to authenticated;

-- Inserção/atualização nas tabelas operacionais
grant insert, update on public.frequencias to authenticated;
grant insert, update on public.registros_comportamento to authenticated;
grant insert on public.registro_comportamento_tags to authenticated;
grant insert, update on public.ocorrencias to authenticated;
grant insert, update on public.justificativas_faltas to authenticated;
grant insert on public.justificativa_anexos to authenticated;
grant insert, update on public.conversas to authenticated;
grant insert, update on public.mensagens to authenticated;
grant insert on public.anexos to authenticated;
grant insert on public.ocorrencia_anexos to authenticated;
grant insert, update on public.monitoramento_acoes to authenticated;
grant insert, update on public.perfis to authenticated;
grant insert, update on public.alunos to authenticated;
grant insert, update on public.vinculos_responsaveis to authenticated;
grant insert, update on public.enturmacoes to authenticated;
grant insert, update on public.turmas to authenticated;
grant insert, update on public.anos_letivos to authenticated;
grant insert, update on public.atribuicoes_professores to authenticated;
grant insert, update on public.tags_comportamento to authenticated;
grant insert, update on public.horarios_letivos to authenticated;
grant insert, update on public.disciplinas to authenticated;
grant insert, update on public.configuracoes_escola to authenticated;
grant insert, update on public.importacoes_log to authenticated;
grant insert, update on public.exportacoes to authenticated;
grant insert, update on public.convites to authenticated;
grant insert on public.notificacoes to authenticated;
grant insert on public.pontuacao_turmas to authenticated;

-- Uso de sequências (se houver)
grant usage on all sequences in schema public to authenticated;

-- ============================================================================
-- 22. CUSTOM ACCESS TOKEN HOOK
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  perfil_nome text;
  perfil_papel text;
begin
  select p.nome, p.papel::text into perfil_nome, perfil_papel
  from public.perfis p
  where p.id = (event->>'user_id')::uuid;

  if not found then
    return event;
  end if;

  claims := event->'claims';

  claims := jsonb_set(claims, '{nome}', to_jsonb(perfil_nome));
  claims := jsonb_set(claims, '{papel}', to_jsonb(perfil_papel));

  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- ============================================================================
-- 23. PRE-REQUEST HOOK (JWT enforcement)
-- ============================================================================

create or replace function public.requisicao_exige_jwt()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text;
begin
  jwt_role := current_setting('request.jwt.claims', true)::json->>'role';

  if jwt_role is null or jwt_role = 'anon' then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code',    'PGRST401',
        'message', 'Token JWT ausente ou invalido. Autentique-se para acessar a API.'
      )::text,
      detail = json_build_object(
        'status',  401,
        'headers', json_build_object()
      )::text;
  end if;
end;
$$;

alter role authenticator set pgrst.db_pre_request = 'public.requisicao_exige_jwt';
notify pgrst, 'reload config';

-- Revoga EXECUTE de pertence_grupo para anon (segurança adicional)
revoke execute on function public.pertence_grupo from anon;
revoke execute on function public.get_user_papel from anon;
revoke execute on function public.is_professor_da_turma from anon;
revoke execute on function public.is_responsavel_do_aluno from anon;
revoke execute on function public.get_turma_do_aluno from anon;
-- ============================================================================
-- Migration: codigos_redefinicao
-- Descricao: Tabela de codigos para redefinicao de senha, funcoes auxiliares
--            e alteracao do enum tipo_notificacao.
-- ============================================================================

-- ============================================================================
-- 1. ALTERAR ENUM
-- ============================================================================
alter type public.tipo_notificacao add value 'codigo_redefinicao';

-- ============================================================================
-- 2. TABELA CODIGOS_REDEFINICAO
-- ============================================================================
create table public.codigos_redefinicao (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  perfil_id  uuid        not null references public.perfis(id) on delete cascade,
  codigo     text        not null,
  criado_por uuid        references public.perfis(id) on delete set null,
  usado_em   timestamptz,
  expira_em  timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.codigos_redefinicao is
  'Codigos de uso unico para redefinicao de senha via administracao. Expira em 1 hora.';

create index idx_codigos_redefinicao_email on public.codigos_redefinicao(email);
create index idx_codigos_redefinicao_email_codigo on public.codigos_redefinicao(email, codigo);

-- ============================================================================
-- 3. FUNCOES AUXILIARES
-- ============================================================================

create or replace function public.fn_gerar_codigo_redefinicao(
  p_perfil_id uuid,
  p_criado_por uuid default auth.uid()
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
  v_email  text;
begin
  if public.get_user_papel() != 'gestao' then
    raise exception 'Apenas a gestao pode gerar codigos de redefinicao.';
  end if;

  select email into v_email
  from public.perfis
  where id = p_perfil_id and status = 'ativo';

  if v_email is null then
    raise exception 'Perfil nao encontrado ou inativo.';
  end if;

  v_codigo := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into public.codigos_redefinicao (email, perfil_id, codigo, criado_por)
  values (v_email, p_perfil_id, v_codigo, p_criado_por);

  return v_codigo;
end;
$$;

comment on function public.fn_gerar_codigo_redefinicao is
  'Gera um codigo de 6 digitos para redefinicao de senha. Apenas gestao.';

create or replace function public.fn_solicitar_codigo_redefinicao(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil_id uuid;
  v_papel     text;
  v_nome      text;
begin
  select id, papel::text, nome into v_perfil_id, v_papel, v_nome
  from public.perfis
  where email = p_email and status = 'ativo';

  if v_perfil_id is not null then
    insert into public.notificacoes (destinatario_id, tipo, titulo, corpo, metadados)
    select
      p.id,
      'codigo_redefinicao',
      'Solicitacao de redefinicao de senha',
      'O usuario ' || v_nome || ' (' || p_email || ', ' || v_papel || ') solicitou um codigo para redefinir a senha.',
      jsonb_build_object('email', p_email, 'perfil_id', v_perfil_id)
    from public.perfis p
    where p.papel = 'gestao' and p.status = 'ativo';
  end if;
end;
$$;

comment on function public.fn_solicitar_codigo_redefinicao is
  'Cria notificacoes para todos os usuarios de gestao quando alguem solicita redefinicao de senha.';

-- ============================================================================
-- 3B. FUNCAO CRIAR USUARIO
-- ============================================================================

create or replace function public.fn_criar_usuario(
  p_nome      text,
  p_email     text,
  p_papel     text,
  p_senha     text,
  p_telefone  text default null,
  p_cargo     text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if public.get_user_papel() != 'gestao' then
    raise exception 'Apenas gestao pode criar usuarios.';
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, confirmation_sent_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, email_change_token_current, reauthentication_token, is_sso_user, is_anonymous, created_at, updated_at)
  values (
    v_user_id,
    p_email,
    extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
    jsonb_build_object('email_verified', true, 'nome', p_nome, 'papel', p_papel),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    false,
    now(),
    now()
  );

  update public.perfis
  set telefone = p_telefone,
      cargo = p_cargo,
      status = 'pendente'
  where id = v_user_id;

  return v_user_id;
end;
$$;

comment on function public.fn_criar_usuario is
  'Cria usuario em auth.users com perfil pendente. Apenas gestao. O trigger fn_handle_new_user cria o perfil automaticamente.';

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.codigos_redefinicao enable row level security;

create policy "Codigos: gestao tem acesso total"
  on public.codigos_redefinicao for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

create policy "Codigos: usuario ve seus proprios registros"
  on public.codigos_redefinicao for select
  to authenticated
  using (
    exists (
      select 1 from public.perfis
      where id = auth.uid()
        and email = codigos_redefinicao.email
    )
  );

-- ============================================================================
-- 5. TRIGGER UPDATED_AT
-- ============================================================================
create trigger trg_set_updated_at
  before update on public.codigos_redefinicao
  for each row
  execute function public.fn_set_updated_at();

-- ============================================================================
-- 6. GRANTS — EXPOR TABELAS E FUNCOES VIA DATA API
-- ============================================================================

grant select, insert, update on public.codigos_redefinicao to authenticated, service_role;

-- Permissao DELETE para frequencias (usada pelo fluxo de DELETE+INSERT)
grant delete on public.frequencias to authenticated;

-- Permissao UPDATE para notificacoes (marcar como lida)
grant update on public.notificacoes to authenticated;

-- Permissao INSERT para justificativas (gestao inserir manualmente)
grant insert on public.justificativas_faltas to authenticated;

grant execute on function public.fn_gerar_codigo_redefinicao to authenticated;
grant execute on function public.fn_criar_usuario to authenticated;
grant execute on function public.fn_solicitar_codigo_redefinicao to anon;

-- ============================================================================
-- 7. POLICIES ADICIONAIS
-- ============================================================================

create policy "Freq: professor deleta proprias"
  on public.frequencias for delete
  to authenticated
  using (professor_id = auth.uid() and public.get_user_papel() = 'professor');

create policy "Freq: gestao deleta"
  on public.frequencias for delete
  to authenticated
  using (public.get_user_papel() = 'gestao');

create policy "JustFaltas: gestao insere"
  on public.justificativas_faltas for insert
  to authenticated
  with check (public.get_user_papel() = 'gestao');

create policy "Notif: destinatario atualiza lida"
  on public.notificacoes for update
  to authenticated
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid() and (lida = true or lida_em is not null));
-- ============================================================================
-- Migration: codigos_lifecycle
-- Descricao: Aprimora o ciclo de vida dos codigos de redefinicao:
--   1. Aceita perfil pendente na geracao
--   2. Evita duplicacao de codigos ativos para o mesmo perfil
--   3. Adiciona funcao de revogacao
--   4. Adiciona coluna revogado_em para auditoria
-- ============================================================================

-- ============================================================================
-- 1. COLUNA REVOGADO_EM
-- ============================================================================
alter table public.codigos_redefinicao
  add column if not exists revogado_em timestamptz;

comment on column public.codigos_redefinicao.revogado_em is
  'Preenchido quando um admin revoga manualmente o codigo antes da expiracao natural.';

-- ============================================================================
-- 2. FUNCAO — GERAR CODIGO (REVISADA)
-- ============================================================================
-- Mudancas:
--   - Aceita perfis com status 'ativo' ou 'pendente'
--   - Retorna codigo ativo existente em vez de criar duplicata
-- ============================================================================

create or replace function public.fn_gerar_codigo_redefinicao(
  p_perfil_id uuid,
  p_criado_por uuid default auth.uid()
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
  v_email  text;
  v_existente text;
begin
  if public.get_user_papel() != 'gestao' then
    raise exception 'Apenas a gestao pode gerar codigos de redefinicao.';
  end if;

  -- Verifica se ja existe codigo ativo para este perfil
  select codigo into v_existente
  from public.codigos_redefinicao
  where perfil_id = p_perfil_id
    and usado_em is null
    and expira_em > now()
  order by created_at desc
  limit 1;

  if v_existente is not null then
    return v_existente;
  end if;

  -- Busca email do perfil (aceita ativo ou pendente)
  select email into v_email
  from public.perfis
  where id = p_perfil_id and status in ('ativo', 'pendente');

  if v_email is null then
    raise exception 'Perfil nao encontrado ou inativo.';
  end if;

  v_codigo := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into public.codigos_redefinicao (email, perfil_id, codigo, criado_por)
  values (v_email, p_perfil_id, v_codigo, p_criado_por);

  return v_codigo;
end;
$$;

comment on function public.fn_gerar_codigo_redefinicao is
  'Gera codigo de 6 digitos ou retorna codigo ativo existente. Aceita perfis ativo ou pendente. Apenas gestao.';

-- ============================================================================
-- 3. FUNCAO — REVOGAR CODIGO
-- ============================================================================

create or replace function public.fn_revogar_codigo(p_codigo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.get_user_papel() != 'gestao' then
    raise exception 'Apenas a gestao pode revogar codigos.';
  end if;

  update public.codigos_redefinicao
  set expira_em = now(),
      revogado_em = now()
  where id = p_codigo_id
    and usado_em is null
    and expira_em > now();

  if not found then
    raise exception 'Codigo ja foi usado ou ja expirou.';
  end if;
end;
$$;

comment on function public.fn_revogar_codigo is
  'Revogacao manual de codigo ativo. Define expira_em = now() e registra revogado_em. Lanca erro se ja usado ou expirado.';

-- ============================================================================
-- 4. GRANTS
-- ============================================================================

grant execute on function public.fn_gerar_codigo_redefinicao to authenticated;
grant execute on function public.fn_revogar_codigo to authenticated;
-- ============================================================================
-- Migration: enable_realtime
-- Descricao: Adiciona tabelas necessarias a publication supabase_realtime
--            para que os eventos postgres_changes funcionem.
-- ============================================================================

alter publication supabase_realtime add table public.notificacoes;
alter publication supabase_realtime add table public.codigos_redefinicao;
alter publication supabase_realtime add table public.alunos;
alter publication supabase_realtime add table public.perfis;
alter publication supabase_realtime add table public.ocorrencias;
alter publication supabase_realtime add table public.justificativas_faltas;
alter publication supabase_realtime add table public.frequencias;
-- ============================================================================
-- Migration: Campos extras para formulários da gestão
-- Adiciona colunas de módulos de acesso, permissões, documentos e
-- indicadores nos perfis e alunos.
-- ============================================================================

-- -------- perfis --------
alter table perfis
  add column if not exists acesso_modulos text[] not null default '{}',
  add column if not exists permissoes text[] not null default '{}';

-- -------- alunos --------
alter table alunos
  add column if not exists transporte_escolar boolean not null default false,
  add column if not exists alimentacao_diferenciada boolean not null default false,
  add column if not exists necessidades_especiais boolean not null default false,
  add column if not exists documentos_recebidos text[] not null default '{}';

-- ============================================================================
-- RLS: as novas colunas seguem as políticas já existentes nas tabelas
-- (SELECT/UPDATE/INSERT já são controladas pelas policies de perfis e alunos)
-- ============================================================================
-- ============================================================================
-- Migration: Persistir campos dos formulários do professor
-- Adiciona colunas para tags, notificações e motivos que antes ficavam
-- apenas na UI sem persistência no banco.
-- ============================================================================

-- -------- ocorrencias --------
alter table ocorrencias
  add column if not exists tags_comportamento text[] not null default '{}',
  add column if not exists notificar_coordenacao boolean not null default true,
  add column if not exists notificar_responsavel boolean not null default false;

-- -------- frequencias --------
-- observacao já existe; adicionar coluna para os motivos rápidos
alter table frequencias
  add column if not exists motivos_ausencia text[] not null default '{}';

-- ============================================================================
-- RLS: as novas colunas seguem as políticas já existentes nas tabelas
-- ============================================================================
-- ============================================================================
-- Migration: Tipo de ocorrência como array (multisseleção)
-- Altera tipo de enum único para text[], permitindo marcar
-- "grave" e "suspensão" simultaneamente.
-- ============================================================================

-- a view v_feed_aluno depende da coluna tipo, precisa ser recriada
drop view if exists public.v_feed_aluno;

alter table ocorrencias
  alter column tipo drop default,
  alter column tipo type text[] using array[tipo::text];

-- drop do enum já que não é mais usado
drop type if exists public.tipo_ocorrencia;

-- recria a view com o novo tipo
create or replace view public.v_feed_aluno
with (security_invoker = true)
as
select
  f.aluno_id,
  f.data_aula as data_evento,
  f.created_at,
  'frequencia' as tipo_evento,
  jsonb_build_object(
    'tipo_registro', f.tipo_registro,
    'periodo', f.periodo,
    'status', f.status,
    'disciplina', d.nome,
    'observacao', f.observacao
  ) as detalhes
from public.frequencias f
left join public.disciplinas d on d.id = f.disciplina_id
where f.deleted_at is null

union all

select
  rc.aluno_id,
  rc.data_hora::date,
  rc.data_hora,
  'comportamento',
  jsonb_build_object(
    'observacao', rc.observacao,
    'tags', (
      select jsonb_agg(jsonb_build_object('nome', tg.nome, 'categoria', tg.categoria))
      from public.registro_comportamento_tags rct
      join public.tags_comportamento tg on tg.id = rct.tag_id
      where rct.registro_id = rc.id
    )
  )
from public.registros_comportamento rc

union all

select
  o.aluno_id,
  o.data_ocorrencia::date,
  o.data_ocorrencia,
  'ocorrencia',
  jsonb_build_object(
    'titulo', o.titulo,
    'tipo', o.tipo,
    'status', o.status,
    'exige_presenca', o.exige_presenca_responsavel
  )
from public.ocorrencias o

order by data_evento desc, created_at desc;

comment on view public.v_feed_aluno is 'RF22: Timeline unificada do aluno. Consolida frequências, comportamentos e ocorrências.';

-- ============================================================================
-- Storage: justificativas bucket
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'justificativas',
  'justificativas',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "JustBucket: gestao tudo"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'justificativas' and public.get_user_papel() = 'gestao')
  with check (bucket_id = 'justificativas' and public.get_user_papel() = 'gestao');

create policy "JustBucket: responsavel insere proprio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'justificativas'
    and public.get_user_papel() = 'responsavel'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "JustBucket: responsavel le proprio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'justificativas'
    and public.get_user_papel() = 'responsavel'
    and owner_id = auth.uid()::text
  );

create policy "JustBucket: gestao update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'justificativas' and public.get_user_papel() = 'gestao')
  with check (bucket_id = 'justificativas' and public.get_user_papel() = 'gestao');

-- ============================================================================
-- RLS: Guardian attachment read access
-- ============================================================================

create policy "JustAnexos: responsavel le proprio"
  on public.justificativa_anexos for select
  to authenticated
  using (
    public.get_user_papel() = 'responsavel'
    and exists (
      select 1 from public.justificativas_faltas j
      where j.id = justificativa_id
        and j.responsavel_id = auth.uid()
    )
  );

create policy "Anexos: responsavel le proprio"
  on public.anexos for select
  to authenticated
  using (
    public.get_user_papel() = 'responsavel'
    and criado_por = auth.uid()
  );

-- ============================================================================
-- Trigger: auto-justify frequencies on justification acceptance
-- ============================================================================

create or replace function public.fn_auto_justificar_frequencias()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'aceita' and old.status = 'pendente' then
    update public.frequencias
    set status = 'justificado'
    where aluno_id = new.aluno_id
      and status = 'ausente'
      and data_aula >= new.data_falta
      and data_aula <= coalesce(new.data_fim, new.data_falta)
      and deleted_at is null;
  end if;
  return new;
end;
$$;

create trigger trg_auto_justificar_frequencias
  after update of status on public.justificativas_faltas
  for each row
  when (new.status = 'aceita' and old.status = 'pendente')
  execute function public.fn_auto_justificar_frequencias();
