import { computed, type ComputedRef, type Ref } from 'vue';
import { api, enviarAnexo } from '@/servicos/api';
import { invalidarChave } from '@/servicos/cache';
import { Consultas } from '@/servicos/consultas';
import { useConsulta, type ResultadoConsulta } from '@/composables/useConsulta';
import { useConfiguracaoSistema } from '@/composables/consultas/useCatalogos';
import { comprimirImagem } from '@/utils/comprimirImagem';
import { diasEntre, formatarData, formatarDataHorario } from '@/utils/datas';
import { calcularTermometro } from '@/servicos/termometro';
import type { Aluno, Frequencia, TagComportamento } from '@/tipos/database';
import type { JustificativaApi, OcorrenciaApi, RegistroComportamentoApi } from '@/tipos/api';
import type {
  AlertaResponsavel,
  AlunoFrequencia,
  AlunoRisco,
  EstatisticaPainel,
  JustificativaPendente,
  NivelRisco,
  OcorrenciaGrave,
  TermometroAtencao,
} from '@/tipos/componentes';

/** Resumo reativo reutilizável para consultas derivadas. */
interface ResumoConsulta {
  pendente: ComputedRef<boolean>;
  atualizando: ComputedRef<boolean>;
  atualizadoEm: ComputedRef<number | null>;
  recarregar: () => Promise<void>;
}

function resumir(consultas: ResultadoConsulta<unknown>[]): ResumoConsulta {
  return {
    pendente: computed(() => consultas.some((consulta) => consulta.pendente.value)),
    atualizando: computed(() => consultas.some((consulta) => consulta.atualizando.value)),
    atualizadoEm: computed(() => {
      const tempos = consultas
        .map((consulta) => consulta.atualizadoEm.value)
        .filter((valor): valor is number => valor !== null);
      return tempos.length ? Math.max(...tempos) : null;
    }),
    recarregar: () =>
      Promise.all(consultas.map((consulta) => consulta.recarregar(true))).then(() => undefined),
  };
}

/** Alunos visíveis com o estado de ausência para a data de aula informada. */
export function useAlunosFrequencia(dataAula: () => string): {
  alunos: ComputedRef<AlunoFrequencia[]>;
  pendente: Ref<boolean>;
  atualizando: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consultaAlunos = useConsulta(() => Consultas.alunos());
  const consultaEnturmacoes = useConsulta(() => Consultas.enturmacoes({ status: 'matriculado' }));

  const alunoIds = computed(() =>
    (consultaAlunos.dados.value?.alunos ?? []).map((aluno) => aluno.id),
  );

  const consultaFrequencias = useConsulta(() => ({
    ...Consultas.frequencias({
      aluno_ids: alunoIds.value,
      data_aula: dataAula(),
      tipo_registro: 'chamada_aula',
      status: 'ausente',
    }),
    habilitado: Boolean(dataAula() && alunoIds.value.length),
  }));

  const alunos = computed<AlunoFrequencia[]>(() => {
    const lista = consultaAlunos.dados.value?.alunos ?? [];
    const enturmacoes = consultaEnturmacoes.dados.value?.enturmacoes ?? [];
    const ausencias = consultaFrequencias.dados.value?.frequencias ?? [];
    const visiveis = new Set(lista.map((aluno) => aluno.id));

    const enturmacaoAluno = new Map(
      enturmacoes.filter((ent) => visiveis.has(ent.aluno_id)).map((ent) => [ent.aluno_id, ent]),
    );

    const periodoPorAluno = new Map<string, string[]>();
    const observacaoPorAluno = new Map<string, string | null>();
    const motivosPorAluno = new Map<string, string[]>();
    for (const registro of ausencias) {
      const periodos = periodoPorAluno.get(registro.aluno_id) ?? [];
      periodos.push(registro.periodo);
      periodoPorAluno.set(registro.aluno_id, periodos);
      observacaoPorAluno.set(registro.aluno_id, registro.observacao);
      if (registro.motivos_ausencia?.length) {
        motivosPorAluno.set(registro.aluno_id, registro.motivos_ausencia);
      }
    }

    return lista.map((aluno) => {
      const enturmacao = enturmacaoAluno.get(aluno.id);
      return {
        id: aluno.id,
        nome: aluno.nome,
        matricula: aluno.matricula,
        turma: enturmacao ? enturmacao.turma.nome_completo : null,
        turma_id: enturmacao?.turma_id ?? null,
        ausente: periodoPorAluno.has(aluno.id),
        periodosAusentes: periodoPorAluno.get(aluno.id) ?? [],
        observacao: observacaoPorAluno.get(aluno.id) ?? null,
        motivosAusencia: motivosPorAluno.get(aluno.id) ?? [],
      };
    });
  });

  const resumo = resumir([consultaAlunos, consultaEnturmacoes, consultaFrequencias]);

  return {
    alunos,
    pendente: resumo.pendente,
    atualizando: resumo.atualizando,
    recarregar: resumo.recarregar,
  };
}

