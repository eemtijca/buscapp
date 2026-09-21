<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRankingRisco } from '@/composables/consultas/useMonitoramento';
import { abrirConversaDoAluno } from '@/composables/consultas/useChat';
import CartaoAlunoRisco from '@/componentes/CartaoAlunoRisco.vue';
import type { AlunoRisco } from '@/tipos/componentes';

const router = useRouter();
const route = useRoute();
const { ranking, pendente, atualizando, erro, recarregar } = useRankingRisco();

const filtroRisco = ref<'todos' | 'alto' | 'medio' | 'baixo'>(
  (route.query.risco as 'alto' | 'medio' | 'baixo') ?? 'todos',
);
const buscaAluno = ref((route.query.busca as string) ?? '');

// Filtros ficam na URL para preservar o contexto no refresh e permitir link direto.
watch([filtroRisco, buscaAluno], () => {
  void router.replace({
    query: {
      ...(filtroRisco.value !== 'todos' ? { risco: filtroRisco.value } : {}),
      ...(buscaAluno.value ? { busca: buscaAluno.value } : {}),
    },
  });
});
const mensagemInfo = ref<string | null>(null);

let timeoutInfo: ReturnType<typeof setTimeout> | null = null;

function mostrarInfo(msg: string) {
  mensagemInfo.value = msg;
  if (timeoutInfo) clearTimeout(timeoutInfo);
  timeoutInfo = setTimeout(() => (mensagemInfo.value = null), 5000);
}

const rankingFiltrado = computed<AlunoRisco[]>(() => {
  let lista = ranking.value;
  if (filtroRisco.value !== 'todos') {
    lista = lista.filter((aluno) => aluno.nivel === filtroRisco.value);
  }
  if (buscaAluno.value.trim()) {
    const termo = buscaAluno.value.toLowerCase().trim();
    lista = lista.filter(
      (aluno) =>
        aluno.nome.toLowerCase().includes(termo) ||
        aluno.matricula.toLowerCase().includes(termo) ||
        (aluno.turma ?? '').toLowerCase().includes(termo),
    );
  }
  return lista;
});

const totalRiscoAlto = computed(() => ranking.value.filter((r) => r.nivel === 'alto').length);
const totalRiscoMedio = computed(() => ranking.value.filter((r) => r.nivel === 'medio').length);
const totalRiscoBaixo = computed(() => ranking.value.filter((r) => r.nivel === 'baixo').length);

async function abrirChat(alunoId: string) {
  const conversaId = await abrirConversaDoAluno(alunoId);
  if (!conversaId) {
    mostrarInfo('Não foi possível abrir o chat: aluno sem responsável ou turma vinculados.');
    return;
  }
  await router.push({ path: '/gestao/chat', query: { conversa: conversaId } });
}

async function registrarFalta(alunoId: string) {
  await router.push({ path: '/gestao/infrequencias', query: { aluno: alunoId } });
}

/** O ranking não tem tela de detalhes própria: leva ao histórico de infrequências do aluno. */
async function abrirDetalhes(alunoId: string) {
  await router.push({ path: '/gestao/infrequencias', query: { aluno: alunoId } });
}
</script>

<template>
  <div class="container py-4" style="max-width: 960px">
    <router-link to="/gestao" class="btn btn-sm btn-outline-success me-2 mb-3">
      <i class="bi bi-house me-1" aria-hidden="true"></i>
      Início
    </router-link>
    <button type="button" class="btn btn-sm btn-outline-secondary mb-3" @click="router.back()">
      <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
      Voltar
    </button>

    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h1 class="h5 fw-bold mb-0">
        <i class="bi bi-bar-chart text-danger me-2" aria-hidden="true"></i>
        Ranking de priorização de risco
      </h1>
      <div class="d-flex align-items-center gap-2">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="atualizando"
          @click="recarregar"
          title="Recarregar dados"
        >
          <span
            v-if="atualizando"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          ></span>
          <i v-else class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
          Atualizar
        </button>
        <span class="rounded-circle d-inline-block" style="width: 8px; height: 8px"></span>
      </div>
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <div class="btn-group btn-group-sm" role="group" aria-label="Filtrar por nível de risco">
        <input
          v-model="filtroRisco"
          type="radio"
          class="btn-check"
          name="filtroRisco"
          id="filtroTodos"
          value="todos"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="filtroTodos">Todos</label>
        <input
          v-model="filtroRisco"
          type="radio"
          class="btn-check"
          name="filtroRisco"
          id="filtroAlto"
          value="alto"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="filtroAlto">Críticos</label>
        <input
          v-model="filtroRisco"
          type="radio"
          class="btn-check"
          name="filtroRisco"
          id="filtroMedio"
          value="medio"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="filtroMedio">Atenção</label>
        <input
          v-model="filtroRisco"
          type="radio"
          class="btn-check"
          name="filtroRisco"
          id="filtroBaixo"
          value="baixo"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="filtroBaixo">Estável</label>
      </div>
      <div class="input-group input-group-sm flex-grow-1" style="min-width: 200px">
        <span class="input-group-text bg-body-tertiary"
          ><i class="bi bi-search" aria-hidden="true"></i
        ></span>
        <input
          v-model="buscaAluno"
          type="search"
          class="form-control"
          placeholder="Buscar aluno"
          aria-label="Buscar no ranking"
        />
      </div>
    </div>

    <div class="d-flex gap-2 mb-3 small">
      <span class="badge text-bg-danger">{{ totalRiscoAlto }} crítico</span>
      <span class="badge text-bg-warning">{{ totalRiscoMedio }} atenção</span>
      <span class="badge text-bg-success">{{ totalRiscoBaixo }} estável</span>
    </div>

    <div
      v-if="mensagemInfo"
      class="alert alert-info py-2 small d-flex align-items-center mb-3"
      role="status"
    >
      <i class="bi bi-info-circle me-2" aria-hidden="true"></i>
      {{ mensagemInfo }}
    </div>

    <div v-if="pendente && !ranking.length" class="text-center py-5" aria-busy="true">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="mt-2 text-body-secondary small mb-0">Calculando prioridades...</p>
    </div>

    <div
      v-else-if="erro && !ranking.length"
      class="alert alert-danger d-flex align-items-center justify-content-between gap-3"
    >
      <span>
        <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
        Não foi possível carregar o ranking. Verifique a conexão e tente novamente.
      </span>
      <button type="button" class="btn btn-sm btn-outline-danger" @click="recarregar">
        Tentar novamente
      </button>
    </div>

    <div v-else-if="!ranking.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-people fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhum aluno cadastrado.</p>
    </div>

    <div v-else-if="!rankingFiltrado.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-search fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhum aluno encontrado com os filtros atuais.</p>
    </div>

    <div v-else class="d-flex flex-column gap-2">
      <CartaoAlunoRisco
        v-for="aluno in rankingFiltrado"
        :key="aluno.id"
        :aluno="aluno"
        @chat="abrirChat"
        @registrar-falta="registrarFalta"
        @ver-detalhes="abrirDetalhes"
      />
    </div>
  </div>
</template>
