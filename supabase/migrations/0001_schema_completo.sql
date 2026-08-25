-- Migration unica do schema BuscApp (EEMTI): cobre RF01 a RF29 e RD01 a RD04; convenções e detalhes no README.

-- 1. EXTENSÕES
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- 2. TIPOS ENUMERADOS
create type public.papel_perfil as enum ('professor', 'gestao', 'responsavel');
create type public.status_perfil as enum ('ativo', 'pendente', 'inativo');
create type public.status_aluno as enum ('ativo', 'egresso', 'transferido', 'inativo');
create type public.status_ano_letivo as enum ('planejado', 'ativo', 'arquivado');
create type public.tipo_registro_frequencia as enum ('entrada_portao', 'chamada_aula', 'saida');
create type public.status_frequencia as enum ('presente', 'ausente', 'justificado');
create type public.categoria_tag as enum ('positivo', 'atencao', 'critico');
create type public.status_ocorrencia as enum ('aberta', 'em_andamento', 'resolvida', 'arquivada');
create type public.tipo_contato_busca as enum ('telefone', 'whatsapp', 'presencial', 'carta', 'outro');
create type public.status_monitoramento as enum ('pendente', 'em_andamento', 'realizado', 'sem_contato', 'cancelado');
create type public.status_justificativa as enum ('pendente', 'aceita', 'recusada');
create type public.tipo_notificacao as enum ('ausencia_portao', 'ausencia_aula', 'monitoramento', 'ocorrencia', 'justificativa', 'mensagem', 'sistema', 'codigo_redefinicao');
create type public.status_importacao as enum ('processando', 'concluido', 'parcial', 'falhou');
create type public.status_exportacao as enum ('agendada', 'processando', 'concluida', 'falhou');

-- 3. FUNÇÕES AUXILIARES DE INFRAESTRUTURA (antes das tabelas que as referenciam)

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4. TABELAS: CAMADA DE DOMÍNIO E CONFIGURAÇÃO

-- 4.1 anos_letivos
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

-- 4.2 configuracoes_sistema (single-row, out-of-the-box)
create table public.configuracoes_sistema (
  id                       integer primary key default 1,
  limite_critico_faltas    integer not null default 25,
  limite_preventivo_faltas integer not null default 10,
  dias_expurgo_anexos      integer not null default 30,
  escola_nome              text    not null default 'EEMTI',
  mensagem_fora_horario    text    not null default 'O canal de diálogo está fora do horário escolar. Mensagens enviadas agora serão respondidas quando a coordenação estiver disponível.',
  updated_at               timestamptz not null default now(),
  minutos_validade_codigo  integer not null default 60,
  max_tentativas_codigo    integer not null default 5,
  minutos_bloqueio_codigo  integer not null default 15,
  dias_retencao_codigos    integer not null default 30,
  constraint chk_sistema_singleton check (id = 1)
);

insert into public.configuracoes_sistema (id) values (1) on conflict do nothing;

comment on table public.configuracoes_sistema is 'Parâmetros globais de sistema em linha única.';

-- 4.3 horarios_letivos
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

-- 4.4 disciplinas
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

-- 5. TABELAS: ENTIDADES PRINCIPAIS

-- 5.1 perfis
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
  acesso_modulos     text[]          not null default '{}',
  permissoes         text[]          not null default '{}',
  created_at         timestamptz     not null default now(),
  updated_at         timestamptz     not null default now(),
  constraint uq_perfil_email unique (email)
);

comment on table public.perfis is 'RF01/RF11/RNF03: Perfis 1:1 com auth.users. Sem dados sensíveis (CPF, endereço).';

-- 5.2 turmas
create table public.turmas (
  id             uuid        primary key default gen_random_uuid(),
  ano_letivo_id  uuid        not null references public.anos_letivos(id) on delete restrict,
  serie          text        not null,
  letra          text        not null,
  nome_completo  text        not null,
  capacidade    integer,
  ativo          boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint uq_turma_ano_serie_letra unique (ano_letivo_id, serie, letra),
  constraint chk_turma_capacidade check (capacidade is null or capacidade > 0)
);

comment on table public.turmas is 'RF09/RD02: Turmas normalizadas. Ensino Médio: até 12 por ano (1ª-3ª × A-D). Série/letra validadas contra o catálogo (chk_turmas_*_catalogo).';

-- Trigger: define nome_completo automaticamente a partir da série e da letra
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

-- 5.3 alunos
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
  transporte_escolar boolean       not null default false,
  alimentacao_diferenciada boolean not null default false,
  necessidades_especiais boolean   not null default false,
  documentos_recebidos text[]      not null default '{}',
  constraint uq_aluno_matricula unique (matricula)
);

comment on table public.alunos is 'RF08/RF13/RNF03/RD04: Alunos identificados por matrícula (pseudonimizado). Sem CPF/endereço/foto.';

-- 5.4 enturmacoes (temporal: aluno × turma × ano)
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

-- 5.5 vinculos_responsaveis
create table public.vinculos_responsaveis (
  id                   uuid          primary key default gen_random_uuid(),
  responsavel_id       uuid          not null references public.perfis(id) on delete cascade,
  aluno_id             uuid          not null references public.alunos(id) on delete cascade,
  tipo_relacao         text          not null default 'outro',
  contato_prioritario  boolean       not null default false,
  ativo                boolean       not null default true,
  created_at           timestamptz   not null default now(),
  updated_at           timestamptz   not null default now(),
  constraint uq_vinculo_responsavel_aluno unique (responsavel_id, aluno_id)
);

comment on table public.vinculos_responsaveis is 'RF05: Vínculo multiparental N:N. Um responsável pode ter múltiplos dependentes.';

-- 5.6 atribuicoes_professores
create table public.atribuicoes_professores (
  id              uuid               primary key default gen_random_uuid(),
  professor_id    uuid               not null references public.perfis(id) on delete cascade,
  turma_id        uuid               not null references public.turmas(id) on delete restrict,
  disciplina_id   uuid               references public.disciplinas(id) on delete set null,
  papel           text               not null default 'titular',
  data_inicio     date               not null default current_date,
  data_fim        date,
  ativo           boolean            not null default true,
  created_at      timestamptz        not null default now(),
  updated_at      timestamptz        not null default now(),
  constraint chk_atribuicao_datas check (data_fim is null or data_fim >= data_inicio)
);

comment on table public.atribuicoes_professores is 'RF21: Professor titular ou substituto com janela temporal.';

-- 6. TABELAS: CATÁLOGOS (TAGS E OPÇÕES CONFIGURÁVEIS)

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