/** Registra ausências em lote por turma e período. */
export async function registrarFrequenciaEmMassa(
  alunos: AlunoFrequencia[],
  _professorId: string,
  dataAula: string,
  periodos: string[],
): Promise<{ registradas: number; erro: string | null }> {
  try {
    const ausentes = alunos.filter((aluno) => aluno.ausente && aluno.turma_id);
    if (!ausentes.length || !periodos.length) return { registradas: 0, erro: null };

    const porTurma = new Map<string, AlunoFrequencia[]>();
    for (const aluno of ausentes) {
      const turmaId = aluno.turma_id as string;
      const lista = porTurma.get(turmaId) ?? [];
      lista.push(aluno);
      porTurma.set(turmaId, lista);
    }

    let totalRegistradas = 0;

    for (const [turmaId, alunosTurma] of porTurma) {
      for (const periodo of periodos) {
        const resposta = await api<{ registradas?: number; idempotente?: boolean }>(
          '/api/frequencias/lote',
          {
            metodo: 'POST',
            corpo: {
              turma_id: turmaId,
              data_aula: dataAula,
              periodo,
              tipo_registro: 'chamada_aula',
              ausentes: alunosTurma.map((aluno) => ({ aluno_id: aluno.id })),
              client_request_id: crypto.randomUUID(),
            },
          },
        );

        // Resposta idempotente significa que as ausências já estavam registradas.
        totalRegistradas += resposta.registradas ?? alunosTurma.length;
      }
    }

    invalidarChave('frequencias');
    return { registradas: totalRegistradas, erro: null };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error('[useMonitoramento] Erro ao registrar frequência:', mensagem);
    return { registradas: 0, erro: 'Falha ao registrar frequência. Tente novamente.' };
  }
}

/** Registra a ausência individual de um aluno em um período. */
export async function registrarAusenciaEmPeriodo(
  alunoId: string,
  _professorId: string,
  dataAula: string,
  periodo: string,
  observacao?: string,
  motivos?: string[],
): Promise<boolean> {
  try {
    await api('/api/frequencias', {
      metodo: 'POST',
      corpo: {
        aluno_id: alunoId,
        data_aula: dataAula,
        periodo,
        observacao: observacao || null,
        motivos_ausencia: motivos ?? [],
        tipo_registro: 'chamada_aula',
      },
    });
    invalidarChave('frequencias');
    return true;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error('[useMonitoramento] Erro ao registrar ausência em período:', mensagem);
    return false;
  }
}

/** Registra uma ocorrência grave ou suspensão. */
export async function registrarOcorrenciaGrave(
  alunoId: string,
  _professorId: string,
  descricao: string,
  tipos: string[] = ['grave'],
  exigePresencaResponsavel = false,
  tags?: string[],
  notificarCoordenacao = true,
  notificarResponsavel = false,
): Promise<boolean> {
  try {
    await api('/api/ocorrencias', {
      metodo: 'POST',
      corpo: {
        aluno_id: alunoId,
        titulo: descricao.slice(0, 100),
        descricao,
        tipo: tipos,
        exige_presenca_responsavel: exigePresencaResponsavel,
        tags_comportamento: tags ?? [],
        notificar_coordenacao: notificarCoordenacao,
        notificar_responsavel: notificarResponsavel,
      },
    });
    invalidarChave('ocorrencias');
    return true;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error('[useMonitoramento] Erro ao registrar ocorrência:', mensagem);
    return false;
  }
}

