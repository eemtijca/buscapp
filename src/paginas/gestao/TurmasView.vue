<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { supabaseClient } from '@/servicos/supabase';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import type { Turma } from '@/tipos/database';
import type { OpcaoCheckbox } from '@/tipos/componentes';

const router = useRouter();

const { buscarOpcoes } = useOpcoesConfiguracao();

const turmas = ref<Turma[]>([]);
const opcoesSerie = ref<OpcaoCheckbox[]>([]);
const opcoesLetra = ref<OpcaoCheckbox[]>([]);
const carregando = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const modalAberto = ref(false);
const modoEdicao = ref(false);
const editandoId = ref<string | null>(null);

const formSerie = ref('1º');
const formLetra = ref('A');
const formCapacidade = ref<number | null>(null);
const formAtivo = ref(true);
const formDirty = ref(false);

onBeforeRouteLeave((_to, _from, next) => {
  if (formDirty.value && modalAberto.value && !carregando.value) {
    const confirmar = window.confirm('Há alterações não salvas. Deseja realmente sair?');
    if (!confirmar) return next(false);
  }
  next();
});

watch([formSerie, formLetra, formCapacidade, formAtivo], () => {
  if (!formDirty.value && modalAberto.value) formDirty.value = true;
});

function mostrarSucesso(msg: string) {
  mensagemSucesso.value = msg;
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}

function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
}

function resetForm() {
  formSerie.value = '1º';
  formLetra.value = 'A';
  formCapacidade.value = null;
  formAtivo.value = true;
  formDirty.value = false;
  editandoId.value = null;
  modoEdicao.value = false;
}

async function carregarTurmas() {
  carregando.value = true;
  try {
    opcoesSerie.value = await buscarOpcoes('serie_turma');
    opcoesLetra.value = await buscarOpcoes('letra_turma');
    const { data } = await supabaseClient.from('turmas').select('*').order('nome_completo');
    turmas.value = data ?? [];
  } catch {
    mostrarErro('Falha ao carregar turmas.');
  } finally {
    carregando.value = false;
  }
}

async function abrirEditar(turma: Turma) {
  modoEdicao.value = true;
  editandoId.value = turma.id;
  formSerie.value = turma.serie;
  formLetra.value = turma.letra;
  formCapacidade.value = turma.capacidade;
  formAtivo.value = turma.ativo;
  modalAberto.value = true;
}

function abrirNovo() {
  resetForm();
  modalAberto.value = true;
}

async function salvar() {
  document.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  carregando.value = true;
  try {
    if (modoEdicao.value && editandoId.value) {
      const { error } = await supabaseClient
        .from('turmas')
        .update({
          serie: formSerie.value,
          letra: formLetra.value,
          capacidade: formCapacidade.value,
          ativo: formAtivo.value,
        })
        .eq('id', editandoId.value);
      if (error) {
        mostrarErro('Falha ao atualizar turma.');
        return;
      }
      mostrarSucesso('Turma atualizada.');
    } else {
      const { data: anos } = await supabaseClient
        .from('anos_letivos')
        .select('id')
        .eq('status', 'ativo')
        .limit(1);
      const anoLetivoId = anos?.[0]?.id;
      if (!anoLetivoId) {
        mostrarErro('Nenhum ano letivo ativo encontrado.');
        return;
      }
      const { error } = await supabaseClient.from('turmas').insert({
        serie: formSerie.value,
        letra: formLetra.value,
        capacidade: formCapacidade.value,
        ativo: formAtivo.value,
        ano_letivo_id: anoLetivoId,
      });
      if (error) {
        mostrarErro('Falha ao criar turma.');
        return;
      }
      mostrarSucesso('Turma criada.');
    }
    modalAberto.value = false;
    resetForm();
    await carregarTurmas();
  } finally {
    carregando.value = false;
  }
}

async function alternarAtivo(turma: Turma) {
  const novoValor = !turma.ativo;
  const { error } = await supabaseClient
    .from('turmas')
    .update({ ativo: novoValor })
    .eq('id', turma.id);
  if (!error) {
    turma.ativo = novoValor;
    mostrarSucesso(novoValor ? 'Turma ativada.' : 'Turma desativada.');
  } else {
    mostrarErro('Falha ao alterar status.');
  }
}

onMounted(carregarTurmas);
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
        Turmas
      </h1>
      <button type="button" class="btn btn-sm btn-success" @click="abrirNovo">
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
        Nova turma
      </button>
    </div>

    <div v-if="mensagemSucesso" class="alert alert-success py-2 small mb-3" role="status">
      <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
      {{ mensagemSucesso }}
    </div>
    <div v-if="mensagemErro" class="alert alert-danger py-2 small mb-3" role="alert">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
      {{ mensagemErro }}
    </div>

    <div v-if="carregando && !turmas.length" class="text-center py-5">
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
                    @click="abrirEditar(turma)"
                  >
                    <i class="bi bi-pencil" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="turma.ativo ? 'btn-outline-danger' : 'btn-outline-success'"
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

    <div
      v-if="modalAberto"
      class="modal d-block"
      tabindex="-1"
      style="background-color: rgba(0, 0, 0, 0.5)"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title small fw-bold">
              <i class="bi bi-book text-primary me-1" aria-hidden="true"></i>
              {{ modoEdicao ? 'Editar turma' : 'Nova turma' }}
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
              <CampoFormulario id="campoSerie" label="Série" :obrigatorio="true">
                <select id="campoSerie" v-model="formSerie" class="form-select form-select-sm">
                  <option v-for="s in opcoesSerie" :key="s.valor" :value="s.valor">
                    {{ s.rotulo }}
                  </option>
                </select>
              </CampoFormulario>
              <CampoFormulario id="campoLetra" label="Letra" :obrigatorio="true">
                <select id="campoLetra" v-model="formLetra" class="form-select form-select-sm">
                  <option v-for="l in opcoesLetra" :key="l.valor" :value="l.valor">
                    {{ l.rotulo }}
                  </option>
                </select>
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
                  <input
                    id="campoAtivo"
                    v-model="formAtivo"
                    type="checkbox"
                    class="form-check-input"
                  />
                  <label class="form-check-label small fw-medium" for="campoAtivo">Ativo</label>
                </div>
              </div>
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
