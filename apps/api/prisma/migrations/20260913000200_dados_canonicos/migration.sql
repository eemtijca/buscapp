-- Dados canônicos de operação: parâmetros, catálogos, horários, tags, disciplinas e ano letivo.
-- Editáveis pela gestão; sem dados de pessoas.

insert into public.configuracoes_sistema (id) values (1)
on conflict (id) do nothing;

insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
  ('modulo', 'frequencia',            'Frequência',        'check2-square',        1, true),
  ('modulo', 'ocorrencias',           'Ocorrências',       'exclamation-triangle', 2, true),
  ('modulo', 'alertas',               'Alertas',           'bell',                 3, true),
  ('modulo', 'termometro',            'Termômetro',        'thermometer-half',     4, true),
  ('modulo', 'justificativa',         'Justificativa',     'paperclip',            5, true),
  ('modulo', 'chat',                  'Chat',              'chat-dots',            6, true),
  ('documento', 'rg',                     'RG',                       'person-vcard',       1, true),
  ('documento', 'cpf',                    'CPF',                      'credit-card',        2, true),
  ('documento', 'certidao_nascimento',    'Certidão de Nascimento',   'file-earmark-text',  3, true),
  ('documento', 'comprovante_residencia', 'Comprovante de Residência','house',              4, true),
  ('documento', 'cartao_vacina',          'Cartão de Vacina',         'heart-pulse',        5, true),
  ('documento', 'nis',                    'NIS',                      'person-badge',       6, true),
  ('documento', 'historico_escolar',      'Histórico Escolar',        'journal-text',       7, true),
  ('periodo', '1º Horário',   '1º Horário',   null,             1, true),
  ('periodo', '2º Horário',   '2º Horário',   null,             2, true),
  ('periodo', '3º Horário',   '3º Horário',   null,             3, true),
  ('periodo', '4º Horário',   '4º Horário',   null,             4, true),
  ('periodo', 'Manhã',        'Manhã',        'sun',            5, true),
  ('periodo', 'Tarde',        'Tarde',        'sunset',         6, true),
  ('motivo_ausencia', 'enfermaria',              'Enfermaria',              'heart-pulse', 1, true),
  ('motivo_ausencia', 'orientacao',              'Orientação pedagógica',   'people',      2, true),
  ('motivo_ausencia', 'saida_antecipada',        'Saída antecipada',        'door-open',   3, true),
  ('motivo_ausencia', 'conselho_tutelar',        'Conselho tutelar',        'shield-check',4, true),
  ('motivo_ausencia', 'atendimento_psicologico', 'Atendimento psicológico', 'heart',       5, true),
  ('motivo_ausencia', 'atividade_externa',       'Atividade externa',       'briefcase',   6, true),
  ('motivo_ausencia', 'consulta_medica',         'Consulta médica',         'thermometer', 7, true),
  ('tipo_ocorrencia', 'grave',     'Ocorrência grave', 'exclamation-triangle', 1, true),
  ('tipo_ocorrencia', 'suspensao', 'Suspensão',        'shield-exclamation',   2, true),
  ('tipo_vinculo', 'pai',    'Pai',       null, 1, true),
  ('tipo_vinculo', 'mae',    'Mãe',       null, 2, true),
  ('tipo_vinculo', 'tutor',  'Tutor',     null, 3, true),
  ('tipo_vinculo', 'avo',    'Avó/Avô',   null, 4, true),
  ('tipo_vinculo', 'irmao',    'Irmão/Irmã',null, 5, true),
  ('tipo_vinculo', 'padrasto', 'Padrasto',  null, 6, true),
  ('tipo_vinculo', 'madrasta', 'Madrasta',  null, 7, true),
  ('tipo_vinculo', 'outro',    'Outro',     null, 8, true),
  ('papel_atribuicao', 'titular',    'Titular',    null, 1, true),
  ('papel_atribuicao', 'substituto', 'Substituto', null, 2, true),
  ('serie_turma', '1ª', '1ª', null, 1, true),
  ('serie_turma', '2ª', '2ª', null, 2, true),
  ('serie_turma', '3ª', '3ª', null, 3, true),
  ('letra_turma', 'A', 'A', null, 1, true),
  ('letra_turma', 'B', 'B', null, 2, true),
  ('letra_turma', 'C', 'C', null, 3, true),
  ('letra_turma', 'D', 'D', null, 4, true)
on conflict (tipo, chave) do nothing;

insert into public.horarios_letivos (dia_semana, hora_inicio, hora_fim) values
  (1, '07:00', '17:00'),
  (2, '07:00', '17:00'),
  (3, '07:00', '17:00'),
  (4, '07:00', '17:00'),
  (5, '07:00', '17:00')
on conflict (dia_semana, hora_inicio, hora_fim) do nothing;

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
