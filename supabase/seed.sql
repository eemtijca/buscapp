-- Dados de desenvolvimento. Usuarios de teste: gestao@escola.edu.br (Admin123!), prof1@escola.edu.br (Prof123!), prof2@escola.edu.br (Prof123!), prof3@escola.edu.br (Prof123!), resp1@email.com (Resp123!), resp2@email.com (Resp123!), resp3@email.com (Resp123!)

-- 1. USUÁRIOS (auth.users)
-- O trigger fn_handle_new_user cria automaticamente o registro em public.perfis
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
    values ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'resp2@email.com', crypt('Resp123!', gen_salt('bf', 10)), now(), now(), '', '', '', '', '', '', '', jsonb_build_object('email_verified', true, 'nome', 'João Santos', 'papel', 'responsavel'), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), false, false, now(), now());
  end if;

  if not exists (select 1 from auth.users where email = 'resp3@email.com') then
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, email_change_token_current, reauthentication_token, raw_user_meta_data, raw_app_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
    values ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'resp3@email.com', crypt('Resp123!', gen_salt('bf', 10)), now(), now(), '', '', '', '', '', '', '', jsonb_build_object('email_verified', true, 'nome', 'Lucia Oliveira', 'papel', 'responsavel'), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), false, false, now(), now());
  end if;
end;
$$;

-- 1B. IDENTIDADES (necessário para que o GoTrue reconheça os usuários)
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

-- 2. ATUALIZAR PERFIS (dados complementares criados pelo trigger)
update public.perfis set
  nome = 'Carlos Administrador', telefone = '(85) 99999-0001', cargo = 'Diretor Escolar', status = 'ativo',
  acesso_modulos = array['frequencia', 'ocorrencias']
where id = 'a0000000-0000-0000-0000-000000000001';

update public.perfis set
  nome = 'Ana Professora', telefone = '(85) 99999-0002', cargo = 'Professora de Português', status = 'ativo',
  acesso_modulos = array['frequencia', 'ocorrencias']
where id = 'a0000000-0000-0000-0000-000000000002';

update public.perfis set
  nome = 'Bruno Professor', telefone = '(85) 99999-0003', cargo = 'Professor de Matemática', status = 'ativo',
  acesso_modulos = array['frequencia']
where id = 'a0000000-0000-0000-0000-000000000003';

update public.perfis set
  nome = 'Carla Docente', telefone = '(85) 99999-0004', status = 'pendente',
  acesso_modulos = array['frequencia', 'ocorrencias']
where id = 'a0000000-0000-0000-0000-000000000004';

update public.perfis set
  nome = 'Maria Silva', telefone = '(85) 99999-0005', status = 'ativo',
  acesso_modulos = array['frequencia', 'ocorrencias']
where id = 'a0000000-0000-0000-0000-000000000005';

update public.perfis set
  nome = 'João Santos', telefone = '(85) 99999-0006', status = 'pendente',
  acesso_modulos = array['frequencia', 'ocorrencias']
where id = 'a0000000-0000-0000-0000-000000000006';

update public.perfis set
  nome = 'Lucia Oliveira', telefone = '(85) 99999-0007', status = 'ativo',
  acesso_modulos = array['frequencia', 'ocorrencias']
where id = 'a0000000-0000-0000-0000-000000000007';
-- 3. ANO LETIVO VIGENTE
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
-- Catalogos e configuracoes ficam nos dados canonicos da migration unica; aqui há apenas pessoas e atividade.

-- 4. TURMAS
insert into public.turmas (id, ano_letivo_id, serie, letra, capacidade) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '1ª', 'A', 40),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '2ª', 'B', 40),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '3ª', 'C', 40)
on conflict (ano_letivo_id, serie, letra) do nothing;

