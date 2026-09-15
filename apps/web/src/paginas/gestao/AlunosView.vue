<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGestaoUsuarios } from '@/composables/useGestaoUsuarios';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import type { AlunoItem } from '@/tipos/componentes';

const router = useRouter();
const { buscarAlunos, carregando } = useGestaoUsuarios();
const {
  ultimaAtualizacao,
  estaAtualizando,
  atualizar: refresh,
  inscrever,
  encerrar,
} = useRealtimeRefresh();

const alunos = ref<AlunoItem[]>([]);
const busca = ref('');
const filtroStatus = ref<'todos' | 'ativo' | 'egresso' | 'transferido' | 'inativo'>('todos');

const alunosFiltrados = computed(() => {
  let lista = alunos.value;
  if (filtroStatus.value !== 'todos') {
    lista = lista.filter((a) => a.status === filtroStatus.value);
  }
  if (busca.value.trim()) {
    const termo = busca.value.toLowerCase().trim();
    lista = lista.filter(
      (a) => a.nome.toLowerCase().includes(termo) || a.matricula.toLowerCase().includes(termo),
    );
  }
  return lista;
});

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ativo: 'success',
    egresso: 'info',
    transferido: 'warning',
    inativo: 'secondary',
  };
  return map[status] ?? 'secondary';
};

async function carregarAlunos() {
  alunos.value = await buscarAlunos();
}

async function atualizarManual() {
  await refresh(carregarAlunos);
}

onMounted(async () => {
  await carregarAlunos();
  // Enturmacoes na inscrição: matrícula nova aparece na lista sem recarregar.
  await inscrever([{ tabela: 'alunos' }, { tabela: 'enturmacoes' }], carregarAlunos);
});

onUnmounted(() => {
  encerrar();
});
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
        <i class="bi bi-book text-success me-2" aria-hidden="true"></i>
        Alunos
      </h1>
      <div class="d-flex align-items-center gap-2">
        <router-link to="/gestao/alunos/novo" class="btn btn-sm btn-success">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
          Novo aluno
        </router-link>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="estaAtualizando"
          @click="atualizarManual"
          title="Recarregar dados"
        >
          <span
            v-if="estaAtualizando"
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

    <div v-if="ultimaAtualizacao" class="small text-body-tertiary mb-2 text-end">
      <i class="bi bi-clock me-1" aria-hidden="true"></i>
      Última atualização: {{ ultimaAtualizacao.toLocaleTimeString('pt-BR') }}
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <div class="btn-group btn-group-sm" role="group" aria-label="Filtrar por status">
        <input
          v-model="filtroStatus"
          type="radio"
          class="btn-check"
          name="filtroStatus"
          id="statusTodos"
          value="todos"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="statusTodos">Todos</label>
        <input
          v-model="filtroStatus"
          type="radio"
          class="btn-check"
          name="filtroStatus"
          id="statusAtivo"
          value="ativo"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="statusAtivo">Ativo</label>
        <input
          v-model="filtroStatus"
          type="radio"
          class="btn-check"
          name="filtroStatus"
          id="statusEgresso"
          value="egresso"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="statusEgresso">Egresso</label>
        <input
          v-model="filtroStatus"
          type="radio"
          class="btn-check"
          name="filtroStatus"
          id="statusTransferido"
          value="transferido"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="statusTransferido">Transferido</label>
      </div>
      <div class="input-group input-group-sm flex-grow-1" style="min-width: 200px">
        <span class="input-group-text bg-body-tertiary"
          ><i class="bi bi-search" aria-hidden="true"></i
        ></span>
        <input
          v-model="busca"
          type="search"
          class="form-control"
          placeholder="Buscar por nome ou matrícula"
          aria-label="Buscar aluno"
        />
      </div>
    </div>

    <div v-if="carregando && !alunos.length" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="mt-2 text-body-secondary small mb-0">Carregando alunos...</p>
    </div>

    <div v-else-if="!alunos.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-book fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhum aluno cadastrado.</p>
    </div>

    <div v-else-if="!alunosFiltrados.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-search fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhum aluno encontrado com os filtros atuais.</p>
    </div>

    <div v-else class="card border">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 small">
          <thead class="table-light">
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Matrícula</th>
              <th scope="col">Turma</th>
              <th scope="col">Indicadores</th>
              <th scope="col">Documentos</th>
              <th scope="col">Status</th>
              <th scope="col" class="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="aluno in alunosFiltrados" :key="aluno.id">
              <td class="fw-medium">{{ aluno.nome }}</td>
              <td class="text-body-secondary">{{ aluno.matricula }}</td>
              <td>{{ aluno.turma ?? '—' }}</td>
              <td>
                <div class="d-flex gap-1 flex-wrap">
                  <i
                    v-if="aluno.transporte_escolar"
                    class="bi bi-bus-front text-success"
                    title="Transporte escolar"
                    aria-hidden="true"
                  ></i>
                  <i
                    v-if="aluno.alimentacao_diferenciada"
                    class="bi bi-cup-hot text-info"
                    title="Alimentação diferenciada"
                    aria-hidden="true"
                  ></i>
                  <i
                    v-if="aluno.necessidades_especiais"
                    class="bi bi-universal-access text-primary"
                    title="Necessidades especiais"
                    aria-hidden="true"
                  ></i>
                </div>
              </td>
              <td>
                <span
                  v-if="aluno.documentos_recebidos.length"
                  class="badge text-bg-light border small"
                  :title="'Documentos: ' + aluno.documentos_recebidos.join(', ')"
                >
                  {{ aluno.documentos_recebidos.length }}
                </span>
                <span v-else class="text-body-tertiary small">—</span>
              </td>
              <td>
                <span class="badge" :class="'text-bg-' + statusBadge(aluno.status)">
                  {{ aluno.status }}
                </span>
              </td>
              <td class="text-end">
                <router-link
                  :to="'/gestao/alunos/' + aluno.id"
                  class="btn btn-sm btn-outline-success"
                >
                  <i class="bi bi-pencil" aria-hidden="true"></i>
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
