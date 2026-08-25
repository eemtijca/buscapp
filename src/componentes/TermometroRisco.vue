<script setup lang="ts">
import { computed } from 'vue';
import type { TermometroAtencao, NivelRisco } from '@/tipos/componentes';

const props = defineProps<{
  termometro: TermometroAtencao;
}>();

const configNivel: Record<
  NivelRisco,
  { cor: string; corTexto: string; icone: string; rotulo: string; descricao: string }
> = {
  baixo: {
    cor: 'bg-success',
    corTexto: 'text-success-emphasis',
    icone: 'check-circle',
    rotulo: 'Tudo certo',
    descricao: 'Seu filho está sem alertas de frequência ou comportamento.',
  },
  medio: {
    cor: 'bg-warning',
    corTexto: 'text-warning-emphasis',
    icone: 'exclamation-triangle',
    rotulo: 'Atenção',
    descricao: 'Há registros de faltas e/ou ocorrências. Acompanhe de perto.',
  },
  alto: {
    cor: 'bg-danger',
    corTexto: 'text-danger-emphasis',
    icone: 'exclamation-octagon',
    rotulo: 'Risco alto',
    descricao: 'Acúmulo importante de faltas e/ou ocorrências. Contate a escola.',
  },
};

const config = computed(() => configNivel[props.termometro.nivel]);

const porcentagem = computed(() => {
  // Cada falta conta 10 pontos, cada ocorrência 20 pontos, limitado a 100.
  const pontos = Math.min(
    100,
    props.termometro.totalAusencias * 10 + props.termometro.totalOcorrencias * 20,
  );
  switch (props.termometro.nivel) {
    case 'baixo':
      return Math.max(15, pontos);
    case 'medio':
      return Math.max(50, pontos);
    case 'alto':
      return Math.max(85, pontos);
    default:
      return pontos;
  }
});
</script>

<template>
  <section
    class="card shadow-sm border-0 overflow-hidden"
    :aria-label="'Termômetro de atenção do aluno ' + termometro.alunoNome"
  >
    <div class="card-body">
      <div class="d-flex align-items-center gap-3 mb-3">
        <span
          class="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
          :class="config.cor"
          style="width: 56px; height: 56px"
          aria-hidden="true"
        >
          <i :class="'bi bi-' + config.icone + ' text-white'" style="font-size: 1.75rem"></i>
        </span>
        <div class="min-w-0 flex-grow-1">
          <div class="text-body-secondary small">Aluno</div>
          <div class="fw-bold text-truncate">{{ termometro.alunoNome }}</div>
          <div v-if="termometro.alunoTurma" class="text-body-secondary small text-truncate">
            {{ termometro.alunoTurma }}
          </div>
        </div>
        <div class="text-end flex-shrink-0">
          <div class="text-body-secondary small">Nível</div>
          <div class="fw-bold fs-5" :class="config.corTexto">{{ config.rotulo }}</div>
        </div>
      </div>

      <div class="mb-2">
        <div class="d-flex justify-content-between small mb-1">
          <span>Estável</span>
          <span>Atenção</span>
          <span>Crítico</span>
        </div>
        <div
          class="progress"
          role="progressbar"
          :aria-valuenow="porcentagem"
          aria-valuemin="0"
          aria-valuemax="100"
          style="height: 14px"
        >
          <div class="progress-bar" :class="config.cor" :style="{ width: porcentagem + '%' }"></div>
        </div>
      </div>

      <p class="card-text small mt-3 mb-0">
        <strong>{{ config.descricao }}</strong>
        <span v-if="termometro.mensagem" class="d-block text-body-secondary mt-1">
          {{ termometro.mensagem }}
        </span>
      </p>

      <div class="d-flex gap-2 mt-3">
        <span class="badge text-bg-light border">
          <i class="bi bi-calendar-x me-1" aria-hidden="true"></i>
          {{ termometro.totalAusencias }} falta(s)
        </span>
        <span class="badge text-bg-light border">
          <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
          {{ termometro.totalOcorrencias }} ocorrência(s)
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
