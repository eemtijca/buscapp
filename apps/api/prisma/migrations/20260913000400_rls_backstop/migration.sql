-- Fase 7: backstop de autorização no banco.
-- Um papel de runtime sem BYPASSRLS passa a ser usado pela API; as políticas usam
-- `current_setting('app.usuario_id', true)`, definido por transação no cliente Prisma.
-- O papel dono do schema continua rodando migrações e serviços de manutenção.

-- Papel de runtime (a senha é definida pelo entrypoint/operação, nunca na migração).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'buscapp_api') then
    create role buscapp_api login;
  end if;
end
$$;

grant usage on schema public to buscapp_api;
grant select, insert, update, delete on all tables in schema public to buscapp_api;
grant usage, select on all sequences in schema public to buscapp_api;
alter default privileges in schema public
  grant select, insert, update, delete on tables to buscapp_api;
alter default privileges in schema public
  grant usage, select on sequences to buscapp_api;

-- Remove eventuais políticas legadas (Supabase) antes de recriar as nossas.
do $$
declare
  politica record;
begin
  for politica in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      politica.policyname, politica.schemaname, politica.tablename
    );
  end loop;
end
$$;

-- Helpers de contexto. SECURITY DEFINER para poderem ler perfis/escopo sem recursão de RLS.
create or replace function public.app_usuario_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.usuario_id', true), '')::uuid
$$;

create or replace function public.app_papel()
returns public.papel_perfil
language sql
stable
security definer
set search_path = ''
as $$
  select p.papel
  from public.perfis p
  where p.id = public.app_usuario_id() and p.status = 'ativo'
$$;

create or replace function public.app_modulos()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.acesso_modulos, '{}')
  from public.perfis p
  where p.id = public.app_usuario_id() and p.status = 'ativo'
$$;

create or replace function public.app_is_gestao()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.app_papel() = 'gestao'
$$;

create or replace function public.app_professor_da_turma(p_turma_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.atribuicoes_professores a
    where a.professor_id = public.app_usuario_id()
      and a.turma_id = p_turma_id
      and a.ativo
      and (a.data_fim is null or a.data_fim >= current_date)
  )
$$;

create or replace function public.app_aluno_visivel(p_aluno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.app_is_gestao()
      or exists (
        select 1
        from public.enturmacoes e
        where e.aluno_id = p_aluno_id
          and e.status = 'matriculado'
          and public.app_professor_da_turma(e.turma_id)
      )
      or exists (
        select 1
        from public.vinculos_responsaveis v
        where v.aluno_id = p_aluno_id
          and v.responsavel_id = public.app_usuario_id()
          and v.ativo
      )
$$;

grant execute on function public.app_usuario_id() to buscapp_api;
grant execute on function public.app_papel() to buscapp_api;
grant execute on function public.app_modulos() to buscapp_api;
grant execute on function public.app_is_gestao() to buscapp_api;
grant execute on function public.app_professor_da_turma(uuid) to buscapp_api;
grant execute on function public.app_aluno_visivel(uuid) to buscapp_api;

-- Tabelas de leitura autenticada e escrita restrita à gestão.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'turmas', 'disciplinas', 'anos_letivos', 'atribuicoes_professores',
    'opcoes_configuracao', 'horarios_letivos', 'tags_comportamento',
    'monitoramento_acoes', 'pontuacao_turmas'
  ]
  loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format(
      'create policy %I on public.%I for select to buscapp_api using (public.app_usuario_id() is not null)',
      'leitura_autenticada', tabela
    );
    execute format(
      'create policy %I on public.%I for all to buscapp_api using (public.app_is_gestao()) with check (public.app_is_gestao())',
      'gestao_total', tabela
    );
  end loop;
end
$$;

-- Tabelas administrativas: apenas gestão.
do $$
declare
  tabela text;
begin
  foreach tabela in array array['importacoes_log', 'exportacoes', 'convites']
  loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format(
      'create policy %I on public.%I for all to buscapp_api using (public.app_is_gestao()) with check (public.app_is_gestao())',
      'gestao_total', tabela
    );
  end loop;
end
$$;

-- Alunos: gestão total; professor vê alunos das suas turmas; responsável vê os vinculados.
alter table public.alunos enable row level security;
create policy gestao_total on public.alunos for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.alunos for select to buscapp_api
  using (public.app_aluno_visivel(id));

