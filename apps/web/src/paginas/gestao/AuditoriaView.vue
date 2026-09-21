<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuditoria, useUsuarios } from '@/composables/consultas/useGestaoUsuarios';
import { formatarDataHorario } from '@/utils/datas';
import type { AuditoriaApi } from '@/tipos/api';

const router = useRouter();

const acao = ref('');
const entidade = ref('');
const usuarioId = ref('');
const dataInicio = ref('');
const dataFim = ref('');
const limite = ref(50);

const { usuarios } = useUsuarios();
const { eventos, pendente, atualizando, erro, recarregar } = useAuditoria(() => ({
  acao: acao.value.trim() || undefined,
  entidade: entidade.value.trim() || undefined,
  usuario_id: usuarioId.value || undefined,
  data_inicio: dataInicio.value || undefined,
  data_fim: dataFim.value || undefined,
  limite: limite.value,
}));

const temFiltro = computed(() =>
  Boolean(
    acao.value.trim() ||
    entidade.value.trim() ||
    usuarioId.value ||
    dataInicio.value ||
    dataFim.value,
  ),
);

const acoesConhecidas = computed(() => {
  const valores = new Set(eventos.value.map((evento) => evento.acao));
  return [...valores].sort();
});

function limparFiltros() {
  acao.value = '';
  entidade.value = '';
  usuarioId.value = '';
  dataInicio.value = '';
  dataFim.value = '';
}

function detalhe(evento: AuditoriaApi): string {
  const dados = evento.dados_novos ?? evento.dados_anteriores;
  if (!dados || typeof dados !== 'object') return '—';
  const registro = dados as Record<string, unknown>;
  const partes = Object.entries(registro)
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .slice(0, 3)
    .map(([chave, valor]) => `${chave}: ${String(valor)}`);
  return partes.length ? partes.join(' · ') : '—';
}
</script>

<template>
  <div class="container py-4" style="max-width: 1080px">
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
        <i class="bi bi-clipboard-data text-success me-2" aria-hidden="true"></i>
        Auditoria
      </h1>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="atualizando"
        @click="recarregar()"
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
    </div>

    <div class="card border mb-3">
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-4 col-lg-3">
            <label for="auditoria-acao" class="form-label small mb-1">Ação</label>
            <input
              id="auditoria-acao"
              v-model="acao"
              type="text"
              class="form-control form-control-sm"
              list="auditoria-acoes"
              placeholder="Ex.: BAIXAR_ANEXO"
            />
            <datalist id="auditoria-acoes">
              <option v-for="valor in acoesConhecidas" :key="valor" :value="valor" />
            </datalist>
          </div>
          <div class="col-12 col-md-4 col-lg-3">
            <label for="auditoria-entidade" class="form-label small mb-1">Entidade</label>
            <input
              id="auditoria-entidade"
              v-model="entidade"
              type="text"
              class="form-control form-control-sm"
              placeholder="Ex.: anexos"
            />
          </div>
          <div class="col-12 col-md-4 col-lg-3">
            <label for="auditoria-usuario" class="form-label small mb-1">Usuário</label>
            <select id="auditoria-usuario" v-model="usuarioId" class="form-select form-select-sm">
              <option value="">Todos</option>
              <option v-for="usuario in usuarios" :key="usuario.id" :value="usuario.id">
                {{ usuario.nome }}
              </option>
            </select>
          </div>
          <div class="col-6 col-md-3 col-lg-2">
            <label for="auditoria-inicio" class="form-label small mb-1">De</label>
            <input
              id="auditoria-inicio"
              v-model="dataInicio"
              type="date"
              class="form-control form-control-sm"
            />
          </div>
          <div class="col-6 col-md-3 col-lg-2">
            <label for="auditoria-fim" class="form-label small mb-1">Até</label>
            <input
              id="auditoria-fim"
              v-model="dataFim"
              type="date"
              class="form-control form-control-sm"
            />
          </div>
          <div class="col-12 col-lg-2 d-grid">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              :disabled="!temFiltro"
              @click="limparFiltros"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="erro" class="alert alert-danger small" role="alert">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
      Não foi possível carregar a auditoria.
      <button type="button" class="btn btn-sm btn-link p-0 ms-1" @click="recarregar()">
        Tentar novamente
      </button>
    </div>

    <div v-if="pendente && !eventos.length" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando auditoria</span>
      </div>
      <p class="mt-2 text-body-secondary small mb-0">Carregando eventos...</p>
    </div>

    <div v-else-if="!eventos.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-clipboard-data fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">
        {{ temFiltro ? 'Nenhum evento para os filtros informados.' : 'Nenhum evento registrado.' }}
      </p>
    </div>

    <template v-else>
      <div class="card border">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 small">
            <thead class="table-light">
              <tr>
                <th scope="col" class="text-nowrap">Data</th>
                <th scope="col">Usuário</th>
                <th scope="col">Ação</th>
                <th scope="col" class="d-none d-md-table-cell">Entidade</th>
                <th scope="col" class="d-none d-lg-table-cell">Detalhes</th>
                <th scope="col" class="d-none d-lg-table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="evento in eventos" :key="evento.id">
                <td class="text-nowrap">
                  {{ formatarDataHorario(evento.created_at).data }}
                  <span class="text-body-tertiary">
                    {{ formatarDataHorario(evento.created_at).horario }}
                  </span>
                </td>
                <td>{{ evento.usuario_nome ?? 'Sistema' }}</td>
                <td>
                  <code class="small">{{ evento.acao }}</code>
                </td>
                <td class="d-none d-md-table-cell text-body-secondary">
                  {{ evento.entidade }}
                </td>
                <td
                  class="d-none d-lg-table-cell text-body-secondary text-truncate"
                  style="max-width: 260px"
                >
                  {{ detalhe(evento) }}
                </td>
                <td class="d-none d-lg-table-cell text-body-secondary">
                  {{ evento.ip_origem ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="eventos.length >= limite" class="text-center mt-3">
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
          Carregar mais eventos
        </button>
      </div>
    </template>
  </div>
</template>
