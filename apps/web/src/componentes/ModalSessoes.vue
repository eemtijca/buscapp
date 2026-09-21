<script setup lang="ts">
import { ref, watch } from 'vue';
import { api, ErroApi } from '@/servicos/api';
import ModalBase from '@/componentes/ModalBase.vue';

interface SessaoApi {
  id: string;
  criado_em: string;
  ultimo_uso_em: string | null;
  expira_em: string;
  user_agent: string | null;
  ip: string | null;
  atual: boolean;
}

const props = defineProps<{ visivel: boolean }>();
const emit = defineEmits<{ 'update:visivel': [valor: boolean] }>();

const sessoes = ref<SessaoApi[]>([]);
const carregando = ref(false);
const encerrando = ref(false);
const mensagem = ref<string | null>(null);
const erro = ref<string | null>(null);

function formatarDataHora(iso: string | null): string {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function resumoDispositivo(userAgent: string | null): string {
  if (!userAgent) return 'Dispositivo não identificado';
  if (/mobile|android|iphone/i.test(userAgent)) return 'Celular';
  if (/tablet|ipad/i.test(userAgent)) return 'Tablet';
  return 'Computador';
}

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const resposta = await api<{ sessoes: SessaoApi[] }>('/api/auth/sessoes');
    sessoes.value = resposta.sessoes;
  } catch (falha) {
    erro.value =
      falha instanceof ErroApi ? falha.message : 'Não foi possível carregar as sessões ativas.';
  } finally {
    carregando.value = false;
  }
}

async function encerrarOutras() {
  encerrando.value = true;
  erro.value = null;
  mensagem.value = null;
  try {
    const resposta = await api<{ ok: true; revogadas: number }>('/api/auth/sessoes', {
      metodo: 'DELETE',
    });
    mensagem.value =
      resposta.revogadas > 0
        ? `${resposta.revogadas} sessão(ões) encerrada(s).`
        : 'Nenhuma outra sessão ativa.';
    await carregar();
  } catch (falha) {
    erro.value =
      falha instanceof ErroApi ? falha.message : 'Não foi possível encerrar as outras sessões.';
  } finally {
    encerrando.value = false;
  }
}

watch(
  () => props.visivel,
  (aberto) => {
    if (!aberto) return;
    mensagem.value = null;
    erro.value = null;
    void carregar();
  },
);
</script>

<template>
  <ModalBase
    :visivel="visivel"
    titulo="Sessões ativas"
    icone="shield-check"
    cor-icone="text-success"
    @update:visivel="(aberto) => !aberto && emit('update:visivel', false)"
  >
    <p class="small text-body-secondary">
      Estes são os acessos com a sua conta. A sessão atual é mantida ao encerrar as demais.
    </p>

    <div v-if="carregando" class="text-center py-3" aria-busy="true">
      <div class="spinner-border spinner-border-sm text-primary" role="status">
        <span class="visually-hidden">Carregando sessões</span>
      </div>
    </div>

    <div v-else-if="erro" class="alert alert-danger py-2 small" role="alert">{{ erro }}</div>

    <div v-else-if="mensagem" class="alert alert-success py-2 small" role="status">
      {{ mensagem }}
    </div>

    <ul v-if="!carregando" class="list-unstyled mb-0">
      <li
        v-for="sessao in sessoes"
        :key="sessao.id"
        class="border rounded p-2 mb-2 d-flex justify-content-between align-items-start gap-2"
      >
        <div class="small">
          <p class="mb-0 fw-medium">
            {{ resumoDispositivo(sessao.user_agent) }}
            <span v-if="sessao.atual" class="badge text-bg-success ms-1">Atual</span>
          </p>
          <p class="mb-0 text-body-secondary">
            Início: {{ formatarDataHora(sessao.criado_em) }} · Último uso:
            {{ formatarDataHora(sessao.ultimo_uso_em) }}
          </p>
          <p v-if="sessao.ip" class="mb-0 text-body-tertiary">IP: {{ sessao.ip }}</p>
        </div>
      </li>
    </ul>

    <template #rodape>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        @click="emit('update:visivel', false)"
      >
        Fechar
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-danger"
        :disabled="encerrando || carregando"
        @click="encerrarOutras"
      >
        <span
          v-if="encerrando"
          class="spinner-border spinner-border-sm me-1"
          role="status"
          aria-hidden="true"
        ></span>
        <i v-else class="bi bi-box-arrow-right me-1" aria-hidden="true"></i>
        Encerrar outras sessões
      </button>
    </template>
  </ModalBase>
</template>
