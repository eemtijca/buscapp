import { ref, type Ref } from 'vue';
import { api, ErroApi } from '@/servicos/api';
import type { Disciplina, Turma } from '@/tipos/database';
import type {
  UsuarioItem,
  AlunoItem,
  SolicitacaoCodigo,
  CodigoGerado,
  DadosCriacaoUsuario,
  DadosCriacaoAluno,
} from '@/tipos/componentes';

interface UsuarioDto {
  id: string;
  nome: string;
  email: string | null;
  papel: UsuarioItem['papel'];
  status: UsuarioItem['status'];
  telefone: string | null;
  cargo: string | null;
  notificacoes_ativas: boolean;
  acesso_modulos: string[];
  ultimo_acesso_em: string | null;
}

interface AlunoDto {
  id: string;
  nome: string;
  matricula: string;
  codigo_inep: string | null;
  status: AlunoItem['status'];
  observacoes: string | null;
  data_nascimento: string | null;
  data_matricula: string | null;
  transporte_escolar: boolean;
  alimentacao_diferenciada: boolean;
  necessidades_especiais: boolean;
  documentos_recebidos: string[];
}

interface EnturmacaoDto {
  id: string;
  aluno_id: string;
  turma_id: string;
  ano_letivo_id: string;
  status: string;
  data_matricula: string;
  data_encerramento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  turma: { id: string; nome_completo: string };
  ano_letivo: { id: string; ano: number };
}

interface CodigoDto {
  id: string;
  email: string;
  perfil_id: string;
  perfil_nome: string | null;
  usado_em: string | null;
  revogado_em: string | null;
  expira_em: string;
  created_at: string;
  status: CodigoGerado['status'];
  bloqueado: boolean;
}

interface NotificacaoDto {
  id: string;
  tipo: string;
  metadados: Record<string, unknown> | null;
  created_at: string;
}