-- 6.1 opcoes_configuracao (catálogo genérico editável pela gestão)

create table public.opcoes_configuracao (
  id          uuid        primary key default gen_random_uuid(),
  tipo        text        not null,
  chave       text        not null,
  rotulo      text        not null,
  icone       text,
  ordem       integer     not null default 0,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tipo, chave)
);

comment on table public.opcoes_configuracao is 'Catálogo genérico de opções configuráveis pela gestão (módulos, permissões, documentos, períodos, motivos, vínculos, séries, letras, etc.).';

-- 7. TABELAS: OPERACIONAIS (FREQUÊNCIA, COMPORTAMENTO, OCORRÊNCIAS)

-- 7.1 frequencias
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
  motivos_ausencia  text[]                      not null default '{}',
  constraint uq_frequencia_client_req unique (client_request_id)
);

comment on table public.frequencias is 'RF14/RF15/RD03/RNF06: Registro unificado de entrada (portão), chamada por período e saída.';

-- 7.2 registros_comportamento
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

-- 7.3 registro_comportamento_tags (N:N)
create table public.registro_comportamento_tags (
  registro_id uuid not null references public.registros_comportamento(id) on delete cascade,
  tag_id      uuid not null references public.tags_comportamento(id) on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (registro_id, tag_id)
);

comment on table public.registro_comportamento_tags is 'RF18: Associação N:N entre registros de comportamento e tags (multitag).';

-- 7.4 ocorrencias
create table public.ocorrencias (
  id                              uuid               primary key default gen_random_uuid(),
  aluno_id                        uuid               not null references public.alunos(id) on delete cascade,
  professor_id                    uuid               references public.perfis(id) on delete set null,
  coordenador_id                  uuid               references public.perfis(id) on delete set null,
  turma_id                        uuid               not null references public.turmas(id) on delete restrict,
  ano_letivo_id                   uuid               not null references public.anos_letivos(id) on delete restrict,
  titulo                          text               not null,
  descricao                       text               not null,
  tipo                            text[]             not null,
  status                          status_ocorrencia  not null default 'aberta',
  exige_presenca_responsavel      boolean            not null default false,
  presenca_responsavel_confirmada boolean            not null default false,
  data_confirmacao_presenca       timestamptz,
  data_ocorrencia                 timestamptz        not null default now(),
  closed_at                       timestamptz,
  created_at                      timestamptz        not null default now(),
  updated_at                      timestamptz        not null default now(),
  tags_comportamento              text[]             not null default '{}',
  notificar_coordenacao           boolean            not null default true,
  notificar_responsavel           boolean            not null default false
);

comment on table public.ocorrencias is 'Ocorrências graves e suspensões com bloqueio de retorno e workflow de status.';

-- 9. TABELAS: ANEXOS (dedicadas, com integridade referencial)

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

-- 10. TABELAS: JUSTIFICATIVAS

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

-- 11. TABELAS: COMUNICAÇÃO (CHAT)

create table public.conversas (
  id                    uuid        primary key default gen_random_uuid(),
  turma_id              uuid        not null references public.turmas(id) on delete restrict,
  responsavel_id        uuid        not null references public.perfis(id) on delete cascade,
  aluno_id              uuid        not null references public.alunos(id) on delete cascade,
  assunto               text,
  ativa                 boolean     not null default true,
  iniciada_pela_gestao  boolean     not null default false,
  ultima_mensagem_em    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint uq_conversa_responsavel_aluno unique (responsavel_id, aluno_id)
);

comment on table public.conversas is 'RF26: Conversas de chat entre responsável e staff (professor/gestão). Única ativa por par.';
comment on column public.conversas.iniciada_pela_gestao is 'True quando a conversa foi aberta pela coordenação via ranking de risco: permite à gestão enviar fora do horário protegido.';

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

-- 12. TABELAS: MONITORAMENTO E GAMIFICAÇÃO

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

-- 13. TABELAS: NOTIFICAÇÕES

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

-- 14. TABELAS: IMPORTAÇÃO, EXPORTAÇÃO E AUDITORIA

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

-- 15. TABELA: CONVITES

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

-- 16. TRIGGERS: UPDATED_AT (gerados dinamicamente)

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'anos_letivos', 'configuracoes_sistema',
    'horarios_letivos', 'disciplinas', 'perfis', 'turmas', 'alunos',
    'enturmacoes', 'vinculos_responsaveis', 'atribuicoes_professores',
    'tags_comportamento', 'opcoes_configuracao', 'frequencias', 'registros_comportamento',
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

-- 17. TRIGGER: CRIAÇÃO AUTOMÁTICA DE PERFIL (signup)

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

-- 18. ROW LEVEL SECURITY
-- Funções auxiliares das políticas com security definer para leitura de perfis sem grants do chamador.

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

-- Módulos de acesso com fail-closed: lista vazia nega tudo; seed e formulário populam os módulos permitidos.
create or replace function public.get_user_acesso_modulos()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(acesso_modulos, '{}'::text[])
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

alter table public.anos_letivos               enable row level security;
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

-- 18.1 PERFIS

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

-- 18.2 ANOS LETIVOS

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

-- 18.3 CONFIGURAÇÕES DO SISTEMA

create policy "ConfigSis: leitura autenticados"
  on public.configuracoes_sistema for select
  to authenticated
  using (true);

create policy "ConfigSis: gestao gerencia"
  on public.configuracoes_sistema for update
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.4 HORÁRIOS LETIVOS

create policy "Horarios: leitura autenticados"
  on public.horarios_letivos for select
  to authenticated
  using (true);

create policy "Horarios: gestao gerencia"
  on public.horarios_letivos for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.4.1 OPÇÕES DE CONFIGURAÇÃO

alter table public.opcoes_configuracao enable row level security;

create policy "OpcoesConfig: leitura autenticados"
  on public.opcoes_configuracao for select
  to authenticated
  using (true);

create policy "OpcoesConfig: gestao gerencia"
  on public.opcoes_configuracao for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.5 DISCIPLINAS

create policy "Disciplinas: leitura autenticados"
  on public.disciplinas for select
  to authenticated
  using (true);

create policy "Disciplinas: gestao gerencia"
  on public.disciplinas for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.6 TURMAS

create policy "Turmas: leitura autenticados"
  on public.turmas for select
  to authenticated
  using (true);

create policy "Turmas: gestao gerencia"
  on public.turmas for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.7 ALUNOS

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

-- 18.8 ENTURMAÇÕES

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

-- 18.9 VÍNCULOS RESPONSÁVEIS

