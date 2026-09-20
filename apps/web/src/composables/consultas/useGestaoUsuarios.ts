import { computed, type ComputedRef, type Ref } from 'vue';
import { api, ErroApi } from '@/servicos/api';
import { invalidarChave, invalidarTabela } from '@/servicos/cache';
import { Consultas } from '@/servicos/consultas';
import { useConsulta } from '@/composables/useConsulta';
import { hojeIso } from '@/utils/datas';
import type { Disciplina, Turma } from '@/tipos/database';
import type { CodigoApi, UsuarioApi } from '@/tipos/api';
import type {
  AlunoItem,
  CodigoGerado,
  DadosCriacaoAluno,
  DadosCriacaoUsuario,
  SolicitacaoCodigo,
  UsuarioItem,
} from '@/tipos/componentes';

function mensagemDeErro(erroCapturado: unknown, padrao: string): string {
  if (erroCapturado instanceof ErroApi) return erroCapturado.message;
  if (erroCapturado instanceof Error && erroCapturado.message) return erroCapturado.message;
  return padrao;
}

/** Usuários da gestão filtrados por papel, status e busca. */
export function useUsuarios(
  filtros?: () => {
    papel?: string;
    status?: string;
    busca?: string;
  },
): {
  usuarios: ComputedRef<UsuarioItem[]>;
  pendente: Ref<boolean>;
  atualizando: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => {
    const valores = filtros?.() ?? {};
    return Consultas.usuarios({
      papel: valores.papel && valores.papel !== 'todos' ? valores.papel : undefined,
      status: valores.status && valores.status !== 'todos' ? valores.status : undefined,
      busca: valores.busca || undefined,
    });
  });

  const usuarios = computed<UsuarioItem[]>(() =>
    (consulta.dados.value?.usuarios ?? []).map((usuario: UsuarioApi) => ({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      status: usuario.status,
      telefone: usuario.telefone,
      cargo: usuario.cargo,
      ultimo_acesso: usuario.ultimo_acesso_em,
      notificacoes_ativas: usuario.notificacoes_ativas,
      acesso_modulos: [...(usuario.acesso_modulos ?? [])],
    })),
  );

  return {
    usuarios,
    pendente: consulta.pendente,
    atualizando: consulta.atualizando,
    recarregar: () => consulta.recarregar(true),
  };
}

/** Alunos da gestão com a turma vigente anexada. */
export function useAlunos(filtros?: () => { status?: string; busca?: string }): {
  alunos: ComputedRef<AlunoItem[]>;
  pendente: Ref<boolean>;
  atualizando: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consultaAlunos = useConsulta(() => {
    const valores = filtros?.() ?? {};
    return Consultas.alunos({
      status: valores.status && valores.status !== 'todos' ? valores.status : undefined,
      busca: valores.busca || undefined,
    });
  });
  const consultaEnturmacoes = useConsulta(() => Consultas.enturmacoes({ status: 'matriculado' }));

  const alunos = computed<AlunoItem[]>(() => {
    const turmaPorAluno = new Map(
      (consultaEnturmacoes.dados.value?.enturmacoes ?? []).map((enturmacao) => [
        enturmacao.aluno_id,
        enturmacao.turma?.nome_completo ?? null,
      ]),
    );

    return (consultaAlunos.dados.value?.alunos ?? []).map((aluno) => ({
      id: aluno.id,
      nome: aluno.nome,
      matricula: aluno.matricula,
      turma: turmaPorAluno.get(aluno.id) ?? null,
      status: aluno.status,
      data_nascimento: aluno.data_nascimento,
      codigo_inep: aluno.codigo_inep,
      data_matricula: aluno.data_matricula,
      observacoes: aluno.observacoes,
      transporte_escolar: aluno.transporte_escolar,
      alimentacao_diferenciada: aluno.alimentacao_diferenciada,
      necessidades_especiais: aluno.necessidades_especiais,
      documentos_recebidos: [...(aluno.documentos_recebidos ?? [])],
    }));
  });

  return {
    alunos,
    pendente: computed(() => consultaAlunos.pendente.value || consultaEnturmacoes.pendente.value),
    atualizando: computed(
      () => consultaAlunos.atualizando.value || consultaEnturmacoes.atualizando.value,
    ),
    recarregar: () =>
      Promise.all([consultaAlunos.recarregar(true), consultaEnturmacoes.recarregar(true)]).then(
        () => undefined,
      ),
  };
}

