-- Rotinas de domínio (funções e triggers) que não dependem de auth/Storage/Realtime.
-- Extraídas do schema de referência e aplicadas após o baseline.

-- Funções
CREATE FUNCTION public.fn_auto_justificar_frequencias() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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

CREATE FUNCTION public.fn_notificar_nova_mensagem() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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

CREATE FUNCTION public.fn_notificar_ocorrencia() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_responsaveis uuid[];
begin
  if not new.notificar_responsavel then
    return new;
  end if;

  select coalesce(array_agg(responsavel_id), '{}') into v_responsaveis
  from public.vinculos_responsaveis
  where aluno_id = new.aluno_id and ativo = true;

  insert into public.notificacoes (destinatario_id, tipo, titulo, corpo, metadados)
  select r,
         'ocorrencia',
         'Nova ocorrência registrada',
         left(new.descricao, 120),
         jsonb_build_object('aluno_id', new.aluno_id)
  from unnest(v_responsaveis) as r;

  return new;
end;
$$;

CREATE FUNCTION public.fn_set_turma_nome() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.nome_completo := new.serie::text || ' ' || new.letra::text;
  return new;
end;
$$;

CREATE FUNCTION public.fn_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers
CREATE TRIGGER trg_auto_justificar_frequencias AFTER UPDATE OF status ON public.justificativas_faltas FOR EACH ROW WHEN (((new.status = 'aceita'::public.status_justificativa) AND (old.status = 'pendente'::public.status_justificativa))) EXECUTE FUNCTION public.fn_auto_justificar_frequencias();
CREATE TRIGGER trg_notificar_nova_mensagem AFTER INSERT ON public.mensagens FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_nova_mensagem();
CREATE TRIGGER trg_notificar_ocorrencia AFTER INSERT ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_ocorrencia();
CREATE TRIGGER trg_set_turma_nome BEFORE INSERT OR UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.fn_set_turma_nome();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.anexos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.anos_letivos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.atribuicoes_professores FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.codigos_redefinicao FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.configuracoes_sistema FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.conversas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.convites FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.disciplinas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.enturmacoes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.exportacoes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.frequencias FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.horarios_letivos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.importacoes_log FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.justificativas_faltas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.mensagens FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.monitoramento_acoes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.opcoes_configuracao FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.perfis FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.pontuacao_turmas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.registros_comportamento FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.tags_comportamento FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.vinculos_responsaveis FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
