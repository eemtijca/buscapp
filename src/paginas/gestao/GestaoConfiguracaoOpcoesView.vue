<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { supabaseClient } from '@/servicos/supabase';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import { useAlturaUniformeCards } from '@/composables/useAlturaUniformeCards';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import CartaoSelecao from '@/componentes/CartaoSelecao.vue';
import { obterRegra, gerarChave, normalizarChaveTexto } from '@/utils/opcoesConfiguracao';
import type { OpcaoConfiguracao } from '@/tipos/database';
import Sortable from 'sortablejs';

const route = useRoute();
const { limparCache } = useOpcoesConfiguracao();

const tipo = computed(() => route.params.tipo as string);

const regra = computed(() => obterRegra(tipo.value));
const tituloPagina = computed(() => regra.value.titulo);
const labelNome = computed(() => regra.value.rotulo);
const placeholderNome = computed(() => regra.value.placeholder);

const opcoes = ref<OpcaoConfiguracao[]>([]);
const carregando = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const modalAberto = ref(false);
const modoEdicao = ref(false);
const editandoId = ref<string | null>(null);

const formNome = ref('');
const formAtivo = ref(true);
const erroValidacao = ref<string | null>(null);

const opcaoSelecionada = ref<string | null>(null);
const mostrarCustom = ref(false);

const modoReordenar = ref(false);
const snapshotPreReordenacao = ref<OpcaoConfiguracao[]>([]);

const ordemAlterada = computed(() => {
  if (!modoReordenar.value) return false;
  return opcoes.value.some((item, index) => item.id !== snapshotPreReordenacao.value[index]?.id);
});

const opcoesPicker = computed(() => {
  const lista = opcoes.value.filter((o) => o.ativo).sort((a, b) => a.ordem - b.ordem);
  if (editandoId.value && !lista.some((o) => o.id === editandoId.value)) {
    const item = opcoes.value.find((o) => o.id === editandoId.value);
    if (item) lista.push(item);
  }
  return lista;
});

const mostrarAreaEntrada = computed(() => opcaoSelecionada.value !== null || mostrarCustom.value);

const digitosSerie = computed<string>(() => formNome.value.replace(/[ºª]/g, ''));

const gridPickerRef = ref<HTMLElement | null>(null);
const { altura: alturaCartao } = useAlturaUniformeCards(gridPickerRef);

let sortableInstance: Sortable | null = null;

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
  formAtivo.value = true;
  modoEdicao.value = false;
  editandoId.value = null;
  erroValidacao.value = null;
  opcaoSelecionada.value = null;
  mostrarCustom.value = false;
}

function rotuloFinal(): string {
  const r = regra.value;
  return r.transformar ? r.transformar(formNome.value) : formNome.value.trim();
}

function validarNome(): boolean {
  erroValidacao.value = null;
  const rotulo = rotuloFinal();
  if (!rotulo) {
    erroValidacao.value = 'O nome é obrigatório.';
    return false;
  }
  const r = regra.value;
  const valorChecado = r.campo === 'ordinal' ? rotulo.replace(/[ºª]/g, '') : rotulo;
  if (valorChecado.length < r.minlength) {
    erroValidacao.value = `Mínimo de ${r.minlength} caractere${r.minlength > 1 ? 's' : ''}.`;
    return false;
  }
  if (valorChecado.length > r.maxlength) {
    erroValidacao.value = `Máximo de ${r.maxlength} caracteres.`;
    return false;
  }
  if (r.padrao && !r.padrao.test(rotulo)) {
    erroValidacao.value = r.mensagemPadrao ?? 'Formato inválido.';
    return false;
  }
  const norm = normalizarChaveTexto(rotulo);
  const existente = opcoes.value.find(
    (o) => o.id !== editandoId.value && normalizarChaveTexto(o.rotulo) === norm,
  );
  if (existente) {
    erroValidacao.value = existente.ativo
      ? `Já existe uma opção chamada "${existente.rotulo}".`
      : `Já existe uma opção chamada "${existente.rotulo}" (inativa). Reative-a na lista para reutilizá-la.`;
    return false;
  }
  const chave = gerarChave(rotulo, tipo.value);
  const colisao = opcoes.value.find((o) => o.chave === chave && o.id !== editandoId.value);
  if (colisao) {
    erroValidacao.value = `Já existe uma opção com a chave "${chave}". Escolha outro nome.`;
    return false;
  }
  return true;
}