export async function criarUsuario(
  dados: DadosCriacaoUsuario,
): Promise<{ id: string | null; codigo: string | null }> {
  try {
    const resultado = await api<{
      usuario: UsuarioApi;
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
    invalidarChave('usuarios');
    return { id: resultado.usuario.id, codigo: resultado.codigo ?? null };
  } catch (erro) {
    console.error('[useGestaoUsuarios] Erro ao criar usuário:', mensagemDeErro(erro, ''));
    return { id: null, codigo: null };
  }
}

export async function atualizarUsuario(
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
  try {
    const { status, ...dadosCadastrais } = dados;
    if (Object.keys(dadosCadastrais).length > 0) {
      await api<{ usuario: UsuarioApi }>(`/api/usuarios/${id}`, {
        metodo: 'PUT',
        corpo: dadosCadastrais,
      });
    }
    if (status && status !== 'pendente') {
      if (status !== 'ativo' && status !== 'inativo') {
        throw new Error('Apenas os status "ativo" e "inativo" podem ser definidos manualmente.');
      }
      await api<{ usuario: UsuarioApi }>(`/api/usuarios/${id}/status`, {
        metodo: 'PATCH',
        corpo: { status },
      });
    }
    invalidarChave('usuarios');
    return true;
  } catch (erro) {
    console.error('[useGestaoUsuarios] Erro ao atualizar usuário:', mensagemDeErro(erro, ''));
    return false;
  }
}

export function ativarUsuario(id: string): Promise<boolean> {
  return atualizarUsuario(id, { status: 'ativo' });
}

export function desativarUsuario(id: string): Promise<boolean> {
  return atualizarUsuario(id, { status: 'inativo' });
}

export async function criarAluno(dados: DadosCriacaoAluno): Promise<string | null> {
  try {
    const { aluno } = await api<{ aluno: { id: string } }>('/api/alunos', {
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
      } catch (erro) {
        console.error('[useGestaoUsuarios] Erro ao enturmar aluno:', mensagemDeErro(erro, ''));
      }
    }

    if (dados.responsavel_email) {
      try {
        const { usuarios } = await api<{ usuarios: UsuarioApi[] }>('/api/usuarios', {
          parametros: { busca: dados.responsavel_email },
        });
        const emailNormalizado = dados.responsavel_email.toLowerCase();
        let responsavelId: string | null =
          usuarios.find((usuario) => usuario.email?.toLowerCase() === emailNormalizado)?.id ?? null;

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
      } catch (erro) {
        console.error(
          '[useGestaoUsuarios] Erro ao vincular responsável:',
          mensagemDeErro(erro, ''),
        );
      }
    }

    invalidarChave('alunos');
    invalidarChave('usuarios');
    return aluno.id;
  } catch (erro) {
    console.error('[useGestaoUsuarios] Erro ao criar aluno:', mensagemDeErro(erro, ''));
    return null;
  }
}

export async function atualizarAluno(
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
  try {
    await api(`/api/alunos/${id}`, { metodo: 'PUT', corpo: dados });
    invalidarChave('alunos');
    return true;
  } catch (erro) {
    console.error('[useGestaoUsuarios] Erro ao atualizar aluno:', mensagemDeErro(erro, ''));
    return false;
  }
}

/** Códigos de redefinição gerados, com status derivado do tempo. */
export function useCodigosGerados(): {
  codigos: ComputedRef<CodigoGerado[]>;
  pendente: Ref<boolean>;
  atualizando: Ref<boolean>;
  atualizadoEm: Ref<number | null>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => Consultas.codigos());

  const codigos = computed<CodigoGerado[]>(() =>
    (consulta.dados.value?.codigos ?? []).map((codigo: CodigoApi) => ({
      id: codigo.id,
      email: codigo.email,
      nome: codigo.perfil_nome ?? 'Desconhecido',
      // A API própria não devolve o código em texto claro na listagem (apenas HMAC).
      codigo: '',
      criado_por_nome: null,
      usado_em: codigo.usado_em,
      revogado_em: codigo.revogado_em,
      expira_em: codigo.expira_em,
      criado_em: codigo.created_at,
      status: codigo.bloqueado && codigo.status === 'ativo' ? 'bloqueado' : codigo.status,
    })),
  );

  return {
    codigos,
    pendente: consulta.pendente,
    atualizando: consulta.atualizando,
    atualizadoEm: consulta.atualizadoEm,
    recarregar: () => consulta.recarregar(true),
  };
}

