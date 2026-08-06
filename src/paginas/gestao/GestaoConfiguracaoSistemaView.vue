<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { supabaseClient } from '@/servicos/supabase';
import CampoFormulario from '@/componentes/CampoFormulario.vue';

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
  erros.value = err;
  return Object.keys(err).length === 0;
}

function mostrarSucesso(msg: string) {
  mensagemSucesso.value = msg;
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}
function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
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
    }
  } catch {
    mostrarErro('Falha ao carregar.');
  } finally {
    carregando.value = false;
  }
}

async function salvar() {
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
      })
      .eq('id', 1);
    if (error) throw error;
    mostrarSucesso('Configurações salvas.');
  } catch (e) {
    mostrarErro(e instanceof Error ? e.message : String(e));
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

    <form v-else @submit.prevent="salvar" class="card">
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
  </div>
</template>
