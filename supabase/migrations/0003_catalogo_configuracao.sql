-- ============================================================================
-- 0003 — CATÁLOGO DE OPÇÕES DE CONFIGURAÇÃO (opcoes_configuracao)
-- ============================================================================
-- O catálogo genérico vivia apenas no seed.sql, que é aplicado SOMENTE no
-- ambiente local (`supabase db reset`). O projeto remoto recebe apenas
-- migrations (o CI usa `supabase db reset --linked --no-seed`), de modo que as
-- restrições CHECK de catálogo — ex.: chk_perfis_modulos_catalogo — rejeitavam
-- qualquer escrita cuja chave não existisse em opcoes_configuracao (erro 23514).
--
-- Esta migration promove o catálogo a parte do schema versionado:
--   1. Insere todas as opções canônicas, idempotente via
--      `on conflict (tipo, chave) do nothing` (unique em opcoes_configuracao).
--   2. Saneia chaves órfãs eventualmente gravadas em perfis.acesso_modulos,
--      evitando que updates futuros dessas linhas falhem no CHECK.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Opções canônicas do catálogo (fonte única; seed.sql não mais as insere)
-- ----------------------------------------------------------------------------

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
  -- tipo_ocorrencia: tipos de ocorrência (ocorrencias.tipo)
  ('tipo_ocorrencia', 'grave',     'Ocorrência grave', 'exclamation-triangle', 1, true),
  ('tipo_ocorrencia', 'suspensao', 'Suspensão',        'shield-exclamation',   2, true),
  -- tipo_vinculo: relação responsável–aluno (vinculos_responsaveis.tipo_relacao)
  ('tipo_vinculo', 'pai',    'Pai',       null, 1, true),
  ('tipo_vinculo', 'mae',    'Mãe',       null, 2, true),
  ('tipo_vinculo', 'tutor',  'Tutor',     null, 3, true),
  ('tipo_vinculo', 'avo',    'Avó/Avô',   null, 4, true),
  ('tipo_vinculo', 'irmao',  'Irmão/Irmã',null, 5, true),
  ('tipo_vinculo', 'outro',  'Outro',     null, 6, true),
  -- papel_atribuicao: papel do professor na atribuição (atribuicoes_professores.papel)
  ('papel_atribuicao', 'titular',    'Titular',    null, 1, true),
  ('papel_atribuicao', 'substituto', 'Substituto', null, 2, true),
  -- serie_turma: séries disponíveis (turmas.serie)
  ('serie_turma', '1º', '1º', null, 1, true),
  ('serie_turma', '2º', '2º', null, 2, true),
  ('serie_turma', '3º', '3º', null, 3, true),
  -- letra_turma: letras disponíveis (turmas.letra)
  ('letra_turma', 'A', 'A', null, 1, true),
  ('letra_turma', 'B', 'B', null, 2, true),
  ('letra_turma', 'C', 'C', null, 3, true),
  ('letra_turma', 'D', 'D', null, 4, true)
on conflict (tipo, chave) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Saneamento defensivo de perfis.acesso_modulos
-- Remove chaves sem correspondência no catálogo (gravações anteriores a esta
-- migration) para que updates futuros das linhas não violem
-- chk_perfis_modulos_catalogo.
-- ----------------------------------------------------------------------------

update public.perfis p
set acesso_modulos = coalesce((
      select array_agg(chave order by chave)
      from unnest(p.acesso_modulos) as u(chave)
      where exists (
        select 1
        from public.opcoes_configuracao o
        where o.tipo = 'modulo'
          and o.chave = u.chave
      )
    ), '{}')
where exists (
      select 1
      from unnest(p.acesso_modulos) as u(chave)
      where not exists (
        select 1
        from public.opcoes_configuracao o
        where o.tipo = 'modulo'
          and o.chave = u.chave
      )
    );
