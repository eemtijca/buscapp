import { ref, type Ref } from 'vue';
import { supabaseClient } from '@/servicos/supabase';
import { useAnoLetivo } from '@/composables/useAnoLetivo';
import { comprimirImagem } from '@/utils/comprimirImagem';
import { safeDate } from '@/utils/chatUtils';
import type {
  Aluno,
  Frequencia,
  Ocorrencia,
  Perfil,
  Turma,
  VinculoResponsavel,
  JustificativaFalta,
} from '@/tipos/database';
import type {
  AlunoFrequencia,
  AlunoRisco,
  AlertaResponsavel,
  EstatisticaPainel,
  JustificativaPendente,
  MensagemChat,
  ContatoChat,
  NivelRisco,
  OcorrenciaGrave,
  TermometroAtencao,
  HorarioProtegido,
} from '@/tipos/componentes';
import {
  calcularTermometro,
  calcularNivel,
  CONFIG_TERMOMETRO_PADRAO,
  type ConfigTermometro,
} from '@/servicos/termometro';

let cacheConfigSistema: {
  critico: number;
  preventivo: number;
  pesoFalta: number;
  pesoOcorrencia: number;
  pesoRecencia: number;
  janelaRecenciaDias: number;
  limiteScoreMedio: number;
  limiteScoreAlto: number;
  mensagemForaHorario: string;
} | null = null;
let cacheHorarios: HorarioProtegido | null = null;

/** Monta a configuração do termômetro a partir do cache. */
function obterConfigTermometro(): ConfigTermometro {
  const c = cacheConfigSistema;
  if (!c) return { ...CONFIG_TERMOMETRO_PADRAO };
  return {
    preventivo: c.preventivo,
    critico: c.critico,
    pesoFalta: c.pesoFalta,
    pesoOcorrencia: c.pesoOcorrencia,
    pesoRecencia: c.pesoRecencia,
    janelaRecenciaDias: c.janelaRecenciaDias,
    limiteScoreMedio: c.limiteScoreMedio,
    limiteScoreAlto: c.limiteScoreAlto,
  };
}

async function carregarConfigSistema(): Promise<void> {
  if (cacheConfigSistema) return;
  try {
    const { data } = await supabaseClient
      .from('configuracoes_sistema')
      .select(
        'limite_critico_faltas, limite_preventivo_faltas, mensagem_fora_horario, peso_falta, peso_ocorrencia, peso_recencia, janela_recencia_dias, limite_score_medio, limite_score_alto',
      )
      .single();
    const row = data as unknown as {
      limite_critico_faltas?: number;
      limite_preventivo_faltas?: number;
      mensagem_fora_horario?: string;
      peso_falta?: number;
      peso_ocorrencia?: number;
      peso_recencia?: number;
      janela_recencia_dias?: number;
      limite_score_medio?: number;
      limite_score_alto?: number;
    } | null;
    cacheConfigSistema = {
      critico: row?.limite_critico_faltas ?? 25,
      preventivo: row?.limite_preventivo_faltas ?? 10,
      pesoFalta: row?.peso_falta ?? 1,
      pesoOcorrencia: row?.peso_ocorrencia ?? 1,
      pesoRecencia: row?.peso_recencia ?? 1,
      janelaRecenciaDias: row?.janela_recencia_dias ?? 14,
      limiteScoreMedio: row?.limite_score_medio ?? 40,
      limiteScoreAlto: row?.limite_score_alto ?? 75,
      mensagemForaHorario:
        row?.mensagem_fora_horario ??
        'O canal de diálogo está fora do horário escolar. Mensagens enviadas agora serão respondidas quando a coordenação estiver disponível.',
    };
  } catch {
    cacheConfigSistema = {
      critico: 25,
      preventivo: 10,
      pesoFalta: 1,
      pesoOcorrencia: 1,
      pesoRecencia: 1,
      janelaRecenciaDias: 14,
      limiteScoreMedio: 40,
      limiteScoreAlto: 75,
      mensagemForaHorario: 'O canal de diálogo está fora do horário escolar.',
    };
  }
}

/** Mantido para compatibilidade: delega para o serviço de termômetro. */
export function calcularNivelRisco(totalAusencias: number, totalOcorrencias: number): NivelRisco {
  const cfg = obterConfigTermometro();
  // Compatibilidade: quando só há contagens, mapeia cada ocorrência para peso padrão 10.
  const ocorrencias = Array.from({ length: totalOcorrencias }, () => ({
    peso: 10,
    exigePresenca: false,
    categoria: 'atencao',
  }));
  return calcularNivel(0, totalAusencias, ocorrencias, cfg);
}

