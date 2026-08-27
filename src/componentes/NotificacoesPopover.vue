<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificacoes } from '@/composables/useNotificacoes';

const router = useRouter();
const { naoLidasOutros, notificacoes, marcarTodasComoLidas, limparTodas, marcarLida, ICONE_TIPO } =
  useNotificacoes();

const aberto = ref(false);
const confirmandoLimpar = ref(false);

function toggle() {
  aberto.value = !aberto.value;
}

function handleClickOutside(e: MouseEvent) {
  if (aberto.value && !(e.target as HTMLElement)?.closest('.notif-popover')) {
    aberto.value = false;
  }
}

async function navegar(n: { id: string; rota: string; lida: boolean }) {
  if (!n.lida) void marcarLida(n.id);
  aberto.value = false;
  try {
    await router.push(n.rota);
  } catch {
    // Fallback para home em caso de rota bloqueada
    await router.push('/');
  }
}

async function handleLimparTodas() {
  await limparTodas();
  confirmandoLimpar.value = false;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', handleClickOutside);
}
</script>

<template>
  <div class="notif-popover d-inline-block position-relative">
    <button
      type="button"
      class="btn btn-outline-light btn-sm position-relative me-1"
      aria-label="Notificações"
      @click="toggle"
    >
      <i class="bi bi-bell" aria-hidden="true"></i>
      <span
        v-if="naoLidasOutros > 0"
        class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
        style="font-size: 0.6rem"
      >
        {{ naoLidasOutros > 9 ? '9+' : naoLidasOutros }}
        <span class="visually-hidden">notificações não lidas</span>
      </span>
    </button>

    <Teleport to="body">
      <div
        v-if="aberto"
        class="notif-menu shadow rounded-1 bg-body border overflow-y-auto"
        @mousedown.prevent
      >
        <div
          class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom flex-wrap gap-1"
        >
          <span class="fw-semibold small">Notificações</span>
          <div class="d-flex gap-2">
            <button
              v-if="notificacoes.length > 0"
              type="button"
              class="btn btn-sm btn-link p-0 text-decoration-none small text-danger"
              @click.stop="confirmandoLimpar = true"
            >
              Limpar todas
            </button>
            <button
              v-if="naoLidasOutros > 0"
              type="button"
              class="btn btn-sm btn-link p-0 text-decoration-none small"
              @click.stop="marcarTodasComoLidas()"
            >
              Marcar todas como lidas
            </button>
          </div>
        </div>

        <div v-if="!notificacoes.length" class="text-center py-3 text-body-secondary small">
          Nenhuma notificação.
        </div>

        <button
          v-for="n in notificacoes"
          :key="n.id"
          type="button"
          class="d-flex gap-2 px-3 py-2 w-100 text-start border-0 bg-transparent position-relative"
          :class="{
            'border-start border-3 border-primary bg-primary bg-opacity-10': !n.lida,
            'bg-white': n.lida,
          }"
          @click="navegar(n)"
        >
          <span
            class="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0 mt-1 position-relative"
            :class="n.lida ? 'text-body-tertiary' : 'text-primary'"
            style="width: 28px; height: 28px; font-size: 0.9rem"
          >
            <i :class="'bi bi-' + (ICONE_TIPO[n.tipo] || 'bell')"></i>
            <span
              v-if="!n.lida"
              class="position-absolute rounded-circle bg-primary"
              style="width: 6px; height: 6px; top: 2px; right: 2px"
            ></span>
          </span>
          <div class="min-w-0">
            <div
              class="small text-truncate"
              :class="{ 'fw-semibold text-body': !n.lida, 'text-body': n.lida }"
            >
              {{ n.titulo }}
            </div>
            <div v-if="n.corpo" class="small text-body-secondary text-truncate">
              {{ n.corpo }}
            </div>
            <div class="small text-body-tertiary">{{ n.tempoRelativo }}</div>
          </div>
        </button>
      </div>

      <div
        v-if="confirmandoLimpar"
        class="notif-confirm-overlay d-flex align-items-center justify-content-center"
        @mousedown.prevent
      >
        <div class="bg-white rounded-3 shadow-lg p-3 text-center" style="max-width: 280px">
          <p class="small mb-2">Tem certeza que deseja limpar todas as notificações?</p>
          <div class="d-flex gap-2 justify-content-center">
            <button
              type="button"
              class="btn btn-sm btn-secondary"
              @click="confirmandoLimpar = false"
            >
              Cancelar
            </button>
            <button type="button" class="btn btn-sm btn-danger" @click="handleLimparTodas">
              Limpar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}

.notif-menu {
  position: fixed;
  top: 48px;
  right: 12px;
  width: 320px;
  max-height: 480px;
  z-index: 1050;
}

.notif-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1060;
}

@media (max-width: 575px) {
  .notif-menu {
    right: 8px;
    left: 8px;
    width: auto;
    max-height: 60vh;
  }
}
</style>