/** Ranking de priorização de risco calculado no cliente a partir das consultas cacheadas. */
export function useRankingRisco(): {
  ranking: ComputedRef<AlunoRisco[]>;
  pendente: Ref<boolean>;
  atualizando: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const { configTermometro } = useConfiguracaoSistema();
  const consultaAlunos = useConsulta(() => Consultas.alunos());
  const consultaFrequencias = useConsulta(() => Consultas.frequencias({ status: 'ausente' }));
  const consultaJustificativas = useConsulta(() => Consultas.justificativas({ status: 'aceita' }));
  const consultaOcorrencias = useConsulta(() => Consultas.ocorrencias());
  const consultaTags = useConsulta(() => Consultas.tags());

  const ranking = computed<AlunoRisco[]>(() => {
    const cfg = configTermometro.value;
    const alunos = consultaAlunos.dados.value?.alunos ?? [];
    const frequencias = consultaFrequencias.dados.value?.frequencias ?? [];
    const justificativas = consultaJustificativas.dados.value?.justificativas ?? [];
    const ocorrencias = consultaOcorrencias.dados.value?.ocorrencias ?? [];
    const tags = consultaTags.dados.value?.tags ?? [];

    const justificadas = new Set<string>();
    for (const justificativa of justificativas) {
      const fim = justificativa.data_fim ?? justificativa.data_falta;
      const inicio = new Date(`${justificativa.data_falta}T00:00:00`);
      const fimData = new Date(`${fim}T00:00:00`);
      for (let dia = new Date(inicio); dia <= fimData; dia.setDate(dia.getDate() + 1)) {
        justificadas.add(`${justificativa.aluno_id}:${dia.toISOString().slice(0, 10)}`);
      }
    }

    const pesoPorTag = new Map<string, { peso: number; categoria: string }>();
    for (const tag of tags) {
      pesoPorTag.set(tag.nome, { peso: tag.peso_pontuacao, categoria: tag.categoria });
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const janelaInicio = new Date();
    janelaInicio.setDate(janelaInicio.getDate() - cfg.janelaRecenciaDias);
    const janelaIso = janelaInicio.toISOString().slice(0, 10);

    const resultado = alunos.map((aluno) => {
      const todasAusencias = frequencias.filter((frequencia) => frequencia.aluno_id === aluno.id);
      const ausenciasInjustificadas = todasAusencias.filter(
        (frequencia) => !justificadas.has(`${aluno.id}:${frequencia.data_aula}`),
      );
      const ocos = ocorrencias.filter((ocorrencia) => ocorrencia.aluno_id === aluno.id);

      const faltasRecentes = ausenciasInjustificadas.filter(
        (frequencia) => frequencia.data_aula >= janelaIso,
      ).length;
      const ultima = ausenciasInjustificadas
        .map((frequencia) => frequencia.data_aula)
        .sort()
        .reverse()[0];
      const diasDesdeUltima = ultima ? diasEntre(ultima, hoje) : null;

      const ocorrenciasCalc = ocos.map((ocorrencia) => {
        let peso = 0;
        let categoria = 'atencao';
        for (const nome of ocorrencia.tags_comportamento ?? []) {
          const info = pesoPorTag.get(nome);
          if (info) {
            peso += Math.max(0, info.peso);
            if (info.categoria === 'critico') categoria = 'critico';
          } else {
            peso += 10;
          }
        }
        if (peso === 0 && (ocorrencia.tags_comportamento ?? []).length === 0) peso = 5;
        const diasDesdeCriacao = ocorrencia.created_at
          ? diasEntre(ocorrencia.created_at.slice(0, 10), hoje)
          : null;
        return {
          peso,
          exigePresenca: ocorrencia.exige_presenca_responsavel,
          categoria,
          tipo: (ocorrencia.tipo ?? []) as string[],
          status: ocorrencia.status,
          diasDesdeCriacao,
          presencaConfirmada: ocorrencia.presenca_responsavel_confirmada,
        };
      });

      const { nivel } = calcularTermometro(
        {
          faltasInjustificadas: ausenciasInjustificadas.length,
          faltasRecentes,
          diasDesdeUltimaFalta: diasDesdeUltima,
          ocorrencias: ocorrenciasCalc,
          comportamentosPositivos: 0,
        },
        cfg,
      );

      return {
        id: aluno.id,
        nome: aluno.nome,
        matricula: aluno.matricula,
        turma: null,
        serie: null,
        totalAusencias: ausenciasInjustificadas.length,
        totalOcorrencias: ocos.length,
        nivel,
        ultimaAusencia: ultima ? formatarData(ultima) : undefined,
        exigePresencaResponsavel: ocos.some((ocorrencia) => ocorrencia.exige_presenca_responsavel),
      };
    });

    const ordemNivel: Record<NivelRisco, number> = { alto: 0, medio: 1, baixo: 2 };
    resultado.sort((a, b) => {
      const diferenca = ordemNivel[a.nivel] - ordemNivel[b.nivel];
      if (diferenca !== 0) return diferenca;
      return b.totalAusencias - a.totalAusencias;
    });

    return resultado;
  });

  const resumo = resumir([
    consultaAlunos,
    consultaFrequencias,
    consultaJustificativas,
    consultaOcorrencias,
    consultaTags,
  ]);

  return { ranking, ...resumo };
}

/** Ocorrências graves formatadas para a central da gestão. */
export function useOcorrenciasGraves(): {
  ocorrencias: ComputedRef<OcorrenciaGrave[]>;
  pendente: Ref<boolean>;
  atualizando: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consultaOcorrencias = useConsulta(() => Consultas.ocorrencias());
  const consultaAlunos = useConsulta(() => Consultas.alunos());

  const ocorrencias = computed<OcorrenciaGrave[]>(() => {
    const alunos = consultaAlunos.dados.value?.alunos ?? [];
    return (consultaOcorrencias.dados.value?.ocorrencias ?? []).map((ocorrencia) => {
      const aluno = alunos.find((registro) => registro.id === ocorrencia.aluno_id);
      return {
        id: ocorrencia.id,
        alunoNome: ocorrencia.aluno?.nome ?? aluno?.nome ?? 'Aluno não encontrado',
        alunoMatricula: aluno?.matricula ?? '—',
        turma: null,
        descricao: ocorrencia.descricao,
        tipo: [...ocorrencia.tipo],
        tags_comportamento: [...(ocorrencia.tags_comportamento ?? [])],
        notificar_coordenacao: ocorrencia.notificar_coordenacao,
        notificar_responsavel: ocorrencia.notificar_responsavel,
        data: formatarData(ocorrencia.created_at),
        professorNome: ocorrencia.professor?.nome,
        exigePresencaResponsavel: ocorrencia.exige_presenca_responsavel,
        bloqueado: ocorrencia.exige_presenca_responsavel,
      };
    });
  });

  return {
    ocorrencias,
    ...resumir([consultaOcorrencias, consultaAlunos]),
  };
}

export async function alternarBloqueioRetorno(
  ocorrenciaId: string,
  novoValor: boolean,
): Promise<boolean> {
  try {
    await api(`/api/ocorrencias/${ocorrenciaId}`, {
      metodo: 'PATCH',
      corpo: { exige_presenca_responsavel: novoValor },
    });
    invalidarChave('ocorrencias');
    return true;
  } catch (erro) {
    console.error('[useMonitoramento] Erro ao alternar bloqueio de retorno:', erro);
    return false;
  }
}

export async function resolverOcorrencia(
  ocorrenciaId: string,
  novoStatus: 'resolvida' | 'arquivada' | 'aberta' | 'em_andamento',
): Promise<boolean> {
  try {
    await api(`/api/ocorrencias/${ocorrenciaId}`, {
      metodo: 'PATCH',
      corpo: { status: novoStatus },
    });
    invalidarChave('ocorrencias');
    return true;
  } catch (erro) {
    console.error('[useMonitoramento] Erro ao resolver ocorrência:', erro);
    return false;
  }
}

export async function confirmarPresencaResponsavel(ocorrenciaId: string): Promise<boolean> {
  try {
    await api(`/api/ocorrencias/${ocorrenciaId}`, {
      metodo: 'PATCH',
      corpo: { presenca_responsavel_confirmada: true },
    });
    invalidarChave('ocorrencias');
    return true;
  } catch (erro) {
    console.error('[useMonitoramento] Erro ao confirmar presença:', erro);
    return false;
  }
}

/** Justificativas formatadas para a fila de validação. */
export function useJustificativasPendentes(): {
  justificativas: ComputedRef<JustificativaPendente[]>;
  pendente: Ref<boolean>;
  atualizando: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => Consultas.justificativas());

  const justificativas = computed<JustificativaPendente[]>(() =>
    (consulta.dados.value?.justificativas ?? []).map((justificativa) => {
      const anexo = justificativa.anexos[0];
      return {
        id: justificativa.id,
        alunoNome: justificativa.aluno?.nome ?? 'Aluno não encontrado',
        responsavelNome: justificativa.responsavel?.nome ?? 'Responsável não vinculado',
        dataAusencia: formatarData(justificativa.data_falta),
        dataFim: justificativa.data_fim ? formatarData(justificativa.data_fim) : null,
        motivo: justificativa.motivo,
        anexoPath: anexo?.storage_path,
        anexoNome: anexo?.nome_arquivo,
        anexoMime: anexo?.mime_type,
        anexoId: anexo?.id,
        status: justificativa.status,
      };
    }),
  );

  return {
    justificativas,
    pendente: consulta.pendente,
    atualizando: consulta.atualizando,
    recarregar: () => consulta.recarregar(true),
  };
}

