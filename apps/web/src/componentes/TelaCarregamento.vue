<script setup lang="ts">
defineProps<{
  visivel: boolean;
  titulo?: string;
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visivel"
        class="tela-carregamento"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="tela-carregamento__conteudo">
          <div class="spinner-border text-success tela-carregamento__spinner" role="status">
            <span class="visually-hidden">Carregando</span>
          </div>
          <p class="tela-carregamento__texto mb-0">Carregando {{ titulo || 'conteúdo' }}...</p>
          <p class="tela-carregamento__subtexto small text-body-secondary mb-0">
            Aguarde um instante
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tela-carregamento {
  position: fixed;
  inset: 0;
  z-index: 1080;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
}

.tela-carregamento__conteudo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 1rem;
  padding: 1.5rem 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  max-width: 90vw;
}

.tela-carregamento__spinner {
  width: 2.5rem;
  height: 2.5rem;
  border-width: 0.25em;
}

.tela-carregamento__texto {
  font-weight: 600;
  font-size: 1rem;
  color: var(--bs-body-color);
  word-break: break-word;
}

.tela-carregamento__subtexto {
  font-size: 0.8125rem;
}

@media (max-width: 576px) {
  .tela-carregamento__conteudo {
    padding: 1.25rem 1.5rem;
  }

  .tela-carregamento__spinner {
    width: 2rem;
    height: 2rem;
  }

  .tela-carregamento__texto {
    font-size: 0.9375rem;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
