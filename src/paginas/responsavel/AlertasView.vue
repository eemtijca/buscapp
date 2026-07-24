<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import { supabaseClient } from '@/servicos/supabase';
import CartaoAlertaResponsavel from '@/componentes/CartaoAlertaResponsavel.vue';
import type { AlertaResponsavel } from '@/tipos/componentes';
import { TAGS_COMPORTAMENTO } from '@/tipos/componentes';

const router = useRouter();
const { usuario } = useAutenticacao();
const { buscarAlertasResponsavel } = useMonitoramento();
const {
  ultimaAtualizacao,
  estaAtualizando,
  statusConexao,
  aoConectar,
  atualizar: refresh,
} = useRealtimeRefresh();

let canalAlertas: ReturnType<typeof supabaseClient.channel>;

const alertas = ref<AlertaResponsavel[]>([]);
const alertaSelecionado = ref<AlertaResponsavel | null>(null);
const mostrarModal = ref(false);

function abrirJustificativa(payload: { alertaId: string; frequenciaId?: string }) {
  const query: Record<string, string> = {};
  if (payload.frequenciaId) query.frequenciaId = payload.frequenciaId;
  router.push({ path: '/responsavel/justificativa', query });
}

function verAnexo(anexoUrl: string) {
  if (anexoUrl) window.open(anexoUrl, '_blank', 'noopener');
}

function verDetalhes(alertaId: string) {
  const alerta = alertas.value.find((a) => a.id === alertaId);
  if (alerta) {
    alertaSelecionado.value = alerta;
    mostrarModal.value = true;
  }
}

function fecharModal() {
  mostrarModal.value = false;
  alertaSelecionado.value = null;
}

async function carregarAlertas() {
  if (usuario.value) {
    alertas.value = await buscarAlertasResponsavel(usuario.value.id);
  }
}

async function atualizarManual() {
  await refresh(carregarAlertas);
}

onMounted(async () => {
  await carregarAlertas();
  canalAlertas = supabaseClient
    .channel('alertas-responsavel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'frequencias' }, () => {
      if (usuario.value)
        buscarAlertasResponsavel(usuario.value.id).then((r) => (alertas.value = r));
    })
    .subscribe(aoConectar(carregarAlertas));
});

onUnmounted(() => {
  if (canalAlertas) supabaseClient.removeChannel(canalAlertas);
});
</script>