function mensagemDeErro(erroCapturado: unknown, padrao: string): string {
  if (erroCapturado instanceof ErroApi) return erroCapturado.message;
  if (erroCapturado instanceof Error && erroCapturado.message) return erroCapturado.message;
  return padrao;
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useGestaoUsuarios() {
  const carregando: Ref<boolean> = ref(false);
  const erro: Ref<string | null> = ref(null);

  // Usuários (perfis)

  async function buscarUsuarios(filtro?: {
    papel?: string;
    status?: string;
    busca?: string;
  }): Promise<UsuarioItem[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const parametros: Record<string, string> = {};
      if (filtro?.papel && filtro.papel !== 'todos') parametros.papel = filtro.papel;
      if (filtro?.status && filtro.status !== 'todos') parametros.status = filtro.status;
      if (filtro?.busca) parametros.busca = filtro.busca;

      const { usuarios } = await api<{ usuarios: UsuarioDto[] }>('/api/usuarios', { parametros });

      return usuarios.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        papel: u.papel,
        status: u.status,
        telefone: u.telefone,
        cargo: u.cargo,
        ultimo_acesso: u.ultimo_acesso_em,
        notificacoes_ativas: u.notificacoes_ativas,
        acesso_modulos: u.acesso_modulos ?? [],
      }));
    } catch (e) {
      const msg = mensagemDeErro(e, 'Não foi possível carregar a lista de usuários.');
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
      const resultado = await api<{
        usuario: UsuarioDto;
        codigo: string;
        senha_temporaria: string;
      }>('/api/usuarios', {
        metodo: 'POST',
        corpo: {
          nome: dados.nome,
          email: dados.email,
          papel: dados.papel,
          telefone: dados.telefone ?? null,
          cargo: dados.cargo ?? null,
        },
      });
      return { id: resultado.usuario.id, codigo: resultado.codigo ?? null };
    } catch (e) {
      const msg = mensagemDeErro(e, 'Falha ao criar usuário.');
      console.error('[useGestaoUsuarios] Erro ao criar usuário:', msg);
      erro.value = msg;
      return { id: null, codigo: null };
    } finally {
      carregando.value = false;
    }
  }

  async function atualizarUsuario(
    id: string,
    dados: Partial<{
      nome: string;
      email: string;
      telefone: string;
      cargo: string;
      status: string;
      notificacoes_ativas: boolean;
      acesso_modulos: string[];
    }>,
  ): Promise<boolean> {
    carregando.value = true;
    erro.value = null;
    try {
      const { status, ...dadosCadastrais } = dados;
      if (Object.keys(dadosCadastrais).length > 0) {
        await api<{ usuario: UsuarioDto }>(`/api/usuarios/${id}`, {
          metodo: 'PUT',
          corpo: dadosCadastrais,
        });
      }
      if (status && status !== 'pendente') {
        if (status !== 'ativo' && status !== 'inativo') {
          throw new Error('Apenas os status "ativo" e "inativo" podem ser definidos manualmente.');
        }
        await api<{ usuario: UsuarioDto }>(`/api/usuarios/${id}/status`, {
          metodo: 'PATCH',
          corpo: { status },
        });
      }
      return true;
    } catch (e) {
      const msg = mensagemDeErro(e, 'Falha ao atualizar usuário.');
      console.error('[useGestaoUsuarios] Erro ao atualizar usuário:', msg);
      erro.value = msg;
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

  // Alunos

  async function buscarAlunos(filtro?: { status?: string; busca?: string }): Promise<AlunoItem[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const parametros: Record<string, string> = {};
      if (filtro?.status && filtro.status !== 'todos') parametros.status = filtro.status;
      if (filtro?.busca) parametros.busca = filtro.busca;

      const [{ alunos }, { enturmacoes }] = await Promise.all([
        api<{ alunos: AlunoDto[] }>('/api/alunos', { parametros }),
        api<{ enturmacoes: EnturmacaoDto[] }>('/api/enturmacoes', {
          parametros: { status: 'matriculado' },
        }),
      ]);

      const turmaPorAluno = new Map(
        enturmacoes.map((e) => [e.aluno_id, e.turma?.nome_completo ?? null]),
      );

      return alunos.map((a) => ({
        id: a.id,
        nome: a.nome,
        matricula: a.matricula,
        turma: turmaPorAluno.get(a.id) ?? null,
        status: a.status,
        data_nascimento: a.data_nascimento,
        codigo_inep: a.codigo_inep,
        data_matricula: a.data_matricula,
        observacoes: a.observacoes,
        transporte_escolar: a.transporte_escolar,
        alimentacao_diferenciada: a.alimentacao_diferenciada,
        necessidades_especiais: a.necessidades_especiais,
        documentos_recebidos: a.documentos_recebidos ?? [],
      }));
    } catch (e) {
      const msg = mensagemDeErro(e, 'Não foi possível carregar a lista de alunos.');
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
      const { aluno } = await api<{ aluno: AlunoDto }>('/api/alunos', {
        metodo: 'POST',
        corpo: {
          nome: dados.nome,
          matricula: dados.matricula,
          data_nascimento: dados.data_nascimento ?? null,
          observacoes: dados.observacoes ?? null,
        },
      });

      if (dados.turma_id) {
        try {
          await api('/api/enturmacoes', {
            metodo: 'POST',
            corpo: {
              aluno_id: aluno.id,
              turma_id: dados.turma_id,
              data_matricula: hojeIso(),
            },
          });
        } catch (e) {
          console.error('[useGestaoUsuarios] Erro ao enturmar aluno:', mensagemDeErro(e, ''));
        }
      }

      if (dados.responsavel_email) {
        try {
          const { usuarios } = await api<{ usuarios: UsuarioDto[] }>('/api/usuarios', {
            parametros: { busca: dados.responsavel_email },
          });
          const emailNormalizado = dados.responsavel_email.toLowerCase();
          let responsavelId: string | null =
            usuarios.find((u) => u.email?.toLowerCase() === emailNormalizado)?.id ?? null;

          if (!responsavelId && dados.responsavel_nome) {
            const criado = await criarUsuario({
              nome: dados.responsavel_nome,
              email: dados.responsavel_email,
              papel: 'responsavel',
              telefone: dados.responsavel_telefone,
            });
            responsavelId = criado.id;
          }

          if (responsavelId) {
            await api('/api/vinculos', {
              metodo: 'POST',
              corpo: {
                responsavel_id: responsavelId,
                aluno_id: aluno.id,
                tipo_relacao: dados.tipo_vinculo ?? 'outro',
                contato_prioritario: true,
              },
            });
          }
        } catch (e) {
          console.error('[useGestaoUsuarios] Erro ao vincular responsável:', mensagemDeErro(e, ''));
        }
      }

      return aluno.id;
    } catch (e) {
      const msg = mensagemDeErro(e, 'Falha ao criar aluno. Verifique se a matrícula já existe.');
      console.error('[useGestaoUsuarios] Erro ao criar aluno:', msg);
      erro.value = msg;
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
      data_matricula: string;
      codigo_inep: string;
      observacoes: string;
      transporte_escolar: boolean;
      alimentacao_diferenciada: boolean;
      necessidades_especiais: boolean;
      documentos_recebidos: string[];
    }>,
  ): Promise<boolean> {
    carregando.value = true;
    erro.value = null;
    try {
      await api<{ aluno: AlunoDto }>(`/api/alunos/${id}`, {
        metodo: 'PUT',
        corpo: dados,
      });
      return true;
    } catch (e) {
      const msg = mensagemDeErro(e, 'Falha ao atualizar aluno.');
      console.error('[useGestaoUsuarios] Erro ao atualizar aluno:', msg);
      erro.value = msg;
      return false;
    } finally {
      carregando.value = false;
    }
  }

  // Códigos de redefinição

  async function buscarNotificacoesCodigos(): Promise<SolicitacaoCodigo[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const { notificacoes } = await api<{ notificacoes: NotificacaoDto[] }>('/api/notificacoes', {
        parametros: { lida: 'false', limite: 100 },
      });

      const relevantes = notificacoes.filter((n) => n.tipo === 'codigo_redefinicao');
      const perfilIds = [
        ...new Set(
          relevantes
            .map((n) => n.metadados?.perfil_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ];

      const perfisMap = new Map<string, { nome: string; papel: UsuarioItem['papel'] }>();
      if (perfilIds.length > 0) {
        const usuarios = await buscarUsuarios();
        for (const u of usuarios) {
          perfisMap.set(u.id, { nome: u.nome, papel: u.papel });
        }
      }

      const resultados: SolicitacaoCodigo[] = [];
      for (const n of relevantes) {
        const email = n.metadados?.email;
        const perfilId = n.metadados?.perfil_id;
        if (typeof email !== 'string' || typeof perfilId !== 'string') continue;

        const perfil = perfisMap.get(perfilId);
        resultados.push({
          id: n.id,
          email,
          perfil_id: perfilId,
          nome: perfil?.nome ?? 'Desconhecido',
          papel: perfil?.papel ?? 'responsavel',
          criado_em: n.created_at,
        });
      }

      return resultados;
    } catch (e) {
      const msg = mensagemDeErro(e, 'Não foi possível carregar as notificações.');
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
      const { codigo } = await api<{ codigo: string }>(`/api/codigos/perfil/${perfilId}`, {
        metodo: 'POST',
      });
      return codigo;
    } catch (e) {
      const msg = mensagemDeErro(e, 'Falha ao gerar código de redefinição.');
      console.error('[useGestaoUsuarios] Erro ao gerar código:', msg);
      erro.value = msg;
      return null;
    } finally {
      carregando.value = false;
    }
  }

  async function buscarCodigosGerados(): Promise<CodigoGerado[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const { codigos } = await api<{ codigos: CodigoDto[] }>('/api/codigos');

      return codigos.map((c) => ({
        id: c.id,
        email: c.email,
        nome: c.perfil_nome ?? 'Desconhecido',
        // A API própria não devolve o código em texto claro na listagem (apenas HMAC).
        codigo: '',
        criado_por_nome: null,
        usado_em: c.usado_em,
        revogado_em: c.revogado_em,
        expira_em: c.expira_em,
        criado_em: c.created_at,
        status: c.bloqueado && c.status === 'ativo' ? 'bloqueado' : c.status,
      }));
    } catch (e) {
      const msg = mensagemDeErro(e, 'Não foi possível carregar os códigos.');
      console.error('[useGestaoUsuarios] Erro ao buscar códigos:', msg);
      erro.value = 'Não foi possível carregar os códigos.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function marcarNotificacaoLida(notificacaoId: string): Promise<void> {
    try {
      await api(`/api/notificacoes/${notificacaoId}/lida`, { metodo: 'PATCH' });
    } catch (e) {
      console.error('[useGestaoUsuarios] Erro ao marcar notificação como lida:', e);
    }
  }

  async function limparCodigosNaoAtivos(): Promise<number> {
    try {
      const { removidos } = await api<{ removidos: number }>('/api/codigos/limpar', {
        metodo: 'POST',
      });
      return removidos ?? 0;
    } catch (e) {
      const msg = mensagemDeErro(e, 'Falha ao limpar códigos.');
      console.error('[useGestaoUsuarios] Erro ao limpar códigos:', msg);
      throw e;
    }
  }

  // Dados auxiliares

  async function buscarTurmas(): Promise<Turma[]> {
    try {
      const { turmas } = await api<{ turmas: Turma[] }>('/api/turmas', {
        parametros: { ativo: true },
      });
      return [...turmas].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    } catch {
      return [];
    }
  }

  async function buscarDisciplinas(): Promise<Disciplina[]> {
    try {
      const { disciplinas } = await api<{ disciplinas: Disciplina[] }>('/api/disciplinas', {
        parametros: { ativo: true },
      });
      return [...disciplinas].sort((a, b) => a.nome.localeCompare(b.nome));
    } catch {
      return [];
    }
  }

  // Utilitários

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
