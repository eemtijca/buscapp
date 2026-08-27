<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import TermometroRisco from '@/componentes/TermometroRisco.vue';
import type { Aluno } from '@/tipos/database';
import type { TermometroAtencao } from '@/tipos/componentes';
import { supabaseClient } from '@/servicos/supabase';

const router = useRouter();
const { usuario } = useAutenticacao();
const { buscarFilhosDoResponsavel, buscarTermometroAluno } = useMonitoramento();
const { inscrever, encerrar } = useRealtimeRefresh();

const filhos = ref<Aluno[]>([]);
const filhoSelecionado = ref<Aluno | null>(null);
const termometro = ref<TermometroAtencao | null>(null);
const carregando = ref(true);

/** Busca o nome da turma do aluno para exibir no termômetro. */
async function buscarTurmaAluno(alunoId: string): Promise<string | null> {
  try {
    const { data } = await supabaseClient
      .from('enturmacoes')
      .select('turma_id')
      .eq('aluno_id', alunoId)
      .eq('status', 'matriculado')
      .limit(1)
      .single();
    const turmaId = (data as unknown as { turma_id: string } | null)?.turma_id;
    if (!turmaId) return null;
    const { data: turma } = await supabaseClient
      .from('turmas')
      .select('nome_completo')
      .eq('id', turmaId)
      .single();
    return (turma as unknown as { nome_completo: string } | null)?.nome_completo ?? null;
  } catch {
    return null;
  }
}

async function selecionarFilho(filho: Aluno) {
  filhoSelecionado.value = filho;
  const turma = await buscarTurmaAluno(filho.id);
  termometro.value = await buscarTermometroAluno(filho.id, filho.nome, turma);
}

async function recarregarTermometro() {
  if (filhoSelecionado.value) {
    const turma = await buscarTurmaAluno(filhoSelecionado.value.id);
    termometro.value = await buscarTermometroAluno(
      filhoSelecionado.value.id,
      filhoSelecionado.value.nome,
      turma,
    );
  }
}

let inicializado = false;

// Inicializa quando usuario existir: garante carga e inscrição realtime mesmo após reload direto.
async function inicializar() {
  if (!usuario.value || inicializado) return;
  inicializado = true;
  filhos.value = await buscarFilhosDoResponsavel(usuario.value.id);
  const primeiro = filhos.value[0];
  if (primeiro) {
    await selecionarFilho(primeiro);
  }
  await inscrever(
    [
      { tabela: 'frequencias' },
      { tabela: 'ocorrencias' },
      { tabela: 'justificativas_faltas' },
      { tabela: 'configuracoes_sistema' },
    ],
    recarregarTermometro,
  );
  carregando.value = false;
}

watch(usuario, () => void inicializar(), { immediate: true });

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
