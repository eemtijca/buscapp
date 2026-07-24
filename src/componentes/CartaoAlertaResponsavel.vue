<script setup lang="ts">
import { computed } from 'vue';
import type { AlertaResponsavel } from '@/tipos/componentes';

const props = defineProps<{
  alerta: AlertaResponsavel;
}>();

const emit = defineEmits<{
  'ver-detalhes': [alertaId: string];
  'enviar-justificativa': [{ alertaId: string; frequenciaId?: string }];
  'ver-anexo': [anexoUrl: string];
}>();

const configTipo: Record<
  AlertaResponsavel['tipo'],
  { icone: string; classe: string; rotulo: string }
> = {
  ausencia_escola: {
    icone: 'door-closed',
    classe: 'text-bg-danger',
    rotulo: 'Ausência da escola',
  },
  ausencia_aula: {
    icone: 'clock',
    classe: 'text-bg-warning',
    rotulo: 'Ausência em aula',
  },
  suspensao: {
    icone: 'shield-exclamation',
    classe: 'text-bg-dark',
    rotulo: 'Suspensão',
  },
  comunicado: {
    icone: 'megaphone',
    classe: 'text-bg-info',
    rotulo: 'Comunicado',
  },
};

const config = computed(() => configTipo[props.alerta.tipo]);

const classeBorda = computed(() => {
  if (props.alerta.urgente) return 'border-danger border-2';
  return 'border-start border-4';
});

const classeBordaEspecifica = computed(() => {
  switch (props.alerta.tipo) {
    case 'ausencia_escola':
      return 'border-danger';
    case 'ausencia_aula':
      return 'border-warning';
    case 'suspensao':
      return 'border-dark';
    case 'comunicado':
    default:
      return 'border-info';
  }
});
</script>

<template>
  <div class="card shadow-sm h-100" :class="[classeBorda, classeBordaEspecifica]">
    <div class="card-body d-flex gap-3 p-3">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-3 flex-shrink-0"
        :class="config.classe"
        style="width: 48px; height: 48px"
        aria-hidden="true"
      >
        <i :class="'bi bi-' + config.icone" style="font-size: 1.25rem"></i>
      </span>

      <div class="min-w-0 flex-grow-1">
        <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
          <span class="badge" :class="config.classe">{{ config.rotulo }}</span>
          <span v-if="alerta.justificativaStatus === 'aceita'" class="badge text-bg-success">
            <i class="bi bi-check-circle me-1" aria-hidden="true"></i>Justificativa aceita
          </span>
          <span v-else-if="alerta.justificativaStatus === 'pendente'" class="badge text-bg-info">
            <i class="bi bi-clock me-1" aria-hidden="true"></i>Aguardando validação
          </span>
          <span v-if="alerta.urgente" class="badge text-bg-danger-subtle text-danger-emphasis">
            <i class="bi bi-exclamation-circle me-1" aria-hidden="true"></i>Urgente
          </span>
          <small class="text-body-secondary ms-auto">{{ alerta.data }}</small>
        </div>
        <h3 class="h6 mb-1 fw-semibold">{{ alerta.titulo }}</h3>
        <p class="card-text small mb-2">{{ alerta.descricao }}</p>
        <div v-if="alerta.periodo" class="text-body-secondary small mb-2">
          <i class="bi bi-clock me-1" aria-hidden="true"></i>Período: {{ alerta.periodo }}
        </div>

        <div class="d-flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-sm btn-outline-success"
            @click="emit('ver-detalhes', alerta.id)"
          >
            <i class="bi bi-eye me-1" aria-hidden="true"></i>
            Ver detalhes
          </button>
          <button
            v-if="
              !alerta.justificativaStatus &&
              (alerta.tipo === 'ausencia_escola' || alerta.tipo === 'ausencia_aula')
            "
            type="button"
            class="btn btn-sm btn-success"
            @click="
              emit('enviar-justificativa', {
                alertaId: alerta.id,
                frequenciaId: alerta.frequenciaId,
              })
            "
          >
            <i class="bi bi-paperclip me-1" aria-hidden="true"></i>
            Enviar justificativa
          </button>
          <button
            v-if="alerta.anexoUrl"
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="emit('ver-anexo', alerta.anexoUrl!)"
          >
            <i class="bi bi-paperclip me-1" aria-hidden="true"></i>
            Ver anexo
            <span v-if="alerta.anexoNome" class="text-body-secondary"
              >({{ alerta.anexoNome }})</span
            >
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
