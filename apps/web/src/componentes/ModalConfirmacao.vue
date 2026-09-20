<script setup lang="ts">
import Modal from '@/componentes/Modal.vue';

withDefaults(
  defineProps<{
    visivel: boolean;
    titulo: string;
    mensagem: string;
    rotuloConfirmar?: string;
    icone?: string;
    variante?: 'danger' | 'success' | 'warning';
  }>(),
  {
    rotuloConfirmar: 'Confirmar',
    icone: 'question-circle',
    variante: 'danger',
  },
);

const emit = defineEmits<{
  confirmar: [];
  cancelar: [];
}>();

function classeIcone(variante: 'danger' | 'success' | 'warning'): string {
  if (variante === 'success') return 'text-success';
  if (variante === 'warning') return 'text-warning-emphasis';
  return 'text-danger';
}

function classeBotao(variante: 'danger' | 'success' | 'warning'): string {
  if (variante === 'success') return 'btn-success';
  if (variante === 'warning') return 'btn-warning';
  return 'btn-danger';
}
</script>

<template>
  <Modal
    :visivel="visivel"
    :titulo="titulo"
    largura="sm"
    @update:visivel="(aberto) => !aberto && emit('cancelar')"
  >
    <p class="mb-0 d-flex align-items-start gap-2">
      <i
        :class="'bi bi-' + icone + ' ' + classeIcone(variante)"
        aria-hidden="true"
      ></i>
      <span>{{ mensagem }}</span>
    </p>

    <template #rodape>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('cancelar')">
        Cancelar
      </button>
      <button
        type="button"
        class="btn btn-sm"
        :class="classeBotao(variante)"
        autofocus
        @click="emit('confirmar')"
      >
        {{ rotuloConfirmar }}
      </button>
    </template>
  </Modal>
</template>
