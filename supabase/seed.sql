-- ============================================================
-- Seed: Dados de desenvolvimento para testes
-- ============================================================
--
-- USUÁRIOS PARA TESTE (login com email e senha):
--   gestao@escola.edu.br  |  Carlos Administrador  |  Admin123!
--   prof1@escola.edu.br   |  Ana Professora        |  Prof123!
--   prof2@escola.edu.br   |  Bruno Professor       |  Prof123!
--   prof3@escola.edu.br   |  Carla Docente         |  Prof123!
--   resp1@email.com       |  Maria Silva           |  Resp123!
--   resp2@email.com       |  Joao Santos           |  Resp123!
--   resp3@email.com       |  Lucia Oliveira        |  Resp123!
-- ============================================================

-- ============================================================================
-- 1. USUÁRIOS (auth.users)
-- O trigger fn_handle_new_user cria automaticamente o registro em public.perfis
-- ============================================================================
do $$
begin
  if not exists (select 1 from auth.users where email = 'gestao@escola.edu.br') then
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, email_change_token_current, reauthentication_token, raw_user_meta_data, raw_app_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gestao@escola.edu.br', crypt('Admin123!', gen_salt('bf', 10)), now(), now(), '', '', '', '', '', '', '', jsonb_build_object('email_verified', true, 'nome', 'Carlos Administrador', 'papel', 'gestao'), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), false, false, now(), now());
  end if;

  if not exists (select 1 from auth.users where email = 'prof1@escola.edu.br') then
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, email_change_token_current, reauthentication_token, raw_user_meta_data, raw_app_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prof1@escola.edu.br', crypt('Prof123!', gen_salt('bf', 10)), now(), now(), '', '', '', '', '', '', '', jsonb_build_object('email_verified', true, 'nome', 'Ana Professora', 'papel', 'professor'), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), false, false, now(), now());
  end if;

  if not exists (select 1 from auth.users where email = 'prof2@escola.edu.br') then
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, email_change_token_current, reauthentication_token, raw_user_meta_data, raw_app_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prof2@escola.edu.br', crypt('Prof123!', gen_salt('bf', 10)), now(), now(), '', '', '', '', '', '', '', jsonb_build_object('email_verified', true, 'nome', 'Bruno Professor', 'papel', 'professor'), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), false, false, now(), now());
  end if;

  if not exists (select 1 from auth.users where email = 'prof3@escola.edu.br') then
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, email_change_token_current, reauthentication_token, raw_user_meta_data, raw_app_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prof3@escola.edu.br', crypt('Prof123!', gen_salt('bf', 10)), now(), now(), '', '', '', '', '', '', '', jsonb_build_object('email_verified', true, 'nome', 'Carla Docente', 'papel', 'professor'), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), false, false, now(), now());
  end if;

  if not exists (select 1 from auth.users where email = 'resp1@email.com') then
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, email_change_token_current, reauthentication_token, raw_user_meta_data, raw_app_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'resp1@email.com', crypt('Resp123!', gen_salt('bf', 10)), now(), now(), '', '', '', '', '', '', '', jsonb_build_object('email_verified', true, 'nome', 'Maria Silva', 'papel', 'responsavel'), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), false, false, now(), now());
  end if;

  if not exists (select 1 from auth.users where email = 'resp2@email.com') then
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, email_change_token_current, reauthentication_token, raw_user_meta_data, raw_app_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'resp2@email.com', crypt('Resp123!', gen_salt('bf', 10)), now(), now(), '', '', '', '', '', '', '', jsonb_build_object('email_verified', true, 'nome', 'Joao Santos', 'papel', 'responsavel'), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), false, false, now(), now());
  end if;

  if not exists (select 1 from auth.users where email = 'resp3@email.com') then
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, email_change_token_current, reauthentication_token, raw_user_meta_data, raw_app_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'resp3@email.com', crypt('Resp123!', gen_salt('bf', 10)), now(), now(), '', '', '', '', '', '', '', jsonb_build_object('email_verified', true, 'nome', 'Lucia Oliveira', 'papel', 'responsavel'), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), false, false, now(), now());
  end if;
