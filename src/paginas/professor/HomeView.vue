<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import CartaoNavegacao from '@/componentes/CartaoNavegacao.vue';

const route = useRoute();
const { usuario } = useAutenticacao();
const nomeProfessor = usuario.value?.nome || 'Professor';

const podeFrequencia = computed(() => (usuario.value?.acesso_modulos ?? []).includes('frequencia'));
const podeOcorrencias = computed(() =>
  (usuario.value?.acesso_modulos ?? []).includes('ocorrencias'),
);
const nenhumModulo = computed(() => !podeFrequencia.value && !podeOcorrencias.value);

const moduloNegado = computed(() => {
  const valor = route.query.moduloNegado;
  if (typeof valor !== 'string') return '';
  return valor === 'ocorrencias'
    ? 'Você não possui acesso ao módulo de ocorrências.'
    : 'Você não possui acesso ao módulo de frequência.';
});
</script>

<template>
  <div class="container py-4 py-md-5" style="max-width: 800px">
    <div class="text-center mb-4 mb-md-5">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success mb-3"
        style="width: 64px; height: 64px; font-size: 1.75rem"
      >
        <i class="bi bi-person-workspace" aria-hidden="true"></i>
      </span>
      <h1 class="h4 fw-bold mb-1">Olá, {{ nomeProfessor }}</h1>
      <p class="text-body-secondary small mb-0">
        Registre a frequência e acompanhe sua turma em poucos cliques.
      </p>
    </div>

    <div
      v-if="moduloNegado"
      class="alert alert-warning py-2 small d-flex align-items-center"
      role="alert"
    >
      <i class="bi bi-lock me-2" aria-hidden="true"></i>
      {{ moduloNegado }}
    </div>

    <div v-if="nenhumModulo" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-sliders fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhum módulo habilitado para o seu usuário.</p>
      <p class="mb-0 small">Contate a gestão escolar para liberar o acesso.</p>
    </div>

    <div v-else class="row g-3 justify-content-center">
      <div v-if="podeFrequencia" class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="check2-square"
          titulo="Registrar frequência"
          descricao="Marque presenças e ausências da turma de forma rápida."
          rota="/professor/frequencia"
          cor="success"
        />
      </div>
      <div v-if="podeFrequencia" class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="clock-history"
          titulo="Ausência em aula"
          descricao="Registre quando o aluno faltou a um período específico."
          rota="/professor/ausencia"
          cor="success"
        />
      </div>
      <div v-if="podeOcorrencias" class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="exclamation-triangle"
          titulo="Ocorrência grave"
          descricao="Registre comportamentos extremos que ameacem a permanência."
          rota="/professor/ocorrencia"
          cor="success"
        />
      </div>
    </div>
  </div>
</template>
