<script setup lang="ts">
import { onMounted, ref, nextTick, watch } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { supabaseClient } from '@/servicos/supabase';
import { useFormSnapshot } from '@/composables/useFormSnapshot';
import {
  mensagemSucesso as criarMensagemSucesso,
  mensagemErroExplicita,
} from '@/utils/mensagemExplicita';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import type { AnoLetivo } from '@/tipos/database';

const router = useRouter();

const anos = ref<AnoLetivo[]>([]);
const carregando = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const modalAberto = ref(false);
const modoEdicao = ref(false);
const editandoId = ref<string | null>(null);

const formAno = ref<number>(new Date().getFullYear());
const formDataInicio = ref(`${new Date().getFullYear()}-02-01`);
const formDataFim = ref(`${new Date().getFullYear()}-12-20`);
// Snapshot para detecção de alterações.
const {
  isDirty: formDirty,
  reset: resetSnapshot,
  pausar: pausarSnapshot,
  pausado: snapshotPausado,
} = useFormSnapshot(() => ({
  ano: String(formAno.value),
  inicio: formDataInicio.value,
  fim: formDataFim.value,
}));
let timerSucesso: ReturnType<typeof setTimeout> | null = null;
let timerErro: ReturnType<typeof setTimeout> | null = null;

onBeforeRouteLeave((_to, _from, next) => {
  if (formDirty.value && modalAberto.value && !carregando.value) {
    const confirmar = window.confirm('Há alterações não salvas. Deseja realmente sair?');
    if (!confirmar) return next(false);
  }
  next();
});