export async function validarJustificativa(
  justificativaId: string,
  acao: 'aceitar' | 'recusar',
): Promise<boolean> {
  try {
    const status = acao === 'aceitar' ? 'aceita' : 'recusada';
    await api(`/api/justificativas/${justificativaId}`, {
      metodo: 'PATCH',
      corpo: { status },
    });
    invalidarChave('justificativas');
    return true;
  } catch (erro) {
    console.error('[useMonitoramento] Erro ao validar justificativa:', erro);
    return false;
  }
}

function montarJustificadas(justificativas: JustificativaApi[], alunoId: string): Set<string> {
  const datas = new Set<string>();
  for (const justificativa of justificativas.filter((registro) => registro.aluno_id === alunoId)) {
    const fim = justificativa.data_fim ?? justificativa.data_falta;
    const inicio = new Date(justificativa.data_falta + 'T00:00:00');
    const fimData = new Date(fim + 'T00:00:00');
    for (let dia = new Date(inicio); dia <= fimData; dia.setDate(dia.getDate() + 1)) {
      datas.add(dia.toISOString().slice(0, 10));
    }
  }
  return datas;
}

/** Alerta do responsável com status de justificativa por ausência. */
export function useAlertasResponsavel(): {
  alertas: ComputedRef<AlertaResponsavel[]>;
  pendente: Ref<boolean>;
  atualizando: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consultaFilhos = useConsulta(() => Consultas.alunos());
  const consultaJustificativas = useConsulta(() => Consultas.justificativas());
  const consultaFrequencias = useConsulta(() => ({
    ...Consultas.frequencias({
      aluno_ids: (consultaFilhos.dados.value?.alunos ?? []).map((filho) => filho.id),
      status: 'ausente',
    }),
    habilitado: (consultaFilhos.dados.value?.alunos ?? []).length > 0,
  }));
  const consultaOcorrencias = useConsulta(() => Consultas.ocorrencias());

  const alertas = computed<AlertaResponsavel[]>(() => {
    const filhos = consultaFilhos.dados.value?.alunos ?? [];
    if (!filhos.length) return [];

    const alunoIds = new Set(filhos.map((filho) => filho.id));
    const justificativas = (consultaJustificativas.dados.value?.justificativas ?? []).filter(
      (justificativa) => alunoIds.has(justificativa.aluno_id),
    );
    const frequencias = (consultaFrequencias.dados.value?.frequencias ?? []).filter((frequencia) =>
      alunoIds.has(frequencia.aluno_id),
    );
    const ocorrencias = consultaOcorrencias.dados.value?.ocorrencias ?? [];

    const justificativaPorDia = new Map<string, { status: string; motivo: string }>();
    const anexoPorDia = new Map<string, { nome: string; storagePath: string; mimeType: string }>();
    for (const justificativa of justificativas) {
      const inicio = new Date(justificativa.data_falta);
      const fim = new Date(justificativa.data_fim ?? justificativa.data_falta);
      const anexo = justificativa.anexos[0];
      for (let dia = new Date(inicio); dia <= fim; dia.setDate(dia.getDate() + 1)) {
        const chave = `${justificativa.aluno_id}:${dia.toISOString().slice(0, 10)}`;
        justificativaPorDia.set(chave, {
          status: justificativa.status,
          motivo: justificativa.motivo,
        });
        if (anexo?.storage_path) {
          anexoPorDia.set(chave, {
            nome: anexo.nome_arquivo,
            storagePath: anexo.storage_path,
            mimeType: anexo.mime_type,
          });
        }
      }
    }

    const lista: AlertaResponsavel[] = [];

    for (const filho of filhos) {
      for (const ausencia of frequencias.filter((registro) => registro.aluno_id === filho.id)) {
        const { data } = formatarDataHorario(ausencia.data_aula);
        const chave = `${filho.id}:${ausencia.data_aula}`;
        const justificativa = justificativaPorDia.get(chave);
        const anexo = anexoPorDia.get(chave);

        let descricao = 'Sem justificativa enviada.';
        let justificativaStatus: AlertaResponsavel['justificativaStatus'];
        let justificativaMotivo: string | undefined;

        if (justificativa) {
          justificativaStatus = justificativa.status as AlertaResponsavel['justificativaStatus'];
          justificativaMotivo = justificativa.motivo;
          descricao =
            justificativa.status === 'aceita'
              ? 'Justificativa aceita.'
              : justificativa.status === 'recusada'
                ? 'Justificativa recusada.'
                : 'Justificativa enviada, aguardando validação.';
        }

        lista.push({
          id: `freq-${ausencia.id}`,
          tipo:
            ausencia.periodo === 'Dia completo' || !ausencia.periodo
              ? 'ausencia_escola'
              : 'ausencia_aula',
          titulo: filho.nome,
          descricao,
          data,
          periodo: ausencia.periodo,
          frequenciaId: ausencia.id,
          justificativaStatus,
          justificativaMotivo,
          anexoPath: anexo?.storagePath,
          anexoNome: anexo?.nome,
          anexoMime: anexo?.mimeType,
          urgente: false,
        });
      }

      for (const ocorrencia of ocorrencias.filter((registro) => registro.aluno_id === filho.id)) {
        const { data } = formatarDataHorario(ocorrencia.created_at);
        lista.push({
          id: `oc-${ocorrencia.id}`,
          tipo: ocorrencia.tipo.includes('suspensao') ? 'suspensao' : 'comunicado',
          titulo: filho.nome,
          descricao: ocorrencia.descricao,
          data,
          ocorrenciaTipo: [...ocorrencia.tipo],
          tagsComportamento: [...(ocorrencia.tags_comportamento ?? [])],
          exigePresencaResponsavel: ocorrencia.exige_presenca_responsavel,
          urgente: ocorrencia.exige_presenca_responsavel,
        });
      }
    }

    return lista.sort((a, b) => (a.data < b.data ? 1 : -1));
  });

  return {
    alertas,
    ...resumir([consultaFilhos, consultaJustificativas, consultaFrequencias, consultaOcorrencias]),
  };
}

