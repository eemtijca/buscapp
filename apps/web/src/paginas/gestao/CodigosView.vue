<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGestaoUsuarios } from '@/composables/useGestaoUsuarios';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import { supabaseClient } from '@/servicos/supabase';
import type { SolicitacaoCodigo, CodigoGerado } from '@/tipos/componentes';

const router = useRouter();
const {
  buscarNotificacoesCodigos,
  gerarCodigoRedefinicao,
  buscarCodigosGerados,
  marcarNotificacaoLida,
  limparCodigosNaoAtivos,
  carregando,
  erro,
} = useGestaoUsuarios();

const solicitacoes = ref<SolicitacaoCodigo[]>([]);
const codigosGerados = ref<CodigoGerado[]>([]);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const {
  ultimaAtualizacao,
  estaAtualizando,
  statusConexao,
  aoConectar,
  atualizar: refresh,
} = useRealtimeRefresh();

const codigosVisiveis = ref<Set<string>>(new Set());
const guiaAtiva = ref<'pendentes' | 'recentes'>('pendentes');

const filtroBusca = ref('');
const paginaAtual = ref(1);
const itensPorPagina = ref(8);

const modalConfirmacaoGerar = ref(false);
const modalCodigoGerado = ref(false);
const modalRevogar = ref(false);
const modalLimpar = ref(false);
const solicitacaoSelecionada = ref<SolicitacaoCodigo | null>(null);
const codigoGeradoAtual = ref<string | null>(null);
const codigoParaRevogar = ref<CodigoGerado | null>(null);
const gerandoCodigo = ref(false);
const limpandoCodigos = ref(false);
const codigoCopiado = ref(false);
let timerCopiado: ReturnType<typeof setTimeout> | null = null;

const idsConhecidosNotificacoes = ref(new Set<string>());
const idsConhecidosCodigos = ref(new Set<string>());

let canalNotificacoes: ReturnType<typeof supabaseClient.channel>;
let canalCodigos: ReturnType<typeof supabaseClient.channel>;
let timerGlobal: ReturnType<typeof setInterval> | null = null;

function mostrarSucesso(msg: string) {
  mensagemSucesso.value = msg;
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}

function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
}

const papelLabel = (papel: string) => {
  const map: Record<string, string> = {
    professor: 'Professor',
    responsavel: 'Responsável',
    gestao: 'Gestão',
  };
  return map[papel] ?? papel;
};

const papelBadge = (papel: string) => {
  const map: Record<string, string> = {
    professor: 'primary',
    responsavel: 'success',
    gestao: 'dark',
  };
  return map[papel] ?? 'secondary';
};

const codigoStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    ativo: 'success',
    usado: 'secondary',
    expirado: 'warning',
    revogado: 'danger',
    bloqueado: 'danger',
  };
  return map[status] ?? 'secondary';
};

function formatarDataCurta(data: string) {
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toggleVisibilidade(codigoId: string) {
  const novo = new Set(codigosVisiveis.value);
  if (novo.has(codigoId)) novo.delete(codigoId);
  else novo.add(codigoId);
  codigosVisiveis.value = novo;
}

function tempoRestanteFormatado(expiraEm: string): { texto: string; classe: string; pct: number } {
  const diff = new Date(expiraEm).getTime() - Date.now();
  if (diff <= 0) return { texto: 'Expirado', classe: 'text-danger', pct: 100 };
  const total = 3600000;
  const pct = Math.min(100, Math.round(((total - diff) / total) * 100));
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const texto = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const classe =
    diff < 600000 ? 'text-danger fw-bold' : diff < 1800000 ? 'text-warning' : 'text-success';
  return { texto, classe, pct };
}

const codigosFiltrados = computed(() => {
  if (!filtroBusca.value.trim()) return codigosGerados.value;
  const termo = filtroBusca.value.toLowerCase().trim();
  return codigosGerados.value.filter(
    (c) =>
      c.nome.toLowerCase().includes(termo) ||
      c.email.toLowerCase().includes(termo) ||
      c.codigo.includes(termo),
  );
});

const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(codigosFiltrados.value.length / itensPorPagina.value)),
);

