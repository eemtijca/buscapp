<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { api } from '@/servicos/api';
import { useAnoLetivoAtivo, useOpcoes, useTurmas } from '@/composables/consultas/useCatalogos';
import { useFormSnapshot } from '@/composables/useFormSnapshot';
import {
  mensagemSucesso as criarMensagemSucesso,
  mensagemErroExplicita,
} from '@/utils/mensagemExplicita';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import Combobox from '@/componentes/Combobox.vue';
import type { OpcaoCombobox } from '@/componentes/Combobox.vue';
import ModalBase from '@/componentes/ModalBase.vue';
import ModalConfirmacao from '@/componentes/ModalConfirmacao.vue';
import EstadoErro from '@/componentes/EstadoErro.vue';
import type { Turma } from '@/tipos/database';

const router = useRouter();

const { opcoes: opcoesSerie } = useOpcoes(() => 'serie_turma');
const { opcoes: opcoesLetra } = useOpcoes(() => 'letra_turma');
const { anoAtivo } = useAnoLetivoAtivo();
const { turmas, pendente, erro, recarregar } = useTurmas();
const salvando = ref(false);
const carregando = computed(() => pendente.value || salvando.value);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const modalAberto = ref(false);
const modoEdicao = ref(false);
const editandoId = ref<string | null>(null);

const formSerie = ref('1ª');
const formLetra = ref('A');
const formCapacidade = ref<number | null>(null);
const formAtivo = ref(true);
// Snapshot para detecção de alterações.
const {
  isDirty: formDirty,
  reset: resetSnapshot,
  pausar: pausarSnapshot,
  pausado: snapshotPausado,
} = useFormSnapshot(() => ({
  serie: formSerie.value,
  letra: formLetra.value,
  capacidade: String(formCapacidade.value ?? ''),
  ativo: String(formAtivo.value),
}));
let timerSucesso: ReturnType<typeof setTimeout> | null = null;
let timerErro: ReturnType<typeof setTimeout> | null = null;

const serieOpcoes = computed<OpcaoCombobox[]>(() =>
  opcoesSerie.value.map((o) => ({ valor: o.valor, rotulo: o.rotulo, icone: o.icone })),
);
const letraOpcoes = computed<OpcaoCombobox[]>(() =>
  opcoesLetra.value.map((o) => ({ valor: o.valor, rotulo: o.rotulo, icone: o.icone })),
);

const confirmacaoSaida = ref(false);
let resolverSaida: ((permitir: boolean) => void) | null = null;

onBeforeRouteLeave(async () => {
  if (!(formDirty.value && modalAberto.value && !carregando.value)) return true;
  confirmacaoSaida.value = true;
  return new Promise<boolean>((resolver) => {
    resolverSaida = resolver;
  });
});

function responderSaida(permitir: boolean): void {
  confirmacaoSaida.value = false;
  resolverSaida?.(permitir);
  resolverSaida = null;
}

watch([formSerie, formLetra, formCapacidade, formAtivo], () => {
  // snapshot cuida do dirty; watch apenas para compatibilidade futura
  if (snapshotPausado.value) return;
});

function mostrarSucesso(msg: string) {
  if (timerSucesso) clearTimeout(timerSucesso);
  mensagemSucesso.value = msg;
  timerSucesso = setTimeout(() => (mensagemSucesso.value = null), 6000);
}

function mostrarErro(msg: string) {
  if (timerErro) clearTimeout(timerErro);
  mensagemErro.value = msg;
  timerErro = setTimeout(() => (mensagemErro.value = null), 6000);
}

function resetForm() {
  pausarSnapshot(true);
  formSerie.value = '1ª';
  formLetra.value = 'A';
  formCapacidade.value = null;
  formAtivo.value = true;
  editandoId.value = null;
  modoEdicao.value = false;
  nextTick(() => {
    resetSnapshot();
    pausarSnapshot(false);
  });
}

async function abrirEditar(turma: Turma) {
  pausarSnapshot(true);
  modoEdicao.value = true;
  editandoId.value = turma.id;
  formSerie.value = turma.serie;
  formLetra.value = turma.letra;
  formCapacidade.value = turma.capacidade;
  formAtivo.value = turma.ativo;
  modalAberto.value = true;
  await nextTick();
  resetSnapshot();
  pausarSnapshot(false);
}

