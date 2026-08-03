<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { supabaseClient } from '@/servicos/supabase';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import SeletorIcone from '@/componentes/SeletorIcone.vue';
import type { TagComportamento } from '@/tipos/database';

const tags = ref<TagComportamento[]>([]);
const carregando = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const modalAberto = ref(false);
const modoEdicao = ref(false);
const editandoId = ref<string | null>(null);

const formNome = ref('');
const formCategoria = ref<'positivo' | 'atencao'>('atencao');
const formIcone = ref('');
const formDescricao = ref('');
const formPeso = ref(0);
const formAtivo = ref(true);

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
  formCategoria.value = 'atencao';
  formIcone.value = '';
  formDescricao.value = '';
  formPeso.value = 0;
  formAtivo.value = true;
  editandoId.value = null;
  modoEdicao.value = false;
}

async function carregar() {
  carregando.value = true;
  try {
    const { data } = await supabaseClient
      .from('tags_comportamento')
      .select('*')
      .order('nome');
    tags.value = data ?? [];
  } catch {
    mostrarErro('Falha ao carregar tags.');
  } finally {
    carregando.value = false;
  }
}

function abrirNovo() {
  resetForm();
  modalAberto.value = true;
}

function abrirEditar(item: TagComportamento) {
  modoEdicao.value = true;
  editandoId.value = item.id;
  formNome.value = item.nome;
  formCategoria.value = item.categoria;
  formIcone.value = item.icone ?? '';
  formDescricao.value = item.descricao ?? '';
  formPeso.value = item.peso_pontuacao;
  formAtivo.value = item.ativo;
  modalAberto.value = true;
}

function validarPeso(): boolean {
  if (formPeso.value < -50) { mostrarErro('O peso mínimo é -50.'); return false; }
  if (formPeso.value > 50) { mostrarErro('O peso máximo é +50.'); return false; }
  return true;
}

async function salvar() {
  if (!formNome.value.trim()) {
    mostrarErro('Preencha o nome da tag.');
    return;
  }
  if (!validarPeso()) return;
  carregando.value = true;
  try {
    if (modoEdicao.value && editandoId.value) {
      await supabaseClient
        .from('tags_comportamento')
        .update({
          nome: formNome.value.trim(),
          categoria: formCategoria.value,
          icone: formIcone.value.trim() || null,
          descricao: formDescricao.value.trim() || null,
          peso_pontuacao: formPeso.value,
          ativo: formAtivo.value,
        })
        .eq('id', editandoId.value);
      mostrarSucesso('Tag atualizada.');
    } else {
      await supabaseClient
        .from('tags_comportamento')
        .insert({
          nome: formNome.value.trim(),
          categoria: formCategoria.value,
          icone: formIcone.value.trim() || null,
          descricao: formDescricao.value.trim() || null,
          peso_pontuacao: formPeso.value,
          ativo: formAtivo.value,
        });
      mostrarSucesso('Tag criada.');
    }
    modalAberto.value = false;
    await carregar();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mostrarErro(msg);
  } finally {
    carregando.value = false;
  }
}

async function alternarAtivo(item: TagComportamento) {
  try {
    await supabaseClient
      .from('tags_comportamento')
      .update({ ativo: !item.ativo })
      .eq('id', item.id);
    await carregar();
  } catch {
    mostrarErro('Falha ao alternar status.');
  }
}

async function excluir(id: string) {
  if (!confirm('Excluir esta tag?')) return;
  try {
    await supabaseClient.from('tags_comportamento').delete().eq('id', id);
    mostrarSucesso('Tag excluída.');
    await carregar();
  } catch {
    mostrarErro('Falha ao excluir.');
  }
}

onMounted(carregar);
</script>

