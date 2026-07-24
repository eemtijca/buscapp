<script setup lang="ts">
import type { JustificativaPendente } from '@/tipos/componentes';

defineProps<{
  justificativas: JustificativaPendente[];
}>();

const emit = defineEmits<{
  aceitar: [justificativaId: string];
  recusar: [justificativaId: string];
  'ver-anexo': [justificativaId: string];
}>();

const classeStatus: Record<JustificativaPendente['status'], string> = {
  pendente: 'text-bg-warning',
  aceita: 'text-bg-success',
  recusada: 'text-bg-danger',
};

const rotuloStatus: Record<JustificativaPendente['status'], string> = {
  pendente: 'Pendente',
  aceita: 'Aceita',
  recusada: 'Recusada',
};
</script>

<template>
  <div class="list-group list-group-flush">
    <article
      v-for="just in justificativas"
      :key="just.id"
      class="list-group-item list-group-item-action p-3"
      :aria-label="'Justificativa de ' + just.alunoNome"
    >
      <div class="d-flex w-100 justify-content-between gap-2 flex-wrap mb-1">
        <div>
          <strong>{{ just.alunoNome }}</strong>
          <small class="text-body-secondary ms-2">
            <i class="bi bi-person-v me-1" aria-hidden="true"></i>{{ just.responsavelNome }}
          </small>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="badge" :class="classeStatus[just.status]">{{
            rotuloStatus[just.status]
          }}</span>
          <small class="text-body-secondary">
            {{ just.dataAusencia
            }}<span v-if="just.dataFim && just.dataFim !== just.dataAusencia">
              — {{ just.dataFim }}</span
            >
          </small>
        </div>
      </div>

      <p class="mb-2 small">{{ just.motivo }}</p>

      <div v-if="just.anexoUrl" class="mb-2">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          @click="emit('ver-anexo', just.id)"
        >
          <i class="bi bi-paperclip me-1" aria-hidden="true"></i>
          Ver anexo
          <span v-if="just.anexoNome" class="text-body-secondary">({{ just.anexoNome }})</span>
        </button>
      </div>

      <div v-if="just.status === 'pendente'" class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-sm btn-success" @click="emit('aceitar', just.id)">
          <i class="bi bi-check-lg me-1" aria-hidden="true"></i>
          Aceitar
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-danger"
          @click="emit('recusar', just.id)"
        >
          <i class="bi bi-x-lg me-1" aria-hidden="true"></i>
          Recusar
        </button>
      </div>
    </article>

    <div v-if="!justificativas.length" class="text-body-secondary text-center py-4 mb-0">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-inbox fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0">Nenhuma justificativa pendente.</p>
    </div>
  </div>
</template>