function abrirNovo() {
  pausarSnapshot(true);
  resetForm();
  modalAberto.value = true;
  nextTick(() => {
    resetSnapshot();
    pausarSnapshot(false);
  });
}

async function salvar() {
  document.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  salvando.value = true;
  try {
    if (modoEdicao.value && editandoId.value) {
      try {
        await api(`/api/turmas/${editandoId.value}`, {
          metodo: 'PUT',
          corpo: {
            serie: formSerie.value,
            letra: formLetra.value,
            capacidade: formCapacidade.value,
            ativo: formAtivo.value,
          },
        });
      } catch (e) {
        mostrarErro(
          mensagemErroExplicita('Turma', `${formSerie.value} ${formLetra.value}`, 'atualizar', e),
        );
        return;
      }
      mostrarSucesso(
        criarMensagemSucesso('Turma', `${formSerie.value} ${formLetra.value}`, 'atualizada'),
      );
    } else {
      const anoLetivo = anoAtivo.value;
      if (!anoLetivo) {
        mostrarErro(
          mensagemErroExplicita(
            'Turma',
            `${formSerie.value} ${formLetra.value}`,
            'criar',
            'Nenhum ano letivo ativo encontrado.',
          ),
        );
        return;
      }
      try {
        await api('/api/turmas', {
          metodo: 'POST',
          corpo: {
            serie: formSerie.value,
            letra: formLetra.value,
            capacidade: formCapacidade.value,
            ativo: formAtivo.value,
            ano_letivo_id: anoLetivo.id,
          },
        });
      } catch (e) {
        mostrarErro(
          mensagemErroExplicita('Turma', `${formSerie.value} ${formLetra.value}`, 'criar', e),
        );
        return;
      }
      mostrarSucesso(
        criarMensagemSucesso('Turma', `${formSerie.value} ${formLetra.value}`, 'criada'),
      );
    }
    modalAberto.value = false;
    resetForm();
    await recarregar();
  } finally {
    salvando.value = false;
  }
}

async function alternarAtivo(turma: Turma) {
  const novoValor = !turma.ativo;
  try {
    await api(`/api/turmas/${turma.id}/status`, {
      metodo: 'PATCH',
      corpo: { ativo: novoValor },
    });
    mostrarSucesso(novoValor ? 'Turma ativada.' : 'Turma desativada.');
    await recarregar();
  } catch {
    mostrarErro('Falha ao alterar status.');
  }
}
</script>