create policy "Vinculos: responsavel le proprios"
  on public.vinculos_responsaveis for select
  to authenticated
  using (responsavel_id = auth.uid());

create policy "Vinculos: gestao tudo"
  on public.vinculos_responsaveis for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.10 ATRIBUIÇÕES PROFESSORES

create policy "Atrib: leitura autenticados"
  on public.atribuicoes_professores for select
  to authenticated
  using (true);

create policy "Atrib: gestao gerencia"
  on public.atribuicoes_professores for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.11 TAGS COMPORTAMENTO

create policy "Tags: leitura autenticados"
  on public.tags_comportamento for select
  to authenticated
  using (true);

create policy "Tags: gestao gerencia"
  on public.tags_comportamento for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.12 FREQUÊNCIAS

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
    and 'frequencia' = any(public.get_user_acesso_modulos())
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
    and 'frequencia' = any(public.get_user_acesso_modulos())
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

-- 18.13 REGISTROS COMPORTAMENTO

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

-- 18.14 REGISTRO COMPORTAMENTO TAGS

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

-- 18.15 OCORRÊNCIAS

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
    and 'ocorrencias' = any(public.get_user_acesso_modulos())
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
    and 'ocorrencias' = any(public.get_user_acesso_modulos())
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

-- 18.16 ANEXOS

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

-- 18.17 OCORRENCIA ANEXOS

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

-- 18.18 JUSTIFICATIVAS FALTAS

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

-- 18.19 JUSTIFICATIVA ANEXOS

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

-- 18.20 CONVERSAS

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

create policy "Conv: gestao cria"
  on public.conversas for insert
  to authenticated
  with check (public.get_user_papel() = 'gestao');

create policy "Conv: gestao oculta"
  on public.conversas for update
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao' and ativa = false);

-- 18.21 MENSAGENS

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

create policy "Msg: gestao marca lida"
  on public.mensagens for update
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (lida_em is not null);

-- 18.22 MONITORAMENTO AÇÕES

create policy "Monitoramento: gestao tudo"
  on public.monitoramento_acoes for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

create policy "Monitoramento: leitura ampla"
  on public.monitoramento_acoes for select
  to authenticated
  using (true);

-- 18.23 PONTUAÇÃO TURMAS

create policy "Pontuacao: leitura autenticados"
  on public.pontuacao_turmas for select
  to authenticated
  using (true);

create policy "Pontuacao: gestao gerencia"
  on public.pontuacao_turmas for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.24 NOTIFICAÇÕES

create policy "Notif: destinatario le proprias"
  on public.notificacoes for select
  to authenticated
  using (destinatario_id = auth.uid());

create policy "Notif: sistema cria"
  on public.notificacoes for insert
  to authenticated
  with check (public.get_user_papel() in ('gestao', 'professor') or destinatario_id <> auth.uid());

-- 18.25 IMPORTAÇÕES LOG

create policy "Import: gestao tudo"
  on public.importacoes_log for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.26 EXPORTAÇÕES

create policy "Export: gestao tudo"
  on public.exportacoes for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 18.27 AUDITORIA

create policy "Auditoria: gestao le"
  on public.auditoria for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

-- 18.28 CONVITES

create policy "Convites: gestao tudo"
  on public.convites for all
  to authenticated
  using (public.get_user_papel() = 'gestao')
  with check (public.get_user_papel() = 'gestao');

-- 19. VIEWS (security_invoker = true para não bypassar RLS)

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

-- 19.5 Pontuação Diária das Turmas (RF28)
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
  count(distinct rc.id) filter (where tc.categoria = 'atencao') as comportamentos_atencao,
  count(distinct rc.id) filter (where tc.categoria = 'critico') as comportamentos_criticos
from public.turmas t
join public.enturmacoes e on e.turma_id = t.id and e.status = 'matriculado'
left join public.frequencias f on f.turma_id = t.id and f.deleted_at is null
left join public.registros_comportamento rc on rc.turma_id = t.id
left join public.registro_comportamento_tags rct on rct.registro_id = rc.id
left join public.tags_comportamento tc on tc.id = rct.tag_id
group by t.id, t.nome_completo, f.data_aula;

comment on view public.v_gamificacao_ranking is 'RF28: Leaderboard interturmas baseado na pontuação mensal acumulada.';
comment on view public.v_pontuacao_diaria_turmas is 'RF28: Base para cálculo dos snapshots mensais de gamificação.';

-- 20. ÍNDICES DE PERFORMANCE

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

-- 21. GRANTS: DATA API (Supabase)

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
grant insert, update, delete on public.opcoes_configuracao to authenticated;
grant insert, update on public.disciplinas to authenticated;
grant insert, update on public.importacoes_log to authenticated;
grant insert, update on public.exportacoes to authenticated;
grant insert, update on public.convites to authenticated;
grant insert on public.notificacoes to authenticated;
grant insert on public.pontuacao_turmas to authenticated;

-- Uso de sequências (se houver)
grant usage on all sequences in schema public to authenticated;

-- 22. CUSTOM ACCESS TOKEN HOOK

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

-- 22.1 PRE-REQUEST HOOK (JWT enforcement)

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
        'message', 'Token JWT ausente ou inválido. Autentique-se para acessar a API.'
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
-- Fluxo sem dependência de email: gestão gera código de 6 dígitos; funções finais na seção 28, políticas em 23.x.

-- 23.1 Tabela e índices

create table public.codigos_redefinicao (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  perfil_id  uuid        not null references public.perfis(id) on delete cascade,
  codigo     text        not null,
  criado_por uuid        references public.perfis(id) on delete set null,
  usado_em   timestamptz,
  expira_em  timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revogado_em timestamptz
);

comment on table public.codigos_redefinicao is
  'Códigos de uso único para redefinição de senha via administração. Expira em 1 hora.';

create index idx_codigos_redefinicao_email on public.codigos_redefinicao(email);
create index idx_codigos_redefinicao_email_codigo on public.codigos_redefinicao(email, codigo);


-- 23.2 Criar usuário (gestão; perfil nasce pendente)

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
    raise exception 'Apenas gestão pode criar usuários.';
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
  'Cria usuário em auth.users com perfil pendente. Apenas gestão. O trigger fn_handle_new_user cria o perfil automaticamente.';

-- 23.3 Políticas RLS

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

-- 23.4 Trigger updated_at
create trigger trg_set_updated_at
  before update on public.codigos_redefinicao
  for each row
  execute function public.fn_set_updated_at();

-- 23.5 Grants

grant select, insert, update on public.codigos_redefinicao to authenticated, service_role;

