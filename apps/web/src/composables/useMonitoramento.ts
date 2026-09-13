import { ref, type Ref } from 'vue';
import { api, enviarArquivo } from '@/servicos/api';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import { comprimirImagem } from '@/utils/comprimirImagem';
import { safeDate } from '@/utils/chatUtils';
import type {
  Aluno,
  ConfiguracaoSistema,
  Enturmacao,
  Frequencia,
  HorarioLetivo,
  TagComportamento,
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
  pesoOcorrenciaGrave: number;
  forcarMedioEmGrave: boolean;
  janelaOcorrenciaDias: number;
  decaimentoOcorrenciaTipo: 'nenhum' | 'janela' | 'exponencial';
  pesoResolvida: number;
  pesoComportamentoPositivo: number;
  janelaPositivoDias: number;
  bonusPresencaConfirmada: number;
  mensagemForaHorario: string;
} | null = null;
let cacheHorarios: HorarioProtegido | null = null;

/** Enturmação com os joins devolvidos pela API (`turma` e `ano_letivo`). */
interface EnturmacaoApi extends Enturmacao {
  turma: { id: string; nome_completo: string };
  ano_letivo: { id: string; ano: number };
}

/** Ocorrência com aluno, professor e catálogo de tags já resolvidos pela API. */
interface OcorrenciaApi {
  id: string;
  aluno_id: string;
  aluno: { id: string; nome: string };
  professor_id: string | null;
  professor: { id: string; nome: string } | null;
  turma_id: string;
  ano_letivo_id: string;
  titulo: string;
  descricao: string;
  tipo: string[];
  status: 'aberta' | 'em_andamento' | 'resolvida' | 'arquivada';
  exige_presenca_responsavel: boolean;
  presenca_responsavel_confirmada: boolean;
  data_confirmacao_presenca: string | null;
  data_ocorrencia: string;
  closed_at: string | null;
  tags_comportamento: string[];
  lista_tags: TagComportamento[];
  notificar_coordenacao: boolean;
  notificar_responsavel: boolean;
  created_at: string;
  updated_at: string;
}

/** Anexo enxuto retornado dentro da justificativa. */
interface AnexoJustificativaApi {
  id: string;
  nome_arquivo: string;
  mime_type: string;
  storage_path: string;
}

/** Justificativa com aluno, responsável e anexos já resolvidos pela API. */
interface JustificativaApi {
  id: string;
  responsavel_id: string;
  aluno_id: string;
  frequencia_id: string | null;
  data_falta: string;
  data_fim: string | null;
  motivo: string;
  status: 'pendente' | 'aceita' | 'recusada';
  avaliado_por: string | null;
  avaliado_em: string | null;
  parecer: string | null;
  aluno: { id: string; nome: string };
  responsavel: { id: string; nome: string };
  anexos: AnexoJustificativaApi[];
  created_at: string;
  updated_at: string;
}

/** Registro de comportamento com as tags do catálogo embutidas. */
interface RegistroComportamentoApi {
  id: string;
  aluno_id: string;
  professor_id: string;
  turma_id: string;
  ano_letivo_id: string;
  data_hora: string;
  descricao: string | null;
  tags: TagComportamento[];
}

/** Conversa do chat com contatos, prévia da última mensagem e não lidas. */
interface ConversaApi {
  id: string;
  responsavel: { id: string; nome: string };
  aluno: { id: string; nome: string };
  turma: { id: string; nome_completo: string };
  ultima_mensagem_em: string | null;
  ultima_mensagem: { conteudo: string; created_at: string } | null;
  nao_lidas: number;
  ativa: boolean;
  iniciada_pela_gestao: boolean;
}

/** Mensagem do chat com o autor resolvido pela API. */
interface MensagemApi {
  id: string;
  conversa_id: string;
  remetente_id: string;
  autor: { id: string; nome: string; papel: 'professor' | 'gestao' | 'responsavel' };
  conteudo: string;
  is_system_message: boolean;
  lida_em: string | null;
  created_at: string;
}

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
    pesoOcorrenciaGrave: c.pesoOcorrenciaGrave,
    forcarMedioEmGrave: c.forcarMedioEmGrave,
    janelaOcorrenciaDias: c.janelaOcorrenciaDias,
    decaimentoOcorrenciaTipo: c.decaimentoOcorrenciaTipo,
    pesoResolvida: c.pesoResolvida,
    pesoComportamentoPositivo: c.pesoComportamentoPositivo,
    janelaPositivoDias: c.janelaPositivoDias,
    bonusPresencaConfirmada: c.bonusPresencaConfirmada,
  };
}

