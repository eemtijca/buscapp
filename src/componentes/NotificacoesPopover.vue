<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabaseClient } from '@/servicos/supabase';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { timestampRelativo } from '@/utils/chatUtils';
import type { Notificacao } from '@/tipos/database';
import type { NotificacaoItem } from '@/tipos/componentes';

const router = useRouter();
const { usuario } = useAutenticacao();

const notificacoes = ref<NotificacaoItem[]>([]);
const naoLidas = ref(0);
const aberto = ref(false);
const botaoRef = ref<HTMLElement | null>(null);

let canal: ReturnType<typeof supabaseClient.channel> | null = null;

const ICONE_TIPO: Record<string, string> = {
  mensagem: 'chat-dots',
  ausencia_portao: 'door-open',
  ausencia_aula: 'book-x',
  monitoramento: 'person-lines-fill',
  ocorrencia: 'shield-exclamation',
  justificativa: 'clipboard-check',
  sistema: 'gear',
  codigo_redefinicao: 'key',
};

function rotaPorTipo(tipo: string, metadados?: Record<string, unknown> | null): string {
  void metadados;
  const papel = usuario.value?.papel;
  if (tipo === 'mensagem') {
    if (papel === 'responsavel') return '/responsavel/chat';
    if (papel === 'gestao') return '/gestao/chat';
    if (papel === 'professor') return '/professor/chat';
  }
  if (tipo === 'ausencia_portao' || tipo === 'ausencia_aula') {
    if (papel === 'responsavel') return '/responsavel/alertas';
    return '/gestao/ranking';
  }
  if (tipo === 'ocorrencia') return '/gestao/ocorrencias';
  if (tipo === 'justificativa') return '/gestao/justificativas';
  if (tipo === 'codigo_redefinicao') return '/gestao/codigos';
  return papel ? `/${papel}` : '/';
}

async function carregarNotificacoes() {
  if (!usuario.value) return;
  const { data } = await supabaseClient
    .from('notificacoes')
    .select('*')
    .eq('destinatario_id', usuario.value.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (data) {
    const items = (data as unknown as Notificacao[]).map((n: Notificacao) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      corpo: n.corpo,
      tempoRelativo: timestampRelativo(n.created_at),
      lida: n.lida,
      rota: rotaPorTipo(n.tipo, n.metadados as Record<string, unknown> | null),
    }));
    notificacoes.value = items;
    naoLidas.value = items.filter((n) => !n.lida).length;
  }
}

async function marcarTodasComoLidas() {
  if (!usuario.value) return;
  await supabaseClient
    .from('notificacoes')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('destinatario_id', usuario.value.id)
    .eq('lida', false);
  await carregarNotificacoes();
}

function toggle() {
  aberto.value = !aberto.value;
}

function navegar(notif: NotificacaoItem) {
  aberto.value = false;
  router.push(notif.rota);
}

function handleClickOutside(e: MouseEvent) {
  if (aberto.value && botaoRef.value && !botaoRef.value.contains(e.target as Node)) {
    aberto.value = false;
  }
}

onMounted(() => {
  carregarNotificacoes();
  if (usuario.value) {
    canal = supabaseClient
      .channel('notificacoes-popover')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `destinatario_id=eq.${usuario.value.id}`,
        },
        () => carregarNotificacoes(),
      )
      .subscribe();
  }
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  if (canal) supabaseClient.removeChannel(canal);
  document.removeEventListener('click', handleClickOutside);
});

defineExpose({ naoLidas });
</script>

<template>
  <div ref="botaoRef" class="notif-popover d-inline-block position-relative">
    <button
      type="button"
      class="btn btn-outline-light btn-sm position-relative me-1"
      :class="{ show: aberto }"
      aria-label="Notificações"
      @click="toggle"
    >
      <i class="bi bi-bell" aria-hidden="true"></i>
      <span
        v-if="naoLidas > 0"
        class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
        style="font-size: 0.6rem"
      >
        {{ naoLidas > 9 ? '9+' : naoLidas }}
        <span class="visually-hidden">notificações não lidas</span>
      </span>
    </button>

    <Teleport to="body">
      <div
        v-if="aberto"
        class="notif-menu shadow rounded-1 bg-body border overflow-y-auto"
        :class="{ 'd-block': aberto }"
        @mousedown.prevent
      >
        <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
          <span class="fw-semibold small">Notificações</span>
          <button
            v-if="naoLidas > 0"
            type="button"
            class="btn btn-sm btn-link p-0 text-decoration-none small"
            @click="marcarTodasComoLidas"
          >
            Marcar todas como lidas
          </button>
        </div>

        <div v-if="!notificacoes.length" class="text-center py-3 text-body-secondary small">
          Nenhuma notificação.
        </div>

        <button
          v-for="notif in notificacoes"
          :key="notif.id"
          type="button"
          class="d-flex gap-2 px-3 py-2 w-100 text-start border-0 bg-transparent"
          :class="{ 'bg-light': !notif.lida }"
          @click="navegar(notif)"
        >
          <span
            class="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0 mt-1"
            :class="notif.lida ? 'text-body-tertiary' : 'text-primary'"
            style="width: 28px; height: 28px; font-size: 0.9rem"
          >
            <i :class="'bi bi-' + (ICONE_TIPO[notif.tipo] || 'bell')"></i>
          </span>
          <div class="min-w-0">
            <div class="small fw-semibold text-truncate" :class="{ 'text-body': !notif.lida }">
              {{ notif.titulo }}
            </div>
            <div v-if="notif.corpo" class="small text-body-secondary text-truncate">
              {{ notif.corpo }}
            </div>
            <div class="small text-body-tertiary">{{ notif.tempoRelativo }}</div>
          </div>
        </button>
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

@media (max-width: 575px) {
  .notif-menu {
    right: 8px;
    left: 8px;
    width: auto;
    max-height: 60vh;
  }
}
</style>