/** Calcula dias entre duas datas ISO (YYYY-MM-DD). */
function diasEntre(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/** Limpa caches de configuração e horários para a próxima sessão não reutilizar dados da anterior. */
function limparCachesGlobais(): void {
  cacheConfigSistema = null;
  cacheHorarios = null;
}

function formatarData(iso: string): string {
  if (!iso) return '';
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (partes) return `${partes[3]}/${partes[2]}/${partes[1]}`;
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatarDataHorario(iso: string): { data: string; horario: string } {
  if (!iso) return { data: '', horario: '' };
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (partes) return { data: `${partes[3]}/${partes[2]}/${partes[1]}`, horario: '' };
  try {
    const d = new Date(iso);
    return {
      data: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      horario: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { data: iso, horario: '' };
  }
}

export function useMonitoramento() {
  const carregando: Ref<boolean> = ref(false);
  const erro: Ref<string | null> = ref(null);
  const { buscarAnoLetivoAtivo } = useAnoLetivo();

  async function buscarAlunosParaFrequencia(dataAula?: string): Promise<AlunoFrequencia[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data: alunosData, error: errAlunos } = await supabaseClient
        .from('alunos')
        .select('*')
        .order('nome', { ascending: true });

      if (errAlunos) throw errAlunos;

      const alunos = (alunosData ?? []) as unknown as Aluno[];
      const alunoIds = alunos.map((a) => a.id);

      const { data: enturmacoesData } = await supabaseClient
        .from('enturmacoes')
        .select('aluno_id, turma_id, ano_letivo_id')
        .in('aluno_id', alunoIds)
        .eq('status', 'matriculado');

      const enturmacoes = (enturmacoesData ?? []) as unknown as Array<{
        aluno_id: string;
        turma_id: string;
        ano_letivo_id: string;
      }>;

      const turmaIds = [...new Set(enturmacoes.map((e) => e.turma_id))];
      const { data: turmasData } = await supabaseClient
        .from('turmas')
        .select('id, nome_completo')
        .in('id', turmaIds);

      const turmaNomeMap = new Map(
        (turmasData ?? []).map((t: unknown) => [(t as Turma).id, (t as Turma).nome_completo]),
      );

      const enturmacaoAlunoMap = new Map(
        enturmacoes.map((e) => [
          e.aluno_id,
          { turma_id: e.turma_id, ano_letivo_id: e.ano_letivo_id },
        ]),
      );

      const ausentesSet = new Set<string>();
      const periodosAluno = new Map<string, string[]>();
      const observacoesAluno = new Map<string, string | null>();
      const motivosAluno = new Map<string, string[]>();

      if (dataAula) {
        const { data: ausencias } = await supabaseClient
          .from('frequencias')
          .select('aluno_id, periodo, observacao, motivos_ausencia')
          .in('aluno_id', alunoIds)
          .eq('data_aula', dataAula)
          .eq('tipo_registro', 'chamada_aula')
          .eq('status', 'ausente')
          .is('deleted_at', null);

        for (const a of ausencias ?? []) {
          const reg = a as unknown as {
            aluno_id: string;
            periodo: string;
            observacao: string | null;
            motivos_ausencia: string[];
          };
          const id = reg.aluno_id;
          ausentesSet.add(id);
          if (!periodosAluno.has(id)) periodosAluno.set(id, []);
          periodosAluno.get(id)!.push(reg.periodo);
          observacoesAluno.set(id, reg.observacao);
          if (reg.motivos_ausencia?.length) {
            motivosAluno.set(id, reg.motivos_ausencia);
          }
        }
      }

      return alunos.map((aluno) => {
        const ent = enturmacaoAlunoMap.get(aluno.id);
        return {
          id: aluno.id,
          nome: aluno.nome,
          matricula: aluno.matricula,
          turma: ent ? (turmaNomeMap.get(ent.turma_id) ?? null) : null,
          turma_id: ent?.turma_id ?? null,
          ausente: ausentesSet.has(aluno.id),
          periodosAusentes: periodosAluno.get(aluno.id) ?? [],
          observacao: observacoesAluno.get(aluno.id) ?? null,
          motivosAusencia: motivosAluno.get(aluno.id) ?? [],
        };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar alunos:', msg);
      erro.value = 'Não foi possível carregar a lista de alunos.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function registrarFrequenciaEmMassa(
    alunos: AlunoFrequencia[],
    professorId: string,
    dataAula: string,
    periodos: string[],
  ): Promise<{ registradas: number; erro: string | null }> {
    carregando.value = true;
    erro.value = null;
    try {
      const ausentes = alunos.filter((a) => a.ausente);
      if (!ausentes.length) {
        return { registradas: 0, erro: null };
      }

      const anoLetivo = await buscarAnoLetivoAtivo();

      if (!anoLetivo) throw new Error('Nenhum ano letivo ativo encontrado.');
      const anoLetivoId = anoLetivo.id;

      let totalRegistradas = 0;

      for (const periodo of periodos) {
        const insercoes = ausentes.map((aluno) => ({
          aluno_id: aluno.id,
          professor_id: professorId,
          turma_id: aluno.turma_id,
          ano_letivo_id: anoLetivoId,
          data_aula: dataAula,
          periodo,
          tipo_registro: 'chamada_aula' as const,
          status: 'ausente' as const,
        }));

        const ausentesIds = ausentes.map((a) => a.id);
        await supabaseClient
          .from('frequencias')
          .delete()
          .in('aluno_id', ausentesIds)
          .eq('data_aula', dataAula)
          .eq('periodo', periodo)
          .eq('tipo_registro', 'chamada_aula')
          .is('deleted_at', null);

        const { error: err } = await supabaseClient.from('frequencias').insert(insercoes);

        if (err) throw err;
        totalRegistradas += ausentes.length;
      }

      return { registradas: totalRegistradas, erro: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao registrar frequência:', msg);
      const mensagem = 'Falha ao registrar frequência. Tente novamente.';
      erro.value = mensagem;
      return { registradas: 0, erro: mensagem };
    } finally {
      carregando.value = false;
    }
  }

  async function registrarAusenciaEmPeriodo(
    alunoId: string,
    professorId: string,
    dataAula: string,
    periodo: string,
    observacao?: string,
    motivos?: string[],
  ): Promise<boolean> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data: enturmacao } = await supabaseClient
        .from('enturmacoes')
        .select('turma_id, ano_letivo_id')
        .eq('aluno_id', alunoId)
        .eq('status', 'matriculado')
        .single();

      if (!enturmacao) throw new Error('Aluno não encontrado em nenhuma turma.');
      const tId = (enturmacao as unknown as { turma_id: string }).turma_id;
      const aId = (enturmacao as unknown as { ano_letivo_id: string }).ano_letivo_id;

      await supabaseClient
        .from('frequencias')
        .delete()
        .eq('aluno_id', alunoId)
        .eq('data_aula', dataAula)
        .eq('periodo', periodo)
        .eq('tipo_registro', 'chamada_aula')
        .is('deleted_at', null);

      const { error: err } = await supabaseClient.from('frequencias').insert({
        aluno_id: alunoId,
        professor_id: professorId,
        turma_id: tId,
        ano_letivo_id: aId,
        data_aula: dataAula,
        periodo,
        tipo_registro: 'chamada_aula',
        status: 'ausente',
        observacao: observacao || null,
        motivos_ausencia: motivos ?? [],
      });

      if (err) throw err;
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao registrar ausência em período:', msg);
      erro.value = 'Falha ao registrar ausência em aula.';
      return false;
    } finally {
      carregando.value = false;
    }
  }

  async function registrarOcorrenciaGrave(
    alunoId: string,
    professorId: string,
    descricao: string,
    tipos: string[] = ['grave'],
    exigePresencaResponsavel = false,
    tags?: string[],
    notificarCoordenacao = true,
    notificarResponsavel = false,
  ): Promise<boolean> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data: enturmacao } = await supabaseClient
        .from('enturmacoes')
        .select('turma_id, ano_letivo_id')
        .eq('aluno_id', alunoId)
        .eq('status', 'matriculado')
        .single();
      if (!enturmacao) throw new Error('Aluno não está matriculado em nenhuma turma.');

      const { error: err } = await supabaseClient.from('ocorrencias').insert({
        aluno_id: alunoId,
        professor_id: professorId,
        turma_id: enturmacao.turma_id,
        ano_letivo_id: enturmacao.ano_letivo_id,
        titulo: descricao.slice(0, 100),
        descricao,
        tipo: tipos,
        exige_presenca_responsavel: exigePresencaResponsavel,
        tags_comportamento: tags ?? [],
        notificar_coordenacao: notificarCoordenacao,
        notificar_responsavel: notificarResponsavel,
      });

      if (err) throw err;
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao registrar ocorrência:', msg);
      erro.value = 'Falha ao registrar ocorrência grave.';
      return false;
    } finally {
      carregando.value = false;
    }
  }

  async function buscarRankingRisco(): Promise<AlunoRisco[]> {
    await carregarConfigSistema();
    carregando.value = true;
    erro.value = null;
    try {
      const cfg = obterConfigTermometro();

      const { data: alunosData, error: errAlunos } = await supabaseClient
        .from('alunos')
        .select('*')
        .order('nome', { ascending: true });

      if (errAlunos) throw errAlunos;
      const alunos = (alunosData ?? []) as unknown as Aluno[];

      const { data: frequenciasData, error: errFreq } = await supabaseClient
        .from('frequencias')
        .select('aluno_id, data_aula, status')
        .eq('status', 'ausente')
        .is('deleted_at', null);

      if (errFreq) throw errFreq;
      const frequencias = (frequenciasData ?? []) as unknown as Pick<
        Frequencia,
        'aluno_id' | 'data_aula' | 'status'
      >[];

      // Justificativas aceitas para abater faltas do ranking.
      const alunoIds = alunos.map((a) => a.id);
      const { data: justsData } = await supabaseClient
        .from('justificativas_faltas')
        .select('aluno_id, data_falta, data_fim')
        .in('aluno_id', alunoIds)
        .eq('status', 'aceita');
      const justificadas = new Set<string>();
      for (const j of (justsData ?? []) as unknown as Array<{
        aluno_id: string;
        data_falta: string;
        data_fim: string | null;
      }>) {
        const fim = j.data_fim ?? j.data_falta;
        const inicio = new Date(j.data_falta + 'T00:00:00');
        const fimD = new Date(fim + 'T00:00:00');
        for (let d = new Date(inicio); d <= fimD; d.setDate(d.getDate() + 1)) {
          justificadas.add(`${j.aluno_id}:${d.toISOString().slice(0, 10)}`);
        }
      }

      const { data: ocorrenciasData, error: errOco } = await supabaseClient
        .from('ocorrencias')
        .select('aluno_id, exige_presenca_responsavel, tags_comportamento, created_at');

      if (errOco) throw errOco;
      const ocorrenciasRaw = (ocorrenciasData ?? []) as unknown as Array<
        Pick<
          Ocorrencia,
          'aluno_id' | 'exige_presenca_responsavel' | 'tags_comportamento' | 'created_at'
        >
      >[];

      // Mapa de peso por tag para cálculo ponderado.
      const { data: tagsData } = await supabaseClient
        .from('tags_comportamento')
        .select('nome, peso_pontuacao, categoria');
      const pesoPorTag = new Map<string, { peso: number; categoria: string }>();
      for (const t of (tagsData ?? []) as unknown as Array<{
        nome: string;
        peso_pontuacao: number;
        categoria: string;
      }>) {
        pesoPorTag.set(t.nome, { peso: t.peso_pontuacao, categoria: t.categoria });
      }

      const hojeIso = new Date().toISOString().slice(0, 10);
      const janelaInicio = new Date();
      janelaInicio.setDate(janelaInicio.getDate() - cfg.janelaRecenciaDias);
      const janelaIso = janelaInicio.toISOString().slice(0, 10);

      const ranking: AlunoRisco[] = alunos.map((aluno) => {
        const todasAusencias = frequencias.filter((f) => f.aluno_id === aluno.id);
        const ausenciasInjust = todasAusencias.filter(
          (f) => !justificadas.has(`${aluno.id}:${f.data_aula}`),
        );
        const ocos = (
          ocorrenciasRaw as unknown as Array<{
            aluno_id: string;
            exige_presenca_responsavel: boolean;
            tags_comportamento: string[];
            created_at: string;
          }>
        ).filter((o) => o.aluno_id === aluno.id);

        const faltasRecentes = ausenciasInjust.filter((f) => f.data_aula >= janelaIso).length;
        const ultima = ausenciasInjust
          .map((f) => f.data_aula)
          .sort()
          .reverse()[0];
        const diasDesdeUltima = ultima ? diasEntre(ultima, hojeIso) : null;

        // Mapeia ocorrências para peso/categoria.
        const ocorrenciasCalc = ocos.map((o) => {
          let peso = 0;
          let categoria = 'atencao';
          for (const nome of (o.tags_comportamento ?? []) as string[]) {
            const info = pesoPorTag.get(nome);
            if (info) {
              peso += Math.max(0, info.peso);
              if (info.categoria === 'critico') categoria = 'critico';
            } else {
              peso += 10;
            }
          }
          // Sem tags mas com registro já conta peso padrão leve.
          if (peso === 0 && ((o.tags_comportamento ?? []) as string[]).length === 0) peso = 5;
          return { peso, exigePresenca: o.exige_presenca_responsavel, categoria };
        });

        const { nivel } = calcularTermometro(
          {
            faltasInjustificadas: ausenciasInjust.length,
            faltasRecentes,
            diasDesdeUltimaFalta: diasDesdeUltima,
            ocorrencias: ocorrenciasCalc,
          },
          cfg,
        );

        return {
          id: aluno.id,
          nome: aluno.nome,
          matricula: aluno.matricula,
          turma: null,
          serie: null,
          totalAusencias: ausenciasInjust.length,
          totalOcorrencias: ocos.length,
          nivel,
          ultimaAusencia: ultima ? formatarData(ultima) : undefined,
          exigePresencaResponsavel: (
            ocos as unknown as Array<{ exige_presenca_responsavel: boolean }>
          ).some((o) => o.exige_presenca_responsavel),
        };
      });

      const ordemNivel: Record<NivelRisco, number> = { alto: 0, medio: 1, baixo: 2 };
      ranking.sort((a, b) => {
        const diffNivel = ordemNivel[a.nivel] - ordemNivel[b.nivel];
        if (diffNivel !== 0) return diffNivel;
        return b.totalAusencias - a.totalAusencias;
      });

      return ranking;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar ranking de risco:', msg);
      erro.value = 'Não foi possível carregar o ranking de risco.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function buscarOcorrenciasGraves(): Promise<OcorrenciaGrave[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data: ocoData, error: err } = await supabaseClient
        .from('ocorrencias')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      const ocorrencias = (ocoData ?? []) as unknown as Ocorrencia[];

      const alunoIds = [...new Set(ocorrencias.map((o) => o.aluno_id))];
      const { data: alunosData } = await supabaseClient
        .from('alunos')
        .select('*')
        .in('id', alunoIds);
      const alunos = (alunosData ?? []) as unknown as Aluno[];

      const profIds = [...new Set(ocorrencias.map((o) => o.professor_id))];
      const { data: profData } = await supabaseClient.from('perfis').select('*').in('id', profIds);
      const professores = (profData ?? []) as unknown as Perfil[];

      return ocorrencias.map((oc) => {
        const aluno = alunos.find((a) => a.id === oc.aluno_id);
        const prof = professores.find((p) => p.id === oc.professor_id);
        return {
          id: oc.id,
          alunoNome: aluno?.nome ?? 'Aluno não encontrado',
          alunoMatricula: aluno?.matricula ?? '—',
          turma: null,
          descricao: oc.descricao,
          tipo: oc.tipo,
          tags_comportamento: oc.tags_comportamento ?? [],
          notificar_coordenacao: oc.notificar_coordenacao,
          notificar_responsavel: oc.notificar_responsavel,
          data: formatarData(oc.created_at),
          professorNome: prof?.nome,
          exigePresencaResponsavel: oc.exige_presenca_responsavel,
          bloqueado: oc.exige_presenca_responsavel,
        };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar ocorrências graves:', msg);
      erro.value = 'Não foi possível carregar as ocorrências graves.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function alternarBloqueioRetorno(
    ocorrenciaId: string,
    novoValor: boolean,
  ): Promise<boolean> {
    try {
      const { error: err } = await supabaseClient
        .from('ocorrencias')
        .update({ exige_presenca_responsavel: novoValor })
        .eq('id', ocorrenciaId);

      if (err) throw err;
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao alternar bloqueio de retorno:', msg);
      erro.value = 'Falha ao atualizar bloqueio de retorno.';
      return false;
    }
  }

  async function buscarJustificativasPendentes(): Promise<JustificativaPendente[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data: justData, error: err } = await supabaseClient
        .from('justificativas_faltas')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      const justificativas = (justData ?? []) as unknown as JustificativaFalta[];

      const alunoIds = [...new Set(justificativas.map((j) => j.aluno_id))];
      const { data: alunosData } = await supabaseClient
        .from('alunos')
        .select('*')
        .in('id', alunoIds);
      const alunos = (alunosData ?? []) as unknown as Aluno[];

      const respIds = [...new Set(justificativas.map((j) => j.responsavel_id))];
      const { data: respData } = await supabaseClient.from('perfis').select('*').in('id', respIds);
      const responsaveis = (respData ?? []) as unknown as Perfil[];

      const justIds = justificativas.map((j) => j.id);
      const { data: jaData } = await supabaseClient
        .from('justificativa_anexos')
        .select('justificativa_id, anexo_id')
        .in('justificativa_id', justIds);

      const jaList = (jaData ?? []) as unknown as Array<{
        justificativa_id: string;
        anexo_id: string;
      }>;

      const anexoIds = [...new Set(jaList.map((ja) => ja.anexo_id))];
      const anexoMap = new Map<
        string,
        {
          nome_arquivo: string;
          storage_path: string;
          mime_type: string;
          processado_em: string | null;
        }
      >();

      if (anexoIds.length) {
        const { data: anexosData } = await supabaseClient
          .from('anexos')
          .select('id, nome_arquivo, storage_path, mime_type, processado_em')
          .in('id', anexoIds);

        const anexos = (anexosData ?? []) as unknown as Array<{
          id: string;
          nome_arquivo: string;
          storage_path: string;
          mime_type: string;
          processado_em: string | null;
        }>;
        for (const a of anexos) {
          anexoMap.set(a.id, a);
        }
      }

      const justAnexoMap = new Map<
        string,
        {
          anexoId: string;
          nome: string;
          storagePath: string;
          mimeType: string;
          processadoEm: string | null;
        }
      >();
      for (const ja of jaList) {
        const a = anexoMap.get(ja.anexo_id);
        if (a) {
          justAnexoMap.set(ja.justificativa_id, {
            anexoId: ja.anexo_id,
            nome: a.nome_arquivo,
            storagePath: a.storage_path,
            mimeType: a.mime_type,
            processadoEm: a.processado_em,
          });
        }
      }

      const result: JustificativaPendente[] = [];
      for (const j of justificativas) {
        const aluno = alunos.find((a) => a.id === j.aluno_id);
        const responsavel = responsaveis.find((r) => r.id === j.responsavel_id);
        const anexo = justAnexoMap.get(j.id);

        result.push({
          id: j.id,
          alunoNome: aluno?.nome ?? 'Aluno não encontrado',
          responsavelNome: responsavel?.nome ?? 'Responsável não vinculado',
          dataAusencia: formatarData(j.data_falta),
          dataFim: j.data_fim ? formatarData(j.data_fim) : null,
          motivo: j.motivo,
          anexoPath: anexo?.storagePath,
          anexoNome: anexo?.nome,
          anexoMime: anexo?.mimeType,
          anexoId: anexo?.anexoId ?? undefined,
          processadoEm: anexo?.processadoEm ?? undefined,
          status: j.status as JustificativaPendente['status'],
        });
      }

      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar justificativas:', msg);
      erro.value = 'Não foi possível carregar as justificativas.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function validarJustificativa(
    justificativaId: string,
    acao: 'aceitar' | 'recusar',
    gestaoId?: string,
  ): Promise<boolean> {
    try {
      const status = acao === 'aceitar' ? 'aceita' : 'recusada';
      const updateData: Record<string, unknown> = {
        status,
        avaliado_em: new Date().toISOString(),
      };
      if (gestaoId) updateData.avaliado_por = gestaoId;

      const { error: err } = await supabaseClient
        .from('justificativas_faltas')
        .update(updateData)
        .eq('id', justificativaId);

      if (err) throw err;

      if (acao === 'aceitar') {
        const { data: justData } = await supabaseClient
          .from('justificativas_faltas')
          .select('aluno_id, data_falta, data_fim')
          .eq('id', justificativaId)
          .single();

        if (justData) {
          const j = justData as unknown as {
            aluno_id: string;
            data_falta: string;
            data_fim: string | null;
          };
          const dataFim = j.data_fim ?? j.data_falta;

          await supabaseClient
            .from('frequencias')
            .update({ status: 'justificado' })
            .eq('aluno_id', j.aluno_id)
            .eq('status', 'ausente')
            .gte('data_aula', j.data_falta)
            .lte('data_aula', dataFim);
        }
      }

      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao validar justificativa:', msg);
      erro.value = 'Falha ao validar justificativa.';
      return false;
    }
  }

  function calcularEstatisticasPainel(
    ranking: AlunoRisco[],
    ocorrencias: OcorrenciaGrave[],
    justificativas: JustificativaPendente[],
  ): EstatisticaPainel[] {
    const totalAlunos = ranking.length;
    const alunosRiscoAlto = ranking.filter((r) => r.nivel === 'alto').length;
    const alunosRiscoMedio = ranking.filter((r) => r.nivel === 'medio').length;
    const ocorrenciasAtivas = ocorrencias.filter((o) => !o.exigePresencaResponsavel).length;
    const bloqueiosAtivos = ocorrencias.filter((o) => o.exigePresencaResponsavel).length;
    const justificativasPendentes = justificativas.filter((j) => j.status === 'pendente').length;

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

  async function buscarFilhosDoResponsavel(responsavelId: string): Promise<Aluno[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const { data: vinculos, error: errVinc } = await supabaseClient
        .from('vinculos_responsaveis')
        .select('aluno_id')
        .eq('responsavel_id', responsavelId);

      if (errVinc) throw errVinc;

      const alunoIds = (vinculos ?? []).map((v) => (v as unknown as VinculoResponsavel).aluno_id);
      if (!alunoIds.length) return [];

      const { data: alunos, error: errAlunos } = await supabaseClient
        .from('alunos')
        .select('*')
        .in('id', alunoIds)
        .order('nome', { ascending: true });

      if (errAlunos) throw errAlunos;
      return (alunos ?? []) as unknown as Aluno[];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar filhos do responsável:', msg);
      erro.value = 'Não foi possível carregar seus filhos vinculados.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function buscarTermometroAluno(
    alunoId: string,
    alunoNome: string,
    alunoTurma: string | null,
  ): Promise<TermometroAtencao> {
    await carregarConfigSistema();
    const cfg = obterConfigTermometro();
    try {
      const { data: freqs, error: errF } = await supabaseClient
        .from('frequencias')
        .select('id, data_aula')
        .eq('aluno_id', alunoId)
        .eq('status', 'ausente')
        .is('deleted_at', null);

      if (errF) throw errF;
      const todasFreqs = (freqs ?? []) as unknown as Array<{ id: string; data_aula: string }>;

      // Faltas justificadas (aceitas) não contam para o score.
      const { data: justs } = await supabaseClient
        .from('justificativas_faltas')
        .select('data_falta, data_fim')
        .eq('aluno_id', alunoId)
        .eq('status', 'aceita');
      const datasJustificadas = new Set<string>();
      for (const j of (justs ?? []) as unknown as Array<{
        data_falta: string;
        data_fim: string | null;
      }>) {
        const fim = j.data_fim ?? j.data_falta;
        const ini = new Date(j.data_falta + 'T00:00:00');
        const fimD = new Date(fim + 'T00:00:00');
        for (let d = new Date(ini); d <= fimD; d.setDate(d.getDate() + 1)) {
          datasJustificadas.add(d.toISOString().slice(0, 10));
        }
      }
      const freqsInjust = todasFreqs.filter((f) => !datasJustificadas.has(f.data_aula));
      const totalAusenciasJustificadas = todasFreqs.length - freqsInjust.length;
      const totalAusencias = freqsInjust.length;

      // Recência: faltas na janela e dias desde a última.
      const hojeIso = new Date().toISOString().slice(0, 10);
      const janelaInicio = new Date();
      janelaInicio.setDate(janelaInicio.getDate() - cfg.janelaRecenciaDias);
      const janelaIso = janelaInicio.toISOString().slice(0, 10);
      const faltasRecentes = freqsInjust.filter((f) => f.data_aula >= janelaIso).length;
      const ultimaFalta =
        freqsInjust
          .map((f) => f.data_aula)
          .sort()
          .reverse()[0] ?? null;
      const diasDesdeUltimaFalta = ultimaFalta ? diasEntre(ultimaFalta, hojeIso) : null;

      // Tendência 30d vs 30d anteriores.
      const d30 = new Date();
      d30.setDate(d30.getDate() - 30);
      const d60 = new Date();
      d60.setDate(d60.getDate() - 60);
      const iso30 = d30.toISOString().slice(0, 10);
      const iso60 = d60.toISOString().slice(0, 10);
      const cnt30 = freqsInjust.filter((f) => f.data_aula >= iso30).length;
      const cnt60 = freqsInjust.filter((f) => f.data_aula >= iso60 && f.data_aula < iso30).length;
      let tendencia: TermometroAtencao['tendencia'] = 'estavel';
      if (cnt30 > cnt60) tendencia = 'alta';
      else if (cnt30 < cnt60) tendencia = 'queda';

      const { data: ocos, error: errO } = await supabaseClient
        .from('ocorrencias')
        .select('id, tags_comportamento, exige_presenca_responsavel')
        .eq('aluno_id', alunoId);

      if (errO) throw errO;
      const ocosRaw = (ocos ?? []) as unknown as Array<{
        id: string;
        tags_comportamento: string[];
        exige_presenca_responsavel: boolean;
      }>;
      const totalOcorrencias = ocosRaw.length;

      // Busca pesos das tags para cálculo ponderado.
      const { data: tagsData } = await supabaseClient
        .from('tags_comportamento')
        .select('nome, peso_pontuacao, categoria');
      const pesoPorTag = new Map<string, { peso: number; categoria: string }>();
      for (const t of (tagsData ?? []) as unknown as Array<{
        nome: string;
        peso_pontuacao: number;
        categoria: string;
      }>) {
        pesoPorTag.set(t.nome, { peso: t.peso_pontuacao, categoria: t.categoria });
      }

      const ocorrenciasCalc = ocosRaw.map((o) => {
        let peso = 0;
        let categoria = 'atencao';
        for (const nome of o.tags_comportamento ?? []) {
          const info = pesoPorTag.get(nome);
          if (info) {
            peso += Math.max(0, info.peso);
            if (info.categoria === 'critico') categoria = 'critico';
          } else {
            peso += 10;
          }
        }
        if (peso === 0 && (o.tags_comportamento ?? []).length === 0) peso = 5;
        return { peso, exigePresenca: o.exige_presenca_responsavel, categoria };
      });

      const { score, nivel, fatores } = calcularTermometro(
        {
          faltasInjustificadas: totalAusencias,
          faltasRecentes,
          diasDesdeUltimaFalta,
          ocorrencias: ocorrenciasCalc,
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
        alunoNome,
        alunoTurma,
        totalAusencias,
        totalAusenciasJustificadas,
        totalOcorrencias,
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar termômetro:', msg);
      return {
        nivel: 'baixo',
        alunoNome,
        alunoTurma,
        totalAusencias: 0,
        totalAusenciasJustificadas: 0,
        totalOcorrencias: 0,
        score: 0,
        limites: {
          preventivo: cfg.preventivo,
          critico: cfg.critico,
          medio: cfg.limiteScoreMedio,
          alto: cfg.limiteScoreAlto,
        },
        fatores: [],
        tendencia: 'estavel',
        mensagem: 'Não foi possível carregar os dados de risco.',
      };
    }
  }

  async function buscarAlertasResponsavel(responsavelId: string): Promise<AlertaResponsavel[]> {
    try {
      const filhos = await buscarFilhosDoResponsavel(responsavelId);
      if (!filhos.length) return [];

      const alunoIds = filhos.map((f) => f.id);
      const { data: justsData } = await supabaseClient
        .from('justificativas_faltas')
        .select('id, aluno_id, data_falta, data_fim, status, motivo')
        .in('aluno_id', alunoIds)
        .in('status', ['pendente', 'aceita', 'recusada']);

      const justs = (justsData ?? []) as unknown as Array<{
        id: string;
        aluno_id: string;
        data_falta: string;
        data_fim: string | null;
        status: string;
        motivo: string;
      }>;

      const justMap = new Map<string, { status: string; motivo: string }>();
      for (const j of justs) {
        const start = new Date(j.data_falta);
        const end = new Date(j.data_fim ?? j.data_falta);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          justMap.set(`${j.aluno_id}:${d.toISOString().slice(0, 10)}`, {
            status: j.status,
            motivo: j.motivo,
          });
        }
      }

      const justIds = justs.map((j) => j.id).filter(Boolean);
      const { data: jaData } = await supabaseClient
        .from('justificativa_anexos')
        .select('justificativa_id, anexo_id')
        .in('justificativa_id', justIds as string[]);
      const jaList = (jaData ?? []) as unknown as Array<{
        justificativa_id: string;
        anexo_id: string;
      }>;

      const anexoIds = [...new Set(jaList.map((ja) => ja.anexo_id))];
      const { data: anexosData } = await supabaseClient
        .from('anexos')
        .select('id, nome_arquivo, storage_path, mime_type')
        .in('id', anexoIds);
      const anexos = (anexosData ?? []) as unknown as Array<{
        id: string;
        nome_arquivo: string;
        storage_path: string;
        mime_type: string;
      }>;
      const anexoMap = new Map(anexos.map((a) => [a.id, a]));

      const anexoPorJustKey = new Map<
        string,
        { nome: string; storagePath: string; mimeType: string }
      >();
      for (const ja of jaList) {
        const j = justs.find((x) => x.id === ja.justificativa_id);
        if (!j) continue;
        const a = anexoMap.get(ja.anexo_id);
        if (!a?.storage_path) continue;
        const start = new Date(j.data_falta);
        const end = new Date(j.data_fim ?? j.data_falta);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          anexoPorJustKey.set(`${j.aluno_id}:${d.toISOString().slice(0, 10)}`, {
            nome: a.nome_arquivo,
            storagePath: a.storage_path,
            mimeType: a.mime_type,
          });
        }
      }

      const alertas: AlertaResponsavel[] = [];

      for (const filho of filhos) {
        const { data: freqs } = await supabaseClient
          .from('frequencias')
          .select('*')
          .eq('aluno_id', filho.id)
          .eq('status', 'ausente')
          .order('data_aula', { ascending: false });

        const ausencias = (freqs ?? []) as unknown as Frequencia[];
        for (const aus of ausencias) {
          const { data: dataFormatada } = formatarDataHorario(aus.data_aula);
          const justKey = `${filho.id}:${aus.data_aula}`;
          const justInfo = justMap.get(justKey);
          const anexoInfo = anexoPorJustKey.get(justKey);

          let descricao = 'Sem justificativa enviada.';
          let justificativaStatus: AlertaResponsavel['justificativaStatus'] | undefined;
          let justificativaMotivo: string | undefined;

          if (justInfo) {
            justificativaStatus = justInfo.status as AlertaResponsavel['justificativaStatus'];
            justificativaMotivo = justInfo.motivo;
            descricao =
              justInfo.status === 'aceita'
                ? 'Justificativa aceita.'
                : justInfo.status === 'recusada'
                  ? 'Justificativa recusada.'
                  : 'Justificativa enviada — aguardando validação.';
          }

          alertas.push({
            id: `freq-${aus.id}`,
            tipo:
              aus.periodo === 'Dia completo' || !aus.periodo ? 'ausencia_escola' : 'ausencia_aula',
            titulo: filho.nome,
            descricao,
            data: dataFormatada,
            periodo: aus.periodo,
            frequenciaId: aus.id,
            justificativaStatus,
            justificativaMotivo,
            anexoPath: anexoInfo?.storagePath,
            anexoNome: anexoInfo?.nome,
            anexoMime: anexoInfo?.mimeType,
            urgente: false,
          });
        }

        const { data: ocos } = await supabaseClient
          .from('ocorrencias')
          .select('*')
          .eq('aluno_id', filho.id)
          .order('created_at', { ascending: false });

        const ocorrencias = (ocos ?? []) as unknown as Ocorrencia[];
        for (const oc of ocorrencias) {
          const { data: dataFormatada } = formatarDataHorario(oc.created_at);
          alertas.push({
            id: `oc-${oc.id}`,
            tipo: oc.tipo.includes('suspensao') ? 'suspensao' : 'comunicado',
            titulo: filho.nome,
            descricao: oc.descricao,
            data: dataFormatada,
            ocorrenciaTipo: oc.tipo,
            tagsComportamento: oc.tags_comportamento ?? [],
            exigePresencaResponsavel: oc.exige_presenca_responsavel,
            urgente: oc.exige_presenca_responsavel,
          });
        }
      }

      return alertas.sort((a, b) => (a.data < b.data ? 1 : -1));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar alertas do responsável:', msg);
      erro.value = 'Não foi possível carregar seus alertas.';
      return [];
    }
  }

  async function enviarJustificativa(
    alunoId: string,
    responsavelId: string,
    dataInicio: string,
    dataFim: string | null,
    motivo: string,
  ): Promise<{ success: boolean; justificativaId: string | null }> {
    erro.value = null;
    try {
      const dataFimNormalized = dataFim && dataFim.trim() ? dataFim : null;
      const justificativaId = crypto.randomUUID();
      const { error: justErr } = await supabaseClient.from('justificativas_faltas').insert({
        id: justificativaId,
        aluno_id: alunoId,
        responsavel_id: responsavelId,
        data_falta: dataInicio,
        data_fim: dataFimNormalized,
        motivo,
      });

      if (justErr) throw justErr;
      return { success: true, justificativaId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao enviar justificativa:', msg);
      erro.value = 'Falha ao enviar justificativa. Tente novamente.';
      return { success: false, justificativaId: null };
    }
  }

  async function processarAnexoAsync(
    justificativaId: string,
    responsavelId: string,
    arquivo: File,
  ) {
    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processar-anexo`;
    const ext = arquivo.type === 'image/jpeg' ? 'jpg' : (arquivo.name.split('.').pop() ?? 'bin');
    const storagePath = `${responsavelId}/${justificativaId}/${Date.now()}-${justificativaId.slice(0, 8)}.${ext}`;

    const removerStorage = () =>
      supabaseClient.storage
        .from('justificativas')
        .remove([storagePath])
        .catch(() => {});

    try {
      const { blob, mimeType, tamanhoComprimido } = await comprimirImagem(arquivo);

      await supabaseClient.storage.from('justificativas').upload(storagePath, blob, {
        contentType: mimeType,
        upsert: false,
      });

      const anexoId = crypto.randomUUID();
      const { error: anexoError } = await supabaseClient.from('anexos').insert({
        id: anexoId,
        storage_path: storagePath,
        nome_arquivo: arquivo.name,
        mime_type: mimeType,
        tamanho_bytes: tamanhoComprimido,
        criado_por: responsavelId,
      });
      if (anexoError) {
        await removerStorage();
        throw anexoError;
      }

      const { error: vinculoError } = await supabaseClient.from('justificativa_anexos').insert({
        justificativa_id: justificativaId,
        anexo_id: anexoId,
      });
      if (vinculoError) {
        // Remove o anexo como compensação; linhas remanescentes são limpas pelo job de expurgo.
        try {
          await supabaseClient.from('anexos').delete().eq('id', anexoId);
        } catch {
          /* sem permissão de deleção pelo cliente */
        }
        await removerStorage();
        throw vinculoError;
      }

      fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, mimeType: arquivo.type, anexoId }),
      }).catch((e) =>
        console.error('[useMonitoramento] Falha no processamento do anexo (edge):', e),
      );
    } catch (e) {
      console.error('[useMonitoramento] Falha no processamento assíncrono do anexo:', e);
    }
  }

  async function criarOuObterConversa(
    responsavelId: string,
    alunoId: string,
    turmaId: string,
    opcoes: {
      mensagemSistemaDe?: string | null;
      textoSistema?: string;
      iniciadaPelaGestao?: boolean;
    } = {},
  ): Promise<string | null> {
    try {
      const { data: existing } = await supabaseClient
        .from('conversas')
        .select('id')
        .eq('responsavel_id', responsavelId)
        .eq('aluno_id', alunoId)
        .maybeSingle();

      if (existing) {
        return (existing as unknown as { id: string }).id;
      }

      const { data, error } = await supabaseClient
        .from('conversas')
        .insert({
          responsavel_id: responsavelId,
          aluno_id: alunoId,
          turma_id: turmaId,
          ativa: true,
          iniciada_pela_gestao: opcoes.iniciadaPelaGestao ?? false,
        })
        .select('id')
        .single();

      if (error) throw error;
      const convId = (data as unknown as { id: string }).id;

      if (opcoes.mensagemSistemaDe) {
        const agora = new Date().toISOString();
        await supabaseClient.from('mensagens').insert({
          conversa_id: convId,
          remetente_id: opcoes.mensagemSistemaDe,
          conteudo: opcoes.textoSistema ?? 'Conversa iniciada para acompanhamento escolar.',
          is_system_message: true,
          created_at: agora,
        });

        await supabaseClient
          .from('conversas')
          .update({ ultima_mensagem_em: agora })
          .eq('id', convId);

        if (opcoes.iniciadaPelaGestao) {
          await supabaseClient.from('notificacoes').insert({
            destinatario_id: responsavelId,
            tipo: 'mensagem',
            titulo: 'Coordenação iniciou uma conversa',
            corpo: 'A coordenação escolar abriu um canal de diálogo para acompanhamento.',
            metadados: { conversa_id: convId },
          });
        }
      }

      return convId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao criar/obter conversa:', msg);
      erro.value = 'Falha ao iniciar conversa.';
      return null;
    }
  }

  async function abrirConversaResponsavel(
    alunoId: string,
    gestaoUserId?: string,
  ): Promise<string | null> {
    try {
      const { data: vinculos } = await supabaseClient
        .from('vinculos_responsaveis')
        .select('responsavel_id')
        .eq('aluno_id', alunoId)
        .eq('ativo', true)
        .order('contato_prioritario', { ascending: false })
        .limit(1);

      const responsavelId = (vinculos?.[0] as { responsavel_id: string } | undefined)
        ?.responsavel_id;
      if (!responsavelId) return null;

      const { data: enturmacoes } = await supabaseClient
        .from('enturmacoes')
        .select('turma_id')
        .eq('aluno_id', alunoId)
        .eq('status', 'matriculado')
        .order('created_at', { ascending: false })
        .limit(1);

      const turmaId = (enturmacoes?.[0] as { turma_id: string } | undefined)?.turma_id;
      if (!turmaId) return null;

      return await criarOuObterConversa(responsavelId, alunoId, turmaId, {
        mensagemSistemaDe: gestaoUserId ?? null,
        textoSistema: 'Conversa iniciada pela coordenação para acompanhamento escolar.',
        iniciadaPelaGestao: !!gestaoUserId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao abrir conversa com responsável:', msg);
      return null;
    }
  }

  async function buscarMensagensChat(
    _responsavelId: string,
    _alunoId?: string,
  ): Promise<MensagemChat[]> {
    return [];
  }

  async function buscarConversaDetalhe(
    conversaId: string,
    userId: string,
  ): Promise<{ contato: ContatoChat | null; mensagens: MensagemChat[] }> {
    try {
      const { data: convData } = await supabaseClient
        .from('conversas')
        .select(
          '*, iniciada_pela_gestao, responsavel:perfis!conversas_responsavel_id_fkey(nome), aluno:alunos!conversas_aluno_id_fkey(nome), turma:turmas!conversas_turma_id_fkey(nome_completo)',
        )
        .eq('id', conversaId)
        .single();

      if (!convData) return { contato: null, mensagens: [] };

      const conv = convData as unknown as {
        id: string;
        iniciada_pela_gestao: boolean | null;
        responsavel: { nome: string };
        aluno: { nome: string };
        turma: { nome_completo: string };
      };

      const { data: msgsData } = await supabaseClient
        .from('mensagens')
        .select('*')
        .eq('conversa_id', conversaId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      const remetenteIds = [
        ...new Set(
          (msgsData ?? []).map((m: unknown) => (m as { remetente_id: string }).remetente_id),
        ),
      ];

      const { data: perfisData } = await supabaseClient
        .from('perfis')
        .select('id, nome, papel')
        .in('id', remetenteIds);

      const autores = new Map(
        (perfisData ?? []).map((p: unknown) => [
          (p as { id: string }).id,
          {
            nome: (p as { nome: string }).nome,
            tipo: (p as { papel: string }).papel as 'responsavel' | 'gestao' | 'professor',
          },
        ]),
      );

      const mensagens: MensagemChat[] = (msgsData ?? []).map((m: unknown) => {
        const msg = m as {
          id: string;
          conversa_id: string;
          remetente_id: string;
          conteudo: string;
          is_system_message: boolean;
          lida_em: string | null;
          created_at: string;
        };
        const autor = autores.get(msg.remetente_id);
        const raw = msg.created_at;
        const d = safeDate(raw);
        return {
          id: msg.id,
          conversaId: msg.conversa_id,
          remetenteId: msg.remetente_id,
          autor: autor?.tipo ?? 'gestao',
          nomeAutor: autor?.nome ?? (msg.is_system_message ? 'Sistema' : 'Equipe escolar'),
          texto: msg.conteudo,
          horario: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          data: d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
          dataIso: raw,
          isSistema: msg.is_system_message,
          minha: msg.remetente_id === userId,
          lida: msg.lida_em !== null,
        };
      });

      return {
        contato: {
          conversaId: conversaId,
          nomeContato: conv.responsavel?.nome ?? 'Responsável',
          subtitulo:
            (conv.aluno?.nome ?? '') +
            (conv.turma?.nome_completo ? ' · ' + conv.turma.nome_completo : ''),
          avatarIniciais: '',
          avatarCor: '#008241',
          ultimaMensagem: '',
          ultimaData: '',
          naoLidas: 0,
          ativa: true,
          iniciadaPelaGestao: conv.iniciada_pela_gestao ?? false,
        },
        mensagens,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar detalhe da conversa:', msg);
      return { contato: null, mensagens: [] };
    }
  }

  async function buscarContatosResponsavel(userId: string): Promise<ContatoChat[]> {
    try {
      const { data: vinculos } = await supabaseClient
        .from('vinculos_responsaveis')
        .select('aluno_id')
        .eq('responsavel_id', userId);

      if (!vinculos || !vinculos.length) return [];

      const alunoIds = (vinculos as unknown as { aluno_id: string }[]).map((v) => v.aluno_id);

      const { data: alunos } = await supabaseClient
        .from('alunos')
        .select('id, nome')
        .in('id', alunoIds);

      if (!alunos) return [];

      const { data: enturmacoes } = await supabaseClient
        .from('enturmacoes')
        .select('aluno_id, turma_id')
        .in('aluno_id', alunoIds)
        .eq('status', 'matriculado');

      const turmaPorAluno = new Map(
        (enturmacoes ?? []).map((e: unknown) => {
          const ent = e as { aluno_id: string; turma_id: string };
          return [ent.aluno_id, ent.turma_id];
        }),
      );

      const contatos: ContatoChat[] = [];

      for (const aluno of alunos as unknown as { id: string; nome: string }[]) {
        const turmaId = turmaPorAluno.get(aluno.id);
        if (!turmaId) continue;

        const convId = await criarOuObterConversa(userId, aluno.id, turmaId, {
          mensagemSistemaDe: userId,
        });
        if (!convId) continue;

        const { data: ultima } = await supabaseClient
          .from('mensagens')
          .select('conteudo, created_at')
          .eq('conversa_id', convId)
          .eq('is_system_message', false)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);

        const { count: naoLidas } = await supabaseClient
          .from('mensagens')
          .select('*', { count: 'exact', head: true })
          .eq('conversa_id', convId)
          .eq('is_system_message', false)
          .is('deleted_at', null)
          .is('lida_em', null)
          .neq('remetente_id', userId);

        const ultMsg = (ultima ?? [])[0] as { conteudo: string; created_at: string } | undefined;

        contatos.push({
          conversaId: convId,
          nomeContato: aluno.nome,
          subtitulo: 'Coordenação Escolar',
          avatarIniciais: aluno.nome
            .split(' ')
            .slice(0, 2)
            .map((p: string) => p[0])
            .join('')
            .toUpperCase(),
          avatarCor: '',
          ultimaMensagem: ultMsg?.conteudo
            ? ultMsg.conteudo.replace(/\n/g, ' ').slice(0, 40)
            : 'Nenhuma mensagem ainda',
          ultimaData: ultMsg?.created_at
            ? (() => {
                const d = safeDate(ultMsg.created_at);
                return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              })()
            : '',
          naoLidas: naoLidas ?? 0,
          ativa: true,
          alunoId: aluno.id,
          turmaId,
        });
      }

      return contatos;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar contatos do responsável:', msg);
      return [];
    }
  }

  async function buscarContatosGestao(userId: string): Promise<ContatoChat[]> {
    return buscarContatosStaff(userId, false);
  }

  async function buscarContatosStaff(
    userId: string,
    apenasSuasTurmas: boolean,
  ): Promise<ContatoChat[]> {
    try {
      let query = supabaseClient
        .from('conversas')
        .select(
          'id, responsavel_id, aluno_id, turma_id, ativa, iniciada_pela_gestao, ultima_mensagem_em, responsavel:perfis!conversas_responsavel_id_fkey(nome), aluno:alunos!conversas_aluno_id_fkey(nome), turma:turmas!conversas_turma_id_fkey(nome_completo)',
        );

      if (apenasSuasTurmas) {
        const { data: turmas } = await supabaseClient
          .from('atribuicoes_professores')
          .select('turma_id')
          .eq('professor_id', userId)
          .eq('ativo', true);

        if (!turmas?.length) return [];

        const turmaIds = (turmas as unknown as { turma_id: string }[]).map((t) => t.turma_id);
        query = query.in('turma_id', turmaIds);
      }

      const { data: convs } = await query.order('ultima_mensagem_em', { ascending: false });

      if (!convs) return [];

      const contatos: ContatoChat[] = [];

      for (const conv of convs as unknown as Array<{
        id: string;
        responsavel_id: string;
        aluno_id: string;
        turma_id: string;
        ativa: boolean;
        iniciada_pela_gestao: boolean | null;
        responsavel: { nome: string };
        aluno: { nome: string };
        turma: { nome_completo: string };
      }>) {
        const { data: ultima } = await supabaseClient
          .from('mensagens')
          .select('conteudo, created_at')
          .eq('conversa_id', conv.id)
          .eq('is_system_message', false)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);

        const { count: naoLidas } = await supabaseClient
          .from('mensagens')
          .select('*', { count: 'exact', head: true })
          .eq('conversa_id', conv.id)
          .eq('is_system_message', false)
          .is('deleted_at', null)
          .is('lida_em', null)
          .neq('remetente_id', userId);

        const ultMsg = (ultima ?? [])[0] as { conteudo: string; created_at: string } | undefined;
        const nomeResp = conv.responsavel?.nome ?? 'Responsável';
        const nomeAluno = conv.aluno?.nome ?? '';
        const nomeTurma = conv.turma?.nome_completo ?? '';

        contatos.push({
          conversaId: conv.id,
          nomeContato: nomeResp,
          subtitulo: nomeAluno + (nomeTurma ? ' · ' + nomeTurma : ''),
          avatarIniciais: nomeResp
            .split(' ')
            .slice(0, 2)
            .map((p: string) => p[0])
            .join('')
            .toUpperCase(),
          avatarCor: '',
          ultimaMensagem: ultMsg?.conteudo
            ? ultMsg.conteudo.replace(/\n/g, ' ').slice(0, 40)
            : 'Nenhuma mensagem ainda',
          ultimaData: ultMsg?.created_at
            ? (() => {
                const d = safeDate(ultMsg.created_at);
                return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              })()
            : '',
          naoLidas: naoLidas ?? 0,
          ativa: conv.ativa,
          iniciadaPelaGestao: conv.iniciada_pela_gestao ?? false,
        });
      }

      return contatos;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar contatos da equipe:', msg);
      return [];
    }
  }

  async function enviarMensagem(conversaId: string, conteudo: string): Promise<boolean> {
    try {
      const user = (await supabaseClient.auth.getUser()).data.user;
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabaseClient.from('mensagens').insert({
        conversa_id: conversaId,
        remetente_id: user.id,
        conteudo,
      });

      if (error) throw error;

      await supabaseClient
        .from('conversas')
        .update({ ultima_mensagem_em: new Date().toISOString() })
        .eq('id', conversaId);

      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao enviar mensagem:', msg);
      erro.value = 'Falha ao enviar mensagem. Tente novamente.';
      return false;
    }
  }

  async function marcarMensagensComoLidas(conversaId: string, userId: string): Promise<void> {
    try {
      await supabaseClient
        .from('mensagens')
        .update({ lida_em: new Date().toISOString() })
        .eq('conversa_id', conversaId)
        .neq('remetente_id', userId)
        .is('lida_em', null);
    } catch (e) {
      console.error('[useMonitoramento] Erro ao marcar mensagens como lidas:', e);
    }
  }

  async function ocultarConversa(conversaId: string): Promise<boolean> {
    try {
      const { error } = await supabaseClient
        .from('conversas')
        .update({ ativa: false })
        .eq('id', conversaId);

      if (error) throw error;
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao ocultar conversa:', msg);
      return false;
    }
  }

  async function carregarHorarios(): Promise<HorarioProtegido> {
    if (cacheHorarios) return cacheHorarios;
    await carregarConfigSistema();
    const msg =
      cacheConfigSistema?.mensagemForaHorario ?? 'O canal de diálogo está fora do horário escolar.';
    try {
      const { data } = await supabaseClient
        .from('horarios_letivos')
        .select('dia_semana, hora_inicio, hora_fim, ativo')
        .order('dia_semana');
      if (!data || data.length === 0) {
        // Banco sem configuração alguma assume a janela escolar padrão.
        cacheHorarios = {
          inicio: '07:00',
          fim: '17:00',
          diasSemana: [1, 2, 3, 4, 5],
          mensagemForaHorario: msg,
        };
        return cacheHorarios;
      }
      // Janelas cadastradas mas todas desativadas: gestão fechou o canal por completo.
      const janelas = (
        data as Array<{
          dia_semana: number;
          hora_inicio: string;
          hora_fim: string;
          ativo: boolean;
        }>
      ).filter((h) => h.ativo);
      if (!janelas.length) {
        cacheHorarios = {
          inicio: '23:59',
          fim: '23:59',
          diasSemana: [],
          mensagemForaHorario: msg,
        };
        return cacheHorarios;
      }
      const dias = [...new Set(janelas.map((h: { dia_semana: number }) => h.dia_semana))].sort();
      const horasInicio =
        janelas
          .filter((h: { dia_semana: number }) => h.dia_semana === dias[0])
          .map((h: { hora_inicio: string }) => h.hora_inicio.slice(0, 5))
          .sort()[0] ?? '07:00';
      const horasFim =
        janelas
          .filter((h: { dia_semana: number }) => h.dia_semana === dias[dias.length - 1])
          .map((h: { hora_fim: string }) => h.hora_fim.slice(0, 5))
          .sort()
          .reverse()[0] ?? '17:00';
      cacheHorarios = {
        inicio: horasInicio,
        fim: horasFim,
        diasSemana: dias,
        mensagemForaHorario: msg,
      };
      return cacheHorarios;
    } catch {
      cacheHorarios = {
        inicio: '07:00',
        fim: '17:00',
        diasSemana: [1, 2, 3, 4, 5],
        mensagemForaHorario: msg,
      };
      return cacheHorarios;
    }
  }

  function horarioProtegidoAtivo(agora: Date = new Date()): boolean {
    const dia = agora.getDay();
    const hora = agora.getHours();
    const minuto = agora.getMinutes();
    const minutosTotais = hora * 60 + minuto;

    const h = cacheHorarios ?? {
      inicio: '07:00',
      fim: '17:00',
      diasSemana: [1, 2, 3, 4, 5],
      mensagemForaHorario: '',
    };
    if (!h.diasSemana.includes(dia)) return false;

    const [hInicio = 0, mInicio = 0] = h.inicio.split(':').map(Number);
    const [hFim = 0, mFim = 0] = h.fim.split(':').map(Number);
    const inicioMinutos = hInicio * 60 + mInicio;
    const fimMinutos = hFim * 60 + mFim;

    return minutosTotais >= inicioMinutos && minutosTotais <= fimMinutos;
  }

  async function obterHorarioProtegido(): Promise<HorarioProtegido> {
    return await carregarHorarios();
  }

  return {
    carregando,
    erro,
    buscarAlunosParaFrequencia,
    registrarFrequenciaEmMassa,
    registrarAusenciaEmPeriodo,
    registrarOcorrenciaGrave,
    buscarRankingRisco,
    buscarOcorrenciasGraves,
    alternarBloqueioRetorno,
    buscarJustificativasPendentes,
    validarJustificativa,
    calcularEstatisticasPainel,
    buscarFilhosDoResponsavel,
    buscarTermometroAluno,
    buscarAlertasResponsavel,
    enviarJustificativa,
    processarAnexoAsync,
    buscarMensagensChat,
    buscarConversaDetalhe,
    buscarContatosResponsavel,
    buscarContatosGestao,
    criarOuObterConversa,
    abrirConversaResponsavel,
    enviarMensagem,
    marcarMensagensComoLidas,
    ocultarConversa,
    horarioProtegidoAtivo,
    obterHorarioProtegido,
    limparCachesGlobais,
  };
}
