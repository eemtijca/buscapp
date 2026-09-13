<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { api } from '@/servicos/api';
import FormularioJustificativa from '@/componentes/FormularioJustificativa.vue';
import Combobox from '@/componentes/Combobox.vue';
import type { OpcaoCombobox } from '@/componentes/Combobox.vue';
import type { Aluno, Frequencia } from '@/tipos/database';

const router = useRouter();
const route = useRoute();
const { usuario } = useAutenticacao();
const { buscarFilhosDoResponsavel, enviarJustificativa } = useMonitoramento();

const filhos = ref<Aluno[]>([]);
const filhoSelecionado = ref<Aluno | null>(null);

const filhoOpcoes = computed<OpcaoCombobox[]>(() =>
  filhos.value.map((f) => ({ valor: f.id, rotulo: f.nome, descricao: f.matricula ?? undefined })),
);
const filhoSelecionadoId = computed({
  get: () => filhoSelecionado.value?.id ?? '',
  set: (id: string) => {
    const filho = filhos.value.find((f) => f.id === id);
    if (filho) filhoSelecionado.value = filho;
  },
});
const enviando = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);
const dataPrefill = ref('');
const formKey = ref(0);
const dataDesabilitada = ref(false);
const detalhesAusencia = ref<string | null>(null);

async function handleEnviarJustificativa(payload: {
  motivo: string;
  dataInicio: string;
  dataFim: string;
  arquivo: File | null;
}) {
  if (!usuario.value || !filhoSelecionado.value) {
    mensagemErro.value = 'Selecione um filho antes de enviar a justificativa.';
    return;
  }
  enviando.value = true;

  const result = await enviarJustificativa(
    filhoSelecionado.value.id,
    usuario.value.id,
    payload.dataInicio,
    payload.dataFim,
    payload.motivo,
    payload.arquivo,
  );

  if (result.success) {
    mensagemSucesso.value = 'Justificativa enviada com sucesso.';
    formKey.value++;
  } else {
    mensagemErro.value = 'Falha ao enviar justificativa. Tente novamente.';
  }
  enviando.value = false;
}

// Inicializa quando usuario existir: garante carga mesmo após reload direto na rota.
async function inicializar() {
  if (!usuario.value) return;

  const frequenciaId = route.query.frequenciaId as string | undefined;
  filhos.value = await buscarFilhosDoResponsavel(usuario.value.id);

  if (frequenciaId) {
    try {
      const { frequencia } = await api<{ frequencia: Frequencia }>(
        `/api/frequencias/${frequenciaId}`,
      );
      dataPrefill.value = frequencia.data_aula;
      dataDesabilitada.value = !!frequencia.data_aula;
      const aluno = filhos.value.find((a) => a.id === frequencia.aluno_id);
      if (aluno) filhoSelecionado.value = aluno;
      detalhesAusencia.value = `Período: ${frequencia.periodo}`;
    } catch (e) {
      console.error('[JustificativaView] Erro ao buscar a frequência do deep-link:', e);
    }
  }

  if (!filhoSelecionado.value) {
    filhoSelecionado.value = filhos.value[0] || null;
  }
}

watch(usuario, () => void inicializar(), { immediate: true });
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
      <i class="bi bi-paperclip text-success me-2" aria-hidden="true"></i>
      Enviar justificativa
    </h1>

    <div v-if="filhos.length > 1" class="mb-3">
      <label for="filhoSelect" class="form-label fw-semibold small">Aluno</label>
      <Combobox
        id="filhoSelect"
        v-model="filhoSelecionadoId"
        :opcoes="filhoOpcoes"
        placeholder="Selecione o aluno"
      />
    </div>

    <div v-if="mensagemSucesso" class="alert alert-success py-2 small mb-3" role="status">
      <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
      {{ mensagemSucesso }}
    </div>
    <div v-if="mensagemErro" class="alert alert-danger py-2 small mb-3" role="alert">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
      {{ mensagemErro }}
    </div>

    <div v-if="detalhesAusencia" class="alert alert-info py-2 small mb-3">
      <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
      Justificativa vinculada a uma falta registrada. {{ detalhesAusencia }}
    </div>

    <div class="card border">
      <div class="card-body">
        <FormularioJustificativa
          :key="formKey"
          :aluno-nome="filhoSelecionado?.nome || ''"
          :aluno-turma="''"
          :enviando="enviando"
          :data-preenchida="dataPrefill"
          :data-desabilitada="dataDesabilitada"
          @enviar="handleEnviarJustificativa"
        />
      </div>
    </div>
  </div>
</template>
