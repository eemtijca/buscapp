<script setup lang="ts">
import { useAutenticacao } from '@/composables/useAutenticacao';

const { carregando, offline } = useAutenticacao();
</script>

<template>
  <div v-if="carregando" class="boot-shell" role="status" aria-live="polite" aria-busy="true">
    <span class="visually-hidden">Carregando aplicação</span>
    <header class="boot-shell__topo"></header>
    <main class="boot-shell__conteudo">
      <div class="boot-shell__bloco boot-shell__bloco--titulo"></div>
      <div class="boot-shell__bloco"></div>
      <div class="boot-shell__bloco boot-shell__bloco--curto"></div>
    </main>
  </div>
  <template v-else>
    <div
      v-if="offline"
      class="alert alert-warning rounded-0 mb-0 py-2 small text-center"
      role="status"
    >
      <i class="bi bi-cloud-slash me-1" aria-hidden="true"></i>
      Sem conexão. Os dados exibidos podem estar desatualizados.
    </div>
    <router-view />
  </template>
</template>

<style scoped>
.boot-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--bs-body-bg);
}

.boot-shell__topo {
  height: 3.5rem;
  background: var(--bs-tertiary-bg);
  border-bottom: 1px solid var(--bs-border-color);
}

.boot-shell__conteudo {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.boot-shell__bloco {
  height: 3rem;
  border-radius: 0.75rem;
  background: linear-gradient(
    90deg,
    var(--bs-tertiary-bg) 25%,
    var(--bs-secondary-bg) 50%,
    var(--bs-tertiary-bg) 75%
  );
  background-size: 200% 100%;
  animation: boot-pulsar 1.4s ease-in-out infinite;
}

.boot-shell__bloco--titulo {
  width: 40%;
  height: 1.75rem;
}

.boot-shell__bloco--curto {
  width: 65%;
}

@keyframes boot-pulsar {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
</style>
