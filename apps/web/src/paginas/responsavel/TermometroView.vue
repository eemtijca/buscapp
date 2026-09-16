<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useFilhosResponsavel, useTermometroAluno } from '@/composables/consultas/useMonitoramento';
import { useConsulta } from '@/composables/useConsulta';
import { Consultas } from '@/servicos/consultas';
import TermometroRisco from '@/componentes/TermometroRisco.vue';
import Combobox from '@/componentes/Combobox.vue';
import type { OpcaoCombobox } from '@/componentes/Combobox.vue';
const router = useRouter();
const { filhos, pendente: pendenteFilhos } = useFilhosResponsavel();

const filhoSelecionadoId = ref('');
const filhoSelecionado = computed(
  () => filhos.value.find((filho) => filho.id === filhoSelecionadoId.value) ?? null,
);

const consultaEnturmacoes = useConsulta(() => ({
  ...Consultas.enturmacoes({ aluno_id: filhoSelecionadoId.value, status: 'matriculado' }),
  habilitado: Boolean(filhoSelecionadoId.value),
}));
const turmaNome = computed(
  () => consultaEnturmacoes.dados.value?.enturmacoes?.[0]?.turma?.nome_completo ?? null,
);

const { termometro, pendente: pendenteTermometro } = useTermometroAluno(
  () => filhoSelecionadoId.value,
  () => filhoSelecionado.value?.nome ?? '',
  () => turmaNome.value,
);

const filhoOpcoes = computed<OpcaoCombobox[]>(() =>
  filhos.value.map((filho) => ({
    valor: filho.id,
    rotulo: filho.nome,
    descricao: filho.matricula ?? undefined,
  })),
);

const carregando = computed(
  () =>
    (pendenteFilhos.value && !filhos.value.length) ||
    (Boolean(filhoSelecionadoId.value) && pendenteTermometro.value && !termometro.value),
);

watch(
  filhos,
  (lista) => {
    if (!filhoSelecionadoId.value && lista.length) filhoSelecionadoId.value = lista[0]!.id;
  },
  { immediate: true },
);
</script>

<template>
  <div class="container py-4" style="max-width: 800px">
    <div class="d-flex gap-2 mb-3">
      <router-link to="/responsavel" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1" aria-hidden="true"></i>
        Início
      </router-link>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="router.back()">
        <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
        Voltar
      </button>
    </div>

    <h1 class="h5 fw-bold mb-3">
      <i class="bi bi-thermometer-half text-success me-2" aria-hidden="true"></i>
      Termômetro de atenção
    </h1>

    <div v-if="filhos.length > 1" class="mb-3">
      <label for="seletorFilho" class="form-label fw-semibold small">Selecione o aluno</label>
      <Combobox
        id="seletorFilho"
        v-model="filhoSelecionadoId"
        :opcoes="filhoOpcoes"
        placeholder="Selecione o aluno"
      />
    </div>

    <div v-if="carregando" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
    </div>

    <div v-else-if="!termometro" class="text-center py-5 text-body-secondary">
      <p class="mb-0 small">Nenhum aluno vinculado.</p>
    </div>

    <TermometroRisco v-else :termometro="termometro" />
  </div>
</template>
