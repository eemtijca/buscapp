<script setup lang="ts">
import { computed } from 'vue';
import type { TermometroAtencao, NivelRisco } from '@/tipos/componentes';

const props = defineProps<{
  termometro: TermometroAtencao;
}>();

/** Configuração visual do nível com cor, ícone e rótulo destinado ao responsável. */
const configNivel: Record<
  NivelRisco,
  { cor: string; corTexto: string; badge: string; icone: string; rotulo: string; descricao: string }
> = {
  baixo: {
    cor: 'bg-success',
    corTexto: 'text-success-emphasis',
    badge: 'bg-success text-white',
    icone: 'check-circle',
    rotulo: 'Tudo certo',
    descricao: 'Seu filho está sem alertas de frequência ou comportamento.',
  },
  medio: {
    cor: 'bg-warning',
    corTexto: 'text-warning-emphasis',
    badge: 'bg-warning text-dark',
    icone: 'exclamation-triangle',
    rotulo: 'Atenção',
    descricao: 'Há registros de faltas e/ou ocorrências. Acompanhe de perto.',
  },
  alto: {
    cor: 'bg-danger',
    corTexto: 'text-danger-emphasis',
    badge: 'bg-danger text-white',
    icone: 'exclamation-octagon',
    rotulo: 'Risco alto',
    descricao: 'Acúmulo importante de faltas e/ou ocorrências. Contate a escola.',
  },
};

// O nível alto é exibido como Risco alto para responsáveis e como Crítico na gestão, mantendo a mesma regra de negócio com linguagem suavizada.
const config = computed(() => configNivel[props.termometro.nivel]);

/** Limiares do score utilizados como referência para as faixas amarela e vermelha. */
const pctMedio = computed(() => props.termometro.limites?.medio ?? 40);
const pctAlto = computed(() => props.termometro.limites?.alto ?? 75);
const score = computed(() => Math.max(0, Math.min(100, props.termometro.score ?? 0)));