end;
$$;

-- ============================================================================
-- 1B. IDENTIDADES (necessario para que o GoTrue reconheca os usuarios)
-- ============================================================================
do $$
begin
  if not exists (select 1 from auth.identities where user_id = 'a0000000-0000-0000-0000-000000000001') then
    insert into auth.identities (id, provider, user_id, identity_data, provider_id, last_sign_in_at, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000001', 'email', 'a0000000-0000-0000-0000-000000000001', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'email', 'gestao@escola.edu.br'), 'a0000000-0000-0000-0000-000000000001', now(), now(), now());
  end if;
  if not exists (select 1 from auth.identities where user_id = 'a0000000-0000-0000-0000-000000000002') then
    insert into auth.identities (id, provider, user_id, identity_data, provider_id, last_sign_in_at, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000002', 'email', 'a0000000-0000-0000-0000-000000000002', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000002', 'email', 'prof1@escola.edu.br'), 'a0000000-0000-0000-0000-000000000002', now(), now(), now());
  end if;
  if not exists (select 1 from auth.identities where user_id = 'a0000000-0000-0000-0000-000000000003') then
    insert into auth.identities (id, provider, user_id, identity_data, provider_id, last_sign_in_at, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000003', 'email', 'a0000000-0000-0000-0000-000000000003', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000003', 'email', 'prof2@escola.edu.br'), 'a0000000-0000-0000-0000-000000000003', now(), now(), now());
  end if;
  if not exists (select 1 from auth.identities where user_id = 'a0000000-0000-0000-0000-000000000004') then
    insert into auth.identities (id, provider, user_id, identity_data, provider_id, last_sign_in_at, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000004', 'email', 'a0000000-0000-0000-0000-000000000004', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000004', 'email', 'prof3@escola.edu.br'), 'a0000000-0000-0000-0000-000000000004', now(), now(), now());
  end if;
  if not exists (select 1 from auth.identities where user_id = 'a0000000-0000-0000-0000-000000000005') then
    insert into auth.identities (id, provider, user_id, identity_data, provider_id, last_sign_in_at, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000005', 'email', 'a0000000-0000-0000-0000-000000000005', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000005', 'email', 'resp1@email.com'), 'a0000000-0000-0000-0000-000000000005', now(), now(), now());
  end if;
  if not exists (select 1 from auth.identities where user_id = 'a0000000-0000-0000-0000-000000000006') then
    insert into auth.identities (id, provider, user_id, identity_data, provider_id, last_sign_in_at, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000006', 'email', 'a0000000-0000-0000-0000-000000000006', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000006', 'email', 'resp2@email.com'), 'a0000000-0000-0000-0000-000000000006', now(), now(), now());
  end if;
  if not exists (select 1 from auth.identities where user_id = 'a0000000-0000-0000-0000-000000000007') then
    insert into auth.identities (id, provider, user_id, identity_data, provider_id, last_sign_in_at, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000007', 'email', 'a0000000-0000-0000-0000-000000000007', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000007', 'email', 'resp3@email.com'), 'a0000000-0000-0000-0000-000000000007', now(), now(), now());
  end if;
end;
$$;

-- ============================================================================
-- 2. ATUALIZAR PERFIS (dados complementares criados pelo trigger)
-- ============================================================================
update public.perfis set
  nome = 'Carlos Administrador', telefone = '(85) 99999-0001', cargo = 'Diretor Escolar', status = 'ativo'
where id = 'a0000000-0000-0000-0000-000000000001' and nome = 'gestao';

update public.perfis set
  nome = 'Ana Professora', telefone = '(85) 99999-0002', cargo = 'Professora de Português', status = 'ativo'
where id = 'a0000000-0000-0000-0000-000000000002' and nome = 'prof1';

update public.perfis set
  nome = 'Bruno Professor', telefone = '(85) 99999-0003', cargo = 'Professor de Matemática', status = 'ativo'
