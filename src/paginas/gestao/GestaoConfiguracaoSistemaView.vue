<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { supabaseClient } from '@/servicos/supabase';
import { mensagemSucesso as msgSucesso, mensagemErroExplicita } from '@/utils/mensagemExplicita';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import ModalConfirmacao from '@/componentes/ModalConfirmacao.vue';

const carregando = ref(false);
const salvando = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const escolaNome = ref('');
const limiteCritico = ref(25);
const limitePreventivo = ref(10);
const diasExpurgo = ref(30);
const mensagemForaHorario = ref('');
const minutosValidadeCodigo = ref(60);
const maxTentativasCodigo = ref(5);
const minutosBloqueioCodigo = ref(15);
const diasRetencaoCodigos = ref(30);
const pesoFalta = ref(1);
const pesoOcorrencia = ref(1);
const pesoRecencia = ref(1);
const janelaRecenciaDias = ref(14);
const limiteScoreMedio = ref(40);
const limiteScoreAlto = ref(75);
const pesoOcorrenciaGrave = ref(15);
const forcarMedioEmGrave = ref(true);
const janelaOcorrenciaDias = ref(90);
const decaimentoOcorrenciaTipo = ref('janela');
const pesoResolvida = ref(0.5);
const pesoComportamentoPositivo = ref(5);
const janelaPositivoDias = ref(30);
const bonusPresencaConfirmada = ref(10);

const confirmarSalvar = ref(false);

const erros = ref<Record<string, string | null>>({});

const podeSalvar = computed(() => {
  if (!escolaNome.value.trim()) return false;
  if (limiteCritico.value < 1 || limitePreventivo.value < 1) return false;
  if (diasExpurgo.value < 1) return false;
  if (limitePreventivo.value >= limiteCritico.value) return false;
  if (minutosValidadeCodigo.value < 1) return false;
  if (maxTentativasCodigo.value < 1) return false;
  if (minutosBloqueioCodigo.value < 1) return false;
  if (diasRetencaoCodigos.value < 1) return false;
  if (pesoFalta.value < 0.5 || pesoFalta.value > 2) return false;
  if (pesoOcorrencia.value < 0.5 || pesoOcorrencia.value > 2) return false;
  if (pesoRecencia.value < 0 || pesoRecencia.value > 2) return false;
  if (janelaRecenciaDias.value < 7 || janelaRecenciaDias.value > 30) return false;
  if (limiteScoreMedio.value < 20 || limiteScoreMedio.value > 60) return false;
  if (limiteScoreAlto.value < 60 || limiteScoreAlto.value > 90) return false;
  if (limiteScoreMedio.value >= limiteScoreAlto.value) return false;
  if (pesoOcorrenciaGrave.value < 5 || pesoOcorrenciaGrave.value > 30) return false;
  if (janelaOcorrenciaDias.value < 30 || janelaOcorrenciaDias.value > 365) return false;
  if (!['nenhum', 'janela', 'exponencial'].includes(decaimentoOcorrenciaTipo.value)) return false;
  if (pesoResolvida.value < 0 || pesoResolvida.value > 1) return false;
  if (pesoComportamentoPositivo.value < 0 || pesoComportamentoPositivo.value > 15) return false;
  if (janelaPositivoDias.value < 7 || janelaPositivoDias.value > 90) return false;
  if (bonusPresencaConfirmada.value < 0 || bonusPresencaConfirmada.value > 30) return false;
  return true;
});

