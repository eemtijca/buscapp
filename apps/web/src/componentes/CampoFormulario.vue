<script setup lang="ts">
import { ref, watchEffect } from 'vue';

const props = withDefaults(
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

const container = ref<HTMLElement | null>(null);

/**
 * Associa erro e dica ao primeiro controle do slot, sem exigir que cada chamada
 * repasse `aria-describedby` e `aria-invalid` manualmente.
 */
watchEffect(() => {
  const controle = container.value?.querySelector<HTMLElement>(
    'input, select, textarea, [role="combobox"]',
  );
  if (!controle) return;

  if (props.erro) {
    controle.setAttribute('aria-invalid', 'true');
    controle.setAttribute('aria-describedby', `${props.id}-erro`);
    return;
  }

  controle.removeAttribute('aria-invalid');
  if (props.dica) controle.setAttribute('aria-describedby', `${props.id}-dica`);
  else controle.removeAttribute('aria-describedby');
});
</script>

<template>
  <div class="mb-3">
    <label :for="id" class="form-label small fw-medium">
      {{ label }}
      <span v-if="obrigatorio" class="text-danger ms-1" aria-hidden="true">*</span>
    </label>
    <div ref="container">
      <slot />
    </div>
    <div v-if="erro" :id="`${id}-erro`" class="invalid-feedback d-block small mt-1" role="alert">
      <i class="bi bi-exclamation-circle me-1" aria-hidden="true"></i>
      {{ erro }}
    </div>
    <small v-else-if="dica" :id="`${id}-dica`" class="text-body-secondary mt-1 d-block">
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