where id = 'a0000000-0000-0000-0000-000000000003' and nome = 'prof2';

update public.perfis set
  nome = 'Carla Docente', telefone = '(85) 99999-0004', status = 'pendente'
where id = 'a0000000-0000-0000-0000-000000000004' and nome = 'prof3';

update public.perfis set
  nome = 'Maria Silva', telefone = '(85) 99999-0005', status = 'ativo'
where id = 'a0000000-0000-0000-0000-000000000005' and nome = 'resp1';

update public.perfis set
  nome = 'Joao Santos', telefone = '(85) 99999-0006', status = 'pendente'
where id = 'a0000000-0000-0000-0000-000000000006' and nome = 'resp2';

update public.perfis set
  nome = 'Lucia Oliveira', telefone = '(85) 99999-0007', status = 'ativo'
where id = 'a0000000-0000-0000-0000-000000000007' and nome = 'resp3';

-- ============================================================================
-- 3. CONFIGURAÇÕES DA ESCOLA
-- ============================================================================
insert into public.configuracoes_escola (chave, valor, descricao) values
  ('chat_hora_inicio',     '07:00',  'Horário de início do chat (RF27)'),
  ('chat_hora_fim',        '17:00',  'Horário de encerramento do chat (RF27)'),
  ('chat_permitir_sabado', 'false',  'Permitir chat aos sábados'),
  ('chat_permitir_domingo','false',  'Permitir chat aos domingos'),
  ('nome_escola',          'EEMTI',  'Nome da unidade escolar')
on conflict (chave) do nothing;

-- ============================================================================
-- 4. ANO LETIVO VIGENTE
-- ============================================================================
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

-- ============================================================================
-- 5. HORÁRIOS LETIVOS
-- ============================================================================
insert into public.horarios_letivos (dia_semana, hora_inicio, hora_fim) values
  (1, '07:00', '17:00'),
  (2, '07:00', '17:00'),
  (3, '07:00', '17:00'),
  (4, '07:00', '17:00'),
  (5, '07:00', '17:00')
on conflict (dia_semana, hora_inicio, hora_fim) do nothing;

-- ============================================================================
-- 6. DISCIPLINAS
-- ============================================================================
insert into public.disciplinas (id, nome, codigo_sige, carga_horaria) values
  ('c0000000-0000-0000-0000-000000000001', 'Português',    'PORT', 160),
  ('c0000000-0000-0000-0000-000000000002', 'Matemática',   'MAT',  160),
  ('c0000000-0000-0000-0000-000000000003', 'História',     'HIST', 120),
  ('c0000000-0000-0000-0000-000000000004', 'Ciências',     'CIEN', 120),
  ('c0000000-0000-0000-0000-000000000005', 'Geografia',    'GEO',  120),
  ('c0000000-0000-0000-0000-000000000006', 'Artes',        'ART',  80)
on conflict (codigo_sige) do nothing;

-- ============================================================================
-- 7. TAGS DE COMPORTAMENTO (RF16)
-- ============================================================================
insert into public.tags_comportamento (nome, categoria, icone, descricao, peso_pontuacao) values
  ('Participativo',   'positivo', 'hand-thumbs-up', 'Aluno participou ativamente da aula', 10),
  ('Colaborativo',    'positivo', 'people',         'Trabalhou bem em grupo',             10),
  ('Pontual',         'positivo', 'clock',          'Chegou no horário',                  5),
  ('Protagonista',    'positivo', 'star',           'Demonstrou iniciativa e liderança',   15),
  ('Desatenção',      'atencao',  'eye-slash',      'Dificuldade de concentração pontual', 0),
  ('Uso de celular',  'atencao',  'phone',          'Uso não autorizado de celular',      0),
  ('Conversa paralela', 'atencao', 'chat-dots',     'Conversa fora do contexto da aula',   0),
  ('Sem material',    'atencao',  'book',            'Não trouxe material necessário',     0)
on conflict (nome) do nothing;