const codigosPaginados = computed(() => {
  const inicio = (paginaAtual.value - 1) * itensPorPagina.value;
  return codigosFiltrados.value.slice(inicio, inicio + itensPorPagina.value);
});

watch(filtroBusca, () => {
  paginaAtual.value = 1;
});

function recalcularTimers() {
  if (document.visibilityState !== 'visible') return;
  codigosGerados.value.forEach((c) => {
    if (c.status !== 'ativo') return;
    if (new Date(c.expira_em).getTime() <= Date.now()) {
      c.status = 'expirado';
    }
  });
}

function abrirConfirmacaoGerar(solicitacao: SolicitacaoCodigo) {
  solicitacaoSelecionada.value = solicitacao;
  modalConfirmacaoGerar.value = true;
}

async function confirmarGerar() {
  if (!solicitacaoSelecionada.value) return;
  modalConfirmacaoGerar.value = false;
  gerandoCodigo.value = true;
  try {
    const codigo = await gerarCodigoRedefinicao(solicitacaoSelecionada.value.perfil_id);
    if (codigo) {
      codigoGeradoAtual.value = codigo;
      modalCodigoGerado.value = true;
      await marcarNotificacaoLida(solicitacaoSelecionada.value.id);
      // fn_gerar_codigo_redefinicao atende as solicitações; remove as entradas locais.
      solicitacoes.value = solicitacoes.value.filter(
        (s) => s.perfil_id !== solicitacaoSelecionada.value!.perfil_id,
      );
      const novos = await buscarCodigosGerados();
      codigosGerados.value = novos;
      novos.forEach((c) => idsConhecidosCodigos.value.add(c.id));
    } else {
      mostrarErro(erro.value || 'Falha ao gerar código.');
    }
  } finally {
    gerandoCodigo.value = false;
    solicitacaoSelecionada.value = null;
  }
}

