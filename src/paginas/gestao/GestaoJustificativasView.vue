<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { supabaseClient } from '@/servicos/supabase';
import FilaJustificativas from '@/componentes/FilaJustificativas.vue';
import type { JustificativaPendente } from '@/tipos/componentes';

const router = useRouter();
const { usuario } = useAutenticacao();
const { buscarJustificativasPendentes, validarJustificativa } = useMonitoramento();
const {
  ultimaAtualizacao,
  estaAtualizando,
  statusConexao,
  aoConectar,
  atualizar: refresh,
} = useRealtimeRefresh();

let canalJustificativas: ReturnType<typeof supabaseClient.channel>;

const justificativas = ref<JustificativaPendente[]>([]);
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

const justificativasPendentes = computed(() =>
  justificativas.value.filter((j) => j.status === 'pendente'),
);

function verAnexoJustificativa(justId: string) {
  const j = justificativas.value.find((x) => x.id === justId);
  if (j?.anexoUrl) {
    window.open(j.anexoUrl, '_blank', 'noopener');
  } else {
    mostrarErro('Anexo não disponível.');
  }
}

async function aceitarJustificativa(justId: string) {
  const ok = await validarJustificativa(justId, 'aceitar', usuario.value?.id);
  if (ok) {
    const j = justificativas.value.find((x) => x.id === justId);
    if (j) j.status = 'aceita';
    mostrarSucesso('Justificativa aceita. Frequências atualizadas.');
  } else {
    mostrarErro('Falha ao aceitar justificativa.');
  }
}

async function recusarJustificativa(justId: string) {
  const ok = await validarJustificativa(justId, 'recusar', usuario.value?.id);
  if (ok) {
    const j = justificativas.value.find((x) => x.id === justId);
    if (j) j.status = 'recusada';
    mostrarSucesso('Justificativa recusada.');
  } else {
    mostrarErro('Falha ao recusar justificativa.');
  }
}

async function processarJustificativas() {
  const j = await buscarJustificativasPendentes();
  justificativas.value = j;
}

async function atualizarManual() {
  await refresh(processarJustificativas);
}

onMounted(async () => {
  await processarJustificativas();
  canalJustificativas = supabaseClient
    .channel('justificativas-gestao')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'justificativas_faltas' }, () =>
      processarJustificativas(),
    )
    .subscribe(aoConectar(processarJustificativas));
});

onUnmounted(() => {
  if (canalJustificativas) supabaseClient.removeChannel(canalJustificativas);
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
        <i class="bi bi-clipboard-check text-info me-2" aria-hidden="true"></i>
        Validação de justificativas
      </h1>
      <div class="d-flex align-items-center gap-2">
        <span class="badge text-bg-warning">{{ justificativasPendentes.length }} pendente(s)</span>
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
        <span
          class="rounded-circle d-inline-block"
          :class="statusConexao === 'conectado' ? 'bg-success' : 'bg-danger'"
          style="width: 8px; height: 8px"
          :title="statusConexao === 'conectado' ? 'Conectado' : 'Desconectado'"
        ></span>
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
        <FilaJustificativas
          :justificativas="justificativas"
          @aceitar="aceitarJustificativa"
          @recusar="recusarJustificativa"
          @ver-anexo="verAnexoJustificativa"
        />
      </div>
    </div>
  </div>
</template>