function validar() {
  const err: Record<string, string | null> = {};
  if (!escolaNome.value.trim()) err.escolaNome = 'O nome da escola é obrigatório.';
  if (limiteCritico.value < 1) err.limiteCritico = 'Deve ser um número positivo.';
  if (limitePreventivo.value < 1) err.limitePreventivo = 'Deve ser um número positivo.';
  if (diasExpurgo.value < 1) err.diasExpurgo = 'Deve ser pelo menos 1 dia.';
  if (
    limitePreventivo.value >= limiteCritico.value &&
    limiteCritico.value >= 1 &&
    limitePreventivo.value >= 1
  ) {
    err.limitePreventivo = `Deve ser menor que o limite crítico (${limiteCritico.value}).`;
  }
  if (mensagemForaHorario.value.length > 500) err.mensagemForaHorario = 'Máximo de 500 caracteres.';
  if (minutosValidadeCodigo.value < 1) err.minutosValidadeCodigo = 'Deve ser um número positivo.';
  if (maxTentativasCodigo.value < 1) err.maxTentativasCodigo = 'Deve ser um número positivo.';
  if (minutosBloqueioCodigo.value < 1) err.minutosBloqueioCodigo = 'Deve ser um número positivo.';
  if (diasRetencaoCodigos.value < 1) err.diasRetencaoCodigos = 'Deve ser pelo menos 1 dia.';
  if (pesoFalta.value < 0.5 || pesoFalta.value > 2) err.pesoFalta = 'Entre 0,5 e 2,0.';
  if (pesoOcorrencia.value < 0.5 || pesoOcorrencia.value > 2)
    err.pesoOcorrencia = 'Entre 0,5 e 2,0.';
  if (pesoRecencia.value < 0 || pesoRecencia.value > 2) err.pesoRecencia = 'Entre 0 e 2,0.';
  if (janelaRecenciaDias.value < 7 || janelaRecenciaDias.value > 30)
    err.janelaRecenciaDias = 'Entre 7 e 30 dias.';
  if (limiteScoreMedio.value < 20 || limiteScoreMedio.value > 60)
    err.limiteScoreMedio = 'Entre 20 e 60.';
  if (limiteScoreAlto.value < 60 || limiteScoreAlto.value > 90)
    err.limiteScoreAlto = 'Entre 60 e 90.';
  if (
    limiteScoreMedio.value >= limiteScoreAlto.value &&
    limiteScoreMedio.value >= 20 &&
    limiteScoreAlto.value >= 60
  ) {
    err.limiteScoreMedio = `Deve ser menor que o limite alto (${limiteScoreAlto.value}).`;
  }
  if (pesoOcorrenciaGrave.value < 5 || pesoOcorrenciaGrave.value > 30)
    err.pesoOcorrenciaGrave = 'Entre 5 e 30.';
  if (janelaOcorrenciaDias.value < 30 || janelaOcorrenciaDias.value > 365)
    err.janelaOcorrenciaDias = 'Entre 30 e 365 dias.';
  if (pesoResolvida.value < 0 || pesoResolvida.value > 1) err.pesoResolvida = 'Entre 0 e 1.';
  if (pesoComportamentoPositivo.value < 0 || pesoComportamentoPositivo.value > 15)
    err.pesoComportamentoPositivo = 'Entre 0 e 15.';
  if (janelaPositivoDias.value < 7 || janelaPositivoDias.value > 90)
    err.janelaPositivoDias = 'Entre 7 e 90 dias.';
  if (bonusPresencaConfirmada.value < 0 || bonusPresencaConfirmada.value > 30)
    err.bonusPresencaConfirmada = 'Entre 0 e 30.';
  erros.value = err;
  return Object.keys(err).length === 0;
}

let timerSucesso: ReturnType<typeof setTimeout> | null = null;
let timerErro: ReturnType<typeof setTimeout> | null = null;

function mostrarSucesso(msg: string) {
  if (timerSucesso) clearTimeout(timerSucesso);
  mensagemSucesso.value = msg;
  timerSucesso = setTimeout(() => (mensagemSucesso.value = null), 6000);
}
function mostrarErro(msg: string) {
  if (timerErro) clearTimeout(timerErro);
  mensagemErro.value = msg;
  timerErro = setTimeout(() => (mensagemErro.value = null), 6000);
}

