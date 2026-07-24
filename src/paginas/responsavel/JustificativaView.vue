<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { supabaseClient } from '@/servicos/supabase';
import FormularioJustificativa from '@/componentes/FormularioJustificativa.vue';
import type { Aluno } from '@/tipos/database';

const router = useRouter();
const route = useRoute();
const { usuario } = useAutenticacao();
const { buscarFilhosDoResponsavel, enviarJustificativa, processarAnexoAsync } = useMonitoramento();

const filhos = ref<Aluno[]>([]);
const filhoSelecionado = ref<Aluno | null>(null);
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
  );

  if (result.success) {
    mensagemSucesso.value = 'Justificativa enviada com sucesso.';
    formKey.value++;
    if (payload.arquivo && result.justificativaId) {
      processarAnexoAsync(result.justificativaId, usuario.value.id, payload.arquivo);
    }
  } else {
    mensagemErro.value = 'Falha ao enviar justificativa. Tente novamente.';
  }
  enviando.value = false;
}

onMounted(async () => {
  if (!usuario.value) return;

  const frequenciaId = route.query.frequenciaId as string | undefined;
  filhos.value = await buscarFilhosDoResponsavel(usuario.value.id);

  if (frequenciaId) {
    const { data: freqData } = await supabaseClient
      .from('frequencias')
      .select('aluno_id, data_aula, periodo')
      .eq('id', frequenciaId)
      .single();

    if (freqData) {
      const f = freqData as unknown as { aluno_id: string; data_aula: string; periodo: string };
      dataPrefill.value = f.data_aula;
      dataDesabilitada.value = !!f.data_aula;
      const aluno = filhos.value.find((a) => a.id === f.aluno_id);
      if (aluno) filhoSelecionado.value = aluno;
      detalhesAusencia.value = `Período: ${f.periodo}`;
    }
  }

  if (!filhoSelecionado.value) {
    filhoSelecionado.value = filhos.value[0] || null;
  }
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
      <i class="bi bi-paperclip text-success me-2" aria-hidden="true"></i>
      Enviar justificativa
    </h1>

    <div v-if="filhos.length > 1" class="mb-3">
      <label for="filhoSelect" class="form-label fw-semibold small">Aluno</label>
      <select id="filhoSelect" class="form-select" v-model="filhoSelecionado">
        <option v-for="f in filhos" :key="f.id" :value="f">
          {{ f.nome }}<span v-if="f.matricula"> — {{ f.matricula }}</span>
        </option>
      </select>
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