-- Permissão DELETE para frequências (usada pelo fluxo de DELETE+INSERT)
grant delete on public.frequencias to authenticated;

-- Permissão UPDATE para notificações (marcar como lida)
grant update, delete on public.notificacoes to authenticated;

-- Permissão INSERT para justificativas (gestão inserir manualmente)
grant insert on public.justificativas_faltas to authenticated;

-- Permissões para o service_role (chave de serviço) nas tabelas de chat,
-- usadas pela Edge Function e pelo setup de testes via REST API.
grant select, insert, update, delete on public.conversas to service_role;
grant select, insert, update, delete on public.mensagens to service_role;
grant select, insert, update, delete on public.notificacoes to service_role;

-- Permissões service_role para as Edge Functions (criar-usuario, redefinir-senha-codigo, processar-anexo, limpar-anexos) e setup REST de testes.
grant select, insert, update, delete on public.perfis to service_role;
grant select, insert, update, delete on public.anexos to service_role;
grant select, insert, update, delete on public.ocorrencias to service_role;

-- O service_role é a chave administrativa de backend: espelha o comportamento
-- do Supabase hospedado, com acesso total a todas as tabelas (bypass de RLS).
grant all privileges on all tables in schema public to service_role;

grant execute on function public.fn_criar_usuario to authenticated;

-- 23.6 Políticas complementares (delete de frequências, inserção manual de
-- justificativas pela gestão e ciclo de vida das notificações)

create policy "Freq: professor deleta proprias"
  on public.frequencias for delete
  to authenticated
  using (
    professor_id = auth.uid()
    and public.get_user_papel() = 'professor'
    and 'frequencia' = any(public.get_user_acesso_modulos())
  );

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

create policy "Notif: destinatario deleta proprias"
  on public.notificacoes for delete
  to authenticated
  using (destinatario_id = auth.uid());

-- 24. REALTIME PUBLICATION
-- Tabelas publicadas para assinaturas postgres_changes no frontend.

alter publication supabase_realtime add table public.notificacoes;
alter publication supabase_realtime add table public.codigos_redefinicao;
alter publication supabase_realtime add table public.alunos;
alter publication supabase_realtime add table public.perfis;
alter publication supabase_realtime add table public.ocorrencias;
alter publication supabase_realtime add table public.justificativas_faltas;
alter publication supabase_realtime add table public.frequencias;
alter publication supabase_realtime add table public.conversas;
alter publication supabase_realtime add table public.mensagens;
-- 25. STORAGE: BUCKET JUSTIFICATIVAS (RF23/RNF04)

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

-- RLS: Acesso de leitura de anexos pelo responsável

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

-- 26. TRIGGERS DE DOMÍNIO
-- 26.1 Auto-justificar frequências ao aceitar a justificativa

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

-- 26.2 Notificar nova mensagem de chat

create or replace function public.fn_notificar_nova_mensagem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_responsavel_id uuid;
  v_turma_id      uuid;
  v_nome_remetente text;
begin
  if new.is_system_message then return new; end if;

  select c.responsavel_id, c.turma_id into v_responsavel_id, v_turma_id
  from public.conversas c where c.id = new.conversa_id;

  select nome into v_nome_remetente from public.perfis where id = new.remetente_id;

  -- Reabrir conversa se estava oculta (responsável enviou)
  update public.conversas
  set ativa = true
  where id = new.conversa_id and ativa = false;

  if new.remetente_id = v_responsavel_id then
    insert into public.notificacoes (destinatario_id, tipo, titulo, corpo, metadados)
    select p.id, 'mensagem',
           'Nova mensagem de ' || v_nome_remetente,
           left(new.conteudo, 120),
           jsonb_build_object('conversa_id', new.conversa_id::text)
    from public.perfis p
    where p.papel = 'gestao' and p.id != new.remetente_id and p.status = 'ativo';
  else
    insert into public.notificacoes (destinatario_id, tipo, titulo, corpo, metadados)
    values (v_responsavel_id, 'mensagem',
            'Nova mensagem de ' || v_nome_remetente,
            left(new.conteudo, 120),
            jsonb_build_object('conversa_id', new.conversa_id::text));
  end if;

  return new;
end;
$$;

create trigger trg_notificar_nova_mensagem
  after insert on public.mensagens
  for each row
  execute function public.fn_notificar_nova_mensagem();

-- 27. INTEGRIDADE: PREVENÇÃO DE DADOS ÓRFÃOS

-- Validação de catálogo com security definer: as CHECKs avaliam com a role que grava, que pode não ter SELECT no catálogo.
create or replace function public.fn_chave_catalogo_valida(p_tipo text, p_chave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.opcoes_configuracao
    where tipo = p_tipo and chave = p_chave
  )
$$;