<template>
  <div class="container py-4" style="max-width: 960px">
    <router-link to="/gestao" class="btn btn-sm btn-outline-success me-2 mb-3">
      <i class="bi bi-house me-1" aria-hidden="true"></i>
      Início
    </router-link>
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary mb-3"
      :disabled="carregando"
      @click="router.back()"
    >
      <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
      Voltar
    </button>

    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h1 class="h5 fw-bold mb-0">
        <i class="bi bi-book text-success me-2" aria-hidden="true"></i>
        Turmas
      </h1>
      <button
        type="button"
        class="btn btn-sm btn-success"
        :disabled="carregando"
        @click="abrirNovo"
      >
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
        Nova turma
      </button>
    </div>

    <div
      v-if="mensagemSucesso"
      class="alert alert-success alert-dismissible fade show py-2 small mb-3 pe-5"
      role="status"
    >
      <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
      {{ mensagemSucesso }}
      <button
        type="button"
        class="btn-close position-absolute top-50 end-0 translate-middle-y me-2 p-2"
        style="font-size: 0.7rem"
        aria-label="Fechar"
        @click="mensagemSucesso = null"
      ></button>
    </div>
    <div
      v-if="mensagemErro"
      class="alert alert-danger alert-dismissible fade show py-2 small mb-3 pe-5"
      role="alert"
    >
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
      {{ mensagemErro }}
      <button
        type="button"
        class="btn-close position-absolute top-50 end-0 translate-middle-y me-2 p-2"
        style="font-size: 0.7rem"
        aria-label="Fechar"
        @click="mensagemErro = null"
      ></button>
    </div>

    <EstadoErro
      v-if="erro"
      mensagem="Não foi possível carregar as turmas."
      @tentar-novamente="recarregar()"
    />

    <div v-else-if="carregando && !turmas.length" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="mt-2 text-body-secondary small mb-0">Carregando turmas...</p>
    </div>

    <div v-else-if="!turmas.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-book fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhuma turma cadastrada.</p>
    </div>

    <div v-else class="card border">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 small">
          <thead class="table-light">
            <tr>
              <th scope="col">Nome completo</th>
              <th scope="col">Série</th>
              <th scope="col">Letra</th>
              <th scope="col">Capacidade</th>
              <th scope="col">Status</th>
              <th scope="col" class="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="turma in turmas" :key="turma.id">
              <td class="fw-medium">{{ turma.nome_completo }}</td>
              <td>{{ turma.serie }}</td>
              <td>{{ turma.letra }}</td>
              <td>{{ turma.capacidade ?? '—' }}</td>
              <td>
                <span class="badge" :class="turma.ativo ? 'text-bg-success' : 'text-bg-secondary'">
                  {{ turma.ativo ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="text-end">
                <div class="d-flex gap-1 justify-content-end">
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-success"
                    :disabled="carregando"
                    :aria-label="'Editar turma ' + turma.nome_completo"
                    @click="abrirEditar(turma)"
                  >
                    <i class="bi bi-pencil" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="turma.ativo ? 'btn-outline-danger' : 'btn-outline-success'"
                    :disabled="carregando"
                    :title="turma.ativo ? 'Desativar' : 'Ativar'"
                    @click="alternarAtivo(turma)"
                  >
                    <i
                      :class="turma.ativo ? 'bi bi-pause-circle' : 'bi bi-play-circle'"
                      aria-hidden="true"
                    ></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ModalBase
      :visivel="modalAberto"
      :titulo="modoEdicao ? 'Editar turma' : 'Nova turma'"
      icone="book"
      cor-icone="text-primary"
      largura="md"
      tela-cheia
      @update:visivel="(aberto) => !aberto && (modalAberto = false)"
    >
      <form @submit.prevent="salvar">
        <CampoFormulario id="campoSerie" label="Série" :obrigatorio="true">
          <Combobox
            id="campoSerie"
            v-model="formSerie"
            :opcoes="serieOpcoes"
            placeholder="Selecione a série"
            tamanho="sm"
          />
        </CampoFormulario>
        <CampoFormulario id="campoLetra" label="Letra" :obrigatorio="true">
          <Combobox
            id="campoLetra"
            v-model="formLetra"
            :opcoes="letraOpcoes"
            placeholder="Selecione a letra"
            tamanho="sm"
          />
        </CampoFormulario>
        <CampoFormulario id="campoCapacidade" label="Capacidade">
          <input
            id="campoCapacidade"
            v-model.number="formCapacidade"
            type="number"
            min="0"
            class="form-control form-control-sm"
            autocomplete="off"
          />
        </CampoFormulario>
        <div class="mb-0">
          <div class="form-check">
            <input id="campoAtivo" v-model="formAtivo" type="checkbox" class="form-check-input" />
            <label class="form-check-label small fw-medium" for="campoAtivo">Ativo</label>
          </div>
        </div>
      </form>

      <template #rodape>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="carregando"
          @click="modalAberto = false"
        >
          Cancelar
        </button>
        <button type="button" class="btn btn-sm btn-success" :disabled="carregando" @click="salvar">
          <span
            v-if="carregando"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          ></span>
          <i v-else class="bi bi-check-lg me-1" aria-hidden="true"></i>
          {{ modoEdicao ? 'Salvar' : 'Criar' }}
        </button>
      </template>
    </ModalBase>
  </div>

    <ModalConfirmacao
      :visivel="confirmacaoSaida"
      titulo="Alterações não salvas"
      mensagem="Há alterações não salvas. Deseja realmente sair?"
      rotulo-confirmar="Sair sem salvar"
      icone="exclamation-triangle"
      variante="warning"
      @confirmar="responderSaida(true)"
      @cancelar="responderSaida(false)"
    />
</template>
