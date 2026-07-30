<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabaseClient } from '@/servicos/supabase';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import SeletorIcone from '@/componentes/SeletorIcone.vue';
import type { OpcaoConfiguracao } from '@/tipos/database';
import type { OpcaoCheckbox } from '@/tipos/componentes';
import Sortable from 'sortablejs';

const route = useRoute();
const router = useRouter();
const { limparCache } = useOpcoesConfiguracao();

const tipo = computed(() => route.params.tipo as string);

const rotulos: Record<string, string> = {
  modulo: 'Módulos',
  permissao: 'Permissões',
  documento: 'Documentos',
  periodo: 'Períodos',
  motivo_ausencia: 'Motivos de Ausência',
  tipo_ocorrencia: 'Tipos de Ocorrência',
  tipo_vinculo: 'Vínculos',
  papel_atribuicao: 'Papéis de Atribuição',
  serie_turma: 'Séries',
  letra_turma: 'Letras de Turma',
};

const tituloPagina = computed(() => rotulos[tipo.value] ?? tipo.value);

const opcoes = ref<OpcaoConfiguracao[]>([]);
const carregando = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const modalAberto = ref(false);
const modoEdicao = ref(false);
const editandoId = ref<string | null>(null);

const formNome = ref('');
const formIcone = ref('');
const formAtivo = ref(true);

const modoReordenar = ref(false);
const snapshotPreReordenacao = ref<OpcaoConfiguracao[]>([]);

const ordemAlterada = computed(() => {
  if (!modoReordenar.value) return false;
  return opcoes.value.some(
    (item, index) => item.id !== snapshotPreReordenacao.value[index]?.id
  );
});

let sortableInstance: Sortable | null = null;

function gerarChave(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/_+/g, '_');
}

function mostrarSucesso(msg: string) {
  mensagemSucesso.value = msg;
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}

function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
}

function resetForm() {
  formNome.value = '';
  formIcone.value = '';
  formAtivo.value = true;
  editandoId.value = null;
  modoEdicao.value = false;
}

function destroySortable() {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
}

function initSortable() {
  destroySortable();
  nextTick(() => {
    const tbody = document.querySelector<HTMLElement>('.config-table tbody');
    if (!tbody) return;
    sortableInstance = Sortable.create(tbody, {
      handle: '.drag-handle',
      animation: 150,
      onUpdate: () => {
        const rows = tbody.querySelectorAll('tr');
        const newOrder: OpcaoConfiguracao[] = [];
        rows.forEach(row => {
          const id = row.getAttribute('data-id');
          const found = opcoes.value.find(o => o.id === id);
          if (found) newOrder.push({ ...found, ordem: newOrder.length + 1 });
        });
        if (newOrder.length === opcoes.value.length) {
          opcoes.value = newOrder;
        }
      },
    });
  });
}

function entrarModoReordenar() {
  snapshotPreReordenacao.value = opcoes.value.map(o => ({ ...o }));
  modoReordenar.value = true;
  initSortable();
}

async function salvarOrdem() {
  carregando.value = true;
  const rows = document.querySelectorAll<HTMLElement>('.config-table tbody tr');
  const updates: { id: string; ordem: number }[] = [];
  rows.forEach((row, index) => {
    const id = row.getAttribute('data-id');
    if (id) updates.push({ id, ordem: index + 1 });
  });

  try {
    const results = await Promise.allSettled(
      updates.map(u => supabaseClient.from('opcoes_configuracao').update({ ordem: u.ordem }).eq('id', u.id))
    );
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      opcoes.value = snapshotPreReordenacao.value.map(o => ({ ...o }));
      initSortable();
      mostrarErro(`${failures.length} de ${updates.length} falharam. A ordem foi restaurada. Tente novamente.`);
      return;
    }
    modoReordenar.value = false;
    destroySortable();
    limparCache(tipo.value);
    mostrarSucesso('Ordem salva com sucesso.');
    await carregar();
  } catch (e) {
    opcoes.value = snapshotPreReordenacao.value.map(o => ({ ...o }));
    initSortable();
    const msg = e instanceof Error ? e.message : 'Erro de conexão';
    mostrarErro(`Erro ao salvar: ${msg}. A ordem foi restaurada.`);
  } finally {
    carregando.value = false;
  }
}

