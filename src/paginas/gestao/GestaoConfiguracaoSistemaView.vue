<script setup lang="ts">
import { onMounted, ref } from 'vue';
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
    }
  } catch {
    mostrarErro('Falha ao carregar configurações.');
  } finally {
    carregando.value = false;
  }
}

async function salvar() {
  salvando.value = true;
  try {
    const { error } = await supabaseClient
      .from('configuracoes_sistema')
      .update({
        escola_nome: escolaNome.value.trim(),
        limite_critico_faltas: limiteCritico.value,
        limite_preventivo_faltas: limitePreventivo.value,
        dias_expurgo_anexos: diasExpurgo.value,
      })
      .eq('id', 1);
    if (error) throw error;
    mostrarSucesso('Configurações salvas.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mostrarErro(msg);
  } finally {
    salvando.value = false;
  }
}

onMounted(carregar);
</script>

<template>
  <div class="container py-4" style="max-width: 700px">
    <div class="d-flex align-items-center gap-2 mb-4 flex-wrap">
      <router-link to="/gestao" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1" aria-hidden="true"></i>
        Início
      </router-link>
      <router-link to="/gestao/configuracao" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
        Voltar
      </router-link>
      <h1 class="h4 fw-bold mb-0 ms-2">Configurações do Sistema</h1>
    </div>

    <div v-if="mensagemSucesso" class="alert alert-success alert-dismissible fade show">
      {{ mensagemSucesso }}
      <button type="button" class="btn-close" @click="mensagemSucesso = null"></button>
    </div>
    <div v-if="mensagemErro" class="alert alert-danger alert-dismissible fade show">
      {{ mensagemErro }}
      <button type="button" class="btn-close" @click="mensagemErro = null"></button>
    </div>

    <div v-if="carregando" class="text-center py-4">
      <div class="spinner-border text-success" role="status"></div>
    </div>

    <form v-else @submit.prevent="salvar" class="card">
      <div class="card-body">
        <CampoFormulario id="cfg-escola-nome" label="Nome da escola">
          <input id="cfg-escola-nome" v-model="escolaNome" type="text" class="form-control" :disabled="salvando" />
        </CampoFormulario>
        <CampoFormulario id="cfg-limite-critico" label="Limite crítico de faltas" dica="Acima deste valor, o aluno é classificado como risco alto.">
          <input id="cfg-limite-critico" v-model.number="limiteCritico" type="number" class="form-control" :disabled="salvando" />
        </CampoFormulario>
        <CampoFormulario id="cfg-limite-preventivo" label="Limite preventivo de faltas" dica="Acima deste valor, o aluno é classificado como risco médio.">
          <input id="cfg-limite-preventivo" v-model.number="limitePreventivo" type="number" class="form-control" :disabled="salvando" />
        </CampoFormulario>
        <CampoFormulario id="cfg-dias-expurgo" label="Dias para expurgo de anexos" dica="Anexos não processados são removidos após este período.">
          <input id="cfg-dias-expurgo" v-model.number="diasExpurgo" type="number" class="form-control" :disabled="salvando" />
        </CampoFormulario>
        <div class="d-flex justify-content-end mt-4">
          <button type="submit" class="btn btn-success" :disabled="salvando">
            <span v-if="salvando" class="spinner-border spinner-border-sm me-1"></span>
            Salvar alterações
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
