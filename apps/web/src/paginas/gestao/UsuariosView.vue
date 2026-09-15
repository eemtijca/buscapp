<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGestaoUsuarios } from '@/composables/useGestaoUsuarios';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import ModalConfirmacao from '@/componentes/ModalConfirmacao.vue';
import type { UsuarioItem } from '@/tipos/componentes';

const router = useRouter();
const { buscarUsuarios, ativarUsuario, desativarUsuario, carregando } = useGestaoUsuarios();
const {
  ultimaAtualizacao,
  estaAtualizando,
  atualizar: refresh,
  inscrever,
  encerrar,
} = useRealtimeRefresh();

const usuarios = ref<UsuarioItem[]>([]);
const busca = ref('');
const filtroPapel = ref<'todos' | 'professor' | 'responsavel'>('todos');
const filtroStatus = ref<'todos' | 'ativo' | 'pendente' | 'inativo'>('todos');
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);
const confirmacaoPendente = ref<{ usuario: UsuarioItem; acao: 'ativar' | 'desativar' } | null>(
  null,
);

const tituloConfirmacao = computed(() =>
  confirmacaoPendente.value?.acao === 'desativar' ? 'Desativar usuário' : 'Ativar usuário',
);
const mensagemConfirmacao = computed(() => {
  const pendente = confirmacaoPendente.value;
  if (!pendente) return '';
  return pendente.acao === 'desativar'
    ? `Deseja realmente desativar ${pendente.usuario.nome}? O acesso ao sistema será bloqueado imediatamente.`
    : `Deseja realmente ativar ${pendente.usuario.nome}? O usuário voltará a ter acesso ao sistema.`;
});

function mostrarSucesso(msg: string) {
  mensagemSucesso.value = msg;
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}

function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
}

const usuariosFiltrados = computed(() => {
  let lista = usuarios.value;
  if (filtroPapel.value !== 'todos') {
    lista = lista.filter((u) => u.papel === filtroPapel.value);
  }
  if (filtroStatus.value !== 'todos') {
    lista = lista.filter((u) => u.status === filtroStatus.value);
  }
  if (busca.value.trim()) {
    const termo = busca.value.toLowerCase().trim();
    lista = lista.filter(
      (u) => u.nome.toLowerCase().includes(termo) || (u.email ?? '').toLowerCase().includes(termo),
    );
  }
  return lista;
});

const papelBadge = (papel: string) => {
  const map: Record<string, string> = {
    professor: 'primary',
    responsavel: 'success',
    gestao: 'dark',
  };
  return map[papel] ?? 'secondary';
};

const papelLabel = (papel: string) => {
  const map: Record<string, string> = {
    professor: 'Professor',
    responsavel: 'Responsável',
    gestao: 'Gestão',
  };
  return map[papel] ?? papel;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ativo: 'success',
    pendente: 'warning',
    inativo: 'secondary',
  };
  return map[status] ?? 'secondary';
};

function toggleAtivacao(usuario: UsuarioItem) {
  // Perfis de papel gestao não podem ser desativados pela interface.
  if (usuario.papel === 'gestao') return;
  confirmacaoPendente.value = {
    usuario,
    acao: usuario.status === 'ativo' ? 'desativar' : 'ativar',
  };
}

async function executarToggleAtivacao() {
  const pendente = confirmacaoPendente.value;
  if (!pendente) return;
  const { usuario, acao } = pendente;
  confirmacaoPendente.value = null;
  if (acao === 'desativar') {
    const ok = await desativarUsuario(usuario.id);
    if (ok) {
      usuario.status = 'inativo';
      mostrarSucesso('Usuário desativado.');
    } else {
      mostrarErro('Falha ao desativar usuário.');
    }
  } else {
    const ok = await ativarUsuario(usuario.id);
    if (ok) {
      usuario.status = 'ativo';
      mostrarSucesso('Usuário ativado.');
    } else {
      mostrarErro('Falha ao ativar usuário.');
    }
  }
}

async function carregarUsuarios() {
  usuarios.value = await buscarUsuarios();
}

async function atualizarManual() {
  await refresh(carregarUsuarios);
}