function cancelarReordenar() {
  opcoes.value = snapshotPreReordenacao.value.map(o => ({ ...o }));
  modoReordenar.value = false;
  destroySortable();
}

async function carregar() {
  carregando.value = true;
  try {
    const { data } = await supabaseClient
      .from('opcoes_configuracao')
      .select('*')
      .eq('tipo', tipo.value)
      .order('ordem');
    opcoes.value = data ?? [];
  } catch {
    mostrarErro('Falha ao carregar opções.');
  } finally {
    carregando.value = false;
  }
}

function abrirNovo() {
  resetForm();
  modalAberto.value = true;
}

function abrirEditar(item: OpcaoConfiguracao) {
  modoEdicao.value = true;
  editandoId.value = item.id;
  formNome.value = item.rotulo;
  formIcone.value = item.icone ?? '';
  formAtivo.value = item.ativo;
  modalAberto.value = true;
}

async function salvar() {
  if (!formNome.value.trim()) {
    mostrarErro('Preencha o nome.');
    return;
  }
  carregando.value = true;
  try {
    if (modoEdicao.value && editandoId.value) {
      await supabaseClient
        .from('opcoes_configuracao')
        .update({
          rotulo: formNome.value.trim(),
          icone: formIcone.value.trim() || null,
          ativo: formAtivo.value,
        })
        .eq('id', editandoId.value);
      mostrarSucesso('Opção atualizada.');
    } else {
      let chave = gerarChave(formNome.value.trim());
      const maxOrdem = opcoes.value.reduce((max, o) => Math.max(max, o.ordem), 0);
      let suffix = 1;
      let chaveFinal = chave;
      while (opcoes.value.some(o => o.chave === chaveFinal)) {
        suffix++;
        chaveFinal = `${chave}_${suffix}`;
      }
      await supabaseClient.from('opcoes_configuracao').insert({
        tipo: tipo.value,
        chave: chaveFinal,
        rotulo: formNome.value.trim(),
        icone: formIcone.value.trim() || null,
        ordem: maxOrdem + 1,
        ativo: formAtivo.value,
      });
      mostrarSucesso('Opção criada.');
    }
    limparCache(tipo.value);
    modalAberto.value = false;
    await carregar();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mostrarErro(msg);
  } finally {
    carregando.value = false;
  }
}

async function alternarAtivo(item: OpcaoConfiguracao) {
  try {
    await supabaseClient.from('opcoes_configuracao').update({ ativo: !item.ativo }).eq('id', item.id);
    limparCache(tipo.value);
    await carregar();
  } catch {
    mostrarErro('Falha ao alternar status.');
  }
}

async function excluir(id: string) {
  if (!confirm('Excluir esta opção?')) return;
  try {
    await supabaseClient.from('opcoes_configuracao').delete().eq('id', id);
    limparCache(tipo.value);
    mostrarSucesso('Opção excluída.');
    await carregar();
  } catch {
    mostrarErro('Falha ao excluir.');
  }
}

onMounted(carregar);
onUnmounted(destroySortable);
</script>