function aoDigitar(e: Event) {
  const el = e.target as HTMLInputElement;
  const v = regra.value.filtrar ? regra.value.filtrar(el.value) : el.value;
  formNome.value = v;
  if (el.value !== v) el.value = v;
  validarNome();
}

function aoDigitarSerie(e: Event) {
  const el = e.target as HTMLInputElement;
  const d = regra.value.filtrar ? regra.value.filtrar(el.value) : el.value;
  formNome.value = d ? `${d}º` : '';
  if (el.value !== d) el.value = d;
  validarNome();
}

function selecionarOpcao(id: string) {
  if (opcaoSelecionada.value === id) {
    resetForm();
    return;
  }
  const opt = opcoes.value.find((o) => o.id === id);
  if (!opt) return;
  opcaoSelecionada.value = id;
  mostrarCustom.value = false;
  modoEdicao.value = true;
  editandoId.value = opt.id;
  formNome.value = opt.rotulo;
  formAtivo.value = opt.ativo;
  erroValidacao.value = null;
}

function selecionarOutra() {
  resetForm();
  mostrarCustom.value = true;
}

function destroySortable() {
  if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
}

function initSortable() {
  destroySortable();
  nextTick(() => {
    const tbody = document.querySelector<HTMLElement>('.config-table tbody');
    if (!tbody) return;
    sortableInstance = Sortable.create(tbody, {
      handle: '.drag-handle', animation: 150,
      onUpdate: () => {
        const newOrder: OpcaoConfiguracao[] = [];
        tbody.querySelectorAll('tr').forEach(row => {
          const id = row.getAttribute('data-id');
          const found = opcoes.value.find(o => o.id === id);
          if (found) newOrder.push({ ...found, ordem: newOrder.length + 1 });
        });
        if (newOrder.length === opcoes.value.length) opcoes.value = newOrder;
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
  const updates: { id: string; ordem: number }[] = [];
  document.querySelectorAll<HTMLElement>('.config-table tbody tr').forEach((row, i) => {
    const id = row.getAttribute('data-id');
    if (id) updates.push({ id, ordem: i + 1 });
  });
  try {
    const results = await Promise.allSettled(
      updates.map(u => supabaseClient.from('opcoes_configuracao').update({ ordem: u.ordem }).eq('id', u.id))
    );
    if (results.some(r => r.status === 'rejected')) {
      opcoes.value = snapshotPreReordenacao.value.map(o => ({ ...o }));
      initSortable();
      mostrarErro('Falha ao salvar a ordem. A ordem foi restaurada.');
      return;
    }
    modoReordenar.value = false;
    destroySortable();
    limparCache(tipo.value);
    mostrarSucesso('Ordem salva.');
    await carregar();
  } catch (e) {
    opcoes.value = snapshotPreReordenacao.value.map(o => ({ ...o }));
    initSortable();
    mostrarErro(`Erro ao salvar: ${e instanceof Error ? e.message : 'Conexão'}`);
  } finally { carregando.value = false; }
}

function cancelarReordenar() {
  opcoes.value = snapshotPreReordenacao.value.map(o => ({ ...o }));
  modoReordenar.value = false;
  destroySortable();
}

async function carregar() {
  carregando.value = true;
  try {
    const { data } = await supabaseClient.from('opcoes_configuracao').select('*').eq('tipo', tipo.value).order('ordem');
    opcoes.value = data ?? [];
  } catch { mostrarErro('Falha ao carregar.'); }
  finally { carregando.value = false; }
}

function abrirNovo() {
  resetForm();
  modalAberto.value = true;
}

function abrirEditar(item: OpcaoConfiguracao) {
  modoEdicao.value = true;
  editandoId.value = item.id;
  opcaoSelecionada.value = item.id;
  mostrarCustom.value = false;
  formNome.value = item.rotulo;
  formAtivo.value = item.ativo;
  erroValidacao.value = null;
  modalAberto.value = true;
}

async function verificarUso(chave: string): Promise<number> {
  const usos = regra.value.verificarUso;
  if (!usos.length) return 0;
  let total = 0;
  for (const c of usos) {
    const q = c.isArray
      ? supabaseClient.from(c.tabela).select('id', { count: 'exact', head: true }).filter(c.coluna, 'cs', `{${chave}}`)
      : supabaseClient.from(c.tabela).select('id', { count: 'exact', head: true }).eq(c.coluna, chave);
    const { count } = await q;
    total += count ?? 0;
  }
  return total;
}

async function salvar() {
  if (!validarNome()) return;
  carregando.value = true;
  const rotulo = rotuloFinal();
  try {
    if (modoEdicao.value && editandoId.value) {
      await supabaseClient.from('opcoes_configuracao').update({
        rotulo, ativo: formAtivo.value,
      }).eq('id', editandoId.value);
      mostrarSucesso('Opção atualizada.');
    } else {
      const chave = gerarChave(rotulo, tipo.value);
      const maxOrdem = opcoes.value.reduce((max, o) => Math.max(max, o.ordem), 0);
      await supabaseClient.from('opcoes_configuracao').insert({
        tipo: tipo.value, chave, rotulo,
        icone: regra.value.icone, ordem: maxOrdem + 1, ativo: formAtivo.value,
      });
      mostrarSucesso('Opção criada.');
    }
    limparCache(tipo.value);
    modalAberto.value = false;
    await carregar();
  } catch (e) {
    mostrarErro(e instanceof Error ? e.message : String(e));
  } finally { carregando.value = false; }
}

async function alternarAtivo(item: OpcaoConfiguracao) {
  await supabaseClient.from('opcoes_configuracao').update({ ativo: !item.ativo }).eq('id', item.id);
  limparCache(tipo.value);
  await carregar();
}

async function excluir(id: string) {
  const item = opcoes.value.find(o => o.id === id);
  if (!item) return;
  if (!confirm(`Excluir "${item.rotulo}"?`)) return;
  const uso = await verificarUso(item.chave);
  if (uso > 0 && !confirm(`Esta opção é referenciada por ${uso} registro(s). A exclusão pode afetar a exibição de dados. Deseja excluir mesmo assim?`)) return;
  await supabaseClient.from('opcoes_configuracao').delete().eq('id', id);
  limparCache(tipo.value);
  mostrarSucesso(`"${item.rotulo}" excluído.`);
  await carregar();
}

onMounted(carregar);
onUnmounted(destroySortable);
</script>

<template>
  <div class="container py-4" style="max-width: 960px">
    <div class="d-flex gap-2 mb-3">
      <router-link to="/gestao" class="btn btn-sm btn-outline-success"><i class="bi bi-house me-1"></i> Início</router-link>
      <router-link to="/gestao/configuracao" class="btn btn-sm btn-outline-secondary"><i class="bi bi-arrow-left me-1"></i> Voltar</router-link>
    </div>
    <div class="d-flex align-items-center gap-2 mb-4 flex-wrap">
      <h1 class="h4 fw-bold mb-0">{{ tituloPagina }}</h1>
      <template v-if="!modoReordenar">
        <button class="btn btn-outline-primary btn-sm ms-auto" @click="entrarModoReordenar"><i class="bi bi-arrow-up-down me-1"></i>Reordenar</button>
        <button class="btn btn-success btn-sm" @click="abrirNovo"><i class="bi bi-plus-lg"></i> Nova opção</button>
      </template>
      <template v-else>
        <button class="btn btn-success btn-sm ms-auto" :disabled="!ordemAlterada || carregando" @click="salvarOrdem">
          <i v-if="carregando" class="spinner-border spinner-border-sm me-1"></i><i v-else class="bi bi-check-lg me-1"></i>Salvar ordem
        </button>
        <button class="btn btn-outline-secondary btn-sm" :disabled="carregando" @click="cancelarReordenar">Cancelar</button>
      </template>
    </div>

    <div v-if="modoReordenar" class="alert alert-info small py-2 mb-3">
      <i class="bi bi-arrow-up-down me-1"></i> Arraste os itens pela alça <i class="bi bi-grip-vertical"></i> para reordenar.
    </div>

    <div v-if="mensagemSucesso" class="alert alert-success alert-dismissible fade show">{{ mensagemSucesso }}<button type="button" class="btn-close" @click="mensagemSucesso = null"></button></div>
    <div v-if="mensagemErro" class="alert alert-danger alert-dismissible fade show">{{ mensagemErro }}<button type="button" class="btn-close" @click="mensagemErro = null"></button></div>

    <div v-if="carregando && !opcoes.length" class="text-center py-4"><div class="spinner-border text-success"></div></div>

    <div v-else class="table-responsive">
      <table class="table table-hover align-middle config-table">
        <thead class="table-light">
          <tr>
            <th v-if="modoReordenar" style="width:32px"></th>
            <th style="width:60px">Ordem</th>
            <th>{{ labelNome }}</th>
            <th style="width:80px">Ativo</th>
            <th v-if="!modoReordenar" class="text-end" style="width:100px">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in opcoes" :key="item.id" :data-id="item.id" :class="{ 'text-body-tertiary': !item.ativo }">
            <td v-if="modoReordenar"><i class="bi bi-grip-vertical drag-handle text-body-secondary" style="cursor:grab"></i></td>
            <td><code>{{ item.ordem }}</code></td>
            <td>
              <span v-if="!item.ativo"><s>{{ item.rotulo }}</s></span>
              <span v-else>{{ item.rotulo }}</span>
            </td>
            <td>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" :checked="item.ativo" @change="alternarAtivo(item)" :id="'ativo-'+idx" />
                <label class="form-check-label" :for="'ativo-'+idx">{{ item.ativo ? 'Sim' : 'Não' }}</label>
              </div>
            </td>
            <td v-if="!modoReordenar" class="text-end">
              <button class="btn btn-outline-primary btn-sm me-1" @click="abrirEditar(item)"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-outline-danger btn-sm" @click="excluir(item.id)"><i class="bi bi-trash"></i></button>
            </td>
          </tr>
          <tr v-if="!opcoes.length"><td :colspan="modoReordenar ? 4 : 5" class="text-center text-body-secondary py-4">Nenhuma opção cadastrada.</td></tr>
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
            <CampoFormulario :id="'campo-picker'" :label="labelNome" :obrigatorio="true">
              <div class="border rounded p-2 mb-2 overflow-auto" style="max-height: 200px">
                <div class="row g-2" ref="gridPickerRef" :style="{ '--altura-cartao': alturaCartao ? `${alturaCartao}px` : undefined }">
                  <div v-for="op in opcoesPicker" :key="op.id" class="col-6 col-md-4">
                    <CartaoSelecao
                      :selecionado="opcaoSelecionada === op.id"
                      :desabilitado="carregando"
                      @click="selecionarOpcao(op.id)"
                    >
                      <i v-if="op.icone" :class="`bi bi-${op.icone} me-1`" aria-hidden="true"></i>
                      {{ op.rotulo }}
                    </CartaoSelecao>
                  </div>
                  <div class="col-6 col-md-4">
                    <CartaoSelecao
                      :selecionado="mostrarCustom"
                      :tracejado="!mostrarCustom"
                      :desabilitado="carregando"
                      @click="selecionarOutra"
                    >
                      <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
                      Outra...
                    </CartaoSelecao>
                  </div>
                </div>
              </div>
            </CampoFormulario>

            <template v-if="mostrarAreaEntrada">
              <CampoFormulario :id="'campo-nome'" :label="labelNome" :erro="erroValidacao" :obrigatorio="true">
                <div v-if="regra.campo === 'ordinal'" class="input-group">
                  <input
                    :id="'campo-nome'"
                    :value="digitosSerie"
                    type="text"
                    inputmode="numeric"
                    class="form-control"
                    :class="{ 'is-invalid': erroValidacao }"
                    :placeholder="placeholderNome"
                    :disabled="carregando"
                    :maxlength="regra.maxlength"
                    @input="aoDigitarSerie($event)"
                  />
                  <span class="input-group-text">º</span>
                </div>
                <input
                  v-else
                  :id="'campo-nome'"
                  :value="formNome"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': erroValidacao }"
                  :placeholder="placeholderNome"
                  :disabled="carregando"
                  :maxlength="regra.maxlength"
                  @input="aoDigitar($event)"
                />
              </CampoFormulario>
              <div class="form-check form-switch mt-3">
                <input class="form-check-input" type="checkbox" id="campo-ativo" v-model="formAtivo" />
                <label class="form-check-label" for="campo-ativo">Ativo</label>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" @click="modalAberto = false">Cancelar</button>
            <button type="button" class="btn btn-success" @click="salvar" :disabled="!mostrarAreaEntrada || erroValidacao !== null || carregando">
              <span v-if="carregando" class="spinner-border spinner-border-sm me-1"></span> Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="modalAberto" class="modal-backdrop fade show"></div>
  </div>
</template>
