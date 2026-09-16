<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  useJustificativasPendentes,
  validarJustificativa,
} from '@/composables/consultas/useMonitoramento';
import FilaJustificativas from '@/componentes/FilaJustificativas.vue';
import VisualizadorAnexo from '@/componentes/VisualizadorAnexo.vue';

const router = useRouter();
const { justificativas, pendente, atualizando, recarregar } = useJustificativasPendentes();

const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);
const anexoSelecionado = ref<{ id: string; nome: string; mime?: string } | null>(null);

function mostrarSucesso(msg: string) {
  mensagemSucesso.value = msg;
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}

function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
}

const justificativasPendentes = computed(() =>
  justificativas.value.filter((justificativa) => justificativa.status === 'pendente'),
);

function verAnexoJustificativa(justId: string) {
  const justificativa = justificativas.value.find((registro) => registro.id === justId);
  if (justificativa?.anexoId) {
    anexoSelecionado.value = {
      id: justificativa.anexoId,
      nome: justificativa.anexoNome ?? 'anexo',
      mime: justificativa.anexoMime,
    };
  } else {
    mostrarErro('Anexo não disponível.');
  }
}

async function aceitarJustificativa(justId: string) {
  const ok = await validarJustificativa(justId, 'aceitar');
  if (ok) {
    mostrarSucesso('Justificativa aceita. Frequências atualizadas.');
    await recarregar();
  } else {
    mostrarErro('Falha ao aceitar justificativa.');
  }
}

async function recusarJustificativa(justId: string) {
  const ok = await validarJustificativa(justId, 'recusar');
  if (ok) {
    mostrarSucesso('Justificativa recusada.');
    await recarregar();
  } else {
    mostrarErro('Falha ao recusar justificativa.');
  }
}
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
          :disabled="atualizando"
          @click="recarregar"
          title="Recarregar dados"
        >
          <span
            v-if="atualizando"
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
        <div v-if="pendente" class="text-center py-5" aria-busy="true">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Carregando justificativas</span>
          </div>
        </div>
        <FilaJustificativas
          v-else
          :justificativas="justificativas"
          @aceitar="aceitarJustificativa"
          @recusar="recusarJustificativa"
          @ver-anexo="verAnexoJustificativa"
        />
      </div>
    </div>

    <VisualizadorAnexo
      :aberto="!!anexoSelecionado"
      :anexo-id="anexoSelecionado?.id ?? ''"
      :nome-arquivo="anexoSelecionado?.nome ?? ''"
      :mime-type="anexoSelecionado?.mime"
      @fechar="anexoSelecionado = null"
    />
  </div>
</template>
