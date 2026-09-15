<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string;
    label: string;
    obrigatorio?: boolean;
    erro?: string | null;
    dica?: string;
    maxlength?: number;
    contador?: number;
  }>(),
  {
    obrigatorio: false,
    erro: null,
    dica: '',
    maxlength: undefined,
    contador: undefined,
  },
);
</script>

<template>
  <div class="mb-3">
    <label :for="id" class="form-label small fw-medium">
      {{ label }}
      <span v-if="obrigatorio" class="text-danger ms-1" aria-hidden="true">*</span>
    </label>
    <slot />
    <div v-if="erro" :id="`${id}-erro`" class="invalid-feedback d-block small mt-1" role="alert">
      <i class="bi bi-exclamation-circle me-1" aria-hidden="true"></i>
      {{ erro }}
    </div>
    <small v-else-if="dica" class="text-body-secondary mt-1 d-block">
      <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
      {{ dica }}
    </small>
    <small
      v-if="maxlength !== undefined && contador !== undefined"
      class="text-body-secondary mt-1 d-block text-end"
      :class="{ 'text-danger': contador > maxlength * 0.9 }"
    >
      {{ contador }}/{{ maxlength }}
    </small>
  </div>
</template>
