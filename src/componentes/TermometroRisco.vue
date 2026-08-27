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

// Limites da barra segmentada (verde/amarelo/vermelho) vindos do score.
const pctMedio = computed(() => props.termometro.limites?.medio ?? 40);
const pctAlto = computed(() => props.termometro.limites?.alto ?? 75);
const score = computed(() => Math.max(0, Math.min(100, props.termometro.score ?? 0)));

const tendenciaInfo = computed(() => {
  switch (props.termometro.tendencia) {
    case 'alta':
      return { icone: 'arrow-up-circle', cor: 'text-danger', rotulo: 'Em alta' };
    case 'queda':
      return { icone: 'arrow-down-circle', cor: 'text-success', rotulo: 'Em queda' };
    default:
      return { icone: 'dash-circle', cor: 'text-body-secondary', rotulo: 'Estável' };
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
          <div
            v-if="termometro.tendencia"
            class="small d-inline-flex align-items-center gap-1"
            :class="tendenciaInfo.cor"
          >
            <i :class="'bi bi-' + tendenciaInfo.icone" aria-hidden="true"></i>
            {{ tendenciaInfo.rotulo }}
          </div>
        </div>
      </div>

      <div class="mb-2">
        <div class="d-flex justify-content-between small mb-1">
          <span :class="termometro.nivel === 'baixo' ? 'fw-bold text-success' : ''">Estável</span>
          <span :class="termometro.nivel === 'medio' ? 'fw-bold text-warning-emphasis' : ''"
            >Atenção</span
          >
          <span :class="termometro.nivel === 'alto' ? 'fw-bold text-danger' : ''">Crítico</span>
        </div>
        <!-- Barra segmentada verde/amarelo/vermelho com marcador de score -->
        <div
          class="progress position-relative"
          role="progressbar"
          :aria-valuenow="score"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuetext="config.rotulo + ' — ' + score + ' de 100'"
          style="height: 16px"
        >
          <div class="progress-bar bg-success" :style="{ width: pctMedio + '%' }"></div>
          <div class="progress-bar bg-warning" :style="{ width: pctAlto - pctMedio + '%' }"></div>
          <div class="progress-bar bg-danger" :style="{ width: 100 - pctAlto + '%' }"></div>
          <div
            class="position-absolute top-0 bottom-0 bg-dark border border-white shadow-sm"
            :style="{ left: 'calc(' + score + '% - 1.5px)', width: '3px', borderRadius: '1px' }"
            aria-hidden="true"
          ></div>
        </div>
        <div class="d-flex justify-content-between small text-body-secondary mt-1">
          <span>0</span>
          <span>{{ pctMedio }}</span>
          <span>{{ pctAlto }}</span>
          <span>100</span>
        </div>
      </div>

      <!-- Score e limites configuráveis -->
      <div class="d-flex flex-wrap gap-2 small text-body-secondary mb-2">
        <span
          >Score <strong class="text-body">{{ score }}/100</strong></span
        >
        <span>·</span>
        <span
          >Limites {{ termometro.limites.preventivo }}/{{ termometro.limites.critico }} faltas</span
        >
        <span>·</span>
        <span>Score médio ≥{{ pctMedio }} · alto ≥{{ pctAlto }}</span>
      </div>

      <p class="card-text small mt-2 mb-0">
        <strong>{{ config.descricao }}</strong>
        <span v-if="termometro.mensagem" class="d-block text-body-secondary mt-1">
          {{ termometro.mensagem }}
        </span>
      </p>

      <!-- Fatores explicativos -->
      <ul v-if="termometro.fatores?.length" class="small text-body-secondary mt-2 mb-0 ps-3">
        <li v-for="(f, i) in termometro.fatores" :key="i">{{ f }}</li>
      </ul>

      <div class="d-flex flex-wrap gap-2 mt-3">
        <span class="badge text-bg-light border">
          <i class="bi bi-calendar-x me-1" aria-hidden="true"></i>
          {{ termometro.totalAusencias }} falta(s) injust.
        </span>
        <span v-if="termometro.totalAusenciasJustificadas > 0" class="badge text-bg-secondary">
          <i class="bi bi-calendar-check me-1" aria-hidden="true"></i>
          {{ termometro.totalAusenciasJustificadas }} justificada(s)
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
