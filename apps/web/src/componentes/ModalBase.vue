<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui';

withDefaults(
  defineProps<{
    visivel: boolean;
    titulo: string;
    descricao?: string;
    largura?: 'sm' | 'md' | 'lg';
    /** Ícone Bootstrap decorativo exibido antes do título. */
    icone?: string;
    corIcone?: string;
    /** Rótulo acessível do botão de fechar. */
    rotuloFechar?: string;
  }>(),
  {
    descricao: undefined,
    largura: 'md',
    icone: undefined,
    corIcone: undefined,
    rotuloFechar: 'Fechar',
  },
);

const emit = defineEmits<{
  'update:visivel': [valor: boolean];
}>();

/** `DialogRoot` fecha por Escape, clique fora e botão de fechar. */
function aoMudarAberto(aberto: boolean): void {
  if (!aberto) emit('update:visivel', false);
}

const CLASSE_LARGURA: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'modal-sm',
  md: '',
  lg: 'modal-lg',
};
</script>

<template>
  <DialogRoot :open="visivel" @update:open="aoMudarAberto">
    <DialogPortal>
      <DialogOverlay class="modal-backdrop fade show" style="z-index: 1055" />
      <DialogContent class="modal d-block" style="z-index: 1056">
        <div class="modal-dialog modal-dialog-centered" :class="CLASSE_LARGURA[largura]">
          <div class="modal-content">
            <div class="modal-header py-2">
              <DialogTitle class="modal-title small fw-bold">
                <i
                  v-if="icone"
                  :class="['bi', 'bi-' + icone, 'me-1', corIcone]"
                  aria-hidden="true"
                ></i>
                {{ titulo }}
              </DialogTitle>
              <DialogClose class="btn-close" :aria-label="rotuloFechar" />
            </div>
            <div class="modal-body small">
              <slot />
              <DialogDescription v-if="descricao" class="mb-0">{{ descricao }}</DialogDescription>
            </div>
            <div class="modal-footer py-2">
              <slot name="rodape" />
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
