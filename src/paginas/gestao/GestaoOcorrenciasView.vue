<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import ListaOcorrencias from '@/componentes/ListaOcorrencias.vue';
import type { OcorrenciaGrave } from '@/tipos/componentes';

const router = useRouter();
const { buscarOcorrenciasGraves, alternarBloqueioRetorno } = useMonitoramento();
const { ultimaAtualizacao, estaAtualizando, atualizar: refresh } = useRealtimeRefresh();

const ocorrencias = ref<OcorrenciaGrave[]>([]);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

function mostrarSucesso(msg: string) {
  mensagemSucesso.value = msg;
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}

function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
}

async function alternarBloqueio(ocorrenciaId: string) {
  const oc = ocorrencias.value.find((o) => o.id === ocorrenciaId);
  if (!oc) return;
  const novoValor = !oc.exigePresencaResponsavel;
  const ok = await alternarBloqueioRetorno(ocorrenciaId, novoValor);
  if (ok) {
    oc.exigePresencaResponsavel = novoValor;
    oc.bloqueado = novoValor;
    mostrarSucesso(novoValor ? 'Retorno bloqueado.' : 'Retorno liberado.');
  } else {
    mostrarErro('Falha ao atualizar bloqueio.');
  }
}

function registrarSuspensao() {
  mostrarSucesso('Encaminhado para formalização de suspensão.');
}

async function carregarOcorrencias() {
  ocorrencias.value = await buscarOcorrenciasGraves();
}

async function atualizarManual() {
  await refresh(carregarOcorrencias);
}

onMounted(async () => {
  await carregarOcorrencias();
});
</script>

<template>
  <div class="container py-4" style="max-width: 960px">
    <router-link to="/gestao" class="btn btn-sm btn-outline-success me-2 mb-3">
      <i class="bi bi-house me-1" aria-hidden="true"></i>
      Início
    </router-link>
    <button type="button" class="btn btn-sm btn-outline-secondary mb-3" @click="router.back()">
      <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
      Voltar
    </button>

    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h1 class="h5 fw-bold mb-0">
        <i class="bi bi-shield-exclamation text-danger me-2" aria-hidden="true"></i>
        Ocorrências graves e suspensões
      </h1>
      <div class="d-flex align-items-center gap-2">
        <span class="badge text-bg-secondary">{{ ocorrencias.length }} registro(s)</span>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="estaAtualizando"
          @click="atualizarManual"
          title="Recarregar dados"
        >
          <span
            v-if="estaAtualizando"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          ></span>
          <i v-else class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
          Atualizar
        </button>
        <span class="rounded-circle d-inline-block" style="width: 8px; height: 8px"></span>
      </div>
    </div>

    <div v-if="ultimaAtualizacao" class="small text-body-tertiary mb-2 text-end">
      <i class="bi bi-clock me-1" aria-hidden="true"></i>
      Última atualização: {{ ultimaAtualizacao.toLocaleTimeString('pt-BR') }}
    </div>

    <div v-if="mensagemSucesso" class="alert alert-success py-2 small mb-3" role="status">
      <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
      {{ mensagemSucesso }}
    </div>
    <div v-if="mensagemErro" class="alert alert-danger py-2 small mb-3" role="alert">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
      {{ mensagemErro }}
    </div>

    <div class="card border">
      <div class="card-body p-0">
        <ListaOcorrencias
          :ocorrencias="ocorrencias"
          @bloquear-retorno="alternarBloqueio"
          @registrar-suspensao="registrarSuspensao"
        />
      </div>
    </div>
  </div>
</template>