watch([formAno, formDataInicio, formDataFim], () => {
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
  const anoAtual = new Date().getFullYear();
  formAno.value = anoAtual;
  formDataInicio.value = `${anoAtual}-02-01`;
  formDataFim.value = `${anoAtual}-12-20`;
  editandoId.value = null;
  modoEdicao.value = false;
  nextTick(() => {
    resetSnapshot();
    pausarSnapshot(false);
  });
}

async function carregarAnos() {
  carregando.value = true;
  try {
    const { error, data } = await supabaseClient
      .from('anos_letivos')
      .select('*')
      .order('ano', { ascending: false });
    if (error) throw error;
    anos.value = data ?? [];
  } catch {
    mostrarErro('Falha ao carregar anos letivos.');
  } finally {
    carregando.value = false;
  }
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

function abrirEditar(ano: AnoLetivo) {
  pausarSnapshot(true);
  modoEdicao.value = true;
  editandoId.value = ano.id;
  formAno.value = ano.ano;
  formDataInicio.value = ano.data_inicio;
  formDataFim.value = ano.data_fim;
  modalAberto.value = true;
  nextTick(() => {
    resetSnapshot();
    pausarSnapshot(false);
  });
}

async function salvar() {
  document.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  if (!formAno.value || !formDataInicio.value || !formDataFim.value) {
    mostrarErro(
      mensagemErroExplicita(
        'Ano letivo',
        String(formAno.value),
        'salvar',
        'Preencha o ano e as datas do período letivo.',
      ),
    );
    return;
  }
  if (formDataFim.value < formDataInicio.value) {
    mostrarErro(
      mensagemErroExplicita(
        'Ano letivo',
        String(formAno.value),
        'salvar',
        'A data de fim deve ser posterior à data de início.',
      ),
    );
    return;
  }
  carregando.value = true;
  try {
    if (modoEdicao.value && editandoId.value) {
      const { error } = await supabaseClient
        .from('anos_letivos')
        .update({
          ano: formAno.value,
          data_inicio: formDataInicio.value,
          data_fim: formDataFim.value,
        })
        .eq('id', editandoId.value);
      if (error) {
        if (error.code === '23505') {
          mostrarErro(
            mensagemErroExplicita(
              'Ano letivo',
              String(formAno.value),
              'atualizar',
              'Já existe um ano letivo para este ano.',
            ),
          );
        } else {
          mostrarErro(
            mensagemErroExplicita('Ano letivo', String(formAno.value), 'atualizar', error),
          );
        }
        return;
      }
      mostrarSucesso(criarMensagemSucesso('Ano letivo', String(formAno.value), 'atualizado'));
    } else {
      const { error } = await supabaseClient.from('anos_letivos').insert({
        ano: formAno.value,
        status: 'planejado',
        ativo: false,
        data_inicio: formDataInicio.value,
        data_fim: formDataFim.value,
      });
      if (error) {
        if (error.code === '23505') {
          mostrarErro(
            mensagemErroExplicita(
              'Ano letivo',
              String(formAno.value),
              'criar',
              'Já existe um ano letivo para este ano.',
            ),
          );
        } else {
          mostrarErro(mensagemErroExplicita('Ano letivo', String(formAno.value), 'criar', error));
        }
        return;
      }
      mostrarSucesso(
        criarMensagemSucesso('Ano letivo', String(formAno.value), 'criado') +
          ' Use "Ativar" para realizar a virada.',
      );
    }
    modalAberto.value = false;
    resetForm();
    await carregarAnos();
  } finally {
    carregando.value = false;
  }
}

async function ativar(ano: AnoLetivo) {
  const anterior = anos.value.find((a) => a.status === 'ativo' && a.ativo);
  const aviso = anterior
    ? `Ao ativar ${ano.ano}, o ano letivo ${anterior.ano} será arquivado e deixará de estar ativo. Deseja continuar?`
    : `Ativar o ano letivo ${ano.ano}?`;
  if (!window.confirm(aviso)) return;

  carregando.value = true;
  try {
    const { error } = await supabaseClient.rpc('ativar_ano_letivo', {
      p_ano_id: ano.id,
    });
    if (error) {
      mostrarErro(error.message || 'Falha ao ativar ano letivo.');
      return;
    }
    mostrarSucesso(`Ano letivo ${ano.ano} ativado.`);
    await carregarAnos();
  } finally {
    carregando.value = false;
  }
}

onMounted(carregarAnos);
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
        <i class="bi bi-calendar3 text-success me-2" aria-hidden="true"></i>
        Anos letivos
      </h1>
      <button
        type="button"
        class="btn btn-sm btn-success"
        :disabled="carregando"
        @click="abrirNovo"
      >
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
        Novo ano letivo
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

    <div v-if="carregando && !anos.length" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="mt-2 text-body-secondary small mb-0">Carregando anos letivos...</p>
    </div>

    <div v-else-if="!anos.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-calendar3 fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-1 small fw-medium">Nenhum ano letivo cadastrado.</p>
      <p class="mb-3 small">
        Cadastre o ano corrente e ative-o para liberar turmas, matrículas e monitoramento.
      </p>
      <button
        type="button"
        class="btn btn-sm btn-success"
        :disabled="carregando"
        @click="abrirNovo"
      >
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
        Criar ano letivo
      </button>
    </div>

    <div v-else class="card border">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 small">
          <thead class="table-light">
            <tr>
              <th scope="col">Ano</th>
              <th scope="col">Período</th>
              <th scope="col">Status</th>
              <th scope="col" class="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ano in anos" :key="ano.id">
              <td class="fw-medium">{{ ano.ano }}</td>
              <td>{{ ano.data_inicio }} a {{ ano.data_fim }}</td>
              <td>
                <span
                  class="badge"
                  :class="
                    ano.status === 'ativo'
                      ? 'text-bg-success'
                      : ano.status === 'planejado'
                        ? 'text-bg-info'
                        : 'text-bg-secondary'
                  "
                >
                  {{ ano.status.charAt(0).toUpperCase() + ano.status.slice(1) }}
                </span>
              </td>
              <td class="text-end">
                <div class="d-flex gap-1 justify-content-end">
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    title="Editar"
                    @click="abrirEditar(ano)"
                  >
                    <i class="bi bi-pencil" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-success"
                    title="Ativar (virada de ano)"
                    :disabled="carregando || (ano.status === 'ativo' && ano.ativo)"
                    @click="ativar(ano)"
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

    <div
      v-if="modalAberto"
      class="modal d-block"
      tabindex="-1"
      style="background-color: rgba(0, 0, 0, 0.5)"
    >
      <div class="modal-dialog modal-dialog-centered modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title small fw-bold">
              <i class="bi bi-calendar3 text-primary me-1" aria-hidden="true"></i>
              {{ modoEdicao ? 'Editar ano letivo' : 'Novo ano letivo' }}
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="modalAberto = false"
              aria-label="Fechar"
            ></button>
          </div>
          <form @submit.prevent="salvar">
            <div class="modal-body">
              <CampoFormulario id="campoAno" label="Ano" :obrigatorio="true">
                <input
                  id="campoAno"
                  v-model.number="formAno"
                  type="number"
                  min="2000"
                  max="2100"
                  class="form-control form-control-sm"
                  autocomplete="off"
                />
              </CampoFormulario>
              <CampoFormulario id="campoDataInicio" label="Data de início" :obrigatorio="true">
                <input
                  id="campoDataInicio"
                  v-model="formDataInicio"
                  type="date"
                  class="form-control form-control-sm"
                />
              </CampoFormulario>
              <CampoFormulario id="campoDataFim" label="Data de fim" :obrigatorio="true">
                <input
                  id="campoDataFim"
                  v-model="formDataFim"
                  type="date"
                  class="form-control form-control-sm"
                />
              </CampoFormulario>
              <p v-if="!modoEdicao" class="text-body-secondary small mb-0 mt-2">
                O novo ano é criado como <strong>planejado</strong>. A ativação ocorre pelo botão
                "Ativar", que arquiva o ano vigente (virada de ano).
              </p>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="modalAberto = false"
              >
                Cancelar
              </button>
              <button type="submit" class="btn btn-sm btn-success" :disabled="carregando">
                <span
                  v-if="carregando"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                  aria-hidden="true"
                ></span>
                <i v-else class="bi bi-check-lg me-1" aria-hidden="true"></i>
                {{ modoEdicao ? 'Salvar' : 'Criar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