-- ============================================================================
-- 8. TURMAS
-- ============================================================================
insert into public.turmas (id, ano_letivo_id, serie, letra, capacidade) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '1º', 'A', 40),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '2º', 'B', 40),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '3º', 'C', 40)
on conflict (ano_letivo_id, serie, letra) do nothing;

-- ============================================================================
-- 9. ALUNOS
-- ============================================================================
insert into public.alunos (id, nome, matricula, codigo_inep, status, data_nascimento, data_matricula, observacoes) values
  ('e0000000-0000-0000-0000-000000000001', 'João Miguel da Silva',    'MAT2026001', '23123456', 'ativo',       '2012-03-15', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000002', 'Maria Clara Santos',      'MAT2026002', '23123457', 'ativo',       '2012-07-22', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000003', 'Pedro Henrique Lima',     'MAT2026003', '23123458', 'ativo',       '2011-11-30', make_date(extract(year from current_date)::int, 2, 1), 'Aluno com histórico de faltas recorrentes'),
  ('e0000000-0000-0000-0000-000000000004', 'Ana Beatriz Costa',       'MAT2026004', '23123459', 'transferido', '2011-01-10', make_date(extract(year from current_date)::int, 2, 1), 'Transferida para escola estadual em abril/2026'),
  ('e0000000-0000-0000-0000-000000000005', 'Lucas Eduardo Pereira',   'MAT2026005', '23123460', 'ativo',       '2011-05-18', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000006', 'Julia Gabriela Oliveira', 'MAT2026006', '23123461', 'ativo',       '2010-09-25', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000007', 'Rafael Augusto Almeida',  'MAT2026007', '23123462', 'ativo',       '2010-02-14', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000008', 'Isabela Cristina Martins','MAT2026008', '23123463', 'ativo',       '2009-12-01', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000009', 'Thiago Vinicius Barbosa', 'MAT2026009', '23123464', 'ativo',       '2010-06-08', make_date(extract(year from current_date)::int, 2, 1), 'Aluno com acompanhamento pedagógico')
on conflict (matricula) do nothing;

-- ============================================================================
-- 10. ENTURMAÇÕES
-- ============================================================================
insert into public.enturmacoes (aluno_id, turma_id, ano_letivo_id, status, data_matricula, data_encerramento) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'matriculado',  make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'matriculado',  make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'matriculado',  make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'transferido',  make_date(extract(year from current_date)::int, 2, 1), '2026-04-15'),
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'matriculado',  make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'matriculado',  make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'matriculado',  make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'matriculado',  make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'matriculado',  make_date(extract(year from current_date)::int, 2, 1), null)
on conflict (aluno_id, ano_letivo_id) do nothing;

-- ============================================================================
-- 11. ATRIBUIÇÕES PROFESSORES
-- ============================================================================
insert into public.atribuicoes_professores (professor_id, turma_id, disciplina_id, papel) values
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', null, 'titular'),
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'titular'),
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'titular'),
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'titular'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', null, 'titular'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'titular'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'titular'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'titular');