/** Termômetro de atenção de um aluno específico. */
export function useTermometroAluno(
  alunoId: () => string,
  alunoNome: () => string,
  alunoTurma: () => string | null,
): {
  termometro: ComputedRef<TermometroAtencao | undefined>;
  pendente: Ref<boolean>;
  atualizando: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const { configTermometro } = useConfiguracaoSistema();
  const consultaFrequencias = useConsulta(() => ({
    ...Consultas.frequencias({ aluno_id: alunoId(), status: 'ausente' }),
    habilitado: Boolean(alunoId()),
  }));
  const consultaJustificativas = useConsulta(() => ({
    ...Consultas.justificativas({ aluno_id: alunoId(), status: 'aceita' }),
    habilitado: Boolean(alunoId()),
  }));
  const consultaOcorrencias = useConsulta(() => ({
    ...Consultas.ocorrencias({ aluno_id: alunoId() }),
    habilitado: Boolean(alunoId()),
  }));
  const consultaTags = useConsulta(() => Consultas.tags());
  const consultaRegistros = useConsulta(() => {
    const janela = new Date();
    janela.setDate(janela.getDate() - configTermometro.value.janelaPositivoDias);
    return {
      ...Consultas.registrosComportamento({
        aluno_id: alunoId(),
        data_inicio: janela.toISOString().slice(0, 10),
      }),
      habilitado: Boolean(alunoId()),
    };
  });

  const termometro = computed<TermometroAtencao | undefined>(() => {
    if (!alunoId()) return undefined;
    const cfg = configTermometro.value;
    const frequencias = consultaFrequencias.dados.value?.frequencias ?? [];
    const justificativas = consultaJustificativas.dados.value?.justificativas ?? [];
    const ocorrenciasApi = consultaOcorrencias.dados.value?.ocorrencias ?? [];
    const tags = consultaTags.dados.value?.tags ?? [];
    const registros = consultaRegistros.dados.value?.registros ?? [];

    const datasJustificadas = montarJustificadas(justificativas, alunoId());
    const frequenciasInjustificadas = frequencias.filter(
      (frequencia) => !datasJustificadas.has(frequencia.data_aula),
    );
    const totalAusenciasJustificadas = frequencias.length - frequenciasInjustificadas.length;

    const hoje = new Date().toISOString().slice(0, 10);
    const janelaInicio = new Date();
    janelaInicio.setDate(janelaInicio.getDate() - cfg.janelaRecenciaDias);
    const janelaIso = janelaInicio.toISOString().slice(0, 10);
    const faltasRecentes = frequenciasInjustificadas.filter(
      (frequencia) => frequencia.data_aula >= janelaIso,
    ).length;
    const ultimaFalta =
      frequenciasInjustificadas
        .map((frequencia) => frequencia.data_aula)
        .sort()
        .reverse()[0] ?? null;
    const diasDesdeUltimaFalta = ultimaFalta ? diasEntre(ultimaFalta, hoje) : null;

    const trintaDias = new Date();
    trintaDias.setDate(trintaDias.getDate() - 30);
    const sessentaDias = new Date();
    sessentaDias.setDate(sessentaDias.getDate() - 60);
    const iso30 = trintaDias.toISOString().slice(0, 10);
    const iso60 = sessentaDias.toISOString().slice(0, 10);
    const contagem30 = frequenciasInjustificadas.filter(
      (frequencia) => frequencia.data_aula >= iso30,
    ).length;
    const contagem60 = frequenciasInjustificadas.filter(
      (frequencia) => frequencia.data_aula >= iso60 && frequencia.data_aula < iso30,
    ).length;
    let tendencia: TermometroAtencao['tendencia'] = 'estavel';
    if (contagem30 > contagem60) tendencia = 'alta';
    else if (contagem30 < contagem60) tendencia = 'queda';

    const pesoPorTag = new Map<string, { peso: number; categoria: string }>();
    for (const tag of tags) {
      pesoPorTag.set(tag.nome, { peso: tag.peso_pontuacao, categoria: tag.categoria });
    }

    const ocorrenciasCalc = ocorrenciasApi.map((ocorrencia) => {
      let peso = 0;
      let categoria = 'atencao';
      for (const nome of ocorrencia.tags_comportamento ?? []) {
        const info = pesoPorTag.get(nome);
        if (info) {
          peso += Math.max(0, info.peso);
          if (info.categoria === 'critico') categoria = 'critico';
        } else {
          peso += 10;
        }
      }
      if (peso === 0 && (ocorrencia.tags_comportamento ?? []).length === 0) peso = 5;
      const diasDesdeCriacao = ocorrencia.created_at
        ? diasEntre(ocorrencia.created_at.slice(0, 10), hoje)
        : null;
      return {
        peso,
        exigePresenca: ocorrencia.exige_presenca_responsavel,
        categoria,
        tipo: (ocorrencia.tipo ?? []) as string[],
        status: ocorrencia.status,
        diasDesdeCriacao,
        presencaConfirmada: ocorrencia.presenca_responsavel_confirmada,
      };
    });

    const comportamentosPositivos = registros.filter((registro) =>
      registro.tags.some((tag) => tag.categoria === 'positivo'),
    ).length;

    const { score, nivel, fatores } = calcularTermometro(
      {
        faltasInjustificadas: frequenciasInjustificadas.length,
        faltasRecentes,
        diasDesdeUltimaFalta,
        ocorrencias: ocorrenciasCalc,
        comportamentosPositivos,
      },
      cfg,
    );

    const mensagens: Record<NivelRisco, string> = {
      baixo: 'Continue acompanhando a vida escolar do seu filho.',
      medio: 'Há registros de faltas e/ou ocorrências. Entre em contato com a escola.',
      alto: 'Acúmulo importante de faltas e/ou ocorrências. Procure a coordenação imediatamente.',
    };

    return {
      nivel,
      alunoNome: alunoNome(),
      alunoTurma: alunoTurma(),
      totalAusencias: frequenciasInjustificadas.length,
      totalAusenciasJustificadas,
      totalOcorrencias: ocorrenciasApi.length,
      score,
      limites: {
        preventivo: cfg.preventivo,
        critico: cfg.critico,
        medio: cfg.limiteScoreMedio,
        alto: cfg.limiteScoreAlto,
      },
      fatores,
      tendencia,
      mensagem: mensagens[nivel],
    };
  });

  return {
    termometro,
    ...resumir([
      consultaFrequencias,
      consultaJustificativas,
      consultaOcorrencias,
      consultaTags,
      consultaRegistros,
    ]),
  };
}