onMounted(async () => {
  await carregarUsuarios();
  await inscrever([{ tabela: 'perfis' }], carregarUsuarios);
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
        <i class="bi bi-people text-success me-2" aria-hidden="true"></i>
        Usuários
      </h1>
      <div class="d-flex align-items-center gap-2">
        <router-link to="/gestao/usuarios/novo" class="btn btn-sm btn-success">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
          Novo usuário
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

    <div v-if="mensagemSucesso" class="alert alert-success py-2 small mb-3" role="status">
      <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
      {{ mensagemSucesso }}
    </div>
    <div v-if="mensagemErro" class="alert alert-danger py-2 small mb-3" role="alert">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
      {{ mensagemErro }}
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <div class="btn-group btn-group-sm" role="group" aria-label="Filtrar por papel">
        <input
          v-model="filtroPapel"
          type="radio"
          class="btn-check"
          name="filtroPapel"
          id="papelTodos"
          value="todos"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="papelTodos">Todos</label>
        <input
          v-model="filtroPapel"
          type="radio"
          class="btn-check"
          name="filtroPapel"
          id="papelProfessor"
          value="professor"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="papelProfessor">Professores</label>
        <input
          v-model="filtroPapel"
          type="radio"
          class="btn-check"
          name="filtroPapel"
          id="papelResponsavel"
          value="responsavel"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="papelResponsavel">Responsáveis</label>
      </div>
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
          id="statusPendente"
          value="pendente"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="statusPendente">Pendente</label>
        <input
          v-model="filtroStatus"
          type="radio"
          class="btn-check"
          name="filtroStatus"
          id="statusInativo"
          value="inativo"
          autocomplete="off"
        />
        <label class="btn btn-outline-secondary" for="statusInativo">Inativo</label>
      </div>
      <div class="input-group input-group-sm flex-grow-1" style="min-width: 200px">
        <span class="input-group-text bg-body-tertiary"
          ><i class="bi bi-search" aria-hidden="true"></i
        ></span>
        <input
          v-model="busca"
          type="search"
          class="form-control"
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar usuário"
        />
      </div>
    </div>

    <div v-if="carregando && !usuarios.length" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="mt-2 text-body-secondary small mb-0">Carregando usuários...</p>
    </div>

    <div v-else-if="!usuarios.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-people fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhum usuário cadastrado.</p>
    </div>

    <div v-else-if="!usuariosFiltrados.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-search fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhum usuário encontrado com os filtros atuais.</p>
    </div>

    <div v-else class="card border">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 small">
          <thead class="table-light">
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">E-mail</th>
              <th scope="col">Papel</th>
              <th scope="col">Status</th>
              <th scope="col">Acesso</th>
              <th scope="col" class="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="usuario in usuariosFiltrados" :key="usuario.id">
              <td class="fw-medium">{{ usuario.nome }}</td>
              <td class="text-body-secondary">{{ usuario.email ?? '—' }}</td>
              <td>
                <span class="badge" :class="'text-bg-' + papelBadge(usuario.papel)">
                  {{ papelLabel(usuario.papel) }}
                </span>
              </td>
              <td>
                <span class="badge" :class="'text-bg-' + statusBadge(usuario.status)">
                  {{ usuario.status }}
                </span>
              </td>
              <td>
                <div class="d-flex gap-1">
                  <i
                    v-if="usuario.notificacoes_ativas"
                    class="bi bi-bell-fill text-success"
                    title="Notificações ativas"
                    aria-hidden="true"
                  ></i>
                  <i
                    v-else
                    class="bi bi-bell-slash text-body-tertiary"
                    title="Notificações inativas"
                    aria-hidden="true"
                  ></i>
                  <span
                    v-if="usuario.acesso_modulos.length"
                    class="badge text-bg-light border small"
                    :title="'Módulos: ' + usuario.acesso_modulos.join(', ')"
                  >
                    {{ usuario.acesso_modulos.length }} mód.
                  </span>
                </div>
              </td>
              <td class="text-end">
                <div class="d-flex gap-1 justify-content-end">
                  <router-link
                    :to="'/gestao/usuarios/' + usuario.id"
                    class="btn btn-sm btn-outline-success"
                  >
                    <i class="bi bi-pencil" aria-hidden="true"></i>
                  </router-link>
                  <button
                    v-if="usuario.status === 'ativo' && usuario.papel !== 'gestao'"
                    type="button"
                    class="btn btn-sm btn-outline-danger"
                    title="Desativar"
                    @click="toggleAtivacao(usuario)"
                  >
                    <i class="bi bi-pause-circle" aria-hidden="true"></i>
                  </button>
                  <button
                    v-else-if="usuario.status === 'inativo' && usuario.papel !== 'gestao'"
                    type="button"
                    class="btn btn-sm btn-outline-success"
                    title="Ativar"
                    @click="toggleAtivacao(usuario)"
                  >
                    <i class="bi bi-play-circle" aria-hidden="true"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ModalConfirmacao
      :visivel="!!confirmacaoPendente"
      :titulo="tituloConfirmacao"
      :mensagem="mensagemConfirmacao"
      :rotulo-confirmar="confirmacaoPendente?.acao === 'desativar' ? 'Desativar' : 'Ativar'"
      :icone="confirmacaoPendente?.acao === 'desativar' ? 'pause-circle' : 'play-circle'"
      :variante="confirmacaoPendente?.acao === 'desativar' ? 'danger' : 'success'"
      @confirmar="executarToggleAtivacao"
      @cancelar="confirmacaoPendente = null"
    />
  </div>
</template>