/** Tendência calculada comparando os últimos 30 dias com os 30 dias anteriores. */
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
    <div class="card-body p-4">
      <div class="d-flex align-items-center gap-3 mb-4">
        <span
          class="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
          :class="config.cor"
          style="width: 44px; height: 44px"
          aria-hidden="true"
        >
          <i :class="'bi bi-' + config.icone + ' text-white'" style="font-size: 1.35rem"></i>
        </span>
        <div class="min-w-0 flex-grow-1">
          <div class="fw-semibold text-truncate">{{ termometro.alunoNome }}</div>
          <div v-if="termometro.alunoTurma" class="text-body-secondary small text-truncate">
            {{ termometro.alunoTurma }}
          </div>
          <div
            v-if="termometro.tendencia"
            class="small d-inline-flex align-items-center gap-1 mt-1"
            :class="tendenciaInfo.cor"
          >
            <i :class="'bi bi-' + tendenciaInfo.icone" aria-hidden="true"></i>
            {{ tendenciaInfo.rotulo }}
          </div>
        </div>
        <span class="badge rounded-pill px-3 py-2 fw-semibold flex-shrink-0" :class="config.badge">
          {{ config.rotulo }}
        </span>
      </div>

      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="small fw-semibold" :class="config.corTexto">Nível de atenção</span>
          <span class="small text-body-secondary">
            <strong class="text-body">{{ score }}/100</strong>
          </span>
        </div>
        <div
          class="progress position-relative bg-body-secondary rounded-pill overflow-hidden"
          role="progressbar"
          :aria-valuenow="score"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuetext="config.rotulo + ' — ' + score + ' de 100'"
          style="height: 14px"
        >
          <div
            class="progress-bar rounded-pill"
            :class="config.cor"
            :style="{ width: score + '%' }"
            style="transition: width 0.45s ease"
          ></div>
          <span
            v-if="pctMedio > 0 && pctMedio < 100"
            class="termometro-marcador"
            :style="{ left: pctMedio + '%' }"
            aria-hidden="true"
          ></span>
          <span
            v-if="pctAlto > 0 && pctAlto < 100"
            class="termometro-marcador"
            :style="{ left: pctAlto + '%' }"
            aria-hidden="true"
          ></span>
        </div>
        <div class="d-flex justify-content-between small text-body-secondary mt-1">
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      <div class="d-flex flex-wrap align-items-center gap-2 small">
        <span class="d-inline-flex align-items-center gap-1">
          <i class="bi bi-calendar-x text-body-secondary" aria-hidden="true"></i>
          {{ termometro.totalAusencias }} falta(s) injust.
        </span>
        <span
          v-if="termometro.totalAusenciasJustificadas > 0"
          class="d-inline-flex align-items-center gap-1"
        >
          <span class="text-body-secondary" aria-hidden="true">·</span>
          <i class="bi bi-calendar-check text-body-secondary" aria-hidden="true"></i>
          {{ termometro.totalAusenciasJustificadas }} justificada(s)
        </span>
        <span class="text-body-secondary" aria-hidden="true">·</span>
        <span class="d-inline-flex align-items-center gap-1">
          <i class="bi bi-exclamation-triangle text-body-secondary" aria-hidden="true"></i>
          {{ termometro.totalOcorrencias }} ocorrência(s)
        </span>
      </div>

      <p class="small text-body-secondary mt-3 mb-0">
        {{ config.descricao }}
        <span v-if="termometro.mensagem" class="d-block mt-1">
          {{ termometro.mensagem }}
        </span>
      </p>

      <ul
        v-if="termometro.fatores?.length"
        class="small text-body-secondary mt-2 mb-0 ps-3 termometro-fatores"
      >
        <li v-for="(f, i) in termometro.fatores" :key="i">{{ f }}</li>
      </ul>

      <details class="mt-3 termometro-detalhe">
        <summary class="small text-body-secondary">Como é calculado?</summary>
        <div class="table-responsive mt-2">
          <table class="table table-sm small mb-0 align-middle">
            <caption class="visually-hidden">
              Critérios do Termômetro de Atenção
            </caption>
            <thead class="text-body-secondary">
              <tr>
                <th scope="col" class="fw-semibold">Critério</th>
                <th scope="col" class="fw-semibold">Limite configurado</th>
              </tr>
            </thead>
            <tbody class="text-body-secondary">
              <tr>
                <th scope="row" class="fw-normal">Atenção</th>
                <td>A partir de {{ termometro.limites.preventivo }} faltas injustificadas</td>
              </tr>
              <tr>
                <th scope="row" class="fw-normal">Alerta máximo</th>
                <td>A partir de {{ termometro.limites.critico }} faltas injustificadas</td>
              </tr>
              <tr>
                <th scope="row" class="fw-normal">
                  <span
                    class="d-inline-block rounded-circle bg-warning me-1"
                    style="width: 10px; height: 10px"
                    aria-hidden="true"
                  ></span>
                  Amarelo
                </th>
                <td>A partir de {{ pctMedio }} pontos</td>
              </tr>
              <tr>
                <th scope="row" class="fw-normal">
                  <span
                    class="d-inline-block rounded-circle bg-danger me-1"
                    style="width: 10px; height: 10px"
                    aria-hidden="true"
                  ></span>
                  Vermelho
                </th>
                <td>A partir de {{ pctAlto }} pontos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <details class="mt-3 termometro-detalhe">
        <summary class="small text-body-secondary">Como melhorar?</summary>
        <ul class="small text-body-secondary mt-2 mb-0 ps-3 termometro-fatores">
          <li v-if="termometro.totalAusencias >= termometro.limites.preventivo">
            Reduza faltas injustificadas para voltar ao verde (faltam
            {{ termometro.totalAusencias - termometro.limites.preventivo + 1 }}).
          </li>
          <li v-else>
            Faltam {{ termometro.limites.preventivo - termometro.totalAusencias }} falta(s) para
            atingir o nível de atenção — mantenha a frequência.
          </li>
          <li v-if="termometro.totalOcorrencias > 0">
            Ocorrências pendentes mantêm o score elevado — resolva ou confirme presença do
            responsável quando aplicável.
          </li>
          <li v-if="termometro.tendencia === 'queda'">
            Tendência em queda — continue assim para acelerar a redução da recência.
          </li>
          <li v-else-if="termometro.tendencia === 'alta'">
            Tendência em alta — evite novas faltas nos próximos dias.
          </li>
          <li>Comportamentos positivos recentes reduzem o score; registre-os com a coordenação.</li>
        </ul>
      </details>
    </div>
  </section>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
.termometro-marcador {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 1px;
  transform: translateX(-50%);
  pointer-events: none;
}
.termometro-fatores li + li {
  margin-top: 2px;
}
.termometro-detalhe summary {
  cursor: pointer;
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  user-select: none;
}
.termometro-detalhe summary::before {
  content: '';
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 4px solid currentColor;
  border-top: 3px solid transparent;
  border-bottom: 3px solid transparent;
  transition: transform 0.15s ease;
  opacity: 0.6;
}
.termometro-detalhe[open] summary::before {
  transform: rotate(90deg);
}
.termometro-detalhe summary::-webkit-details-marker {
  display: none;
}
</style>