async function copiarCodigo() {
  if (!codigoGeradoAtual.value) return;
  try {
    await navigator.clipboard.writeText(codigoGeradoAtual.value);
  } catch {
    const el = document.createElement('textarea');
    el.value = codigoGeradoAtual.value;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  mostrarSucesso('Código copiado!');
  codigoCopiado.value = true;
  if (timerCopiado) clearTimeout(timerCopiado);
  timerCopiado = setTimeout(() => (codigoCopiado.value = false), 1500);
}

async function copiarCodigoDaTabela(codigo: string) {
  try {
    await navigator.clipboard.writeText(codigo);
  } catch {
    const el = document.createElement('textarea');
    el.value = codigo;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  mostrarSucesso('Código copiado!');
}

function abrirWhatsApp() {
  const nome = solicitacaoSelecionada.value?.nome;
  if (!codigoGeradoAtual.value || !nome) return;
  const texto = `Olá ${nome}, seu código de acesso do BuscApp é: ${codigoGeradoAtual.value}`;
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank', 'noopener');
}

function abrirConfirmacaoRevogar(codigo: CodigoGerado) {
  codigoParaRevogar.value = codigo;
  modalRevogar.value = true;
}

async function confirmarRevogar() {
  if (!codigoParaRevogar.value) return;
  modalRevogar.value = false;
  try {
    const { error: err } = await supabaseClient.rpc('fn_revogar_codigo', {
      p_codigo_id: codigoParaRevogar.value.id,
    });
    if (err) throw err;
    const novos = await buscarCodigosGerados();
    codigosGerados.value = novos;
    novos.forEach((c) => idsConhecidosCodigos.value.add(c.id));
    mostrarSucesso('Código revogado com sucesso.');
  } catch (e) {
    mostrarErro(e instanceof Error ? e.message : 'Erro ao revogar código.');
  }
  codigoParaRevogar.value = null;
}

const codigosNaoAtivos = computed(
  () => codigosGerados.value.filter((c) => c.status !== 'ativo').length,
);

function abrirConfirmacaoLimpar() {
  if (codigosNaoAtivos.value === 0) return;
  modalLimpar.value = true;
}

async function confirmarLimpar() {
  modalLimpar.value = false;
  limpandoCodigos.value = true;
  try {
    const removidos = await limparCodigosNaoAtivos();
    const novos = await buscarCodigosGerados();
    codigosGerados.value = novos;
    novos.forEach((c) => idsConhecidosCodigos.value.add(c.id));
    mostrarSucesso(
      removidos > 0
        ? `${removidos} código${removidos !== 1 ? 's' : ''} removido${removidos !== 1 ? 's' : ''}.`
        : 'Nenhum código não ativo para limpar.',
    );
  } catch (e) {
    mostrarErro(e instanceof Error ? e.message : 'Erro ao limpar códigos.');
  } finally {
    limpandoCodigos.value = false;
  }
}

async function atualizarManual() {
  await refresh(async () => {
    solicitacoes.value = await buscarNotificacoesCodigos();
    solicitacoes.value.forEach((s) => idsConhecidosNotificacoes.value.add(s.id));
    const novos = await buscarCodigosGerados();
    codigosGerados.value = novos;
    novos.forEach((c) => idsConhecidosCodigos.value.add(c.id));
    mostrarSucesso('Dados atualizados.');
  });
}

async function carregarDados() {
  solicitacoes.value = await buscarNotificacoesCodigos();
  solicitacoes.value.forEach((s) => idsConhecidosNotificacoes.value.add(s.id));
  const novos = await buscarCodigosGerados();
  codigosGerados.value = novos;
  novos.forEach((c) => idsConhecidosCodigos.value.add(c.id));
}

function fecharModalCodigo() {
  modalCodigoGerado.value = false;
  codigoGeradoAtual.value = null;
}

async function recarregarAposConexao() {
  solicitacoes.value = await buscarNotificacoesCodigos();
  solicitacoes.value.forEach((s) => idsConhecidosNotificacoes.value.add(s.id));
  const novos = await buscarCodigosGerados();
  codigosGerados.value = novos;
  novos.forEach((c) => idsConhecidosCodigos.value.add(c.id));
}

onMounted(async () => {
  await carregarDados();

  canalNotificacoes = supabaseClient
    .channel('codigos-notificacoes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notificacoes',
        filter: 'tipo=eq.codigo_redefinicao',
      },
      async (payload) => {
        const notif = payload.new as Record<string, unknown>;
        if (idsConhecidosNotificacoes.value.has(notif.id as string)) return;
        solicitacoes.value = await buscarNotificacoesCodigos();
        solicitacoes.value.forEach((s) => idsConhecidosNotificacoes.value.add(s.id));
      },
    )
    .subscribe(aoConectar(recarregarAposConexao));

  canalCodigos = supabaseClient
    .channel('codigos-redefinicao')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'codigos_redefinicao' },
      async (payload) => {
        const cod = payload.new as Record<string, unknown>;
        if (idsConhecidosCodigos.value.has(cod.id as string)) return;
        const novos = await buscarCodigosGerados();
        codigosGerados.value = novos;
        novos.forEach((c) => idsConhecidosCodigos.value.add(c.id));
      },
    )
    .subscribe();

  timerGlobal = setInterval(() => {
    codigosGerados.value.forEach((c) => {
      if (c.status !== 'ativo') return;
      if (new Date(c.expira_em).getTime() <= Date.now()) {
        c.status = 'expirado';
      }
    });
  }, 1000);

  document.addEventListener('visibilitychange', recalcularTimers);
});