<template>
  <div class="container py-4" style="max-width: 960px">
    <div class="d-flex align-items-center gap-2 mb-4 flex-wrap">
      <router-link to="/gestao" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1" aria-hidden="true"></i>
        Início
      </router-link>
      <router-link to="/gestao/configuracao" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
        Voltar
      </router-link>
      <h1 class="h4 fw-bold mb-0 ms-2">{{ tituloPagina }}</h1>

      <template v-if="!modoReordenar">
        <button class="btn btn-outline-primary btn-sm ms-auto" @click="entrarModoReordenar">
          <i class="bi bi-arrow-up-down me-1"></i> Reordenar
        </button>
        <button class="btn btn-success btn-sm" @click="abrirNovo">
          <i class="bi bi-plus-lg"></i> Nova opção
        </button>
      </template>
      <template v-else>
        <button class="btn btn-success btn-sm ms-auto" :disabled="!ordemAlterada || carregando" @click="salvarOrdem">
          <i v-if="carregando" class="spinner-border spinner-border-sm me-1"></i>
          <i v-else class="bi bi-check-lg me-1"></i>
          Salvar ordem
        </button>
        <button class="btn btn-outline-secondary btn-sm" :disabled="carregando" @click="cancelarReordenar">
          Cancelar
        </button>
      </template>
    </div>

    <div v-if="modoReordenar" class="alert alert-info small py-2 mb-3" role="alert">
      <i class="bi bi-arrow-up-down me-1"></i>
      Modo de reordenação ativado. Arraste os itens pela alça <i class="bi bi-grip-vertical"></i> para reordenar.
    </div>

    <div v-if="mensagemSucesso" class="alert alert-success alert-dismissible fade show">
      {{ mensagemSucesso }}
      <button type="button" class="btn-close" @click="mensagemSucesso = null"></button>
    </div>
    <div v-if="mensagemErro" class="alert alert-danger alert-dismissible fade show">
      {{ mensagemErro }}
      <button type="button" class="btn-close" @click="mensagemErro = null"></button>
    </div>

    <div v-if="carregando && !opcoes.length" class="text-center py-4">
      <div class="spinner-border text-success" role="status"></div>
    </div>

    <div v-else class="table-responsive">
      <table class="table table-hover align-middle config-table">
        <thead class="table-light">
          <tr>
            <th v-if="modoReordenar" style="width: 32px"></th>
            <th style="width: 60px">Ordem</th>
            <th>Nome</th>
            <th>Ícone</th>
            <th style="width: 80px">Ativo</th>
            <th v-if="!modoReordenar" class="text-end" style="width: 100px">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in opcoes" :key="item.id" :data-id="item.id" :class="{ 'text-body-tertiary': !item.ativo }">
            <td v-if="modoReordenar">
              <i class="bi bi-grip-vertical drag-handle text-body-secondary" style="cursor: grab" role="button" aria-label="Arrastar para reordenar"></i>
            </td>
            <td><code>{{ item.ordem }}</code></td>
            <td>
              <span v-if="!item.ativo"><s>{{ item.rotulo }}</s></span>
              <span v-else>{{ item.rotulo }}</span>
              <br><code class="small text-body-secondary">chave: {{ item.chave }}</code>
            </td>
            <td>
              <span v-if="item.icone" class="badge bg-light text-dark">
                <i :class="'bi bi-' + item.icone"></i> {{ item.icone }}
              </span>
              <span v-else class="text-body-secondary small">—</span>
            </td>
            <td>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" :checked="item.ativo" @change="alternarAtivo(item)" :id="'ativo-' + idx" />
                <label class="form-check-label" :for="'ativo-' + idx">{{ item.ativo ? 'Sim' : 'Não' }}</label>
              </div>
            </td>
            <td v-if="!modoReordenar" class="text-end">
              <button class="btn btn-outline-primary btn-sm me-1" @click="abrirEditar(item)">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm" @click="excluir(item.id)">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="!opcoes.length">
            <td :colspan="modoReordenar ? 5 : 6" class="text-center text-body-secondary py-4">Nenhuma opção cadastrada.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="modalAberto" class="modal d-block" tabindex="-1" @click.self="modalAberto = false">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ modoEdicao ? 'Editar' : 'Nova' }} opção</h5>
            <button type="button" class="btn-close" @click="modalAberto = false"></button>
          </div>
          <div class="modal-body">
            <CampoFormulario id="campo-nome" label="Nome">
              <input id="campo-nome" v-model="formNome" type="text" class="form-control" placeholder="ex.: Frequência" :disabled="carregando" />
            </CampoFormulario>
            <SeletorIcone v-model="formIcone" :desabilitado="carregando" />
            <div class="form-check form-switch mt-3">
              <input class="form-check-input" type="checkbox" id="campo-ativo" v-model="formAtivo" />
              <label class="form-check-label" for="campo-ativo">Ativo</label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" @click="modalAberto = false">Cancelar</button>
            <button type="button" class="btn btn-success" @click="salvar" :disabled="carregando">
              <span v-if="carregando" class="spinner-border spinner-border-sm me-1"></span>
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="modalAberto" class="modal-backdrop fade show"></div>
  </div>
</template>