-- Enturmações.
alter table public.enturmacoes enable row level security;
create policy gestao_total on public.enturmacoes for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.enturmacoes for select to buscapp_api
  using (public.app_aluno_visivel(aluno_id));

-- Vínculos responsável-aluno.
alter table public.vinculos_responsaveis enable row level security;
create policy gestao_total on public.vinculos_responsaveis for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.vinculos_responsaveis for select to buscapp_api
  using (public.app_aluno_visivel(aluno_id) or responsavel_id = public.app_usuario_id());

-- Frequências.
alter table public.frequencias enable row level security;
create policy gestao_total on public.frequencias for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.frequencias for select to buscapp_api
  using (public.app_aluno_visivel(aluno_id));
create policy professor_escreve on public.frequencias for all to buscapp_api
  using (
    public.app_professor_da_turma(turma_id)
    and public.app_modulos() @> array['frequencia']
  )
  with check (
    public.app_professor_da_turma(turma_id)
    and public.app_modulos() @> array['frequencia']
  );

-- Registros de comportamento.
alter table public.registros_comportamento enable row level security;
create policy gestao_total on public.registros_comportamento for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.registros_comportamento for select to buscapp_api
  using (public.app_aluno_visivel(aluno_id));
create policy professor_escreve on public.registros_comportamento for all to buscapp_api
  using (
    public.app_professor_da_turma(turma_id)
    and public.app_modulos() @> array['ocorrencias']
  )
  with check (
    public.app_professor_da_turma(turma_id)
    and public.app_modulos() @> array['ocorrencias']
  );

alter table public.registro_comportamento_tags enable row level security;
create policy gestao_total on public.registro_comportamento_tags for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.registro_comportamento_tags for select to buscapp_api
  using (
    exists (
      select 1 from public.registros_comportamento r
      where r.id = registro_id and public.app_aluno_visivel(r.aluno_id)
    )
  );
create policy professor_escreve on public.registro_comportamento_tags for all to buscapp_api
  using (
    exists (
      select 1 from public.registros_comportamento r
      where r.id = registro_id
        and r.professor_id = public.app_usuario_id()
        and public.app_modulos() @> array['ocorrencias']
    )
  )
  with check (
    exists (
      select 1 from public.registros_comportamento r
      where r.id = registro_id
        and r.professor_id = public.app_usuario_id()
        and public.app_modulos() @> array['ocorrencias']
    )
  );

-- Ocorrências.
alter table public.ocorrencias enable row level security;
create policy gestao_total on public.ocorrencias for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.ocorrencias for select to buscapp_api
  using (
    public.app_aluno_visivel(aluno_id)
    and (
      public.app_papel() = 'gestao'
      or public.app_modulos() @> array['alertas']
      or public.app_modulos() @> array['ocorrencias']
    )
  );
create policy professor_escreve on public.ocorrencias for all to buscapp_api
  using (
    public.app_professor_da_turma(turma_id)
    and public.app_modulos() @> array['ocorrencias']
  )
  with check (
    public.app_professor_da_turma(turma_id)
    and public.app_modulos() @> array['ocorrencias']
  );

alter table public.ocorrencia_anexos enable row level security;
create policy gestao_total on public.ocorrencia_anexos for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.ocorrencia_anexos for select to buscapp_api
  using (
    exists (
      select 1 from public.ocorrencias o
      where o.id = ocorrencia_id and public.app_aluno_visivel(o.aluno_id)
    )
  );
create policy escrita_escopada on public.ocorrencia_anexos for insert to buscapp_api
  with check (
    exists (
      select 1 from public.ocorrencias o
      where o.id = ocorrencia_id and public.app_aluno_visivel(o.aluno_id)
    )
  );

-- Justificativas.
alter table public.justificativas_faltas enable row level security;
create policy gestao_total on public.justificativas_faltas for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.justificativas_faltas for select to buscapp_api
  using (public.app_aluno_visivel(aluno_id));
create policy responsavel_escreve on public.justificativas_faltas for insert to buscapp_api
  with check (
    responsavel_id = public.app_usuario_id()
    and public.app_modulos() @> array['justificativa']
    and public.app_aluno_visivel(aluno_id)
  );
create policy responsavel_remove_pendente on public.justificativas_faltas for delete to buscapp_api
  using (responsavel_id = public.app_usuario_id() and status = 'pendente');

