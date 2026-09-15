<script setup lang="ts">
import { onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useStatusConexao } from '@/composables/useStatusConexao';
import { useNotificacoes } from '@/composables/useNotificacoes';
import IndicadorConexao from '@/componentes/IndicadorConexao.vue';
import CabecalhoNavegacao from '@/componentes/CabecalhoNavegacao.vue';
import NotificacoesPopover from '@/componentes/NotificacoesPopover.vue';

const router = useRouter();
const { usuario, logout } = useAutenticacao();
const { status } = useStatusConexao();
const { naoLidasMensagens, iniciar, parar } = useNotificacoes();

watch(
  usuario,
  (val) => {
    if (val?.id) {
      void iniciar(val.id);
    } else {
      parar();
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  parar();
});

async function handleLogout(): Promise<void> {
  await logout();
  await router.push('/');
}

const rotaInicio = () => {
  if (!usuario.value?.papel) return '/';
  if (usuario.value.papel === 'professor') return '/professor';
  if (usuario.value.papel === 'gestao') return '/gestao';
  if (usuario.value.papel === 'responsavel') return '/responsavel';
  return '/';
};

const papelChat = () => {
  if (usuario.value?.papel === 'gestao' || usuario.value?.papel === 'responsavel')
    return usuario.value.papel;
  return null;
};
</script>

<template>
  <div class="d-flex flex-column overflow-hidden" style="height: 100dvh">
    <CabecalhoNavegacao variante="dashboard" :itens="[]" marca="BuscApp" :rotaMarca="rotaInicio()">
      <template #usuario>
        <!-- Botão de chat (apenas responsável e gestão) -->
        <router-link
          v-if="papelChat()"
          :to="`/${papelChat()}/chat`"
          class="btn btn-outline-light btn-sm position-relative me-1"
          aria-label="Chat"
        >
          <i class="bi bi-chat-dots" aria-hidden="true"></i>
          <span
            v-if="naoLidasMensagens > 0"
            class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style="font-size: 0.6rem"
          >
            {{ naoLidasMensagens > 9 ? '9+' : naoLidasMensagens }}
            <span class="visually-hidden">mensagens não lidas</span>
          </span>
        </router-link>

        <!-- Notificações (outros tipos) -->
        <NotificacoesPopover />

        <div class="dropdown">
          <button
            type="button"
            class="btn btn-outline-light btn-sm d-flex align-items-center gap-1"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            :aria-label="'Menu do usuário ' + (usuario?.nome || '')"
          >
            <i class="bi bi-person-circle" aria-hidden="true"></i>
            <span class="d-inline text-truncate" style="max-width: 140px">
              {{ usuario?.nome || 'Conta' }}
            </span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow">
            <li>
              <h6 class="dropdown-header">
                <i class="bi bi-person me-1" aria-hidden="true"></i>
                {{ usuario?.nome || 'Usuário' }}
              </h6>
            </li>
            <li v-if="usuario?.email">
              <span class="dropdown-item-text small text-body-secondary">
                {{ usuario.email }}
              </span>
            </li>
            <li><hr class="dropdown-divider" /></li>
            <li>
              <button
                type="button"
                class="dropdown-item d-flex align-items-center gap-2"
                @click="handleLogout"
              >
                <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
                Sair da conta
              </button>
            </li>
          </ul>
        </div>
      </template>
    </CabecalhoNavegacao>

    <main id="conteudoPrincipal" class="flex-grow-1 overflow-y-auto" role="main" tabindex="-1">
      <router-view />
    </main>

    <footer class="flex-shrink-0 bg-body-tertiary border-top py-1">
      <div
        class="d-flex flex-wrap justify-content-between align-items-center gap-2 small text-body-secondary px-3"
      >
        <IndicadorConexao :status="status" />
        <span>v0.1.0</span>
      </div>
    </footer>
  </div>
</template>