-- ============================================================================
-- 12. VÍNCULOS RESPONSÁVEIS
-- ============================================================================
insert into public.vinculos_responsaveis (responsavel_id, aluno_id, tipo_relacao, contato_prioritario) values
  ('a0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'mae',  true),
  ('a0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'mae',  false),
  ('a0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000005', 'pai',  true),
  ('a0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000007', 'mae',  true)
on conflict (responsavel_id, aluno_id) do nothing;

-- ============================================================================
-- 13. FREQUÊNCIAS
-- Gera 5 dias de aula (02 a 06 de março) para alunos ativos,
-- com diferentes padrões de ausência para testar ranking de risco.
-- ============================================================================
do $$
declare
  v_ano_letivo_id uuid := 'b0000000-0000-0000-0000-000000000001';
  v_disciplinas uuid[] := array[
    'c0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000000006'
  ];
  v_dia date;
  v_aluno record;
  v_professor_id uuid;
  v_status text;
  v_aula_count int;
begin
  for v_dia in select generate_series('2026-03-02'::date, '2026-03-06'::date, '1 day') loop
    for v_aluno in
      select a.id as aluno_id, e.turma_id
      from public.alunos a
      join public.enturmacoes e on e.aluno_id = a.id and e.status = 'matriculado'
      where a.status = 'ativo'
    loop
      v_professor_id := case
        when v_aluno.turma_id = 'd0000000-0000-0000-0000-000000000001' then 'a0000000-0000-0000-0000-000000000002'
        when v_aluno.turma_id = 'd0000000-0000-0000-0000-000000000002' then 'a0000000-0000-0000-0000-000000000003'
        else 'a0000000-0000-0000-0000-000000000002'
      end;

      -- 3 aulas por dia (Português/Matemática, História/Ciências, Geografia/Artes)
      for v_aula_count in 1..3 loop
        v_status := 'presente';

        -- João Miguel (1º A): 3 ausências (dias 02, 04, 06)
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000001' and v_dia in ('2026-03-02'::date, '2026-03-04'::date, '2026-03-06'::date) then
          v_status := 'ausente';
        end if;

        -- Pedro Henrique (1º A): 5 ausências (todos os dias) = risco alto
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000003' then
          v_status := 'ausente';
        end if;

        -- Lucas Eduardo (2º B): 2 ausências (dias 03, 05)
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000005' and v_dia in ('2026-03-03'::date, '2026-03-05'::date) then
          v_status := 'ausente';
        end if;

        -- Julia Gabriela (2º B): 4 ausências (dias 02, 03, 05, 06)
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000006' and v_dia in ('2026-03-02'::date, '2026-03-03'::date, '2026-03-05'::date, '2026-03-06'::date) then
          v_status := 'ausente';
        end if;

        -- Rafael Augusto (3º C): 0 ausências (perfeita frequência)

        -- Isabela Cristina (3º C): 1 ausência (dia 04)
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000008' and v_dia = '2026-03-04'::date then
          v_status := 'ausente';
        end if;

        -- Thiago Vinicius (3º C): 3 ausências (dias 02, 04, 06)
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000009' and v_dia in ('2026-03-02'::date, '2026-03-04'::date, '2026-03-06'::date) then
          v_status := 'ausente';
        end if;

        insert into public.frequencias (aluno_id, professor_id, turma_id, disciplina_id, ano_letivo_id, data_aula, tipo_registro, periodo, status)
        values (
          v_aluno.aluno_id,
          v_professor_id,
          v_aluno.turma_id,
          v_disciplinas[v_aula_count],
          v_ano_letivo_id,
          v_dia,
          'chamada_aula',
          case v_aula_count when 1 then 'Manhã' when 2 then 'Manhã' else 'Tarde' end,
          v_status::public.status_frequencia
        );
      end loop;
    end loop;
  end loop;
end;
$$;

-- ============================================================================
-- 14. OCORRÊNCIAS
-- ============================================================================
insert into public.ocorrencias (aluno_id, professor_id, turma_id, ano_letivo_id, titulo, descricao, tipo, status, data_ocorrencia) values
  (
    'e0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Uso de celular durante prova',
    'Aluno foi flagrado utilizando o celular durante a avaliação bimestral de Português. O aparelho foi recolhido e entregue à coordenação.',
    '{grave}',
    'em_andamento',
    '2026-03-10 09:30:00-03'
  ),
  (
    'e0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001',
    'Ameaça a colega de turma',
    'Aluna fez ameaças verbais a um colega durante o intervalo. Testemunhas relataram o ocorrido à coordenação. Exige reunião com responsável.',
    '{suspensao}',
    'aberta',
    '2026-03-18 15:00:00-03'
  );

-- ============================================================================
-- 15. NOTIFICAÇÕES
-- ============================================================================
insert into public.notificacoes (destinatario_id, tipo, titulo, corpo, metadados) values
  (
    'a0000000-0000-0000-0000-000000000001',
    'sistema',
    'Novo ano letivo iniciado',
    'O ano letivo de 2026 foi ativado com sucesso. Todas as turmas e horários estão configurados.',
    null
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'ausencia_aula',
    'Aluno com faltas críticas detectado',
    'Pedro Henrique Lima (1º A) atingiu 5 faltas consecutivas. Recomenda-se acionar o protocolo de monitoramento.',
    null
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'codigo_redefinicao',
    'Solicitação de redefinição de senha',
    'O usuário Maria Silva (resp1@email.com, responsavel) solicitou um código para redefinir a senha.',
    jsonb_build_object('email', 'resp1@email.com', 'perfil_id', 'a0000000-0000-0000-0000-000000000005')
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'sistema',
    'Bem-vinda ao sistema',
    'Seu perfil de professora foi ativado. Você está vinculada à turma 1º A como titular.',
    null
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'sistema',
    'Bem-vindo ao sistema',
    'Seu perfil de responsável foi ativado. Você receberá notificações sobre a frequência dos seus dependentes.',
    null
  );

-- ============================================================================
-- 16. CÓDIGOS DE REDEFINIÇÃO
-- ============================================================================
insert into public.codigos_redefinicao (email, perfil_id, codigo, criado_por, usado_em, expira_em) values
  (
    'resp1@email.com',
    'a0000000-0000-0000-0000-000000000005',
    '123456',
    'a0000000-0000-0000-0000-000000000001',
    null,
    now() - interval '2 days'
  ),
  (
    'prof1@escola.edu.br',
    'a0000000-0000-0000-0000-000000000002',
    '654321',
    'a0000000-0000-0000-0000-000000000001',
    now() - interval '1 hour',
    now() + interval '1 day'
  ),
  (
    'prof2@escola.edu.br',
    'a0000000-0000-0000-0000-000000000003',
    '789012',
    'a0000000-0000-0000-0000-000000000001',
    null,
    now() + interval '2 hours'
  );

-- ============================================================================
-- 17. MONITORAMENTO AÇÕES
-- ============================================================================
insert into public.monitoramento_acoes (aluno_id, responsavel_id, tipo_contato, status, realizado_por, observacao, agendado_para, realizado_em) values
  (
    'e0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000005',
    'telefone',
    'realizado',
    'a0000000-0000-0000-0000-000000000001',
    'Tentativa de contato com a mãe. Telefone chamou mas ninguém atendeu.',
    null,
    '2026-03-20 10:00:00-03'
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000005',
    'whatsapp',
    'realizado',
    'a0000000-0000-0000-0000-000000000001',
    'Enviada mensagem via WhatsApp informando sobre as faltas do aluno. Aguardando retorno.',
    null,
    '2026-03-20 14:30:00-03'
  ),
  (
    'e0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000006',
    'presencial',
    'pendente',
    null,
    'Visita domiciliar aguardando agendamento. Aluna com 4 faltas consecutivas.',
    '2026-04-01 09:00:00-03',
    null
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000005',
    'presencial',
    'pendente',
    'a0000000-0000-0000-0000-000000000001',
    'Reunião agendada com a mãe na escola para discutir o desempenho e frequência do aluno.',
    '2026-07-15 14:00:00-03',
    null
  );

-- ============================================================================
-- 9. OPCÕES DE CONFIGURAÇÃO (catálogo genérico)
-- ============================================================================

do $$
begin
  -- modulo
  if not exists (select 1 from public.opcoes_configuracao where tipo = 'modulo') then
    insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
      ('modulo', 'frequencia', 'Frequência', 'check2-square', 1, true),
      ('modulo', 'ocorrencias', 'Ocorrências', 'exclamation-triangle', 2, true);
  end if;
  -- permissao (vazio por enquanto — todas as funcionalidades são controladas por papel, não por permissão granular)
  -- documento
  if not exists (select 1 from public.opcoes_configuracao where tipo = 'documento') then
    insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
      ('documento', 'rg', 'RG', 'person-vcard', 1, true),
      ('documento', 'cpf', 'CPF', 'credit-card', 2, true),
      ('documento', 'certidao_nascimento', 'Certidão de Nascimento', 'file-earmark-text', 3, true),
      ('documento', 'comprovante_residencia', 'Comprovante de Residência', 'house', 4, true),
      ('documento', 'cartao_vacina', 'Cartão de Vacina', 'heart-pulse', 5, true),
      ('documento', 'nis', 'NIS', 'person-badge', 6, true);
  end if;
  -- periodo
  if not exists (select 1 from public.opcoes_configuracao where tipo = 'periodo') then
    insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
      ('periodo', 'Dia completo', 'Dia completo', 'calendar-check', 1, true),
      ('periodo', '1º Horário', '1º Horário', null, 2, true),
      ('periodo', '2º Horário', '2º Horário', null, 3, true),
      ('periodo', '3º Horário', '3º Horário', null, 4, true),
      ('periodo', '4º Horário', '4º Horário', null, 5, true),
      ('periodo', 'Manhã', 'Manhã', 'sun', 6, true),
      ('periodo', 'Tarde', 'Tarde', 'sunset', 7, true);
  end if;
  -- motivo_ausencia
  if not exists (select 1 from public.opcoes_configuracao where tipo = 'motivo_ausencia') then
    insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
      ('motivo_ausencia', 'enfermaria', 'Enfermaria', 'heart-pulse', 1, true),
      ('motivo_ausencia', 'orientacao', 'Orientação pedagógica', 'people', 2, true),
      ('motivo_ausencia', 'saida_antecipada', 'Saída antecipada', 'door-open', 3, true),
      ('motivo_ausencia', 'conselho_tutelar', 'Conselho tutelar', 'shield-check', 4, true),
      ('motivo_ausencia', 'atendimento_psicologico', 'Atendimento psicológico', 'heart', 5, true),
      ('motivo_ausencia', 'atividade_externa', 'Atividade externa', 'briefcase', 6, true);
  end if;
  -- tipo_ocorrencia
  if not exists (select 1 from public.opcoes_configuracao where tipo = 'tipo_ocorrencia') then
    insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
      ('tipo_ocorrencia', 'grave', 'Ocorrência grave', 'exclamation-triangle', 1, true),
      ('tipo_ocorrencia', 'suspensao', 'Suspensão', 'shield-exclamation', 2, true);
  end if;
  -- tipo_vinculo
  if not exists (select 1 from public.opcoes_configuracao where tipo = 'tipo_vinculo') then
    insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
      ('tipo_vinculo', 'pai', 'Pai', null, 1, true),
      ('tipo_vinculo', 'mae', 'Mãe', null, 2, true),
      ('tipo_vinculo', 'tutor', 'Tutor', null, 3, true),
      ('tipo_vinculo', 'avo', 'Avó/Avô', null, 4, true),
      ('tipo_vinculo', 'irmao', 'Irmão/Irmã', null, 5, true),
      ('tipo_vinculo', 'outro', 'Outro', null, 6, true);
  end if;
  -- papel_atribuicao
  if not exists (select 1 from public.opcoes_configuracao where tipo = 'papel_atribuicao') then
    insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
      ('papel_atribuicao', 'titular', 'Titular', null, 1, true),
      ('papel_atribuicao', 'substituto', 'Substituto', null, 2, true);
  end if;
  -- serie_turma
  if not exists (select 1 from public.opcoes_configuracao where tipo = 'serie_turma') then
    insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
      ('serie_turma', '1º', '1º', null, 1, true),
      ('serie_turma', '2º', '2º', null, 2, true),
      ('serie_turma', '3º', '3º', null, 3, true);
  end if;
  -- letra_turma
  if not exists (select 1 from public.opcoes_configuracao where tipo = 'letra_turma') then
    insert into public.opcoes_configuracao (tipo, chave, rotulo, icone, ordem, ativo) values
      ('letra_turma', 'A', 'A', null, 1, true),
      ('letra_turma', 'B', 'B', null, 2, true),
      ('letra_turma', 'C', 'C', null, 3, true);
  end if;
end;
$$;