create or replace function public.fn_chaves_catalogo_validas(p_tipo text, p_chaves text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(cardinality(p_chaves), 0) = 0
      or not exists (
        select 1 from unnest(p_chaves) as c(chave)
        where not exists (
          select 1 from public.opcoes_configuracao
          where tipo = p_tipo and chave = c.chave
        )
      )
$$;

create or replace function public.fn_tags_validas(p_nomes text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(cardinality(p_nomes), 0) = 0
      or not exists (
        select 1 from unnest(p_nomes) as t(nome)
        where not exists (
          select 1 from public.tags_comportamento
          where nome = t.nome
        )
      )
$$;

grant execute on function public.fn_chave_catalogo_valida(text, text) to authenticated;
grant execute on function public.fn_chaves_catalogo_validas(text, text[]) to authenticated;
grant execute on function public.fn_tags_validas(text[]) to authenticated;

-- 27.2 Constraints que impedem a gravação de chaves/nomes sem correspondência
-- no catálogo (impede a criação de referências órfãs a partir de novas escritas).
alter table public.turmas
  add constraint chk_turmas_serie_catalogo
  check (public.fn_chave_catalogo_valida('serie_turma', serie));
alter table public.turmas
  add constraint chk_turmas_letra_catalogo
  check (public.fn_chave_catalogo_valida('letra_turma', letra));
alter table public.vinculos_responsaveis
  add constraint chk_vinculos_tipo_relacao_catalogo
  check (public.fn_chave_catalogo_valida('tipo_vinculo', tipo_relacao));
alter table public.atribuicoes_professores
  add constraint chk_atribuicoes_papel_catalogo
  check (public.fn_chave_catalogo_valida('papel_atribuicao', papel));
alter table public.frequencias
  add constraint chk_frequencias_periodo_catalogo
  check (public.fn_chave_catalogo_valida('periodo', periodo));
alter table public.perfis
  add constraint chk_perfis_modulos_catalogo
  check (public.fn_chaves_catalogo_validas('modulo', acesso_modulos));
alter table public.alunos
  add constraint chk_alunos_documentos_catalogo
  check (public.fn_chaves_catalogo_validas('documento', documentos_recebidos));
alter table public.frequencias
  add constraint chk_frequencias_motivos_catalogo
  check (public.fn_chaves_catalogo_validas('motivo_ausencia', motivos_ausencia));
alter table public.ocorrencias
  add constraint chk_ocorrencias_tipo_catalogo
  check (public.fn_chaves_catalogo_validas('tipo_ocorrencia', tipo));
alter table public.ocorrencias
  add constraint chk_ocorrencias_tags_validas
  check (public.fn_tags_validas(tags_comportamento));

-- Expurgo pela Edge Function limpar-anexos (storage não é removível por SQL); fn_relatorio_orfas audita pendências; agendar cron diário no Dashboard.

-- 27.4 Relatório de referências órfãs (monitoramento).
create or replace function public.fn_relatorio_orfas()
returns table (categoria text, detalhe text, quantidade bigint)
language sql
security definer
set search_path = ''
as $$
  select 'catalogo', 'perfis.acesso_modulos sem opção de modulo', count(*)::bigint
  from public.perfis p
  where exists (
    select 1 from unnest(p.acesso_modulos) c
    where not exists (select 1 from public.opcoes_configuracao o where o.tipo = 'modulo' and o.chave = c)
  )
  union all
  select 'catalogo', 'alunos.documentos_recebidos sem opção de documento', count(*)::bigint
  from public.alunos a
  where exists (
    select 1 from unnest(a.documentos_recebidos) c
    where not exists (select 1 from public.opcoes_configuracao o where o.tipo = 'documento' and o.chave = c)
  )
  union all
  select 'catalogo', 'frequencias.periodo sem opção de periodo', count(*)::bigint
  from public.frequencias f
  where not exists (select 1 from public.opcoes_configuracao o where o.tipo = 'periodo' and o.chave = f.periodo)
  union all
  select 'catalogo', 'frequencias.motivos_ausencia sem opção de motivo', count(*)::bigint
  from public.frequencias f
  where exists (
    select 1 from unnest(f.motivos_ausencia) c
    where not exists (select 1 from public.opcoes_configuracao o where o.tipo = 'motivo_ausencia' and o.chave = c)
  )
  union all
  select 'catalogo', 'ocorrencias.tipo sem opção de tipo_ocorrencia', count(*)::bigint
  from public.ocorrencias o
  where exists (
    select 1 from unnest(o.tipo) c
    where not exists (select 1 from public.opcoes_configuracao oc where oc.tipo = 'tipo_ocorrencia' and oc.chave = c)
  )
  union all
  select 'catalogo', 'ocorrencias.tags_comportamento sem tag existente', count(*)::bigint
  from public.ocorrencias o
  where exists (
    select 1 from unnest(o.tags_comportamento) t
    where not exists (select 1 from public.tags_comportamento tc where tc.nome = t)
  )
  union all
  select 'catalogo', 'turmas.serie sem opção de serie_turma', count(*)::bigint
  from public.turmas t
  where not exists (select 1 from public.opcoes_configuracao o where o.tipo = 'serie_turma' and o.chave = t.serie)
  union all
  select 'catalogo', 'turmas.letra sem opção de letra_turma', count(*)::bigint
  from public.turmas t
  where not exists (select 1 from public.opcoes_configuracao o where o.tipo = 'letra_turma' and o.chave = t.letra)
  union all
  select 'catalogo', 'vinculos.tipo_relacao sem opção de tipo_vinculo', count(*)::bigint
  from public.vinculos_responsaveis v
  where not exists (select 1 from public.opcoes_configuracao o where o.tipo = 'tipo_vinculo' and o.chave = v.tipo_relacao)
  union all
  select 'catalogo', 'atribuicoes.papel sem opção de papel_atribuicao', count(*)::bigint
  from public.atribuicoes_professores a
  where not exists (select 1 from public.opcoes_configuracao o where o.tipo = 'papel_atribuicao' and o.chave = a.papel)
  union all
  select 'perfil', 'auth.users sem perfil', count(*)::bigint
  from auth.users u
  left join public.perfis p on p.id = u.id
  where p.id is null
  union all
  select 'enturmacao', 'alunos ativos sem enturmacao matriculado', count(*)::bigint
  from public.alunos a
  where a.status = 'ativo'
    and not exists (
      select 1 from public.enturmacoes e
      where e.aluno_id = a.id and e.status = 'matriculado'
    )
  union all
  select 'anexos', 'anexos sem vinculo (justificativa_anexos/ocorrencia_anexos)', count(*)::bigint
  from public.anexos a
  where not exists (select 1 from public.justificativa_anexos ja where ja.anexo_id = a.id)
    and not exists (select 1 from public.ocorrencia_anexos oa where oa.anexo_id = a.id)
$$;

grant execute on function public.fn_relatorio_orfas to authenticated;

-- Endurece o ciclo dos códigos: bloqueio por tentativas, validade configurável, revogação auditada e limpeza programada; versões finais vigentes.

create table if not exists public.codigos_redefinicao_tentativas (
  email         text        primary key,
  tentativas    integer     not null default 0,
  bloqueado_ate timestamptz,
  updated_at    timestamptz not null default now()
);

comment on table public.codigos_redefinicao_tentativas is
  'Controle anti força bruta: tentativas falhas de redefinição por e-mail. Acessível apenas via funções (security definer) e leitura da gestão.';

alter table public.codigos_redefinicao_tentativas enable row level security;

create policy "CodTentativas: gestao le"
  on public.codigos_redefinicao_tentativas for select
  to authenticated
  using (public.get_user_papel() = 'gestao');

-- Base de acesso via Data API: leitura para a gestão (RLS filtra) e acesso
-- total para o service_role (usado pelas Edge Functions e testes).
grant select on public.codigos_redefinicao_tentativas to authenticated;
grant select, insert, update, delete on public.codigos_redefinicao_tentativas to service_role;

-- 28.1 Solicitar código (público via Edge Function; suprime só se houver pendência não lida)

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
  where email = p_email and status in ('ativo', 'pendente');

  if v_perfil_id is not null then
    -- Só suprime quando já existe solicitação pendente (não lida) para o perfil.
    -- Código ativo, expirado ou revogado não bloqueia uma nova solicitação.
    if not exists (
      select 1
      from public.notificacoes
      where tipo = 'codigo_redefinicao'
        and metadados->>'perfil_id' = v_perfil_id::text
        and lida = false
    ) then
      insert into public.notificacoes (destinatario_id, tipo, titulo, corpo, metadados)
      select
        p.id,
        'codigo_redefinicao',
        'Solicitação de redefinição de senha',
        'O usuário ' || v_nome || ' (' || p_email || ', ' || v_papel || ') solicitou um código para redefinir a senha.',
        jsonb_build_object('email', p_email, 'perfil_id', v_perfil_id)
      from public.perfis p
      where p.papel = 'gestao'
        and p.status = 'ativo'
        and not exists (
          select 1
          from public.notificacoes n
          where n.destinatario_id = p.id
            and n.tipo = 'codigo_redefinicao'
            and n.lida = false
            and n.metadados->>'perfil_id' = v_perfil_id::text
        );
    end if;
  end if;
end;
$$;

comment on function public.fn_solicitar_codigo_redefinicao is
  'Cria notificações para os usuários de gestão quando alguém solicita redefinição de senha. Aceita perfis ativo ou pendente. Nova solicitação é suprimida somente se já existir solicitação pendente (não lida) para o perfil.';

-- 28.2 Gerar código (gestão; sempre emite NOVO código, revogando o ativo anterior)

create or replace function public.fn_gerar_codigo_redefinicao(
  p_perfil_id uuid,
  p_criado_por uuid default auth.uid()
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo     text;
  v_codigo_id  uuid;
  v_email      text;
  v_validade   interval;
begin
  if public.get_user_papel() != 'gestao' then
    raise exception 'Apenas a gestão pode gerar códigos de redefinição.';
  end if;

  select make_interval(mins => minutos_validade_codigo)
  into v_validade
  from public.configuracoes_sistema
  where id = 1;

  if v_validade is null then
    v_validade := interval '1 hour';
  end if;

  -- Revoga códigos ativos existentes para que a geração sempre emita um NOVO
  -- código (o anterior fica marcado como revogado, exibido em vermelho)
  with revogados as (
    update public.codigos_redefinicao
    set expira_em = now(),
        revogado_em = now()
    where perfil_id = p_perfil_id
      and usado_em is null
      and expira_em > now()
    returning id
  )
  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores)
  select p_criado_por, 'REVOGAR_CODIGO', 'codigos_redefinicao', id,
         jsonb_build_object('motivo', 'substituído por nova geração')
  from revogados;

  -- Busca email do perfil (aceita ativo ou pendente)
  select email into v_email
  from public.perfis
  where id = p_perfil_id and status in ('ativo', 'pendente');

  if v_email is null then
    raise exception 'Perfil não encontrado ou inativo.';
  end if;

  v_codigo := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into public.codigos_redefinicao (email, perfil_id, codigo, criado_por, expira_em)
  values (v_email, p_perfil_id, v_codigo, p_criado_por, now() + v_validade)
  returning id into v_codigo_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_novos)
  values (p_criado_por, 'GERAR_CODIGO', 'codigos_redefinicao', v_codigo_id,
    jsonb_build_object('perfil_id', p_perfil_id, 'email', v_email));

  -- Solicitações pendentes para este perfil são consideradas atendidas
  update public.notificacoes
  set lida = true, lida_em = now()
  where tipo = 'codigo_redefinicao'
    and metadados->>'perfil_id' = p_perfil_id::text
    and lida = false;

  return v_codigo;
end;
$$;

comment on function public.fn_gerar_codigo_redefinicao is
  'Gera um código NOVO de 6 dígitos, revogando qualquer código ativo anterior do perfil. Aceita perfis ativo ou pendente, marca as solicitações pendentes como atendidas e audita a geração/revogação. Apenas gestão.';

-- 28.3 Revogar código (gestão; registra revogado_em)

create or replace function public.fn_revogar_codigo(p_codigo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  if public.get_user_papel() != 'gestao' then
    raise exception 'Apenas a gestão pode revogar códigos.';
  end if;

  update public.codigos_redefinicao
  set expira_em = now(),
      revogado_em = now()
  where id = p_codigo_id
    and usado_em is null
    and expira_em > now();

  if not found then
    raise exception 'Código já foi usado ou já expirou.';
  end if;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id)
  values (v_usuario_id, 'REVOGAR_CODIGO', 'codigos_redefinicao', p_codigo_id);
end;
$$;

comment on function public.fn_revogar_codigo is
  'Revogação manual de código ativo com auditoria. Define expira_em = now() e registra revogado_em. Lança erro se já usado ou expirado.';

-- 28.4 Anti força bruta (tentativas por e-mail)

create or replace function public.fn_codigo_email_bloqueado(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select bloqueado_ate > now()
    from public.codigos_redefinicao_tentativas
    where email = p_email
  ), false);
