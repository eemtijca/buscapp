<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import TermometroRisco from '@/componentes/TermometroRisco.vue';
import type { Aluno } from '@/tipos/database';
import type { TermometroAtencao } from '@/tipos/componentes';

const router = useRouter();
const { usuario } = useAutenticacao();
const { buscarFilhosDoResponsavel, buscarTermometroAluno } = useMonitoramento();
const { inscrever, encerrar } = useRealtimeRefresh();

const filhos = ref<Aluno[]>([]);
const filhoSelecionado = ref<Aluno | null>(null);
const termometro = ref<TermometroAtencao | null>(null);
const carregando = ref(true);

async function selecionarFilho(filho: Aluno) {
  filhoSelecionado.value = filho;
  termometro.value = await buscarTermometroAluno(filho.id, filho.nome, '');
}

async function recarregarTermometro() {
  if (filhoSelecionado.value) {
    termometro.value = await buscarTermometroAluno(
      filhoSelecionado.value.id,
      filhoSelecionado.value.nome,
      '',
    );
  }
}

onMounted(async () => {
  if (usuario.value) {
    filhos.value = await buscarFilhosDoResponsavel(usuario.value.id);
    const primeiro = filhos.value[0];
    if (primeiro) {
      await selecionarFilho(primeiro);
    }
    await inscrever([{ tabela: 'frequencias' }, { tabela: 'ocorrencias' }], recarregarTermometro);
  }
  carregando.value = false;
});

onUnmounted(() => {
  encerrar();
});
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
      <select
        id="seletorFilho"
        class="form-select"
        :value="filhoSelecionado?.id"
        @change="
          (e: Event) => {
            const alvo = e.target as HTMLSelectElement;
            const filho = filhos.find((f: Aluno) => f.id === alvo.value);
            if (filho) selecionarFilho(filho);
          }
        "
      >
        <option v-for="f in filhos" :key="f.id" :value="f.id">
          {{ f.nome }}<span v-if="f.matricula"> — {{ f.matricula }}</span>
        </option>
      </select>
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