async function carregar() {
  carregando.value = true;
  try {
    const { data } = await supabaseClient.from('configuracoes_sistema').select('*').single();
    if (data) {
      escolaNome.value = data.escola_nome;
      limiteCritico.value = data.limite_critico_faltas;
      limitePreventivo.value = data.limite_preventivo_faltas;
      diasExpurgo.value = data.dias_expurgo_anexos;
      mensagemForaHorario.value = data.mensagem_fora_horario ?? '';
      minutosValidadeCodigo.value = data.minutos_validade_codigo ?? 60;
      maxTentativasCodigo.value = data.max_tentativas_codigo ?? 5;
      minutosBloqueioCodigo.value = data.minutos_bloqueio_codigo ?? 15;
      diasRetencaoCodigos.value = data.dias_retencao_codigos ?? 30;
      pesoFalta.value = (data as unknown as { peso_falta?: number }).peso_falta ?? 1;
      pesoOcorrencia.value = (data as unknown as { peso_ocorrencia?: number }).peso_ocorrencia ?? 1;
      pesoRecencia.value = (data as unknown as { peso_recencia?: number }).peso_recencia ?? 1;
      janelaRecenciaDias.value =
        (data as unknown as { janela_recencia_dias?: number }).janela_recencia_dias ?? 14;
      limiteScoreMedio.value =
        (data as unknown as { limite_score_medio?: number }).limite_score_medio ?? 40;
      limiteScoreAlto.value =
        (data as unknown as { limite_score_alto?: number }).limite_score_alto ?? 75;
      pesoOcorrenciaGrave.value =
        (data as unknown as { peso_ocorrencia_grave?: number }).peso_ocorrencia_grave ?? 15;
      forcarMedioEmGrave.value =
        (data as unknown as { forcar_medio_em_grave?: boolean }).forcar_medio_em_grave ?? true;
      janelaOcorrenciaDias.value =
        (data as unknown as { janela_ocorrencia_dias?: number }).janela_ocorrencia_dias ?? 90;
      decaimentoOcorrenciaTipo.value =
        (data as unknown as { decaimento_ocorrencia_tipo?: string }).decaimento_ocorrencia_tipo ??
        'janela';
      pesoResolvida.value = (data as unknown as { peso_resolvida?: number }).peso_resolvida ?? 0.5;
      pesoComportamentoPositivo.value =
        (data as unknown as { peso_comportamento_positivo?: number }).peso_comportamento_positivo ??
        5;
      janelaPositivoDias.value =
        (data as unknown as { janela_positivo_dias?: number }).janela_positivo_dias ?? 30;
      bonusPresencaConfirmada.value =
        (data as unknown as { bonus_presenca_confirmada?: number }).bonus_presenca_confirmada ?? 10;
    }
  } catch {
    mostrarErro('Falha ao carregar.');
  } finally {
    carregando.value = false;
  }
}

function solicitarSalvar() {
  if (!validar()) return;
  confirmarSalvar.value = true;
}

async function salvar() {
  confirmarSalvar.value = false;
  if (!validar()) return;
  salvando.value = true;
  try {
    const { error } = await supabaseClient
      .from('configuracoes_sistema')
      .update({
        escola_nome: escolaNome.value.trim(),
        limite_critico_faltas: limiteCritico.value,
        limite_preventivo_faltas: limitePreventivo.value,
        dias_expurgo_anexos: diasExpurgo.value,
        mensagem_fora_horario: mensagemForaHorario.value.trim(),
        minutos_validade_codigo: minutosValidadeCodigo.value,
        max_tentativas_codigo: maxTentativasCodigo.value,
        minutos_bloqueio_codigo: minutosBloqueioCodigo.value,
        dias_retencao_codigos: diasRetencaoCodigos.value,
        peso_falta: pesoFalta.value,
        peso_ocorrencia: pesoOcorrencia.value,
        peso_recencia: pesoRecencia.value,
        janela_recencia_dias: janelaRecenciaDias.value,
        limite_score_medio: limiteScoreMedio.value,
        limite_score_alto: limiteScoreAlto.value,
        peso_ocorrencia_grave: pesoOcorrenciaGrave.value,
        forcar_medio_em_grave: forcarMedioEmGrave.value,
        janela_ocorrencia_dias: janelaOcorrenciaDias.value,
        decaimento_ocorrencia_tipo: decaimentoOcorrenciaTipo.value,
        peso_resolvida: pesoResolvida.value,
        peso_comportamento_positivo: pesoComportamentoPositivo.value,
        janela_positivo_dias: janelaPositivoDias.value,
        bonus_presenca_confirmada: bonusPresencaConfirmada.value,
      })
      .eq('id', 1);
    if (error) throw error;
    mostrarSucesso(msgSucesso('Configurações do sistema', escolaNome.value || 'gerais', 'salva'));
  } catch (e) {
    mostrarErro(
      mensagemErroExplicita('Configurações do sistema', escolaNome.value || 'gerais', 'salvar', e),
    );
  } finally {
    salvando.value = false;
  }
}