/** Carrega as configurações gerais da API e mantém em cache de sessão. */
async function carregarConfigSistema(): Promise<void> {
  if (cacheConfigSistema) return;
  try {
    const { configuracao } = await api<{ configuracao: ConfiguracaoSistema }>('/api/configuracoes');
    cacheConfigSistema = {
      critico: configuracao.limite_critico_faltas ?? 25,
      preventivo: configuracao.limite_preventivo_faltas ?? 10,
      pesoFalta: configuracao.peso_falta ?? 1,
      pesoOcorrencia: configuracao.peso_ocorrencia ?? 1,
      pesoRecencia: configuracao.peso_recencia ?? 1,
      janelaRecenciaDias: configuracao.janela_recencia_dias ?? 14,
      limiteScoreMedio: configuracao.limite_score_medio ?? 40,
      limiteScoreAlto: configuracao.limite_score_alto ?? 75,
      pesoOcorrenciaGrave: configuracao.peso_ocorrencia_grave ?? 15,
      forcarMedioEmGrave: configuracao.forcar_medio_em_grave ?? true,
      janelaOcorrenciaDias: configuracao.janela_ocorrencia_dias ?? 90,
      decaimentoOcorrenciaTipo:
        (configuracao.decaimento_ocorrencia_tipo as 'nenhum' | 'janela' | 'exponencial') ??
        'janela',
      pesoResolvida: configuracao.peso_resolvida ?? 0.5,
      pesoComportamentoPositivo: configuracao.peso_comportamento_positivo ?? 5,
      janelaPositivoDias: configuracao.janela_positivo_dias ?? 30,
      bonusPresencaConfirmada: configuracao.bonus_presenca_confirmada ?? 10,
      mensagemForaHorario:
        configuracao.mensagem_fora_horario ??
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
      pesoOcorrenciaGrave: 15,
      forcarMedioEmGrave: true,
      janelaOcorrenciaDias: 90,
      decaimentoOcorrenciaTipo: 'janela',
      pesoResolvida: 0.5,
      pesoComportamentoPositivo: 5,
      janelaPositivoDias: 30,
      bonusPresencaConfirmada: 10,
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
    tipo: ['grave'] as string[],
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
  useOpcoesConfiguracao().limparCache();
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

/** Iniciais do nome para o avatar do chat. */
function iniciaisDoNome(nome: string): string {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((p: string) => p[0])
    .join('')
    .toUpperCase();
}

export function useMonitoramento() {
  const carregando: Ref<boolean> = ref(false);
  const erro: Ref<string | null> = ref(null);

  async function buscarAlunosParaFrequencia(dataAula?: string): Promise<AlunoFrequencia[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const { alunos } = await api<{ alunos: Aluno[] }>('/api/alunos');
      const alunoIds = alunos.map((a) => a.id);

      const [{ enturmacoes }, ausencias] = await Promise.all([
        api<{ enturmacoes: EnturmacaoApi[] }>('/api/enturmacoes', {
          parametros: { status: 'matriculado' },
        }),
        dataAula && alunoIds.length
          ? api<{ frequencias: Frequencia[] }>('/api/frequencias', {
              parametros: {
                aluno_ids: alunoIds,
                data_aula: dataAula,
                tipo_registro: 'chamada_aula',
                status: 'ausente',
              },
            })
          : Promise.resolve({ frequencias: [] as Frequencia[] }),
      ]);

      const visiveis = new Set(alunoIds);
      const enturmacaoAlunoMap = new Map(
        enturmacoes.filter((e) => visiveis.has(e.aluno_id)).map((e) => [e.aluno_id, e]),
      );

      const ausentesSet = new Set<string>();
      const periodosAluno = new Map<string, string[]>();
      const observacoesAluno = new Map<string, string | null>();
      const motivosAluno = new Map<string, string[]>();

      for (const reg of ausencias.frequencias) {
        const id = reg.aluno_id;
        ausentesSet.add(id);
        if (!periodosAluno.has(id)) periodosAluno.set(id, []);
        periodosAluno.get(id)!.push(reg.periodo);
        observacoesAluno.set(id, reg.observacao);
        if (reg.motivos_ausencia?.length) {
          motivosAluno.set(id, reg.motivos_ausencia);
        }
      }

      return alunos.map((aluno) => {
        const ent = enturmacaoAlunoMap.get(aluno.id);
        return {
          id: aluno.id,
          nome: aluno.nome,
          matricula: aluno.matricula,
          turma: ent ? ent.turma.nome_completo : null,
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
    _professorId: string,
    dataAula: string,
    periodos: string[],
  ): Promise<{ registradas: number; erro: string | null }> {
    carregando.value = true;
    erro.value = null;
    try {
      const ausentes = alunos.filter((a) => a.ausente && a.turma_id);
      if (!ausentes.length || !periodos.length) {
        return { registradas: 0, erro: null };
      }

      // O lote é por turma: agrupa os ausentes para respeitar o vínculo aluno-turma.
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
    _professorId: string,
    dataAula: string,
    periodo: string,
    observacao?: string,
    motivos?: string[],
  ): Promise<boolean> {
    carregando.value = true;
    erro.value = null;
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
    _professorId: string,
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

      const [
        { alunos },
        { frequencias },
        { justificativas },
        { ocorrencias: ocorrenciasApi },
        { tags },
      ] = await Promise.all([
        api<{ alunos: Aluno[] }>('/api/alunos'),
        api<{ frequencias: Frequencia[] }>('/api/frequencias', {
          parametros: { status: 'ausente' },
        }),
        api<{ justificativas: JustificativaApi[] }>('/api/justificativas', {
          parametros: { status: 'aceita' },
        }),
        api<{ ocorrencias: OcorrenciaApi[] }>('/api/ocorrencias'),
        api<{ tags: TagComportamento[] }>('/api/tags-comportamento'),
      ]);

      // Justificativas aceitas para abater faltas do ranking.
      const justificadas = new Set<string>();
      for (const j of justificativas) {
        const fim = j.data_fim ?? j.data_falta;
        const inicio = new Date(j.data_falta + 'T00:00:00');
        const fimD = new Date(fim + 'T00:00:00');
        for (let d = new Date(inicio); d <= fimD; d.setDate(d.getDate() + 1)) {
          justificadas.add(`${j.aluno_id}:${d.toISOString().slice(0, 10)}`);
        }
      }

      // Mapa de peso por tag para cálculo ponderado.
      const pesoPorTag = new Map<string, { peso: number; categoria: string }>();
      for (const t of tags) {
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
        const ocos = ocorrenciasApi.filter((o) => o.aluno_id === aluno.id);

        const faltasRecentes = ausenciasInjust.filter((f) => f.data_aula >= janelaIso).length;
        const ultima = ausenciasInjust
          .map((f) => f.data_aula)
          .sort()
          .reverse()[0];
        const diasDesdeUltima = ultima ? diasEntre(ultima, hojeIso) : null;

        // Mapeia ocorrências para peso/categoria com suporte a decaimento e status.
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
          const diasDesdeCriacao = o.created_at
            ? diasEntre(o.created_at.slice(0, 10), hojeIso)
            : null;
          return {
            peso,
            exigePresenca: o.exige_presenca_responsavel,
            categoria,
            tipo: (o.tipo ?? []) as string[],
            status: o.status,
            diasDesdeCriacao,
            presencaConfirmada: o.presenca_responsavel_confirmada,
          };
        });

        const { nivel } = calcularTermometro(
          {
            faltasInjustificadas: ausenciasInjust.length,
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
          totalAusencias: ausenciasInjust.length,
          totalOcorrencias: ocos.length,
          nivel,
          ultimaAusencia: ultima ? formatarData(ultima) : undefined,
          exigePresencaResponsavel: ocos.some((o) => o.exige_presenca_responsavel),
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
      const [{ ocorrencias }, { alunos }] = await Promise.all([
        api<{ ocorrencias: OcorrenciaApi[] }>('/api/ocorrencias'),
        // A ocorrência traz apenas nome do aluno; a matrícula completa a listagem.
        api<{ alunos: Aluno[] }>('/api/alunos'),
      ]);

      return ocorrencias.map((oc) => {
        const aluno = alunos.find((a) => a.id === oc.aluno_id);
        return {
          id: oc.id,
          alunoNome: oc.aluno?.nome ?? aluno?.nome ?? 'Aluno não encontrado',
          alunoMatricula: aluno?.matricula ?? '—',
          turma: null,
          descricao: oc.descricao,
          tipo: oc.tipo,
          tags_comportamento: oc.tags_comportamento ?? [],
          notificar_coordenacao: oc.notificar_coordenacao,
          notificar_responsavel: oc.notificar_responsavel,
          data: formatarData(oc.created_at),
          professorNome: oc.professor?.nome,
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
      await api(`/api/ocorrencias/${ocorrenciaId}`, {
        metodo: 'PATCH',
        corpo: { exige_presenca_responsavel: novoValor },
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao alternar bloqueio de retorno:', msg);
      erro.value = 'Falha ao atualizar bloqueio de retorno.';
      return false;
    }
  }

  /** Atualiza o status da ocorrência para refletir a resolução pela gestão. */
  async function resolverOcorrencia(
    ocorrenciaId: string,
    novoStatus: 'resolvida' | 'arquivada' | 'aberta' | 'em_andamento',
  ): Promise<boolean> {
    try {
      // O fechamento (`closed_at`) é derivado do status pela própria API.
      await api(`/api/ocorrencias/${ocorrenciaId}`, {
        metodo: 'PATCH',
        corpo: { status: novoStatus },
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao resolver ocorrência:', msg);
      erro.value = 'Falha ao atualizar status da ocorrência.';
      return false;
    }
  }

  /** Confirma a presença do responsável, reduzindo o peso no termômetro. */
  async function confirmarPresencaResponsavel(ocorrenciaId: string): Promise<boolean> {
    try {
      await api(`/api/ocorrencias/${ocorrenciaId}`, {
        metodo: 'PATCH',
        corpo: { presenca_responsavel_confirmada: true },
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao confirmar presença:', msg);
      erro.value = 'Falha ao confirmar presença do responsável.';
      return false;
    }
  }

  async function buscarJustificativasPendentes(): Promise<JustificativaPendente[]> {
    carregando.value = true;
    erro.value = null;
    try {
      const { justificativas } = await api<{ justificativas: JustificativaApi[] }>(
        '/api/justificativas',
      );

      return justificativas.map((j) => {
        const anexo = j.anexos[0];
        return {
          id: j.id,
          alunoNome: j.aluno?.nome ?? 'Aluno não encontrado',
          responsavelNome: j.responsavel?.nome ?? 'Responsável não vinculado',
          dataAusencia: formatarData(j.data_falta),
          dataFim: j.data_fim ? formatarData(j.data_fim) : null,
          motivo: j.motivo,
          anexoPath: anexo?.storage_path,
          anexoNome: anexo?.nome_arquivo,
          anexoMime: anexo?.mime_type,
          anexoId: anexo?.id,
          status: j.status as JustificativaPendente['status'],
        };
      });
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
    _gestaoId?: string,
  ): Promise<boolean> {
    try {
      const status = acao === 'aceitar' ? 'aceita' : 'recusada';
      // O aceite dispara o trigger que marca as frequências do período como justificadas.
      await api(`/api/justificativas/${justificativaId}`, {
        metodo: 'PATCH',
        corpo: { status },
      });
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

  async function buscarFilhosDoResponsavel(_responsavelId: string): Promise<Aluno[]> {
    carregando.value = true;
    erro.value = null;
    try {
      // O escopo por papel já restringe a listagem aos filhos do responsável autenticado.
      const { alunos } = await api<{ alunos: Aluno[] }>('/api/alunos');
      return alunos;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar filhos do responsável:', msg);
      erro.value = 'Não foi possível carregar seus filhos vinculados.';
      return [];
    } finally {
      carregando.value = false;
    }
  }

  /** Busca faltas e ocorrências do aluno e calcula o Termômetro de Atenção. Faltas justificadas são desconsideradas; a tendência compara os últimos 30 dias com os 30 dias anteriores. */
  async function buscarTermometroAluno(
    alunoId: string,
    alunoNome: string,
    alunoTurma: string | null,
  ): Promise<TermometroAtencao> {
    await carregarConfigSistema();
    const cfg = obterConfigTermometro();
    try {
      const janelaPos = new Date();
      janelaPos.setDate(janelaPos.getDate() - cfg.janelaPositivoDias);
      const janelaPosIso = janelaPos.toISOString().slice(0, 10);

      const [
        { frequencias: todasFreqs },
        { justificativas: justs },
        { ocorrencias: ocosRaw },
        { tags },
        registros,
      ] = await Promise.all([
        api<{ frequencias: Frequencia[] }>('/api/frequencias', {
          parametros: { aluno_id: alunoId, status: 'ausente' },
        }),
        api<{ justificativas: JustificativaApi[] }>('/api/justificativas', {
          parametros: { aluno_id: alunoId, status: 'aceita' },
        }),
        api<{ ocorrencias: OcorrenciaApi[] }>('/api/ocorrencias', {
          parametros: { aluno_id: alunoId },
        }),
        api<{ tags: TagComportamento[] }>('/api/tags-comportamento'),
        api<{ registros: RegistroComportamentoApi[] }>('/api/registros-comportamento', {
          parametros: { aluno_id: alunoId, data_inicio: janelaPosIso },
        }),
      ]);

      // Faltas justificadas com status aceito não compõem o score e formam a base de ausências injustificadas.
      const datasJustificadas = new Set<string>();
      for (const j of justs) {
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

      // Recência considera faltas dentro da janela configurada e dias desde a última ocorrência.
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

      // Tendência compara o volume dos últimos 30 dias com os 30 dias anteriores.
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

      const totalOcorrencias = ocosRaw.length;

      // Consulta os pesos das tags para o cálculo ponderado das ocorrências.
      const pesoPorTag = new Map<string, { peso: number; categoria: string }>();
      for (const t of tags) {
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
        const diasDesdeCriacao = o.created_at
          ? diasEntre(o.created_at.slice(0, 10), hojeIso)
          : null;
        return {
          peso,
          exigePresenca: o.exige_presenca_responsavel,
          categoria,
          tipo: (o.tipo ?? []) as string[],
          status: o.status,
          diasDesdeCriacao,
          presencaConfirmada: o.presenca_responsavel_confirmada,
        };
      });

      // Conta comportamentos positivos recentes para desconto.
      const comportamentosPositivos = registros.registros.filter((r) =>
        r.tags.some((tag) => tag.categoria === 'positivo'),
      ).length;

      const { score, nivel, fatores } = calcularTermometro(
        {
          faltasInjustificadas: totalAusencias,
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

  async function buscarAlertasResponsavel(_responsavelId: string): Promise<AlertaResponsavel[]> {
    try {
      const filhos = await buscarFilhosDoResponsavel(_responsavelId);
      if (!filhos.length) return [];

      const alunoIds = filhos.map((f) => f.id);
      const [{ justificativas }, { frequencias }, { ocorrencias: ocorrenciasApi }] =
        await Promise.all([
          api<{ justificativas: JustificativaApi[] }>('/api/justificativas'),
          api<{ frequencias: Frequencia[] }>('/api/frequencias', {
            parametros: { aluno_ids: alunoIds, status: 'ausente' },
          }),
          api<{ ocorrencias: OcorrenciaApi[] }>('/api/ocorrencias'),
        ]);

      const visiveis = new Set(alunoIds);
      const justs = justificativas.filter((j) => visiveis.has(j.aluno_id));

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

      const anexoPorJustKey = new Map<
        string,
        { nome: string; storagePath: string; mimeType: string }
      >();
      for (const j of justs) {
        const a = j.anexos[0];
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
        const ausencias = frequencias.filter((f) => f.aluno_id === filho.id);
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

        const ocos = ocorrenciasApi.filter((o) => o.aluno_id === filho.id);
        for (const oc of ocos) {
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
    _responsavelId: string,
    dataInicio: string,
    dataFim: string | null,
    motivo: string,
    arquivo?: File | null,
  ): Promise<{ success: boolean; justificativaId: string | null }> {
    erro.value = null;
    let anexoId: string | null = null;
    try {
      // O anexo é criado antes da justificativa para entrar em `anexo_ids`.
      if (arquivo) {
        const { blob, mimeType } = await comprimirImagem(arquivo);
        const nome =
          mimeType === 'image/jpeg' && arquivo.type !== 'image/jpeg'
            ? arquivo.name.replace(/\.[^.]+$/, '.jpg')
            : arquivo.name;
        const { anexo } = await enviarArquivo<{ anexo: { id: string } }>('/api/anexos', blob, nome);
        anexoId = anexo.id;
      }

      const dataFimNormalized = dataFim && dataFim.trim() ? dataFim : null;
      const { justificativa } = await api<{ justificativa: { id: string } }>(
        '/api/justificativas',
        {
          metodo: 'POST',
          corpo: {
            aluno_id: alunoId,
            data_falta: dataInicio,
            data_fim: dataFimNormalized,
            motivo: motivo,
            ...(anexoId ? { anexo_ids: [anexoId] } : {}),
          },
        },
      );

      return { success: true, justificativaId: justificativa.id };
    } catch (e) {
      // Compensação: sem a justificativa o anexo recém-enviado não deve ficar órfão.
      if (anexoId) {
        await api(`/api/anexos/${anexoId}`, { metodo: 'DELETE' }).catch(() => undefined);
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao enviar justificativa:', msg);
      erro.value = 'Falha ao enviar justificativa. Tente novamente.';
      return { success: false, justificativaId: null };
    }
  }

  async function processarAnexoAsync(
    _justificativaId: string,
    _responsavelId: string,
    _arquivo: File,
  ): Promise<void> {
    // Otimização server-side descontinuada: o anexo sobe junto do envio da justificativa.
    await Promise.resolve();
  }

  async function criarOuObterConversa(
    responsavelId: string,
    alunoId: string,
    _turmaId: string,
    _opcoes: {
      mensagemSistemaDe?: string | null;
      textoSistema?: string;
      iniciadaPelaGestao?: boolean;
    } = {},
  ): Promise<string | null> {
    try {
      // A API resolve turma, mensagem de sistema e notificações ao criar a conversa.
      const { conversa } = await api<{ conversa: ConversaApi }>('/api/conversas', {
        metodo: 'POST',
        corpo: { aluno_id: alunoId, responsavel_id: responsavelId },
      });
      return conversa.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao criar/obter conversa:', msg);
      erro.value = 'Falha ao iniciar conversa.';
      return null;
    }
  }

  async function abrirConversaResponsavel(
    alunoId: string,
    _gestaoUserId?: string,
  ): Promise<string | null> {
    try {
      // A API escolhe o responsável de contato prioritário quando a gestão abre a conversa.
      const { conversa } = await api<{ conversa: ConversaApi }>('/api/conversas', {
        metodo: 'POST',
        corpo: { aluno_id: alunoId },
      });
      return conversa.id;
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
      const [{ conversas }, { mensagens: mensagensApi }] = await Promise.all([
        api<{ conversas: ConversaApi[] }>('/api/conversas'),
        api<{ mensagens: MensagemApi[] }>(`/api/conversas/${conversaId}/mensagens`),
      ]);

      const conv = conversas.find((c) => c.id === conversaId);
      if (!conv) return { contato: null, mensagens: [] };

      const mensagens: MensagemChat[] = mensagensApi.map((msg) => {
        const autor = msg.autor;
        const raw = msg.created_at;
        const d = safeDate(raw);
        return {
          id: msg.id,
          conversaId: msg.conversa_id,
          remetenteId: msg.remetente_id,
          autor: autor?.papel ?? 'gestao',
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
          ultimaMensagem: conv.ultima_mensagem?.conteudo ?? '',
          ultimaData: conv.ultima_mensagem
            ? safeDate(conv.ultima_mensagem.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              })
            : '',
          naoLidas: conv.nao_lidas,
          ativa: conv.ativa,
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
      const filhos = await buscarFilhosDoResponsavel(userId);
      if (!filhos.length) return [];

      const { conversas } = await api<{ conversas: ConversaApi[] }>('/api/conversas');
      const porAluno = new Map(conversas.map((c) => [c.aluno.id, c]));

      const contatos: ContatoChat[] = [];

      for (const aluno of filhos) {
        let conversa = porAluno.get(aluno.id);

        if (!conversa) {
          try {
            // Mantém o comportamento antigo de abrir o canal já na listagem de contatos.
            const resposta = await api<{ conversa: ConversaApi }>('/api/conversas', {
              metodo: 'POST',
              corpo: { aluno_id: aluno.id },
            });
            conversa = resposta.conversa;
          } catch {
            // Aluno sem enturmação ativa não possui canal de conversa.
            continue;
          }
        }

        const ultima = conversa.ultima_mensagem;
        contatos.push({
          conversaId: conversa.id,
          nomeContato: aluno.nome,
          subtitulo: 'Coordenação Escolar',
          avatarIniciais: iniciaisDoNome(aluno.nome),
          avatarCor: '',
          ultimaMensagem: ultima
            ? ultima.conteudo.replace(/\n/g, ' ').slice(0, 40)
            : 'Nenhuma mensagem ainda',
          ultimaData: ultima
            ? safeDate(ultima.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              })
            : '',
          naoLidas: conversa.nao_lidas,
          ativa: true,
          alunoId: aluno.id,
          turmaId: conversa.turma.id,
        });
      }

      return contatos;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar contatos do responsável:', msg);
      return [];
    }
  }

  async function buscarContatosGestao(_userId: string): Promise<ContatoChat[]> {
    try {
      const { conversas } = await api<{ conversas: ConversaApi[] }>('/api/conversas');

      return conversas.map((conv) => {
        const nomeResp = conv.responsavel?.nome ?? 'Responsável';
        const nomeAluno = conv.aluno?.nome ?? '';
        const nomeTurma = conv.turma?.nome_completo ?? '';
        const ultima = conv.ultima_mensagem;

        return {
          conversaId: conv.id,
          nomeContato: nomeResp,
          subtitulo: nomeAluno + (nomeTurma ? ' · ' + nomeTurma : ''),
          avatarIniciais: iniciaisDoNome(nomeResp),
          avatarCor: '',
          ultimaMensagem: ultima
            ? ultima.conteudo.replace(/\n/g, ' ').slice(0, 40)
            : 'Nenhuma mensagem ainda',
          ultimaData: ultima
            ? safeDate(ultima.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              })
            : '',
          naoLidas: conv.nao_lidas,
          ativa: conv.ativa,
          iniciadaPelaGestao: conv.iniciada_pela_gestao ?? false,
        };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao buscar contatos da equipe:', msg);
      return [];
    }
  }

  async function enviarMensagem(conversaId: string, conteudo: string): Promise<boolean> {
    try {
      await api(`/api/conversas/${conversaId}/mensagens`, {
        metodo: 'POST',
        corpo: { conteudo, client_request_id: crypto.randomUUID() },
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useMonitoramento] Erro ao enviar mensagem:', msg);
      erro.value = 'Falha ao enviar mensagem. Tente novamente.';
      return false;
    }
  }

  async function marcarMensagensComoLidas(conversaId: string, _userId: string): Promise<void> {
    try {
      await api(`/api/conversas/${conversaId}/lidas`, { metodo: 'PATCH' });
    } catch (e) {
      console.error('[useMonitoramento] Erro ao marcar mensagens como lidas:', e);
    }
  }

  async function ocultarConversa(conversaId: string): Promise<boolean> {
    try {
      await api(`/api/conversas/${conversaId}`, {
        metodo: 'PATCH',
        corpo: { ativa: false },
      });
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
      const { horarios } = await api<{ horarios: HorarioLetivo[] }>('/api/horarios');
      if (!horarios || horarios.length === 0) {
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
      const janelas = horarios.filter((h) => h.ativo);
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
    resolverOcorrencia,
    confirmarPresencaResponsavel,
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