-- 5. ALUNOS
insert into public.alunos (id, nome, matricula, codigo_inep, status, data_nascimento, data_matricula, observacoes) values
  ('e0000000-0000-0000-0000-000000000001', 'João Miguel da Silva',    'MAT2026001', '23123456', 'ativo',       '2012-03-15', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000002', 'Maria Clara Santos',      'MAT2026002', '23123457', 'ativo',       '2012-07-22', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000003', 'Pedro Henrique Lima',     'MAT2026003', '23123458', 'ativo',       '2011-11-30', make_date(extract(year from current_date)::int, 2, 1), 'Aluno com histórico de faltas recorrentes'),
  ('e0000000-0000-0000-0000-000000000004', 'Ana Beatriz Costa',       'MAT2026004', '23123459', 'transferido', '2011-01-10', make_date(extract(year from current_date)::int, 2, 1), 'Transferida para escola estadual em abril/2026'),
  ('e0000000-0000-0000-0000-000000000005', 'Lucas Eduardo Pereira',   'MAT2026005', '23123460', 'ativo',       '2011-05-18', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000006', 'Júlia Gabriela Oliveira', 'MAT2026006', '23123461', 'ativo',       '2010-09-25', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000007', 'Rafael Augusto Almeida',  'MAT2026007', '23123462', 'ativo',       '2010-02-14', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000008', 'Isabela Cristina Martins','MAT2026008', '23123463', 'ativo',       '2009-12-01', make_date(extract(year from current_date)::int, 2, 1), null),
  ('e0000000-0000-0000-0000-000000000009', 'Thiago Vinicius Barbosa', 'MAT2026009', '23123464', 'ativo',       '2010-06-08', make_date(extract(year from current_date)::int, 2, 1), 'Aluno com acompanhamento pedagógico')
on conflict (matricula) do nothing;

-- 6. ENTURMAÇÕES
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

-- 7. ATRIBUIÇÕES PROFESSORES
insert into public.atribuicoes_professores (professor_id, turma_id, disciplina_id, papel) values
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', null, 'titular'),
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'titular'),
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'titular'),
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'titular'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', null, 'titular'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'titular'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'titular'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'titular');

-- 8. VÍNCULOS RESPONSÁVEIS
insert into public.vinculos_responsaveis (responsavel_id, aluno_id, tipo_relacao, contato_prioritario) values
  ('a0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'mae',  true),
  ('a0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'mae',  false),
  ('a0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000005', 'pai',  true),
  ('a0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000007', 'mae',  true)
on conflict (responsavel_id, aluno_id) do nothing;

-- Frequencias: cinco dias de aula em marco com padroes variados de ausencia para testar o ranking.
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

      -- 3 aulas por dia (Língua Portuguesa/Arte, Educação Física/Matemática, Física/Química)
      for v_aula_count in 1..3 loop
        v_status := 'presente';

        -- João Miguel (1ª A): 3 ausências (dias 02, 04, 06)
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000001' and v_dia in ('2026-03-02'::date, '2026-03-04'::date, '2026-03-06'::date) then
          v_status := 'ausente';
        end if;

        -- Pedro Henrique (1ª A): 5 ausências (todos os dias) = risco alto
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000003' then
          v_status := 'ausente';
        end if;

        -- Lucas Eduardo (2ª B): 2 ausências (dias 03, 05)
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000005' and v_dia in ('2026-03-03'::date, '2026-03-05'::date) then
          v_status := 'ausente';
        end if;

        -- Júlia Gabriela (2ª B): 4 ausências (dias 02, 03, 05, 06)
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000006' and v_dia in ('2026-03-02'::date, '2026-03-03'::date, '2026-03-05'::date, '2026-03-06'::date) then
          v_status := 'ausente';
        end if;

        -- Rafael Augusto (3ª C): 0 ausências (perfeita frequência)

        -- Isabela Cristina (3ª C): 1 ausência (dia 04)
        if v_aluno.aluno_id = 'e0000000-0000-0000-0000-000000000008' and v_dia = '2026-03-04'::date then
          v_status := 'ausente';
        end if;

        -- Thiago Vinicius (3ª C): 3 ausências (dias 02, 04, 06)
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

-- 10. OCORRÊNCIAS
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

-- 11. NOTIFICAÇÕES
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
    'Pedro Henrique Lima (1ª A) atingiu 5 faltas consecutivas. Recomenda-se acionar o protocolo de monitoramento.',
    null
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'codigo_redefinicao',
    'Solicitação de redefinição de senha',
    'O usuário Maria Silva (resp1@email.com, responsável) solicitou um código para redefinir a senha.',
    jsonb_build_object('email', 'resp1@email.com', 'perfil_id', 'a0000000-0000-0000-0000-000000000005')
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'sistema',
    'Bem-vinda ao sistema',
    'Seu perfil de professora foi ativado. Você está vinculada à turma 1ª A como titular.',
    null
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'sistema',
    'Bem-vindo ao sistema',
    'Seu perfil de responsável foi ativado. Você receberá notificações sobre a frequência dos seus dependentes.',
    null
  );

-- 12. CÓDIGOS DE REDEFINIÇÃO
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

-- 13. MONITORAMENTO AÇÕES
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