onMounted(carregar);
</script>

<template>
  <div class="container py-4" style="max-width: 700px">
    <div class="d-flex gap-2 mb-3">
      <router-link to="/gestao" class="btn btn-sm btn-outline-success"
        ><i class="bi bi-house me-1"></i> Início</router-link
      >
      <router-link to="/gestao/configuracao" class="btn btn-sm btn-outline-secondary"
        ><i class="bi bi-arrow-left me-1"></i> Voltar</router-link
      >
    </div>
    <div class="d-flex align-items-center gap-2 mb-4 flex-wrap">
      <h1 class="h4 fw-bold mb-0">Configurações do Sistema</h1>
    </div>

    <div v-if="mensagemSucesso" class="alert alert-success alert-dismissible fade show">
      {{ mensagemSucesso
      }}<button type="button" class="btn-close" @click="mensagemSucesso = null"></button>
    </div>
    <div v-if="mensagemErro" class="alert alert-danger alert-dismissible fade show">
      {{ mensagemErro
      }}<button type="button" class="btn-close" @click="mensagemErro = null"></button>
    </div>

    <div v-if="carregando" class="text-center py-4">
      <div class="spinner-border text-success"></div>
    </div>

    <form v-else @submit.prevent="solicitarSalvar" class="card">
      <div class="card-body">
        <CampoFormulario id="cfg-nome" label="Nome da escola" :erro="erros.escolaNome">
          <input
            id="cfg-nome"
            v-model="escolaNome"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': erros.escolaNome }"
            :disabled="salvando"
            maxlength="100"
            @input="validar"
          />
        </CampoFormulario>

        <div class="row g-3">
          <div class="col-md-6">
            <CampoFormulario
              id="cfg-preventivo"
              label="Alertas de atenção a partir de"
              :erro="erros.limitePreventivo"
            >
              <div class="input-group">
                <input
                  id="cfg-preventivo"
                  v-model.number="limitePreventivo"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.limitePreventivo }"
                  :disabled="salvando"
                  min="1"
                  @input="validar"
                />
                <span class="input-group-text">faltas</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-6">
            <CampoFormulario
              id="cfg-critico"
              label="Alertas críticos a partir de"
              :erro="erros.limiteCritico"
            >
              <div class="input-group">
                <input
                  id="cfg-critico"
                  v-model.number="limiteCritico"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.limiteCritico }"
                  :disabled="salvando"
                  min="1"
                  @input="validar"
                />
                <span class="input-group-text">faltas</span>
              </div>
            </CampoFormulario>
          </div>
        </div>

        <CampoFormulario
          id="cfg-expurgo"
          label="Excluir anexos não processados após"
          :erro="erros.diasExpurgo"
        >
          <div class="input-group">
            <input
              id="cfg-expurgo"
              v-model.number="diasExpurgo"
              type="number"
              class="form-control"
              :class="{ 'is-invalid': erros.diasExpurgo }"
              :disabled="salvando"
              min="1"
              @input="validar"
            />
            <span class="input-group-text">dias</span>
          </div>
        </CampoFormulario>

        <CampoFormulario
          id="cfg-msg-fora"
          label="Mensagem exibida fora do horário do chat"
          :erro="erros.mensagemForaHorario"
          dica="Texto exibido para responsáveis quando tentam enviar mensagem fora do horário letivo. Máx. 500 caracteres."
        >
          <textarea
            id="cfg-msg-fora"
            v-model="mensagemForaHorario"
            class="form-control"
            :class="{ 'is-invalid': erros.mensagemForaHorario }"
            :disabled="salvando"
            rows="3"
            maxlength="500"
            @input="validar"
          ></textarea>
          <small class="text-body-secondary text-end d-block"
            >{{ mensagemForaHorario.length }}/500</small
          >
        </CampoFormulario>

        <h2 class="h6 fw-bold mt-4 mb-2">Termômetro de atenção — pesos e limites</h2>
        <p class="small text-body-secondary">
          Ajuste fino do cálculo inteligente. A barra preenche até o score e muda de cor
          (verde/amarelo/vermelho) conforme os limiares.
        </p>

        <!-- Prévia da barra móvel -->
        <div class="card bg-body-tertiary border mb-3">
          <div class="card-body py-3">
            <div class="small fw-semibold mb-2">Prévia da barra</div>
            <div class="d-flex gap-2 mb-2">
              <button
                v-for="ex in [20, 50, 85]"
                :key="ex"
                type="button"
                class="btn btn-sm py-0 px-2"
                :class="
                  ex < limiteScoreMedio
                    ? 'btn-success'
                    : ex < limiteScoreAlto
                      ? 'btn-warning'
                      : 'btn-danger'
                "
                style="font-size: 0.75rem"
                :aria-label="'Exemplo score ' + ex"
              >
                {{ ex }}
              </button>
              <span class="small text-body-secondary align-self-center ms-1"
                >exemplos de score</span
              >
            </div>
            <div class="d-flex flex-column gap-2">
              <div
                v-for="ex in [20, 50, 85]"
                :key="'bar-' + ex"
                class="progress position-relative bg-white rounded-pill overflow-hidden"
                style="height: 14px"
              >
                <div
                  class="progress-bar rounded-pill"
                  :class="
                    ex < limiteScoreMedio
                      ? 'bg-success'
                      : ex < limiteScoreAlto
                        ? 'bg-warning'
                        : 'bg-danger'
                  "
                  :style="{ width: ex + '%' }"
                ></div>
                <span
                  class="position-absolute top-0 bottom-0"
                  :style="{
                    left: limiteScoreMedio + '%',
                    width: '2px',
                    background: 'rgba(0,0,0,0.15)',
                    transform: 'translateX(-50%)',
                  }"
                  aria-hidden="true"
                ></span>
                <span
                  class="position-absolute top-0 bottom-0"
                  :style="{
                    left: limiteScoreAlto + '%',
                    width: '2px',
                    background: 'rgba(0,0,0,0.15)',
                    transform: 'translateX(-50%)',
                  }"
                  aria-hidden="true"
                ></span>
              </div>
            </div>
            <div class="d-flex justify-content-between small text-body-secondary mt-1">
              <span>0</span><span>{{ limiteScoreMedio }}</span
              ><span>{{ limiteScoreAlto }}</span
              ><span>100</span>
            </div>
            <div class="small text-body-secondary mt-1">
              Verde 0–{{ limiteScoreMedio - 1 }} · Amarelo {{ limiteScoreMedio }}–{{
                limiteScoreAlto - 1
              }}
              · Vermelho ≥{{ limiteScoreAlto }} — a barra assume a cor do nível.
            </div>
          </div>
        </div>

        <div class="row g-3">
          <div class="col-md-4">
            <CampoFormulario id="cfg-peso-falta" label="Peso das faltas" :erro="erros.pesoFalta">
              <div class="input-group">
                <input
                  id="cfg-peso-falta"
                  v-model.number="pesoFalta"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.pesoFalta }"
                  :disabled="salvando"
                  min="0.5"
                  max="2"
                  step="0.1"
                  @input="validar"
                />
                <span class="input-group-text">×</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-peso-oco"
              label="Peso das ocorrências"
              :erro="erros.pesoOcorrencia"
            >
              <div class="input-group">
                <input
                  id="cfg-peso-oco"
                  v-model.number="pesoOcorrencia"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.pesoOcorrencia }"
                  :disabled="salvando"
                  min="0.5"
                  max="2"
                  step="0.1"
                  @input="validar"
                />
                <span class="input-group-text">×</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-peso-recencia"
              label="Peso da recência"
              :erro="erros.pesoRecencia"
            >
              <div class="input-group">
                <input
                  id="cfg-peso-recencia"
                  v-model.number="pesoRecencia"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.pesoRecencia }"
                  :disabled="salvando"
                  min="0"
                  max="2"
                  step="0.1"
                  @input="validar"
                />
                <span class="input-group-text">×</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-janela"
              label="Janela de recência"
              :erro="erros.janelaRecenciaDias"
            >
              <div class="input-group">
                <input
                  id="cfg-janela"
                  v-model.number="janelaRecenciaDias"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.janelaRecenciaDias }"
                  :disabled="salvando"
                  min="7"
                  max="30"
                  @input="validar"
                />
                <span class="input-group-text">dias</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-limite-medio"
              label="Score médio a partir de"
              :erro="erros.limiteScoreMedio"
            >
              <div class="input-group">
                <input
                  id="cfg-limite-medio"
                  v-model.number="limiteScoreMedio"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.limiteScoreMedio }"
                  :disabled="salvando"
                  min="20"
                  max="60"
                  @input="validar"
                />
                <span class="input-group-text">pts</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-limite-alto"
              label="Score alto a partir de"
              :erro="erros.limiteScoreAlto"
            >
              <div class="input-group">
                <input
                  id="cfg-limite-alto"
                  v-model.number="limiteScoreAlto"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.limiteScoreAlto }"
                  :disabled="salvando"
                  min="60"
                  max="90"
                  @input="validar"
                />
                <span class="input-group-text">pts</span>
              </div>
            </CampoFormulario>
          </div>
        </div>

        <h2 class="h6 fw-bold mt-4 mb-2">Ocorrências e recuperação</h2>
        <p class="small text-body-secondary">
          Configuração de como ocorrências elevam o termômetro e como o aluno pode melhorar.
        </p>
        <div class="row g-3">
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-peso-grave"
              label="Peso de grave sem tag"
              :erro="erros.pesoOcorrenciaGrave"
              dica="Pontos de uma ocorrência grave sem tags críticas."
            >
              <div class="input-group">
                <input
                  id="cfg-peso-grave"
                  v-model.number="pesoOcorrenciaGrave"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.pesoOcorrenciaGrave }"
                  :disabled="salvando"
                  min="5"
                  max="30"
                  step="1"
                  @input="validar"
                />
                <span class="input-group-text">pts</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-4 d-flex align-items-end pb-2">
            <div class="form-check">
              <input
                id="cfg-forcar-medio"
                v-model="forcarMedioEmGrave"
                type="checkbox"
                class="form-check-input"
                :disabled="salvando"
              />
              <label for="cfg-forcar-medio" class="form-check-label small"
                >Grave força no mínimo Atenção</label
              >
            </div>
          </div>
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-janela-ocorrencia"
              label="Janela de ocorrência"
              :erro="erros.janelaOcorrenciaDias"
            >
              <div class="input-group">
                <input
                  id="cfg-janela-ocorrencia"
                  v-model.number="janelaOcorrenciaDias"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.janelaOcorrenciaDias }"
                  :disabled="salvando"
                  min="30"
                  max="365"
                  @input="validar"
                />
                <span class="input-group-text">dias</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-4">
            <CampoFormulario id="cfg-decaimento" label="Decaimento de ocorrência">
              <select
                id="cfg-decaimento"
                v-model="decaimentoOcorrenciaTipo"
                class="form-select"
                :disabled="salvando"
              >
                <option value="nenhum">Nenhum</option>
                <option value="janela">Janela fixa</option>
                <option value="exponencial">Exponencial</option>
              </select>
            </CampoFormulario>
          </div>
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-peso-resolvida"
              label="Peso de resolvida"
              :erro="erros.pesoResolvida"
              dica="Multiplicador quando resolvida/arquivada."
            >
              <div class="input-group">
                <input
                  id="cfg-peso-resolvida"
                  v-model.number="pesoResolvida"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.pesoResolvida }"
                  :disabled="salvando"
                  min="0"
                  max="1"
                  step="0.1"
                  @input="validar"
                />
                <span class="input-group-text">×</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-bonus-presenca"
              label="Bônus presença confirmada"
              :erro="erros.bonusPresencaConfirmada"
            >
              <div class="input-group">
                <input
                  id="cfg-bonus-presenca"
                  v-model.number="bonusPresencaConfirmada"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.bonusPresencaConfirmada }"
                  :disabled="salvando"
                  min="0"
                  max="30"
                  step="1"
                  @input="validar"
                />
                <span class="input-group-text">pts</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-peso-positivo"
              label="Desconto positivo máx."
              :erro="erros.pesoComportamentoPositivo"
            >
              <div class="input-group">
                <input
                  id="cfg-peso-positivo"
                  v-model.number="pesoComportamentoPositivo"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.pesoComportamentoPositivo }"
                  :disabled="salvando"
                  min="0"
                  max="15"
                  step="1"
                  @input="validar"
                />
                <span class="input-group-text">pts</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-4">
            <CampoFormulario
              id="cfg-janela-positivo"
              label="Janela positivo"
              :erro="erros.janelaPositivoDias"
            >
              <div class="input-group">
                <input
                  id="cfg-janela-positivo"
                  v-model.number="janelaPositivoDias"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.janelaPositivoDias }"
                  :disabled="salvando"
                  min="7"
                  max="90"
                  @input="validar"
                />
                <span class="input-group-text">dias</span>
              </div>
            </CampoFormulario>
          </div>
        </div>

        <h2 class="h6 fw-bold mt-4 mb-2">Códigos de acesso</h2>

        <div class="row g-3">
          <div class="col-md-6">
            <CampoFormulario
              id="cfg-validade-codigo"
              label="Validade do código"
              :erro="erros.minutosValidadeCodigo"
            >
              <div class="input-group">
                <input
                  id="cfg-validade-codigo"
                  v-model.number="minutosValidadeCodigo"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.minutosValidadeCodigo }"
                  :disabled="salvando"
                  min="1"
                  @input="validar"
                />
                <span class="input-group-text">minutos</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-6">
            <CampoFormulario
              id="cfg-max-tentativas"
              label="Tentativas antes de bloquear"
              :erro="erros.maxTentativasCodigo"
            >
              <div class="input-group">
                <input
                  id="cfg-max-tentativas"
                  v-model.number="maxTentativasCodigo"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.maxTentativasCodigo }"
                  :disabled="salvando"
                  min="1"
                  @input="validar"
                />
                <span class="input-group-text">tentativas</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-6">
            <CampoFormulario
              id="cfg-bloqueio"
              label="Duração do bloqueio"
              :erro="erros.minutosBloqueioCodigo"
            >
              <div class="input-group">
                <input
                  id="cfg-bloqueio"
                  v-model.number="minutosBloqueioCodigo"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.minutosBloqueioCodigo }"
                  :disabled="salvando"
                  min="1"
                  @input="validar"
                />
                <span class="input-group-text">minutos</span>
              </div>
            </CampoFormulario>
          </div>
          <div class="col-md-6">
            <CampoFormulario
              id="cfg-retencao"
              label="Limpar códigos antigos após"
              :erro="erros.diasRetencaoCodigos"
            >
              <div class="input-group">
                <input
                  id="cfg-retencao"
                  v-model.number="diasRetencaoCodigos"
                  type="number"
                  class="form-control"
                  :class="{ 'is-invalid': erros.diasRetencaoCodigos }"
                  :disabled="salvando"
                  min="1"
                  @input="validar"
                />
                <span class="input-group-text">dias</span>
              </div>
            </CampoFormulario>
          </div>
        </div>

        <div class="d-flex justify-content-end mt-4">
          <button type="submit" class="btn btn-success" :disabled="!podeSalvar || salvando">
            <span v-if="salvando" class="spinner-border spinner-border-sm me-1"></span> Salvar
            alterações
          </button>
        </div>
      </div>
    </form>
    <ModalConfirmacao
      :visivel="confirmarSalvar"
      titulo="Salvar configurações"
      mensagem="Deseja salvar as alterações nas configurações do sistema? Isso afetará o cálculo do termômetro."
      rotulo-confirmar="Salvar"
      icone="gear"
      variante="warning"
      @confirmar="salvar"
      @cancelar="confirmarSalvar = false"
    />
  </div>
</template>