/** Filhos vinculados ao responsável autenticado. */
export function useFilhosResponsavel(): {
  filhos: ComputedRef<Aluno[]>;
  pendente: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => Consultas.alunos());
  return {
    filhos: computed(() => consulta.dados.value?.alunos ?? []),
    pendente: consulta.pendente,
    recarregar: () => consulta.recarregar(true),
  };
}

/** Envia uma justificativa com anexo opcional e invalida a lista. */
export async function enviarJustificativa(
  alunoId: string,
  _responsavelId: string,
  dataInicio: string,
  dataFim: string | null,
  motivo: string,
  arquivo?: File | null,
): Promise<{ success: boolean; justificativaId: string | null }> {
  let anexoId: string | null = null;
  try {
    if (arquivo) {
      const { blob, mimeType } = await comprimirImagem(arquivo);
      const nome =
        mimeType === 'image/jpeg' && arquivo.type !== 'image/jpeg'
          ? arquivo.name.replace(/\.[^.]+$/, '.jpg')
          : arquivo.name;
      const { anexo } = await enviarAnexo<{ anexo: { id: string } }>(blob, nome, mimeType);
      anexoId = anexo.id;
    }

    const dataFimNormalizada = dataFim && dataFim.trim() ? dataFim : null;
    const { justificativa } = await api<{ justificativa: { id: string } }>('/api/justificativas', {
      metodo: 'POST',
      corpo: {
        aluno_id: alunoId,
        data_falta: dataInicio,
        data_fim: dataFimNormalizada,
        motivo,
        ...(anexoId ? { anexo_ids: [anexoId] } : {}),
      },
    });

    invalidarChave('justificativas');
    return { success: true, justificativaId: justificativa.id };
  } catch (erro) {
    // Compensação: sem a justificativa o anexo recém-enviado não deve ficar órfão.
    if (anexoId) {
      await api(`/api/anexos/${anexoId}`, { metodo: 'DELETE' }).catch(() => undefined);
    }
    console.error('[useMonitoramento] Erro ao enviar justificativa:', erro);
    return { success: false, justificativaId: null };
  }
}

