<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAlunos } from '@/composables/consultas/useGestaoUsuarios';
import EstadoErro from '@/componentes/EstadoErro.vue';

const router = useRouter();
const route = useRoute();
const limite = ref(50);
const { alunos, pendente, atualizando, erro, recarregar } = useAlunos(() => ({ limite: limite.value }));

const busca = ref((route.query.busca as string) ?? '');
const filtroStatus = ref<'todos' | 'ativo' | 'egresso' | 'transferido' | 'inativo'>(
  (route.query.status as 'ativo' | 'egresso' | 'transferido' | 'inativo') ?? 'todos',
);

// Filtros ficam na URL para preservar o contexto no refresh e permitir link direto.
watch([busca, filtroStatus], () => {
  void router.replace({
    query: {
      ...(busca.value ? { busca: busca.value } : {}),
      ...(filtroStatus.value !== 'todos' ? { status: filtroStatus.value } : {}),
    },
  });
});

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

    <EstadoErro
      v-if="erro"
      mensagem="Não foi possível carregar os alunos."
      @tentar-novamente="recarregar()"
    />

    <div v-else-if="pendente && !alunos.length" class="text-center py-5">
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
                  :aria-label="'Editar aluno ' + aluno.nome"
                >
                  <i class="bi bi-pencil" aria-hidden="true"></i>
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="alunos.length >= limite" class="text-center mt-3">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="atualizando"
          @click="limite += 50"
        >
          <span
            v-if="atualizando"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          ></span>
          Carregar mais alunos
        </button>
      </div>
    </div>
  </div>
</template>
