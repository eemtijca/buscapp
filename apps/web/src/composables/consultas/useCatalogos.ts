import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue';
import { useConsulta } from '@/composables/useConsulta';
import { Consultas } from '@/servicos/consultas';
import { CONFIG_TERMOMETRO_PADRAO, type ConfigTermometro } from '@/servicos/termometro';
import type {
  AnoLetivo,
  ConfiguracaoSistema,
  Disciplina,
  HorarioLetivo,
  OpcaoConfiguracao,
  TagComportamento,
  Turma,
} from '@/tipos/database';
import type { HorarioProtegido, OpcaoCheckbox } from '@/tipos/componentes';

const MENSAGEM_FORA_HORARIO_PADRAO =
  'O canal de diálogo está fora do horário escolar. Mensagens enviadas agora serão respondidas quando a coordenação estiver disponível.';

/** Converte a configuração do sistema no formato do termômetro, com padrões seguros. */
export function configTermometroDe(
  configuracao: ConfiguracaoSistema | undefined,
): ConfigTermometro {
  if (!configuracao) return { ...CONFIG_TERMOMETRO_PADRAO };
  return {
    preventivo: configuracao.limite_preventivo_faltas ?? CONFIG_TERMOMETRO_PADRAO.preventivo,
    critico: configuracao.limite_critico_faltas ?? CONFIG_TERMOMETRO_PADRAO.critico,
    pesoFalta: configuracao.peso_falta ?? CONFIG_TERMOMETRO_PADRAO.pesoFalta,
    pesoOcorrencia: configuracao.peso_ocorrencia ?? CONFIG_TERMOMETRO_PADRAO.pesoOcorrencia,
    pesoRecencia: configuracao.peso_recencia ?? CONFIG_TERMOMETRO_PADRAO.pesoRecencia,
    janelaRecenciaDias:
      configuracao.janela_recencia_dias ?? CONFIG_TERMOMETRO_PADRAO.janelaRecenciaDias,
    limiteScoreMedio: configuracao.limite_score_medio ?? CONFIG_TERMOMETRO_PADRAO.limiteScoreMedio,
    limiteScoreAlto: configuracao.limite_score_alto ?? CONFIG_TERMOMETRO_PADRAO.limiteScoreAlto,
    pesoOcorrenciaGrave:
      configuracao.peso_ocorrencia_grave ?? CONFIG_TERMOMETRO_PADRAO.pesoOcorrenciaGrave,
    forcarMedioEmGrave:
      configuracao.forcar_medio_em_grave ?? CONFIG_TERMOMETRO_PADRAO.forcarMedioEmGrave,
    janelaOcorrenciaDias:
      configuracao.janela_ocorrencia_dias ?? CONFIG_TERMOMETRO_PADRAO.janelaOcorrenciaDias,
    decaimentoOcorrenciaTipo:
      (configuracao.decaimento_ocorrencia_tipo as ConfigTermometro['decaimentoOcorrenciaTipo']) ??
      CONFIG_TERMOMETRO_PADRAO.decaimentoOcorrenciaTipo,
    pesoResolvida: configuracao.peso_resolvida ?? CONFIG_TERMOMETRO_PADRAO.pesoResolvida,
    pesoComportamentoPositivo:
      configuracao.peso_comportamento_positivo ??
      CONFIG_TERMOMETRO_PADRAO.pesoComportamentoPositivo,
    janelaPositivoDias:
      configuracao.janela_positivo_dias ?? CONFIG_TERMOMETRO_PADRAO.janelaPositivoDias,
    bonusPresencaConfirmada:
      configuracao.bonus_presenca_confirmada ?? CONFIG_TERMOMETRO_PADRAO.bonusPresencaConfirmada,
  };
}

/** Opções de configuração de um tipo, no formato dos componentes de checkbox. */
export function useOpcoes(tipo: () => string): {
  opcoes: ComputedRef<OpcaoCheckbox[]>;
  pendente: Ref<boolean>;
  garantirDados: () => Promise<void>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => ({
    ...Consultas.opcoes(tipo()),
    habilitado: Boolean(tipo()),
  }));

  const opcoes = computed<OpcaoCheckbox[]>(() =>
    (consulta.dados.value?.opcoes ?? []).map((opcao) => ({
      valor: opcao.chave,
      rotulo: opcao.rotulo,
      icone: opcao.icone ?? undefined,
    })),
  );

  return {
    opcoes,
    pendente: consulta.pendente,
    // Aguarda a primeira leitura quando ainda não há dados, sem forçar revalidação.
    garantirDados: () => consulta.recarregar(false),
    recarregar: () => consulta.recarregar(true),
  };
}

/** Catálogo de tags de comportamento. */
export function useTags(): {
  tags: ComputedRef<TagComportamento[]>;
  pendente: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => Consultas.tags());
  const tags = computed(() => consulta.dados.value?.tags ?? []);
  return {
    tags,
    pendente: consulta.pendente,
    recarregar: () => consulta.recarregar(true),
  };
}

/** Turmas ordenadas por nome; sem filtros, inclui inativas. */
export function useTurmas(filtros?: () => Record<string, string | undefined>): {
  turmas: ComputedRef<Turma[]>;
  pendente: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => Consultas.turmas(filtros?.()));
  const turmas = computed(() =>
    [...(consulta.dados.value?.turmas ?? [])].sort((a, b) =>
      a.nome_completo.localeCompare(b.nome_completo),
    ),
  );
  return {
    turmas,
    pendente: consulta.pendente,
    recarregar: () => consulta.recarregar(true),
  };
}

