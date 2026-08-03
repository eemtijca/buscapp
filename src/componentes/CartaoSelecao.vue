<script setup lang="ts">
  withDefaults(
  defineProps<{
    selecionado: boolean;
    desabilitado?: boolean;
    variante?: 'success' | 'primary' | 'warning' | 'danger' | 'info';
    tracejado?: boolean;
  }>(),
  {
    desabilitado: false,
    variante: 'success',
    tracejado: false,
  },
);

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    type="button"
    class="btn btn-sm w-100 text-start d-flex align-items-center gap-2 border cartao-selecao"
    :class="[selecionado ? `btn-${variante} border-${variante}` : 'btn-outline-secondary bg-body']"
    :style="tracejado && !selecionado ? { borderStyle: 'dashed' } : undefined"
    :disabled="desabilitado"
    :aria-pressed="selecionado"
    @click="emit('click')"
  >
    <i
      :class="[
        selecionado ? 'bi bi-check-circle-fill' : 'bi bi-circle',
        'flex-shrink-0',
        selecionado ? '' : 'text-body-tertiary',
      ]"
      aria-hidden="true"
    ></i>
    <span class="small flex-grow-1"><slot /></span>
  </button>
</template>

<style scoped>
.cartao-selecao {
  min-height: var(--altura-cartao, auto);
}

.cartao-selecao.btn-outline-secondary:not(:disabled):hover {
  color: var(--bs-body-color) !important;
  background-color: var(--bs-secondary-bg-subtle) !important;
  border-color: var(--bs-secondary-border-subtle) !important;
}

.cartao-selecao.btn-outline-secondary:not(:disabled):hover i {
  color: var(--bs-body-color);
}
</style>