<template>
  <div class="container py-4" style="max-width: 800px">
    <div class="d-flex gap-2 mb-3">
      <router-link to="/responsavel" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1" aria-hidden="true"></i>
        Início
      </router-link>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="router.back()">
        <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
        Voltar
      </button>
    </div>

    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h1 class="h5 fw-bold mb-0">
        <i class="bi bi-bell text-danger me-2" aria-hidden="true"></i>
        Alertas
      </h1>
      <div class="d-flex align-items-center gap-2">
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

    <div v-if="!alertas.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-check-circle fs-4 text-success" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhum alerta no momento. Seu filho está com frequência regular.</p>
    </div>

    <div v-else class="row g-3">
      <div v-for="alerta in alertas" :key="alerta.id" class="col-12 col-md-6">
        <CartaoAlertaResponsavel
          :alerta="alerta"
          @enviar-justificativa="abrirJustificativa"
          @ver-anexo="verAnexo"
          @ver-detalhes="verDetalhes"
        />
      </div>
    </div>

    <!-- Modal de detalhes -->
    <div
      v-if="mostrarModal && alertaSelecionado"
      class="modal-backdrop fade show"
      style="z-index: 1055"
      @click="fecharModal"
    ></div>
    <div
      v-if="mostrarModal && alertaSelecionado"
      class="modal fade show d-block"
      tabindex="-1"
      style="z-index: 1056"
      @click.self="fecharModal"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold">
              <i class="bi bi-info-circle me-2" aria-hidden="true"></i>
              Detalhes do alerta
            </h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Fechar"
              @click="fecharModal"
            ></button>
          </div>

          <div class="modal-body">
            <!-- Aluno -->
            <div class="d-flex align-items-center gap-2 mb-3">
              <span
                class="d-inline-flex align-items-center justify-content-center rounded-3 flex-shrink-0"
                style="width: 40px; height: 40px"
                :class="
                  alertaSelecionado.tipo === 'ausencia_escola'
                    ? 'text-bg-danger'
                    : alertaSelecionado.tipo === 'ausencia_aula'
                      ? 'text-bg-warning'
                      : alertaSelecionado.tipo === 'suspensao'
                        ? 'text-bg-dark'
                        : 'text-bg-info'
                "
              >
                <i
                  :class="
                    'bi bi-' +
                    (alertaSelecionado.tipo === 'ausencia_escola'
                      ? 'door-closed'
                      : alertaSelecionado.tipo === 'ausencia_aula'
                        ? 'clock'
                        : alertaSelecionado.tipo === 'suspensao'
                          ? 'shield-exclamation'
                          : 'megaphone')
                  "
                  style="font-size: 1.1rem"
                ></i>
              </span>
              <div>
                <h6 class="mb-0 fw-semibold">{{ alertaSelecionado.titulo }}</h6>
                <span
                  class="badge"
                  :class="
                    alertaSelecionado.tipo === 'ausencia_escola'
                      ? 'text-bg-danger'
                      : alertaSelecionado.tipo === 'ausencia_aula'
                        ? 'text-bg-warning'
                        : alertaSelecionado.tipo === 'suspensao'
                          ? 'text-bg-dark'
                          : 'text-bg-info'
                  "
                >
                  {{
                    alertaSelecionado.tipo === 'ausencia_escola'
                      ? 'Ausência da escola'
                      : alertaSelecionado.tipo === 'ausencia_aula'
                        ? 'Ausência em aula'
                        : alertaSelecionado.tipo === 'suspensao'
                          ? 'Suspensão'
                          : 'Comunicado'
                  }}
                </span>
              </div>
            </div>

            <!-- Ausência -->
            <template
              v-if="
                alertaSelecionado.tipo === 'ausencia_escola' ||
                alertaSelecionado.tipo === 'ausencia_aula'
              "
            >
              <div class="mb-2 small">
                <i class="bi bi-calendar3 me-1 text-body-secondary" aria-hidden="true"></i>
                <strong>Data:</strong> {{ alertaSelecionado.data }}
                <span v-if="alertaSelecionado.periodo" class="ms-2">
                  <i class="bi bi-clock me-1 text-body-secondary" aria-hidden="true"></i>
                  <strong>Período:</strong> {{ alertaSelecionado.periodo }}
                </span>
              </div>

              <!-- Justificativa -->
              <div
                v-if="alertaSelecionado.justificativaStatus"
                class="card bg-body-tertiary border-0 mt-3"
              >
                <div class="card-body py-2">
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <i class="bi bi-file-text" aria-hidden="true"></i>
                    <span class="fw-medium small">Justificativa</span>
                    <span
                      class="badge ms-auto"
                      :class="
                        alertaSelecionado.justificativaStatus === 'aceita'
                          ? 'text-bg-success'
                          : alertaSelecionado.justificativaStatus === 'recusada'
                            ? 'text-bg-danger'
                            : 'text-bg-info'
                      "
                    >
                      {{
                        alertaSelecionado.justificativaStatus === 'aceita'
                          ? 'Aceita'
                          : alertaSelecionado.justificativaStatus === 'recusada'
                            ? 'Recusada'
                            : 'Aguardando validação'
                      }}
                    </span>
                  </div>
                  <p v-if="alertaSelecionado.justificativaMotivo" class="small mb-1 mt-2">
                    {{ alertaSelecionado.justificativaMotivo }}
                  </p>
                  <button
                    v-if="alertaSelecionado.anexoUrl"
                    type="button"
                    class="btn btn-sm btn-outline-secondary mt-1"
                    @click="verAnexo(alertaSelecionado!.anexoUrl!)"
                  >
                    <i class="bi bi-paperclip me-1" aria-hidden="true"></i>
                    Ver anexo
                    <span v-if="alertaSelecionado.anexoNome" class="text-body-secondary"
                      >({{ alertaSelecionado.anexoNome }})</span
                    >
                  </button>
                </div>
              </div>
            </template>

            <!-- Ocorrência -->
            <template v-else>
              <div class="mb-2 small">
                <i class="bi bi-calendar3 me-1 text-body-secondary" aria-hidden="true"></i>
                <strong>Data:</strong> {{ alertaSelecionado.data }}
              </div>

              <div
                v-if="alertaSelecionado.ocorrenciaTipo?.length"
                class="d-flex gap-1 mb-2 flex-wrap"
              >
                <span
                  v-for="t in alertaSelecionado.ocorrenciaTipo"
                  :key="t"
                  class="badge"
                  :class="t === 'suspensao' ? 'text-bg-dark' : 'text-bg-warning'"
                >
                  {{ t === 'suspensao' ? 'Suspensão' : 'Ocorrência grave' }}
                </span>
              </div>

              <div class="card bg-body-tertiary border-0 mt-2">
                <div class="card-body py-2">
                  <p class="small mb-0">{{ alertaSelecionado.descricao }}</p>
                </div>
              </div>

              <!-- Tags de comportamento -->
              <div v-if="alertaSelecionado.tagsComportamento?.length" class="mt-3">
                <small class="fw-medium text-body-secondary d-block mb-1">
                  <i class="bi bi-tags me-1" aria-hidden="true"></i>Tags de comportamento
                </small>
                <div class="d-flex gap-1 flex-wrap">
                  <span
                    v-for="tag in alertaSelecionado.tagsComportamento"
                    :key="tag"
                    class="badge text-bg-warning-subtle text-warning-emphasis small d-inline-flex align-items-center gap-1"
                  >
                    <i
                      :class="'bi bi-' + (TAGS_COMPORTAMENTO[tag]?.icone ?? 'tag')"
                      aria-hidden="true"
                    ></i>
                    {{ TAGS_COMPORTAMENTO[tag]?.rotulo ?? tag }}
                  </span>
                </div>
              </div>

              <div
                v-if="alertaSelecionado.exigePresencaResponsavel"
                class="alert alert-danger d-flex align-items-center gap-2 py-2 small mt-3 mb-0"
                role="alert"
              >
                <i class="bi bi-house-door" aria-hidden="true"></i>
                <span>Exige presença do responsável na escola</span>
              </div>
            </template>
          </div>

          <div class="modal-footer border-top-0 pt-0">
            <button type="button" class="btn btn-sm btn-secondary" @click="fecharModal">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
