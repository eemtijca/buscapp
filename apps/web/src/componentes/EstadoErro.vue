<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo?: string;
    mensagem?: string;
  }>(),
  {
    titulo: 'Não foi possível carregar os dados',
    mensagem: 'Verifique a conexão e tente novamente.',
  },
);

const emit = defineEmits<{ tentarNovamente: [] }>();
</script>

<template>
  <div class="text-center py-5" role="alert">
    <span
      class="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle mb-3"
      style="width: 72px; height: 72px"
    >
      <i class="bi bi-exclamation-triangle fs-4 text-danger" aria-hidden="true"></i>
    </span>
    <p class="mb-1 small fw-medium">{{ titulo }}</p>
    <p class="mb-3 small text-body-secondary">{{ mensagem }}</p>
    <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('tentarNovamente')">
      <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
      Tentar novamente
    </button>
  </div>
</template>