<template>
  <div class="container py-4" style="max-width: 960px">
    <div class="d-flex gap-2 mb-3">
      <router-link to="/gestao" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1" aria-hidden="true"></i>
        Início
      </router-link>
      <router-link to="/gestao/configuracao" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
        Voltar
      </router-link>
    </div>
    <div class="d-flex align-items-center gap-2 mb-4 flex-wrap">
      <h1 class="h4 fw-bold mb-0">Tags de Comportamento</h1>
      <button class="btn btn-success btn-sm ms-auto" @click="abrirNovo">
        <i class="bi bi-plus-lg"></i> Nova tag
      </button>
    </div>

    <div v-if="mensagemSucesso" class="alert alert-success alert-dismissible fade show">
      {{ mensagemSucesso }}
      <button type="button" class="btn-close" @click="mensagemSucesso = null"></button>
    </div>
    <div v-if="mensagemErro" class="alert alert-danger alert-dismissible fade show">
      {{ mensagemErro }}
      <button type="button" class="btn-close" @click="mensagemErro = null"></button>
    </div>

    <div v-if="carregando" class="text-center py-4">
      <div class="spinner-border text-success" role="status"></div>
    </div>

    <div v-else class="table-responsive">
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Ícone</th>
            <th>Peso</th>
            <th>Descrição</th>
            <th>Ativo</th>
            <th class="text-end">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in tags" :key="item.id" :class="{ 'text-body-tertiary': !item.ativo }">
            <td><code>{{ item.nome }}</code></td>
            <td>
              <span :class="'badge bg-' + (item.categoria === 'positivo' ? 'success' : item.categoria === 'atencao' ? 'warning' : 'danger')">
                {{ item.categoria }}
              </span>
            </td>
            <td>
              <span v-if="item.icone" class="badge bg-light text-dark">
                <i :class="'bi bi-' + item.icone"></i>
              </span>
            </td>
            <td>{{ item.peso_pontuacao }}</td>
            <td class="text-truncate" style="max-width: 200px">{{ item.descricao }}</td>
            <td>
              <div class="form-check form-switch">
                <input
                  class="form-check-input"
                  type="checkbox"
                  :checked="item.ativo"
                  @change="alternarAtivo(item)"
                />
              </div>
            </td>
            <td class="text-end">
              <button class="btn btn-outline-primary btn-sm me-1" @click="abrirEditar(item)">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm" @click="excluir(item.id)">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="!tags.length">
            <td colspan="7" class="text-center text-body-secondary py-4">Nenhuma tag cadastrada.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="modalAberto" class="modal d-block" tabindex="-1" @click.self="modalAberto = false">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ modoEdicao ? 'Editar' : 'Nova' }} tag</h5>
            <button type="button" class="btn-close" @click="modalAberto = false"></button>
          </div>
          <div class="modal-body">
            <CampoFormulario id="tag-nome" label="Nome">
              <input id="tag-nome" v-model="formNome" type="text" class="form-control" placeholder="ex.: agressao_verbal" :disabled="carregando" />
            </CampoFormulario>
            <div class="mb-3">
              <label class="form-label">Categoria</label>
              <select class="form-select" v-model="formCategoria">
                <option value="positivo">Positivo</option>
                <option value="atencao">Atenção</option>
                <option value="critico">Crítico</option>
              </select>
            </div>
            <SeletorIcone v-model="formIcone" :desabilitado="carregando" />
            <CampoFormulario id="tag-descricao" label="Descrição">
              <input id="tag-descricao" v-model="formDescricao" type="text" class="form-control" :disabled="carregando" />
            </CampoFormulario>
            <CampoFormulario id="tag-peso" label="Peso/pontuação">
              <input id="tag-peso" v-model.number="formPeso" type="number" class="form-control" :disabled="carregando" min="-50" max="50" />
            </CampoFormulario>
            <div class="form-check form-switch mt-3">
              <input class="form-check-input" type="checkbox" id="tag-ativo" v-model="formAtivo" />
              <label class="form-check-label" for="tag-ativo">Ativo</label>
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
