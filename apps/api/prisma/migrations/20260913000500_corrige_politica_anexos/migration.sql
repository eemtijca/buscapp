-- Corrige a política de leitura de anexos: `id` sem qualificação resolvia para
-- `justificativas_faltas.id`/`ocorrencias.id` dentro das subconsultas.

drop policy if exists leitura_escopada on public.anexos;

create policy leitura_escopada on public.anexos for select to buscapp_api
  using (
    criado_por = public.app_usuario_id()
    or exists (
      select 1
      from public.justificativa_anexos ja
      join public.justificativas_faltas j on j.id = ja.justificativa_id
      where ja.anexo_id = public.anexos.id and public.app_aluno_visivel(j.aluno_id)
    )
    or exists (
      select 1
      from public.ocorrencia_anexos oa
      join public.ocorrencias o on o.id = oa.ocorrencia_id
      where oa.anexo_id = public.anexos.id and public.app_aluno_visivel(o.aluno_id)
    )
  );