onUnmounted(() => {
  if (canalNotificacoes) supabaseClient.removeChannel(canalNotificacoes);
  if (canalCodigos) supabaseClient.removeChannel(canalCodigos);
  if (timerGlobal) clearInterval(timerGlobal);
  if (timerCopiado) clearTimeout(timerCopiado);
  document.removeEventListener('visibilitychange', recalcularTimers);
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

    <div class="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
      <h1 class="h5 fw-bold mb-0">
        <i class="bi bi-key text-success me-2" aria-hidden="true"></i>
        Códigos de acesso
      </h1>
      <div class="d-flex align-items-center gap-2">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="estaAtualizando"
          @click="atualizarManual"
          title="Recarregar dados manualmente"
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
        <span
          class="rounded-circle d-inline-block"
          :class="statusConexao === 'conectado' ? 'bg-success' : 'bg-danger'"
          style="width: 8px; height: 8px"
          :title="statusConexao === 'conectado' ? 'Conectado' : 'Desconectado'"
        ></span>
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

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <button
          type="button"
          class="nav-link small"
          :class="{ active: guiaAtiva === 'pendentes' }"
          @click="guiaAtiva = 'pendentes'"
        >
          <i class="bi bi-inbox me-1" aria-hidden="true"></i>
          Solicitações
          <span v-if="solicitacoes.length" class="badge text-bg-warning ms-1">{{
            solicitacoes.length
          }}</span>
        </button>
      </li>
      <li class="nav-item">
        <button
          type="button"
          class="nav-link small"
          :class="{ active: guiaAtiva === 'recentes' }"
          @click="guiaAtiva = 'recentes'"
        >
          <i class="bi bi-clock-history me-1" aria-hidden="true"></i>
          Códigos
          <span v-if="codigosGerados.length" class="badge text-bg-secondary ms-1">{{
            codigosGerados.length
          }}</span>
        </button>
      </li>
    </ul>

    <div v-if="guiaAtiva === 'pendentes'">
      <div v-if="carregando && !solicitacoes.length" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Carregando...</span>
        </div>
        <p class="mt-2 text-body-secondary small mb-0">Carregando solicitações...</p>
      </div>

      <div v-else-if="!solicitacoes.length" class="text-center py-5 text-body-secondary">
        <span
          class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
          style="width: 72px; height: 72px"
        >
          <i class="bi bi-check2-all fs-4 opacity-50" aria-hidden="true"></i>
        </span>
        <p class="mb-0 small">Nenhuma solicitação pendente.</p>
        <p class="mb-0 small text-body-tertiary">
          Solicitações de redefinição de senha aparecerão aqui.
        </p>
      </div>

      <div v-else class="d-flex flex-column gap-2">
        <div v-for="s in solicitacoes" :key="s.id" class="card border">
          <div class="card-body py-3">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div class="min-w-0">
                <p class="fw-medium mb-1 small">{{ s.nome }}</p>
                <p class="text-body-secondary mb-1 small">{{ s.email }}</p>
                <div class="d-flex gap-2 align-items-center flex-wrap">
                  <span class="badge" :class="'text-bg-' + papelBadge(s.papel)">
                    {{ papelLabel(s.papel) }}
                  </span>
                  <span class="text-body-tertiary small">
                    <i class="bi bi-clock me-1" aria-hidden="true"></i>
                    {{ formatarDataCurta(s.criado_em) }}
                  </span>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-success text-nowrap"
                :disabled="gerandoCodigo && solicitacaoSelecionada?.id === s.id"
                @click="abrirConfirmacaoGerar(s)"
              >
                <span
                  v-if="gerandoCodigo && solicitacaoSelecionada?.id === s.id"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                  aria-hidden="true"
                ></span>
                <i v-else class="bi bi-key me-1" aria-hidden="true"></i>
                {{ gerandoCodigo && solicitacaoSelecionada?.id === s.id ? 'Gerando...' : 'Gerar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else>
      <div class="mb-3 d-flex gap-2">
        <div class="input-group input-group-sm flex-grow-1">
          <span class="input-group-text bg-body-tertiary border-end-0">
            <i class="bi bi-search text-body-secondary" aria-hidden="true"></i>
          </span>
          <input
            v-model="filtroBusca"
            type="search"
            class="form-control border-start-0 ps-0"
            placeholder="Buscar por nome, e-mail ou código..."
            aria-label="Buscar códigos"
          />
          <button
            v-if="filtroBusca"
            type="button"
            class="btn btn-outline-secondary"
            @click="filtroBusca = ''"
          >
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-outline-danger text-nowrap"
          :disabled="codigosNaoAtivos === 0 || limpandoCodigos"
          :title="
            codigosNaoAtivos === 0
              ? 'Nenhum código não ativo para limpar'
              : 'Remover permanentemente os códigos não ativos'
          "
          @click="abrirConfirmacaoLimpar"
        >
          <span
            v-if="limpandoCodigos"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          ></span>
          <i v-else class="bi bi-trash me-1" aria-hidden="true"></i>
          Limpar não ativos
          <span v-if="codigosNaoAtivos" class="badge text-bg-danger ms-1">{{
            codigosNaoAtivos
          }}</span>
        </button>
      </div>

      <div v-if="carregando && !codigosGerados.length" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Carregando...</span>
        </div>
        <p class="mt-2 text-body-secondary small mb-0">Carregando códigos...</p>
      </div>

      <div v-else-if="!codigosGerados.length" class="text-center py-5 text-body-secondary">
        <span
          class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
          style="width: 72px; height: 72px"
        >
          <i class="bi bi-clock-history fs-4 opacity-50" aria-hidden="true"></i>
        </span>
        <p class="mb-0 small">Nenhum código gerado ainda.</p>
      </div>

      <div v-else-if="!codigosFiltrados.length" class="text-center py-5 text-body-secondary">
        <span
          class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
          style="width: 72px; height: 72px"
        >
          <i class="bi bi-search fs-4 opacity-50" aria-hidden="true"></i>
        </span>
        <p class="mb-0 small">Nenhum resultado para "{{ filtroBusca }}".</p>
        <button type="button" class="btn btn-sm btn-link" @click="filtroBusca = ''">
          Limpar busca
        </button>
      </div>

      <template v-else>
        <div class="card border">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0 small">
              <thead class="table-light">
                <tr>
                  <th scope="col" class="text-nowrap">Nome</th>
                  <th scope="col" class="d-none d-md-table-cell">E-mail</th>
                  <th scope="col">Código</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="d-none d-lg-table-cell text-nowrap">Expira</th>
                  <th scope="col" class="d-none d-lg-table-cell text-nowrap">Usado em</th>
                  <th scope="col" class="text-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in codigosPaginados" :key="c.id">
                  <td class="fw-medium text-nowrap">{{ c.nome }}</td>
                  <td class="text-body-secondary small d-none d-md-table-cell">{{ c.email }}</td>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <code
                        v-if="codigosVisiveis.has(c.id)"
                        class="user-select-all text-primary"
                        role="button"
                        tabindex="0"
                        title="Copiar código"
                        style="cursor: pointer"
                        @click="copiarCodigoDaTabela(c.codigo)"
                        @keydown.enter="copiarCodigoDaTabela(c.codigo)"
                        >{{ c.codigo }}</code
                      >
                      <span v-else class="text-body-tertiary">••••••</span>
                      <button
                        type="button"
                        class="btn btn-sm btn-link p-0 text-body-secondary"
                        :title="codigosVisiveis.has(c.id) ? 'Ocultar' : 'Mostrar'"
                        @click="toggleVisibilidade(c.id)"
                      >
                        <i
                          :class="codigosVisiveis.has(c.id) ? 'bi bi-eye-slash' : 'bi bi-eye'"
                          aria-hidden="true"
                        ></i>
                      </button>
                    </div>
                  </td>
                  <td>
                    <div class="d-flex flex-column gap-1">
                      <span class="badge" :class="'text-bg-' + codigoStatusBadge(c.status)">
                        {{ c.status }}
                      </span>
                      <span
                        v-if="c.status === 'ativo'"
                        :class="'small ' + tempoRestanteFormatado(c.expira_em).classe"
                      >
                        <i class="bi bi-hourglass-split me-1" aria-hidden="true"></i>
                        {{ tempoRestanteFormatado(c.expira_em).texto }}
                      </span>
                    </div>
                  </td>
                  <td class="text-body-secondary small d-none d-lg-table-cell text-nowrap">
                    <template v-if="c.status === 'ativo'">
                      {{ tempoRestanteFormatado(c.expira_em).texto }}
                    </template>
                    <template v-else>
                      {{ formatarDataCurta(c.expira_em) }}
                    </template>
                  </td>
                  <td class="text-body-secondary small d-none d-lg-table-cell text-nowrap">
                    {{ c.usado_em ? formatarDataCurta(c.usado_em) : '—' }}
                  </td>
                  <td>
                    <div class="d-flex gap-1">
                      <button
                        v-if="c.status === 'ativo'"
                        type="button"
                        class="btn btn-sm btn-outline-danger"
                        title="Revogar código"
                        @click="abrirConfirmacaoRevogar(c)"
                      >
                        <i class="bi bi-x-circle" aria-hidden="true"></i>
                      </button>
                      <button
                        v-else
                        type="button"
                        class="btn btn-sm btn-outline-secondary"
                        disabled
                        title="Código não pode ser revogado"
                      >
                        <i class="bi bi-x-circle" aria-hidden="true"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div
          v-if="totalPaginas > 1"
          class="d-flex justify-content-between align-items-center mt-3 small"
        >
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="paginaAtual <= 1"
            @click="paginaAtual > 1 && paginaAtual--"
          >
            <i class="bi bi-chevron-left me-1" aria-hidden="true"></i>
            Anterior
          </button>
          <span class="text-body-secondary">
            Página {{ paginaAtual }} de {{ totalPaginas }}
            <span class="d-none d-sm-inline">
              — {{ codigosFiltrados.length }} registro{{ codigosFiltrados.length !== 1 ? 's' : '' }}
            </span>
          </span>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="paginaAtual >= totalPaginas"
            @click="paginaAtual < totalPaginas && paginaAtual++"
          >
            Próximo
            <i class="bi bi-chevron-right ms-1" aria-hidden="true"></i>
          </button>
        </div>
      </template>
    </div>

    <div
      v-if="modalConfirmacaoGerar && solicitacaoSelecionada"
      class="modal d-block"
      tabindex="-1"
      style="background-color: rgba(0, 0, 0, 0.5)"
    >
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title small fw-bold">
              <i class="bi bi-shield-exclamation text-success me-1" aria-hidden="true"></i>
              Confirmar geração
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="modalConfirmacaoGerar = false"
              aria-label="Fechar"
            ></button>
          </div>
          <div class="modal-body">
            <p class="small mb-2">Gerar código de acesso para:</p>
            <div class="border rounded p-2 small bg-body-tertiary mb-0">
              <p class="fw-medium mb-1">{{ solicitacaoSelecionada.nome }}</p>
              <p class="text-body-secondary mb-1">{{ solicitacaoSelecionada.email }}</p>
              <span class="badge" :class="'text-bg-' + papelBadge(solicitacaoSelecionada.papel)">
                {{ papelLabel(solicitacaoSelecionada.papel) }}
              </span>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="modalConfirmacaoGerar = false"
            >
              Cancelar
            </button>
            <button type="button" class="btn btn-sm btn-success" @click="confirmarGerar">
              <i class="bi bi-key me-1" aria-hidden="true"></i>
              Sim, gerar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="modalCodigoGerado && codigoGeradoAtual"
      class="modal d-block"
      tabindex="-1"
      style="background-color: rgba(0, 0, 0, 0.5)"
    >
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title small fw-bold">
              <i class="bi bi-key text-success me-1" aria-hidden="true"></i>
              Código gerado
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="fecharModalCodigo"
              aria-label="Fechar"
            ></button>
          </div>
          <div class="modal-body text-center py-4">
            <p class="small text-body-secondary mb-2">
              Código de acesso para {{ solicitacaoSelecionada?.nome ?? 'usuário' }}
            </p>
            <div class="position-relative d-inline-block mb-3">
              <code
                class="d-inline-block fs-1 fw-bold font-monospace text-primary bg-body-tertiary px-3 py-2 rounded user-select-all"
                role="button"
                tabindex="0"
                title="Clique para copiar"
                style="letter-spacing: 0.15em; cursor: pointer"
                @click="copiarCodigo"
                @keydown.enter="copiarCodigo"
              >
                {{ codigoGeradoAtual }}
              </code>
              <span
                v-if="codigoCopiado"
                class="position-absolute top-0 end-0 translate-middle badge rounded-pill text-bg-success small"
              >
                <i class="bi bi-check2 me-1" aria-hidden="true"></i>Copiado
              </span>
            </div>
            <div
              v-if="solicitacaoSelecionada"
              class="small"
              :class="tempoRestanteFormatado(new Date(Date.now() + 3600000).toISOString()).classe"
            >
              <i class="bi bi-hourglass-split me-1" aria-hidden="true"></i>
              Expira em 59:59
            </div>
            <div class="d-flex gap-2 justify-content-center mt-3">
              <button type="button" class="btn btn-sm btn-outline-secondary" @click="copiarCodigo">
                <i class="bi bi-clipboard me-1" aria-hidden="true"></i>
                Copiar
              </button>
              <button type="button" class="btn btn-sm btn-success" @click="abrirWhatsApp">
                <i class="bi bi-whatsapp me-1" aria-hidden="true"></i>
                WhatsApp
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-sm btn-success" @click="fecharModalCodigo">
              Concluído
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="modalRevogar && codigoParaRevogar"
      class="modal d-block"
      tabindex="-1"
      style="background-color: rgba(0, 0, 0, 0.5)"
    >
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title small fw-bold">
              <i class="bi bi-exclamation-triangle text-danger me-1" aria-hidden="true"></i>
              Revogar código
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="modalRevogar = false"
              aria-label="Fechar"
            ></button>
          </div>
          <div class="modal-body">
            <p class="small mb-2">
              Tem certeza que deseja revogar o código de
              <strong>{{ codigoParaRevogar.nome }}</strong
              >?
            </p>
            <div class="border rounded p-2 small bg-body-tertiary mb-0">
              <p class="mb-1">
                <span class="text-body-secondary">Status:</span>
                <span class="badge text-bg-success ms-1">Ativo</span>
              </p>
              <p class="mb-1">
                <span class="text-body-secondary">Expira em:</span>
                <span class="ms-1">{{
                  tempoRestanteFormatado(codigoParaRevogar.expira_em).texto
                }}</span>
              </p>
              <p class="mb-0">
                <span class="text-body-secondary">Código:</span>
                <code class="ms-1 text-primary">{{ codigoParaRevogar.codigo }}</code>
              </p>
            </div>
            <p class="small text-danger mt-2 mb-0">
              <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
              Após revogar, o código não poderá mais ser utilizado.
            </p>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="modalRevogar = false"
            >
              Cancelar
            </button>
            <button type="button" class="btn btn-sm btn-danger" @click="confirmarRevogar">
              <i class="bi bi-x-circle me-1" aria-hidden="true"></i>
              Sim, revogar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="modalLimpar"
      class="modal d-block"
      tabindex="-1"
      style="background-color: rgba(0, 0, 0, 0.5)"
    >
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title small fw-bold">
              <i class="bi bi-trash text-danger me-1" aria-hidden="true"></i>
              Limpar códigos não ativos
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="modalLimpar = false"
              aria-label="Fechar"
            ></button>
          </div>
          <div class="modal-body">
            <p class="small mb-2">
              Tem certeza que deseja remover permanentemente
              <strong>{{ codigosNaoAtivos }}</strong>
              código{{ codigosNaoAtivos !== 1 ? 's' : '' }} não ativo{{
                codigosNaoAtivos !== 1 ? 's' : ''
              }}
              (usado{{ codigosNaoAtivos !== 1 ? 's' : '' }}, expirado{{
                codigosNaoAtivos !== 1 ? 's' : ''
              }}
              ou revogado{{ codigosNaoAtivos !== 1 ? 's' : '' }})?
            </p>
            <p class="small text-danger mb-0">
              <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
              Os códigos ativos serão preservados. O histórico permanece na auditoria.
            </p>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="modalLimpar = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-sm btn-danger"
              :disabled="limpandoCodigos"
              @click="confirmarLimpar"
            >
              <span
                v-if="limpandoCodigos"
                class="spinner-border spinner-border-sm me-1"
                role="status"
                aria-hidden="true"
              ></span>
              <i v-else class="bi bi-trash me-1" aria-hidden="true"></i>
              Sim, limpar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