/** Estatísticas agregadas do painel confidencial de monitoramento. */
export function calcularEstatisticasPainel(
  ranking: AlunoRisco[],
  ocorrencias: OcorrenciaGrave[],
  justificativas: JustificativaPendente[],
): EstatisticaPainel[] {
  const totalAlunos = ranking.length;
  const alunosRiscoAlto = ranking.filter((aluno) => aluno.nivel === 'alto').length;
  const alunosRiscoMedio = ranking.filter((aluno) => aluno.nivel === 'medio').length;
  const ocorrenciasAtivas = ocorrencias.filter(
    (ocorrencia) => !ocorrencia.exigePresencaResponsavel,
  ).length;
  const bloqueiosAtivos = ocorrencias.filter(
    (ocorrencia) => ocorrencia.exigePresencaResponsavel,
  ).length;
  const justificativasPendentes = justificativas.filter(
    (justificativa) => justificativa.status === 'pendente',
  ).length;

  return [
    {
      id: 'alunos',
      rotulo: 'Alunos monitorados',
      valor: totalAlunos,
      icone: 'people',
      variante: 'primary',
      rodape: 'Total cadastrado',
    },
    {
      id: 'risco-alto',
      rotulo: 'Risco crítico',
      valor: alunosRiscoAlto,
      icone: 'exclamation-octagon',
      variante: 'danger',
      rodape: 'Contato urgente',
    },
    {
      id: 'risco-medio',
      rotulo: 'Em atenção',
      valor: alunosRiscoMedio,
      icone: 'exclamation-triangle',
      variante: 'warning',
      rodape: 'Acompanhamento',
    },
    {
      id: 'ocorrencias',
      rotulo: 'Ocorrências graves',
      valor: ocorrencias.length,
      icone: 'shield-exclamation',
      variante: 'dark',
      rodape: `${ocorrenciasAtivas} ativas`,
    },
    {
      id: 'bloqueios',
      rotulo: 'Retornos bloqueados',
      valor: bloqueiosAtivos,
      icone: 'lock',
      variante: 'secondary',
      rodape: 'Exigem responsável',
    },
    {
      id: 'justificativas',
      rotulo: 'Justificativas',
      valor: justificativasPendentes,
      icone: 'clipboard-check',
      variante: 'info',
      rodape: 'Aguardando validação',
    },
  ];
}

/** Tipos auxiliares reexportados para as view models derivadas. */
export type { Frequencia, TagComportamento, RegistroComportamentoApi, OcorrenciaApi };
