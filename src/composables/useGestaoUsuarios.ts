import { ref, type Ref } from 'vue';
import { supabaseClient } from '@/servicos/supabase';
import type {
  Aluno,
  CodigoRedefinicao,
  Perfil,
  Turma,
  VinculoResponsavel,
  Disciplina,
} from '@/tipos/database';
import type {
  UsuarioItem,
  AlunoItem,
  SolicitacaoCodigo,
  CodigoGerado,
  DadosCriacaoUsuario,
  DadosCriacaoAluno,
} from '@/tipos/componentes';

export function useGestaoUsuarios() {
  const carregando: Ref<boolean> = ref(false);
  const erro: Ref<string | null> = ref(null);

  // ==========================================================================
  // USUÁRIOS (Perfis)
  // ==========================================================================

  async function buscarUsuarios(filtro?: {
    papel?: string;
    status?: string;
    busca?: string;
  }): Promise<UsuarioItem[]> {
    carregando.value = true;
    erro.value = null;
    try {
      let query = supabaseClient.from('perfis').select('*').order('nome');

      if (filtro?.papel && filtro.papel !== 'todos') {
        query = query.eq('papel', filtro.papel);
      }
      if (filtro?.status && filtro.status !== 'todos') {
        query = query.eq('status', filtro.status);
      }
      if (filtro?.busca) {
        query = query.or(`nome.ilike.%${filtro.busca}%,email.ilike.%${filtro.busca}%`);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      return ((data ?? []) as unknown as Perfil[]).map((p) => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        papel: p.papel,
        status: p.status,
        telefone: p.telefone,
        cargo: p.cargo,
        ultimo_acesso: p.ultimo_acesso_em,
        notificacoes_ativas: p.notificacoes_ativas,
        acesso_modulos: p.acesso_modulos ?? [],
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useGestaoUsuarios] Erro ao buscar usuários:', msg);
      erro.value = 'Não foi possível carregar a lista de usuários.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function criarUsuario(
    dados: DadosCriacaoUsuario,
  ): Promise<{ id: string | null; codigo: string | null }> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão não encontrada.');

      const funcaoUrl =
        import.meta.env.VITE_EDGE_FUNCTIONS_URL ??
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
      const url = `${funcaoUrl}/criar-usuario`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: dados.nome,
          email: dados.email,
          papel: dados.papel,
          telefone: dados.telefone ?? null,
          cargo: dados.cargo ?? null,
        }),
      });

      const resultado = await response.json();
      if (!response.ok) {
        throw new Error(resultado.error ?? 'Erro ao criar usuário.');
      }
      return { id: resultado.id as string, codigo: (resultado.codigo as string) ?? null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useGestaoUsuarios] Erro ao criar usuário:', msg);
      erro.value = msg;
      return { id: null, codigo: null };
    } finally {
      carregando.value = false;
    }
  }

  function mensagemErroAtualizacao(e: unknown): string {
    const err = e as { code?: string; constraint?: string } | null;
    if (err?.code === '23514') {
      if (err.constraint === 'chk_perfis_modulos_catalogo') {
        return (
          'Módulo de acesso inválido. Recarregue a página e revise os módulos selecionados.'
        );
      }
      return 'Dados inválidos. Verifique os campos e tente novamente.';
    }
    return 'Falha ao atualizar usuário.';
  }

  async function atualizarUsuario(
    id: string,
    dados: Partial<{ nome: string; telefone: string; cargo: string; status: string }>,
  ): Promise<boolean> {
    carregando.value = true;
    erro.value = null;
    try {
      const { error: err } = await supabaseClient
        .from('perfis')
        .update(dados as Record<string, unknown>)
        .eq('id', id);
      if (err) throw err;
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      console.error('[useGestaoUsuarios] Erro ao atualizar usuário:', msg);
      erro.value = mensagemErroAtualizacao(e);
      return false;
    } finally {
      carregando.value = false;
    }
  }

  async function ativarUsuario(id: string): Promise<boolean> {
    return atualizarUsuario(id, { status: 'ativo' });
  }

  async function desativarUsuario(id: string): Promise<boolean> {
    return atualizarUsuario(id, { status: 'inativo' });
  }

  // ==========================================================================
  // ALUNOS
  // ==========================================================================

  async function buscarAlunos(filtro?: { status?: string; busca?: string }): Promise<AlunoItem[]> {
    carregando.value = true;
    erro.value = null;
    try {
      let query = supabaseClient.from('alunos').select('*').order('nome');

      if (filtro?.status && filtro.status !== 'todos') {
        query = query.eq('status', filtro.status);
      }
      if (filtro?.busca) {
        query = query.or(`nome.ilike.%${filtro.busca}%,matricula.ilike.%${filtro.busca}%`);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      const alunos = (data ?? []) as unknown as Aluno[];
      const alunoIds = alunos.map((a) => a.id);

      const { data: enturmacoes } = await supabaseClient
        .from('enturmacoes')
        .select('aluno_id, turma_id')
        .in('aluno_id', alunoIds)
        .eq('status', 'matriculado');

      const turmaIds = [...new Set((enturmacoes ?? []).map((e) => e.turma_id))];
      const { data: turmas } = await supabaseClient
        .from('turmas')
        .select('id, nome_completo')
        .in('id', turmaIds);

      const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t.nome_completo]));
      const enturmacaoMap = new Map((enturmacoes ?? []).map((e) => [e.aluno_id, e.turma_id]));

      return alunos.map((a) => {
        const turmaId = enturmacaoMap.get(a.id);
        return {
          id: a.id,
          nome: a.nome,
          matricula: a.matricula,
          turma: turmaId ? (turmaMap.get(turmaId) ?? null) : null,
          status: a.status,
          data_nascimento: a.data_nascimento,
          codigo_inep: a.codigo_inep,
          data_matricula: a.data_matricula,
          observacoes: a.observacoes,
          transporte_escolar: a.transporte_escolar,
          alimentacao_diferenciada: a.alimentacao_diferenciada,
          necessidades_especiais: a.necessidades_especiais,
          documentos_recebidos: a.documentos_recebidos ?? [],
        };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useGestaoUsuarios] Erro ao buscar alunos:', msg);
      erro.value = 'Não foi possível carregar a lista de alunos.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function criarAluno(dados: DadosCriacaoAluno): Promise<string | null> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data: aluno, error: errAluno } = await supabaseClient
        .from('alunos')
        .insert({
          nome: dados.nome,
          matricula: dados.matricula,
          data_nascimento: dados.data_nascimento ?? null,
          observacoes: dados.observacoes ?? null,
        })
        .select('id')
        .single();

      if (errAluno) throw errAluno;
      const alunoId = (aluno as unknown as Aluno).id;

      if (dados.turma_id) {
        const { data: ano } = await supabaseClient
          .from('anos_letivos')
          .select('id')
          .eq('ativo', true)
          .single();

        if (ano) {
          await supabaseClient.from('enturmacoes').insert({
            aluno_id: alunoId,
            turma_id: dados.turma_id,
            ano_letivo_id: (ano as unknown as { id: string }).id,
            data_matricula: new Date().toISOString().split('T')[0],
          });
        }
      }

      if (dados.responsavel_email) {
        const { data: perfisExistentes } = await supabaseClient
          .from('perfis')
          .select('id')
          .eq('email', dados.responsavel_email)
          .single();

        let responsavelId: string | null = null;

        if (perfisExistentes) {
          responsavelId = (perfisExistentes as unknown as Perfil).id;
        } else if (dados.responsavel_nome) {
          const { id: idCriado } = await criarUsuario({
            nome: dados.responsavel_nome,
            email: dados.responsavel_email,
            papel: 'responsavel',
            telefone: dados.responsavel_telefone,
          });
          if (idCriado) responsavelId = idCriado;
        }

        if (responsavelId) {
          await supabaseClient.from('vinculos_responsaveis').insert({
            responsavel_id: responsavelId,
            aluno_id: alunoId,
            tipo_relacao: (dados.tipo_vinculo as VinculoResponsavel['tipo_relacao']) ?? 'outro',
            contato_prioritario: true,
          });
        }
      }

      return alunoId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useGestaoUsuarios] Erro ao criar aluno:', msg);
      erro.value = 'Falha ao criar aluno. Verifique se a matrícula já existe.';
      return null;
    } finally {
      carregando.value = false;
    }
  }

  async function atualizarAluno(
    id: string,
    dados: Partial<{
      nome: string;
      matricula: string;
      status: string;
      data_nascimento: string;
      observacoes: string;
    }>,
  ): Promise<boolean> {
    carregando.value = true;
    erro.value = null;
    try {
      const { error: err } = await supabaseClient
        .from('alunos')
        .update(dados as Record<string, unknown>)
        .eq('id', id);
      if (err) throw err;
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useGestaoUsuarios] Erro ao atualizar aluno:', msg);
      erro.value = 'Falha ao atualizar aluno.';
      return false;
    } finally {
      carregando.value = false;
    }
  }

  // ==========================================================================
  // CÓDIGOS DE REDEFINIÇÃO
  // ==========================================================================

  async function buscarNotificacoesCodigos(): Promise<SolicitacaoCodigo[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data, error: err } = await supabaseClient
        .from('notificacoes')
        .select('*')
        .eq('tipo', 'codigo_redefinicao')
        .eq('lida', false)
        .order('created_at', { ascending: false });

      if (err) throw err;

      const notificacoes = (data ?? []) as unknown as Array<{
        id: string;
        metadados: { email?: string; perfil_id?: string };
        created_at: string;
      }>;

      const perfilIds = notificacoes
        .map((n) => n.metadados?.perfil_id)
        .filter((id): id is string => !!id);

      const perfisMap = new Map<string, { nome: string; papel: string }>();
      if (perfilIds.length > 0) {
        const { data: perfis } = await supabaseClient
          .from('perfis')
          .select('id, nome, papel')
          .in('id', perfilIds);
        for (const p of perfis ?? []) {
          const perfil = p as unknown as Perfil;
          perfisMap.set(perfil.id, { nome: perfil.nome, papel: perfil.papel });
        }
      }

      const resultados: SolicitacaoCodigo[] = [];

      for (const n of notificacoes) {
        const email = n.metadados?.email;
        const perfilId = n.metadados?.perfil_id;

        if (email && perfilId) {
          const perfil = perfisMap.get(perfilId);
          resultados.push({
            id: n.id,
            email,
            perfil_id: perfilId,
            nome: perfil?.nome ?? 'Desconhecido',
            papel: (perfil?.papel as SolicitacaoCodigo['papel']) ?? 'responsavel',
            criado_em: n.created_at,
          });
        }
      }

      return resultados;
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      console.error('[useGestaoUsuarios] Erro ao buscar notificações:', msg);
      erro.value = 'Não foi possível carregar as notificações.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function gerarCodigoRedefinicao(perfilId: string): Promise<string | null> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data, error: err } = await supabaseClient.rpc('fn_gerar_codigo_redefinicao', {
        p_perfil_id: perfilId,
      });
      if (err) throw err;
      return data as string;
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      console.error('[useGestaoUsuarios] Erro ao gerar código:', msg);
      erro.value = 'Falha ao gerar código de redefinição.';
      return null;
    } finally {
      carregando.value = false;
    }
  }

  async function buscarCodigosGerados(): Promise<CodigoGerado[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data, error: err } = await supabaseClient
        .from('codigos_redefinicao')
        .select('*, perfis!codigos_redefinicao_perfil_id_fkey!inner(nome)')
        .order('created_at', { ascending: false });

      if (err) throw err;

      const codigos = (data ?? []) as unknown as (CodigoRedefinicao & {
        perfis: { nome: string };
      })[];

      const criadorIds = [...new Set(codigos.map((c) => c.criado_por).filter(Boolean))];
      const criadorMap = new Map<string, string>();

      if (criadorIds.length > 0) {
        const { data: criadores } = await supabaseClient
          .from('perfis')
          .select('id, nome')
          .in('id', criadorIds);
        for (const c of criadores ?? []) {
          criadorMap.set((c as unknown as Perfil).id, (c as unknown as Perfil).nome);
        }
      }

      // E-mails com bloqueio ativo por excesso de tentativas
      const emailsBloqueados = new Set<string>();
      const { data: bloqueados } = await supabaseClient
        .from('codigos_redefinicao_tentativas')
        .select('email')
        .gt('bloqueado_ate', new Date().toISOString());
      for (const b of bloqueados ?? []) {
        emailsBloqueados.add((b as unknown as { email: string }).email);
      }

      return codigos.map((c) => {
        const agora = new Date();
        const expira = new Date(c.expira_em);
        let status: 'ativo' | 'usado' | 'expirado' | 'revogado' | 'bloqueado';
        if (c.usado_em) status = 'usado';
        else if (c.revogado_em) status = 'revogado';
        else if (expira < agora) status = 'expirado';
        else if (emailsBloqueados.has(c.email)) status = 'bloqueado';
        else status = 'ativo';

        return {
          id: c.id,
          email: c.email,
          nome: c.perfis.nome,
          codigo: c.codigo,
          criado_por_nome: c.criado_por ? (criadorMap.get(c.criado_por) ?? null) : null,
          usado_em: c.usado_em,
          revogado_em: c.revogado_em,
          expira_em: c.expira_em,
          criado_em: c.created_at,
          status,
        };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      console.error('[useGestaoUsuarios] Erro ao buscar códigos:', msg);
      erro.value = 'Não foi possível carregar os códigos.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function marcarNotificacaoLida(notificacaoId: string): Promise<void> {
    try {
      await supabaseClient
        .from('notificacoes')
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq('id', notificacaoId);
    } catch (e) {
      console.error('[useGestaoUsuarios] Erro ao marcar notificação como lida:', e);
    }
  }

  async function limparCodigosNaoAtivos(): Promise<number> {
    try {
      const { data, error: err } = await supabaseClient.rpc('fn_limpar_codigos_nao_ativos');
      if (err) throw err;
      return (data as number) ?? 0;
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      console.error('[useGestaoUsuarios] Erro ao limpar códigos:', msg);
      throw e;
    }
  }

  // ==========================================================================
  // DADOS AUXILIARES
  // ==========================================================================

  async function buscarTurmas(): Promise<Turma[]> {
    try {
      const { data } = await supabaseClient
        .from('turmas')
        .select('*')
        .eq('ativo', true)
        .order('nome_completo');
      return (data ?? []) as unknown as Turma[];
    } catch {
      return [];
    }
  }

  async function buscarDisciplinas(): Promise<Disciplina[]> {
    try {
      const { data } = await supabaseClient
        .from('disciplinas')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      return (data ?? []) as unknown as Disciplina[];
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================

  return {
    carregando,
    erro,
    buscarUsuarios,
    criarUsuario,
    atualizarUsuario,
    ativarUsuario,
    desativarUsuario,
    buscarAlunos,
    criarAluno,
    atualizarAluno,
    buscarNotificacoesCodigos,
    gerarCodigoRedefinicao,
    buscarCodigosGerados,
    marcarNotificacaoLida,
    limparCodigosNaoAtivos,
    buscarTurmas,
    buscarDisciplinas,
  };
}