/** Solicitações de código pendentes extraídas das notificações. */
export function useSolicitacoesCodigo(): {
  solicitacoes: ComputedRef<SolicitacaoCodigo[]>;
  pendente: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consultaNotificacoes = useConsulta(() =>
    Consultas.notificacoes({ lida: 'false', limite: 100 }),
  );
  const consultaUsuarios = useConsulta(() => Consultas.usuarios());

  const solicitacoes = computed<SolicitacaoCodigo[]>(() => {
    const notificacoes = (consultaNotificacoes.dados.value?.notificacoes ?? []).filter(
      (notificacao) => notificacao.tipo === 'codigo_redefinicao',
    );
    const perfis = new Map(
      (consultaUsuarios.dados.value?.usuarios ?? []).map((usuario) => [
        usuario.id,
        { nome: usuario.nome, papel: usuario.papel },
      ]),
    );

    const resultados: SolicitacaoCodigo[] = [];
    for (const notificacao of notificacoes) {
      const email = notificacao.metadados?.email;
      const perfilId = notificacao.metadados?.perfil_id;
      if (typeof email !== 'string' || typeof perfilId !== 'string') continue;

      const perfil = perfis.get(perfilId);
      resultados.push({
        id: notificacao.id,
        email,
        perfil_id: perfilId,
        nome: perfil?.nome ?? 'Desconhecido',
        papel: perfil?.papel ?? 'responsavel',
        criado_em: notificacao.created_at,
      });
    }
    return resultados;
  });

  return {
    solicitacoes,
    pendente: computed(
      () => consultaNotificacoes.pendente.value || consultaUsuarios.pendente.value,
    ),
    recarregar: () =>
      Promise.all([consultaNotificacoes.recarregar(true), consultaUsuarios.recarregar(true)]).then(
        () => undefined,
      ),
  };
}

export async function gerarCodigoRedefinicao(
  perfilId: string,
): Promise<{ codigo: string; expiraEm: string } | null> {
  try {
    const resposta = await api<{ codigo: string; expira_em: string }>(
      `/api/codigos/perfil/${perfilId}`,
      { metodo: 'POST' },
    );
    invalidarTabela('codigos_redefinicao', undefined, false);
    return { codigo: resposta.codigo, expiraEm: resposta.expira_em };
  } catch (erro) {
    console.error('[useGestaoUsuarios] Erro ao gerar código:', mensagemDeErro(erro, ''));
    return null;
  }
}

export async function revogarCodigo(codigoId: string): Promise<boolean> {
  try {
    await api(`/api/codigos/${codigoId}/revogar`, { metodo: 'PATCH' });
    invalidarTabela('codigos_redefinicao', undefined, false);
    return true;
  } catch (erro) {
    console.error('[useGestaoUsuarios] Erro ao revogar código:', mensagemDeErro(erro, ''));
    return false;
  }
}

export async function limparCodigosNaoAtivos(): Promise<number> {
  try {
    const { removidos } = await api<{ removidos: number }>('/api/codigos/limpar', {
      metodo: 'POST',
    });
    invalidarTabela('codigos_redefinicao', undefined, false);
    return removidos ?? 0;
  } catch (erro) {
    console.error('[useGestaoUsuarios] Erro ao limpar códigos:', mensagemDeErro(erro, ''));
    throw erro;
  }
}

export async function marcarNotificacaoLida(notificacaoId: string): Promise<void> {
  try {
    await api(`/api/notificacoes/${notificacaoId}/lida`, { metodo: 'PATCH' });
    invalidarChave('notificacoes');
  } catch (erro) {
    console.error('[useGestaoUsuarios] Erro ao marcar notificação como lida:', erro);
  }
}

/** Turmas e disciplinas auxiliares para formulários. */
export function useAuxiliaresFormulario(): {
  turmas: ComputedRef<Turma[]>;
  disciplinas: ComputedRef<Disciplina[]>;
} {
  const consultaTurmas = useConsulta(() => Consultas.turmas({ ativo: 'true' }));
  const consultaDisciplinas = useConsulta(() => Consultas.disciplinas({ ativo: 'true' }));

  return {
    turmas: computed(() =>
      [...(consultaTurmas.dados.value?.turmas ?? [])].sort((a, b) =>
        a.nome_completo.localeCompare(b.nome_completo),
      ),
    ),
    disciplinas: computed(() =>
      [...(consultaDisciplinas.dados.value?.disciplinas ?? [])].sort((a, b) =>
        a.nome.localeCompare(b.nome),
      ),
    ),
  };
}
