<script setup lang="ts">
import { onUnmounted, watch } from 'vue';

const props = withDefaults(
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

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Escape') emit('cancelar');
}

watch(
  () => props.visivel,
  (aberto) => {
    if (aberto) {
      window.addEventListener('keydown', aoTeclar);
    } else {
      window.removeEventListener('keydown', aoTeclar);
    }
  },
);

onUnmounted(() => {
  window.removeEventListener('keydown', aoTeclar);
});
</script>

<template>
  <div
    v-if="visivel"
    class="modal d-block"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    :aria-label="titulo"
    style="background-color: rgba(0, 0, 0, 0.5)"
  >
    <div class="modal-dialog modal-dialog-centered modal-sm">
      <div class="modal-content">
        <div class="modal-header py-2">
          <h5 class="modal-title small fw-bold">
            <i
              :class="
                'bi bi-' +
                icone +
                ' me-1 ' +
                (variante === 'success'
                  ? 'text-success'
                  : variante === 'warning'
                    ? 'text-warning-emphasis'
                    : 'text-danger')
              "
              aria-hidden="true"
            ></i>
            {{ titulo }}
          </h5>
          <button
            type="button"
            class="btn-close"
            aria-label="Fechar"
            @click="emit('cancelar')"
          ></button>
        </div>
        <div class="modal-body small">
          <p class="mb-0">{{ mensagem }}</p>
        </div>
        <div class="modal-footer py-2">
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('cancelar')">
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="
              variante === 'success'
                ? 'btn-success'
                : variante === 'warning'
                  ? 'btn-warning'
                  : 'btn-danger'
            "
            @click="emit('confirmar')"
          >
            {{ rotuloConfirmar }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