alter table public.justificativa_anexos enable row level security;
create policy gestao_total on public.justificativa_anexos for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.justificativa_anexos for select to buscapp_api
  using (
    exists (
      select 1 from public.justificativas_faltas j
      where j.id = justificativa_id and public.app_aluno_visivel(j.aluno_id)
    )
  );
create policy escrita_escopada on public.justificativa_anexos for insert to buscapp_api
  with check (
    exists (
      select 1 from public.justificativas_faltas j
      where j.id = justificativa_id and public.app_aluno_visivel(j.aluno_id)
    )
  );
create policy responsavel_remove on public.justificativa_anexos for delete to buscapp_api
  using (
    exists (
      select 1 from public.justificativas_faltas j
      where j.id = justificativa_id
        and j.responsavel_id = public.app_usuario_id()
        and j.status = 'pendente'
    )
  );

-- Anexos.
alter table public.anexos enable row level security;
create policy gestao_total on public.anexos for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy leitura_escopada on public.anexos for select to buscapp_api
  using (
    criado_por = public.app_usuario_id()
    or exists (
      select 1
      from public.justificativa_anexos ja
      join public.justificativas_faltas j on j.id = ja.justificativa_id
      where ja.anexo_id = id and public.app_aluno_visivel(j.aluno_id)
    )
    or exists (
      select 1
      from public.ocorrencia_anexos oa
      join public.ocorrencias o on o.id = oa.ocorrencia_id
      where oa.anexo_id = id and public.app_aluno_visivel(o.aluno_id)
    )
  );
create policy criador_escreve on public.anexos for insert to buscapp_api
  with check (criado_por = public.app_usuario_id() or public.app_is_gestao());
create policy criador_atualiza on public.anexos for update to buscapp_api
  using (criado_por = public.app_usuario_id() or public.app_is_gestao())
  with check (criado_por = public.app_usuario_id() or public.app_is_gestao());
create policy criador_remove on public.anexos for delete to buscapp_api
  using (criado_por = public.app_usuario_id() or public.app_is_gestao());

-- Chat.
alter table public.conversas enable row level security;
create policy gestao_total on public.conversas for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy participante_le on public.conversas for select to buscapp_api
  using (
    responsavel_id = public.app_usuario_id()
    or public.app_professor_da_turma(turma_id)
  );
create policy responsavel_cria on public.conversas for insert to buscapp_api
  with check (
    responsavel_id = public.app_usuario_id()
    and public.app_modulos() @> array['chat']
  );
create policy participante_atualiza on public.conversas for update to buscapp_api
  using (
    responsavel_id = public.app_usuario_id()
    or public.app_professor_da_turma(turma_id)
  )
  with check (
    responsavel_id = public.app_usuario_id()
    or public.app_professor_da_turma(turma_id)
  );

alter table public.mensagens enable row level security;
create policy gestao_total on public.mensagens for all to buscapp_api
  using (public.app_is_gestao()) with check (public.app_is_gestao());
create policy participante_le on public.mensagens for select to buscapp_api
  using (
    exists (
      select 1 from public.conversas c
      where c.id = conversa_id
        and (
          c.responsavel_id = public.app_usuario_id()
          or public.app_professor_da_turma(c.turma_id)
        )
    )
  );
create policy participante_escreve on public.mensagens for insert to buscapp_api
  with check (
    remetente_id = public.app_usuario_id()
    and exists (
      select 1 from public.conversas c
      where c.id = conversa_id
        and (
          c.responsavel_id = public.app_usuario_id()
          or public.app_professor_da_turma(c.turma_id)
        )
    )
  );
create policy participante_atualiza on public.mensagens for update to buscapp_api
  using (
    exists (
      select 1 from public.conversas c
      where c.id = conversa_id
        and (
          c.responsavel_id = public.app_usuario_id()
          or public.app_professor_da_turma(c.turma_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.conversas c
      where c.id = conversa_id
        and (
          c.responsavel_id = public.app_usuario_id()
          or public.app_professor_da_turma(c.turma_id)
        )
    )
  );

-- Notificações.
alter table public.notificacoes enable row level security;
create policy destinatario_total on public.notificacoes for all to buscapp_api
  using (destinatario_id = public.app_usuario_id())
  with check (destinatario_id = public.app_usuario_id());