$$;

create or replace function public.fn_registrar_tentativa_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max      int;
  v_minutos  int;
  v_bloqueou boolean := false;
begin
  select max_tentativas_codigo, minutos_bloqueio_codigo
  into v_max, v_minutos
  from public.configuracoes_sistema
  where id = 1;

  if v_max is null then v_max := 5; end if;
  if v_minutos is null then v_minutos := 15; end if;

  -- Se ainda está bloqueado, mantém o bloqueio (não conta nova tentativa)
  if exists (
    select 1 from public.codigos_redefinicao_tentativas
    where email = p_email and bloqueado_ate > now()
  ) then
    return true;
  end if;

  insert into public.codigos_redefinicao_tentativas (email, tentativas)
  values (p_email, 1)
  on conflict (email) do update
    set tentativas = case
          when codigos_redefinicao_tentativas.bloqueado_ate is not null
            and codigos_redefinicao_tentativas.bloqueado_ate <= now()
            then 1
          else codigos_redefinicao_tentativas.tentativas + 1
        end,
        bloqueado_ate = null,
        updated_at = now();

  update public.codigos_redefinicao_tentativas
  set tentativas = 0,
      bloqueado_ate = now() + make_interval(mins => v_minutos)
  where email = p_email
    and tentativas >= v_max
    and (bloqueado_ate is null or bloqueado_ate <= now());

  if found then
    v_bloqueou := true;
  end if;

  return v_bloqueou;
end;
$$;

