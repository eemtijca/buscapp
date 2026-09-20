<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  useAlertasResponsavel,
  useJustificativasPendentes,
} from '@/composables/consultas/useMonitoramento';
import { useTags } from '@/composables/consultas/useCatalogos';
import CartaoAlertaResponsavel from '@/componentes/CartaoAlertaResponsavel.vue';
import ModalBase from '@/componentes/ModalBase.vue';
import VisualizadorAnexo from '@/componentes/VisualizadorAnexo.vue';
import type { AlertaResponsavel } from '@/tipos/componentes';

const router = useRouter();
const route = useRoute();
const { alertas, pendente, atualizando, erro, recarregar } = useAlertasResponsavel();
const { justificativas } = useJustificativasPendentes();
const { tags } = useTags();

const alertaSelecionado = ref<AlertaResponsavel | null>(null);
const mostrarModal = ref(false);
const anexoSelecionado = ref<{ id: string; nome: string; mime?: string } | null>(null);
const mensagemErro = ref<string | null>(null);

/** Deep-link da notificação: mostra apenas os alertas do aluno informado. */
const alunoFiltro = computed(() => (route.query.aluno as string | undefined) || null);
const alertasVisiveis = computed(() =>
  alunoFiltro.value
    ? alertas.value.filter((alerta) => alerta.alunoId === alunoFiltro.value)
    : alertas.value,
);
const nomeAlunoFiltro = computed(() => {
  const alerta = alertas.value.find((registro) => registro.alunoId === alunoFiltro.value);
  return alerta?.titulo ?? null;
});

function limparFiltroAluno() {
  void router.replace({ path: '/responsavel/alertas' });
}

const tagsMap = computed<Record<string, { rotulo: string; icone: string }>>(() => {
  const mapa: Record<string, { rotulo: string; icone: string }> = {};
  for (const tag of tags.value.filter((registro) => registro.ativo)) {
    mapa[tag.nome] = { rotulo: tag.descricao ?? tag.nome, icone: tag.icone ?? 'tag' };
  }
  return mapa;
});

// O alerta expõe o `storage_path` do anexo, mas o download autenticado exige o id.
const anexoIdPorPath = computed(() => {
  const mapa = new Map<string, string>();
  for (const justificativa of justificativas.value) {
    if (justificativa.anexoPath && justificativa.anexoId) {
      mapa.set(justificativa.anexoPath, justificativa.anexoId);
    }
  }
  return mapa;
});

function abrirJustificativa(payload: { alertaId: string; frequenciaId?: string }) {
  const query: Record<string, string> = {};
  if (payload.frequenciaId) query.frequenciaId = payload.frequenciaId;
  router.push({ path: '/responsavel/justificativa', query });
}

function verAnexo(alertaId: string) {
  const alerta = alertas.value.find((a) => a.id === alertaId);
  if (!alerta?.anexoPath) return;
  const anexoId = anexoIdPorPath.value.get(alerta.anexoPath);
  if (!anexoId) {
    mensagemErro.value = 'O anexo ainda não está disponível. Tente atualizar a lista.';
    setTimeout(() => (mensagemErro.value = null), 5000);
    return;
  }
  anexoSelecionado.value = {
    id: anexoId,
    nome: alerta.anexoNome ?? 'anexo',
    mime: alerta.anexoMime,
  };
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

async function atualizarManual() {
  await recarregar();
}
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
          :disabled="atualizando"
          @click="atualizarManual"
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

    <div v-if="pendente && !alertas.length" class="text-center py-5" aria-busy="true">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando alertas</span>
      </div>
    </div>

    <div
      v-else-if="erro && !alertas.length"
      class="alert alert-danger d-flex align-items-center justify-content-between gap-3"
      role="alert"
    >
      <span>
        <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
        Não foi possível carregar os alertas. Verifique a conexão e tente novamente.
      </span>
      <button type="button" class="btn btn-sm btn-outline-danger" @click="recarregar">
        Tentar novamente
      </button>
    </div>

    <div v-else>
      <div v-if="mensagemErro" class="alert alert-warning py-2 small" role="alert">
        <i class="bi bi-exclamation-circle me-1" aria-hidden="true"></i>
        {{ mensagemErro }}
      </div>

      <div
        v-if="alunoFiltro && alertas.length"
        class="alert alert-info d-flex align-items-center justify-content-between gap-2 py-2 small"
        role="status"
      >
        <span>
          Mostrando os alertas de <strong>{{ nomeAlunoFiltro ?? 'um dependente' }}</strong
          >.
        </span>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="limparFiltroAluno">
          Ver todos
        </button>
      </div>

      <div v-if="!alertasVisiveis.length" class="text-center py-5 text-body-secondary">
        <span
          class="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle mb-3"
          style="width: 72px; height: 72px"
        >
          <i class="bi bi-check-circle fs-4 text-success" aria-hidden="true"></i>
        </span>
        <p class="mb-0 small">
          {{
            alunoFiltro
              ? 'Nenhum alerta para este dependente no momento.'
              : 'Nenhum alerta no momento. Seu filho está com frequência regular.'
          }}
        </p>
      </div>

      <div v-else class="row g-3">
        <div v-for="alerta in alertasVisiveis" :key="alerta.id" class="col-12 col-md-6">
          <CartaoAlertaResponsavel
            :alerta="alerta"
            @enviar-justificativa="abrirJustificativa"
            @ver-anexo="verAnexo"
            @ver-detalhes="verDetalhes"
          />
        </div>
      </div>
    </div>

    <!-- Modal de detalhes -->
    <ModalBase
      :visivel="mostrarModal && !!alertaSelecionado"
      titulo="Detalhes do alerta"
      icone="info-circle"
      largura="md"
      @update:visivel="(aberto) => !aberto && fecharModal()"
    >
      <template v-if="alertaSelecionado">
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
                v-if="alertaSelecionado.anexoPath"
                type="button"
                class="btn btn-sm btn-outline-secondary mt-1"
                @click="verAnexo(alertaSelecionado!.id)"
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

          <div v-if="alertaSelecionado.ocorrenciaTipo?.length" class="d-flex gap-1 mb-2 flex-wrap">
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
                <i :class="'bi bi-' + (tagsMap[tag]?.icone ?? 'tag')" aria-hidden="true"></i>
                {{ tagsMap[tag]?.rotulo ?? tag }}
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
      </template>

      <template #rodape>
        <button type="button" class="btn btn-sm btn-secondary" @click="fecharModal">Fechar</button>
      </template>
    </ModalBase>

    <VisualizadorAnexo
      :aberto="!!anexoSelecionado"
      :anexo-id="anexoSelecionado?.id ?? ''"
      :nome-arquivo="anexoSelecionado?.nome ?? ''"
      :mime-type="anexoSelecionado?.mime"
      @fechar="anexoSelecionado = null"
    />
  </div>
</template>