/** Disciplinas ordenadas por nome; sem filtros, inclui inativas. */
export function useDisciplinas(filtros?: () => Record<string, string | undefined>): {
  disciplinas: ComputedRef<Disciplina[]>;
  pendente: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => Consultas.disciplinas(filtros?.()));
  const disciplinas = computed(() =>
    [...(consulta.dados.value?.disciplinas ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)),
  );
  return {
    disciplinas,
    pendente: consulta.pendente,
    recarregar: () => consulta.recarregar(true),
  };
}

/** Anos letivos cadastrados. */
export function useAnosLetivos(): {
  anos: ComputedRef<AnoLetivo[]>;
  pendente: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => Consultas.anosLetivos());
  const anos = computed(() => consulta.dados.value?.anos_letivos ?? []);
  return {
    anos,
    pendente: consulta.pendente,
    recarregar: () => consulta.recarregar(true),
  };
}

/** Horários letivos cadastrados, como devolvidos pela API. */
export function useHorariosLetivos(): {
  horarios: ComputedRef<HorarioLetivo[]>;
  pendente: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => Consultas.horarios());
  const horarios = computed(() => consulta.dados.value?.horarios ?? []);
  return {
    horarios,
    pendente: consulta.pendente,
    recarregar: () => consulta.recarregar(true),
  };
}

/** Opções de configuração cruas de um tipo, para as telas de administração. */
export function useOpcoesConfiguracao(tipo: () => string): {
  opcoes: ComputedRef<OpcaoConfiguracao[]>;
  pendente: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => ({
    ...Consultas.opcoes(tipo()),
    habilitado: Boolean(tipo()),
  }));
  const opcoes = computed(() =>
    [...(consulta.dados.value?.opcoes ?? [])].sort((a, b) => a.ordem - b.ordem),
  );
  return {
    opcoes,
    pendente: consulta.pendente,
    recarregar: () => consulta.recarregar(true),
  };
}

/** Ano letivo ativo e vigente, quando existir. */
export function useAnoLetivoAtivo(): { anoAtivo: ComputedRef<{ id: string } | null> } {
  const { anos } = useAnosLetivos();
  const anoAtivo = computed(() => {
    const ativo = anos.value.find((ano) => ano.ativo && ano.status === 'ativo');
    return ativo ? { id: ativo.id } : null;
  });
  return { anoAtivo };
}

/** Configuração do sistema e a configuração derivada do termômetro. */
export function useConfiguracaoSistema(): {
  configuracao: ComputedRef<ConfiguracaoSistema | undefined>;
  configTermometro: ComputedRef<ConfigTermometro>;
  mensagemForaHorario: ComputedRef<string>;
  pendente: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consulta = useConsulta(() => Consultas.configuracoes());
  const configuracao = computed(() => consulta.dados.value?.configuracao);
  const configTermometro = computed(() => configTermometroDe(configuracao.value));
  const mensagemForaHorario = computed(
    () => configuracao.value?.mensagem_fora_horario || MENSAGEM_FORA_HORARIO_PADRAO,
  );

  return {
    configuracao,
    configTermometro,
    mensagemForaHorario,
    pendente: consulta.pendente,
    recarregar: () => consulta.recarregar(true),
  };
}

function derivarHorario(
  horarios: { dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean }[],
  mensagemForaHorario: string,
): HorarioProtegido {
  if (!horarios.length) {
    return {
      inicio: '07:00',
      fim: '17:00',
      diasSemana: [1, 2, 3, 4, 5],
      mensagemForaHorario,
    };
  }

  const janelas = horarios.filter((horario) => horario.ativo);
  if (!janelas.length) {
    return { inicio: '23:59', fim: '23:59', diasSemana: [], mensagemForaHorario };
  }

  const dias = [...new Set(janelas.map((janela) => janela.dia_semana))].sort();
  const horasInicio =
    janelas
      .filter((janela) => janela.dia_semana === dias[0])
      .map((janela) => janela.hora_inicio.slice(0, 5))
      .sort()[0] ?? '07:00';
  const horasFim =
    janelas
      .filter((janela) => janela.dia_semana === dias[dias.length - 1])
      .map((janela) => janela.hora_fim.slice(0, 5))
      .sort()
      .reverse()[0] ?? '17:00';

  return { inicio: horasInicio, fim: horasFim, diasSemana: dias, mensagemForaHorario };
}

function janelaAberta(horario: HorarioProtegido, agora: Date): boolean {
  if (!horario.diasSemana.includes(agora.getDay())) return false;

  const minutosTotais = agora.getHours() * 60 + agora.getMinutes();
  const [hInicio = 0, mInicio = 0] = horario.inicio.split(':').map(Number);
  const [hFim = 0, mFim = 0] = horario.fim.split(':').map(Number);
  return minutosTotais >= hInicio * 60 + mInicio && minutosTotais <= hFim * 60 + mFim;
}

/** Horário protegido do canal de diálogo, com estado de janela aberta atualizado a cada minuto. */
export function useHorarioProtegido(): {
  horario: ComputedRef<HorarioProtegido>;
  horarioAtivo: ComputedRef<boolean>;
  pendente: Ref<boolean>;
} {
  const consultaHorarios = useConsulta(() => Consultas.horarios());
  const { mensagemForaHorario } = useConfiguracaoSistema();

  const horario = computed(() =>
    derivarHorario(consultaHorarios.dados.value?.horarios ?? [], mensagemForaHorario.value),
  );

  const agora = ref(new Date());
  const timer = setInterval(() => (agora.value = new Date()), 60_000);
  onScopeDispose(() => clearInterval(timer));

  const horarioAtivo = computed(() => janelaAberta(horario.value, agora.value));

  return { horario, horarioAtivo, pendente: consultaHorarios.pendente };
}