create or replace function public.fn_limpar_tentativas_email(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.codigos_redefinicao_tentativas where email = p_email;
end;
$$;

comment on function public.fn_codigo_email_bloqueado is
  'Informa se o e-mail está temporariamente bloqueado por excesso de tentativas falhas.';
comment on function public.fn_registrar_tentativa_email is
  'Registra uma tentativa falha de redefinição para o e-mail. Retorna true quando o e-mail atinge o limite e é bloqueado.';
comment on function public.fn_limpar_tentativas_email is
  'Limpa o contador de tentativas falhas de um e-mail após uma redefinição bem-sucedida.';

-- 28.5 Grants

grant execute on function public.fn_solicitar_codigo_redefinicao to anon;
grant execute on function public.fn_gerar_codigo_redefinicao to authenticated;
grant execute on function public.fn_revogar_codigo to authenticated;
grant execute on function public.fn_codigo_email_bloqueado to authenticated;
grant execute on function public.fn_registrar_tentativa_email to authenticated;
grant execute on function public.fn_limpar_tentativas_email to authenticated;

-- Correção: a tela de configuração do sistema salva via cliente autenticado,
-- mas a tabela nunca teve GRANT de UPDATE para `authenticated` (apenas SELECT).
grant insert, update on public.configuracoes_sistema to authenticated;

-- Remove permanentemente códigos não ativos, retorna a quantidade removida e audita a operação (GERAR/REVOGAR/USAR_CODIGO).

create or replace function public.fn_limpar_codigos_nao_ativos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removidos  int;
  v_usuario_id uuid := auth.uid();
begin
  if public.get_user_papel() != 'gestao' then
    raise exception 'Apenas a gestão pode limpar códigos.';
  end if;

  with removidos as (
    delete from public.codigos_redefinicao
    where usado_em is not null
       or revogado_em is not null
       or expira_em <= now()
    returning id
  )
  select count(*) into v_removidos from removidos;

  if v_removidos > 0 then
    insert into public.auditoria (usuario_id, acao, entidade, dados_novos)
    values (v_usuario_id, 'LIMPAR_CODIGOS', 'codigos_redefinicao',
      jsonb_build_object('removidos', v_removidos));
  end if;

  return v_removidos;
end;
$$;

comment on function public.fn_limpar_codigos_nao_ativos is
  'Remove permanentemente códigos não ativos (usados, expirados ou revogados), preservando os ativos. Audita a operação e retorna a quantidade removida. Apenas gestão.';

grant execute on function public.fn_limpar_codigos_nao_ativos to authenticated;
-- Popula catálogos para operação imediata sem seed, editável pela gestão, sem dados de pessoas; permanecer após as constraints da seção 27.


insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
  -- modulo: módulos acessíveis ao professor (perfis.acesso_modulos)
  ('modulo', 'frequencia',            'Frequência',        'check2-square',        1, true),
  ('modulo', 'ocorrencias',           'Ocorrências',       'exclamation-triangle', 2, true),
  -- documento: documentos recebidos do aluno (alunos.documentos_recebidos)
  ('documento', 'rg',                     'RG',                       'person-vcard',       1, true),
  ('documento', 'cpf',                    'CPF',                      'credit-card',        2, true),
  ('documento', 'certidao_nascimento',    'Certidão de Nascimento',   'file-earmark-text',  3, true),
  ('documento', 'comprovante_residencia', 'Comprovante de Residência','house',              4, true),
  ('documento', 'cartao_vacina',          'Cartão de Vacina',         'heart-pulse',        5, true),
  ('documento', 'nis',                    'NIS',                      'person-badge',       6, true),
  ('documento', 'historico_escolar',      'Histórico Escolar',        'journal-text',       7, true),
  -- periodo: períodos de frequência (frequencias.periodo)
  ('periodo', 'Dia completo', 'Dia completo', 'calendar-check', 1, true),
  ('periodo', '1º Horário',   '1º Horário',   null,             2, true),
  ('periodo', '2º Horário',   '2º Horário',   null,             3, true),
  ('periodo', '3º Horário',   '3º Horário',   null,             4, true),
  ('periodo', '4º Horário',   '4º Horário',   null,             5, true),
  ('periodo', 'Manhã',        'Manhã',        'sun',            6, true),
  ('periodo', 'Tarde',        'Tarde',        'sunset',         7, true),
  -- motivo_ausencia: motivos de ausência à escola (frequencias.motivos_ausencia)
  ('motivo_ausencia', 'enfermaria',              'Enfermaria',              'heart-pulse', 1, true),
  ('motivo_ausencia', 'orientacao',              'Orientação pedagógica',   'people',      2, true),
  ('motivo_ausencia', 'saida_antecipada',        'Saída antecipada',        'door-open',   3, true),
  ('motivo_ausencia', 'conselho_tutelar',        'Conselho tutelar',        'shield-check',4, true),
  ('motivo_ausencia', 'atendimento_psicologico', 'Atendimento psicológico', 'heart',       5, true),
  ('motivo_ausencia', 'atividade_externa',       'Atividade externa',       'briefcase',   6, true),
  ('motivo_ausencia', 'consulta_medica',         'Consulta médica',         'thermometer', 7, true),
  -- tipo_ocorrencia: tipos de ocorrência (ocorrencias.tipo)
  ('tipo_ocorrencia', 'grave',     'Ocorrência grave', 'exclamation-triangle', 1, true),
  ('tipo_ocorrencia', 'suspensao', 'Suspensão',        'shield-exclamation',   2, true),
  -- tipo_vinculo: relação responsável–aluno (vinculos_responsaveis.tipo_relacao)
  ('tipo_vinculo', 'pai',    'Pai',       null, 1, true),
  ('tipo_vinculo', 'mae',    'Mãe',       null, 2, true),
  ('tipo_vinculo', 'tutor',  'Tutor',     null, 3, true),
  ('tipo_vinculo', 'avo',    'Avó/Avô',   null, 4, true),
  ('tipo_vinculo', 'irmao',    'Irmão/Irmã',null, 5, true),
  ('tipo_vinculo', 'padrasto', 'Padrasto',  null, 6, true),
  ('tipo_vinculo', 'madrasta', 'Madrasta',  null, 7, true),
  ('tipo_vinculo', 'outro',    'Outro',     null, 8, true),
  -- papel_atribuicao: papel do professor na atribuição (atribuicoes_professores.papel)
  ('papel_atribuicao', 'titular',    'Titular',    null, 1, true),
  ('papel_atribuicao', 'substituto', 'Substituto', null, 2, true),
  -- serie_turma: séries disponíveis (turmas.serie)
  ('serie_turma', '1ª', '1ª', null, 1, true),
  ('serie_turma', '2ª', '2ª', null, 2, true),
  ('serie_turma', '3ª', '3ª', null, 3, true),
  -- letra_turma: letras disponíveis (turmas.letra)
  ('letra_turma', 'A', 'A', null, 1, true),
  ('letra_turma', 'B', 'B', null, 2, true),
  ('letra_turma', 'C', 'C', null, 3, true),
  ('letra_turma', 'D', 'D', null, 4, true)
on conflict (tipo, chave) do nothing;

-- 29.1 Horários letivos padrão (RF27: horário protegido do chat)
-- Segunda a sexta, 07:00–17:00. Ajustável pela gestão em Configurações › Horários.
insert into public.horarios_letivos (dia_semana, hora_inicio, hora_fim) values
  (1, '07:00', '17:00'),
  (2, '07:00', '17:00'),
  (3, '07:00', '17:00'),
  (4, '07:00', '17:00'),
  (5, '07:00', '17:00')
on conflict (dia_semana, hora_inicio, hora_fim) do nothing;

-- 29.2 Tags de comportamento (RF16): base inicial editável pela gestão
insert into public.tags_comportamento (nome, categoria, icone, descricao, peso_pontuacao) values
  ('Participativo',     'positivo', 'hand-thumbs-up', 'Aluno participou ativamente da aula', 10),
  ('Colaborativo',      'positivo', 'people',         'Trabalhou bem em grupo',             10),
  ('Pontual',           'positivo', 'clock',          'Chegou no horário',                   5),
  ('Protagonista',      'positivo', 'star',           'Demonstrou iniciativa e liderança',  15),
  ('Respeitoso',        'positivo', 'emoji-smile',    'Tratou colegas e professores com respeito', 10),
  ('Cooperativo',       'positivo', 'puzzle',         'Cooperou com as atividades em grupo', 5),
  ('Desatenção',        'atencao',  'eye-slash',      'Dificuldade de concentração pontual', 0),
  ('Uso de celular',    'atencao',  'phone',          'Uso não autorizado de celular',       0),
  ('Conversa paralela', 'atencao',  'chat-dots',      'Conversa fora do contexto da aula',   0),
  ('Sem material',      'atencao',  'book',           'Não trouxe material necessário',      0),
  ('Atraso às aulas',   'atencao',  'alarm',          'Chegou após o início das atividades', 0),
  ('Distração com eletrônicos', 'atencao', 'headphones', 'Distração com fones ou outros dispositivos', 0)
on conflict (nome) do nothing;

-- 29.3 Disciplinas (RD04): matriz curricular base do Ensino Médio (BNCC),
-- com IDs determinísticos e códigos SIGE. Editável pela gestão.
insert into public.disciplinas (id, nome, codigo_sige, carga_horaria) values
  ('c0000000-0000-0000-0000-000000000001', 'Língua Portuguesa', 'PORT', 160),
  ('c0000000-0000-0000-0000-000000000002', 'Arte',              'ARTE',  80),
  ('c0000000-0000-0000-0000-000000000003', 'Educação Física',   'EDFIS', 80),
  ('c0000000-0000-0000-0000-000000000004', 'Matemática',        'MAT',  160),
  ('c0000000-0000-0000-0000-000000000005', 'Física',            'FIS',  120),
  ('c0000000-0000-0000-0000-000000000006', 'Química',           'QUIM', 120),
  ('c0000000-0000-0000-0000-000000000007', 'Biologia',          'BIO',  120),
  ('c0000000-0000-0000-0000-000000000008', 'História',          'HIST', 120),
  ('c0000000-0000-0000-0000-000000000009', 'Geografia',         'GEO',  120),
  ('c0000000-0000-0000-0000-000000000010', 'Filosofia',         'FIL',   80),
  ('c0000000-0000-0000-0000-000000000011', 'Sociologia',        'SOC',   80),
  ('c0000000-0000-0000-0000-000000000012', 'Língua Inglesa',    'ING',   80),
  ('c0000000-0000-0000-0000-000000000013', 'Projeto de Vida',   'PV',    40)
on conflict (codigo_sige) do nothing;

-- 29.4 Ano letivo corrente ativo (RF13/RF25)
insert into public.anos_letivos (id, ano, status, data_inicio, data_fim, ativo)
values (
  'b0000000-0000-0000-0000-000000000001',
  extract(year from current_date)::int,
  'ativo',
  make_date(extract(year from current_date)::int, 2, 1),
  make_date(extract(year from current_date)::int, 12, 20),
  true
)
on conflict (ano) do nothing;

update public.anos_letivos
set status = 'ativo',
    ativo = true
where ano = extract(year from current_date)::int
  and not exists (
    select 1 from public.anos_letivos where status = 'ativo' and ativo = true
  );

-- Ativa ano planejado arquivando o vigente com consistência e auditoria; security definer pois grava em public.auditoria.

create or replace function public.ativar_ano_letivo(p_ano_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alvo        public.anos_letivos;
  v_anterior_id uuid;
begin
  if coalesce(public.get_user_papel(), '') != 'gestao' then
    raise exception 'Apenas a gestão pode realizar a virada de ano letivo.';
  end if;

  select *
    into v_alvo
    from public.anos_letivos
   where id = p_ano_id;

  if v_alvo.id is null then
    raise exception 'Ano letivo não encontrado.';
  end if;

  if v_alvo.status = 'ativo' and v_alvo.ativo then
    raise exception 'Este ano letivo já está ativo.';
  end if;

  -- Arquiva o ano ativo vigente (se houver e for diferente do alvo)
  update public.anos_letivos
     set status = 'arquivado',
         ativo = false
   where status = 'ativo'
      or ativo = true
   returning id into v_anterior_id;

  if v_anterior_id is not null and v_anterior_id <> v_alvo.id then
    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_novos)
    values (
      auth.uid(),
      'ARQUIVAR_ANO_LETIVO',
      'anos_letivos',
      v_anterior_id,
      jsonb_build_object('status', 'arquivado', 'ativo', false)
    );
  end if;

  update public.anos_letivos
     set status = 'ativo',
         ativo = true
   where id = v_alvo.id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
  values (
    auth.uid(),
    'ATIVAR_ANO_LETIVO',
    'anos_letivos',
    v_alvo.id,
    jsonb_build_object('status', v_alvo.status, 'ativo', v_alvo.ativo),
    jsonb_build_object('status', 'ativo', 'ativo', true)
  );
end;
$$;

comment on function public.ativar_ano_letivo(uuid) is
  'RF13/RF25: Wizard de virada. Ativa o ano letivo informado e arquiva o vigente, atomicamente e com auditoria. Apenas gestão.';

revoke execute on function public.ativar_ano_letivo(uuid) from anon, public;
grant execute on function public.ativar_ano_letivo(uuid) to authenticated;
