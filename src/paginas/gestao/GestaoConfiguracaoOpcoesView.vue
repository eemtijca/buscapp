<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabaseClient } from '@/servicos/supabase';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import type { OpcaoConfiguracao } from '@/tipos/database';
import Sortable from 'sortablejs';

const route = useRoute();
const router = useRouter();
const { limparCache } = useOpcoesConfiguracao();

const tipo = computed(() => route.params.tipo as string);

const iconesPadrao: Record<string, string> = {
  modulo: 'ui-checks', permissao: 'shield-check', documento: 'file-earmark-text',
  periodo: 'clock', motivo_ausencia: 'heart-pulse', tipo_ocorrencia: 'exclamation-triangle',
  tipo_vinculo: 'people', papel_atribuicao: 'person-badge',
  serie_turma: 'book', letra_turma: 'fonts',
};

const nomeRotulos: Record<string, string> = {
  modulo: 'Módulos', permissao: 'Permissões', documento: 'Documentos',
  periodo: 'Períodos', motivo_ausencia: 'Motivos de Ausência',
  tipo_ocorrencia: 'Tipos de Ocorrência', tipo_vinculo: 'Vínculos',
  papel_atribuicao: 'Papéis de Atribuição', serie_turma: 'Séries', letra_turma: 'Letras de Turma',
};

const tituloPagina = computed(() => nomeRotulos[tipo.value] ?? tipo.value);

const labelNome = computed(() => {
  if (tipo.value === 'letra_turma') return 'Letra';
  if (tipo.value === 'serie_turma') return 'Série';
  return 'Nome';
});

const placeholderNome = computed(() => {
  if (tipo.value === 'letra_turma') return 'ex.: D';
  if (tipo.value === 'serie_turma') return 'ex.: 1º';
  return 'ex.: Frequência';
});

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
const mostrarInputCustom = ref(false);
const useDropdown = computed(() => tipo.value === 'letra_turma' || tipo.value === 'serie_turma');
const opcoesDropdown = computed(() => {
  if (!useDropdown.value) return [];
  return opcoes.value.filter(o => o.ativo).sort((a, b) => a.ordem - b.ordem);
});

const modoReordenar = ref(false);
const snapshotPreReordenacao = ref<OpcaoConfiguracao[]>([]);

const ordemAlterada = computed(() => {
  if (!modoReordenar.value) return false;
  return opcoes.value.some((item, index) => item.id !== snapshotPreReordenacao.value[index]?.id);
});

let sortableInstance: Sortable | null = null;

function gerarChave(nome: string, t: string): string {
  switch (t) {
    case 'letra_turma':
      return nome.trim().charAt(0).toUpperCase() || 'A';
    case 'serie_turma': {
      const m = nome.trim().match(/^(\d+[ºª]?)/);
      return m ? (m[1] ?? nome.trim()) : nome.trim();
    }
    default:
      return nome.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '').replace(/_+/g, '_');
  }
}

function validarNome(): boolean {
  erroValidacao.value = null;
  const nome = formNome.value.trim();
  if (!nome) { erroValidacao.value = 'O nome é obrigatório.'; return false; }
  if (nome.length > 80) { erroValidacao.value = 'Máximo de 80 caracteres.'; return false; }
  if (tipo.value === 'letra_turma') {
    if (!/^[A-Za-zÀ-ÿ]$/.test(nome.charAt(0))) {
      erroValidacao.value = 'Digite apenas a letra da turma (ex.: D).';
      return false;
    }
  } else if (tipo.value === 'serie_turma') {
    if (!/^\d/.test(nome)) {
      erroValidacao.value = 'A série deve começar com um número (ex.: 1º).';
      return false;
    }
  } else if (nome.length < 2) {
    erroValidacao.value = 'O nome deve ter pelo menos 2 caracteres.';
    return false;
  }
  return true;
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
  formAtivo.value = true;
  modoEdicao.value = false;
  editandoId.value = null;
  erroValidacao.value = null;
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
  mostrarInputCustom.value = false;
  modalAberto.value = true;
}

function selecionarDropdown(valor: string) {
  if (valor === '__outra__') {
    formNome.value = '';
    mostrarInputCustom.value = true;
  } else {
    mostrarInputCustom.value = false;
    const opt = opcoes.value.find(o => o.id === valor);
    if (opt) {
      formNome.value = opt.rotulo;
      editandoId.value = opt.id;
      modoEdicao.value = true;
      formAtivo.value = opt.ativo;
    }
  }
}

function abrirEditar(item: OpcaoConfiguracao) {
  modoEdicao.value = true;
  editandoId.value = item.id;
  formNome.value = item.rotulo;
  formAtivo.value = item.ativo;
  erroValidacao.value = null;
  modalAberto.value = true;
}

const tabelasVerificar: Record<string, { tabela: string; coluna: string; isArray: boolean }[]> = {
  modulo: [{ tabela: 'perfis', coluna: 'acesso_modulos', isArray: true }],
  permissao: [{ tabela: 'perfis', coluna: 'permissoes', isArray: true }],
  documento: [{ tabela: 'alunos', coluna: 'documentos_recebidos', isArray: true }],
  periodo: [{ tabela: 'frequencias', coluna: 'periodo', isArray: false }],
  motivo_ausencia: [{ tabela: 'frequencias', coluna: 'motivos_ausencia', isArray: true }],
  tipo_ocorrencia: [{ tabela: 'ocorrencias', coluna: 'tipo', isArray: true }],
  tipo_vinculo: [{ tabela: 'vinculos_responsaveis', coluna: 'tipo_relacao', isArray: false }],
  papel_atribuicao: [{ tabela: 'atribuicoes_professores', coluna: 'papel', isArray: false }],
  serie_turma: [{ tabela: 'turmas', coluna: 'serie', isArray: false }],
  letra_turma: [{ tabela: 'turmas', coluna: 'letra', isArray: false }],
};

async function verificarUso(chave: string): Promise<number> {
  const checks = tabelasVerificar[tipo.value];
  if (!checks) return 0;
  let total = 0;
  for (const c of checks) {
    let q = c.isArray
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
  try {
    if (modoEdicao.value && editandoId.value) {
      await supabaseClient.from('opcoes_configuracao').update({
        rotulo: formNome.value.trim(), ativo: formAtivo.value,
      }).eq('id', editandoId.value);
      mostrarSucesso('Opção atualizada.');
    } else {
      let chave = gerarChave(formNome.value.trim(), tipo.value);
      const maxOrdem = opcoes.value.reduce((max, o) => Math.max(max, o.ordem), 0);
      let sf = 1, chaveF = chave;
      while (opcoes.value.some(o => o.chave === chaveF)) { sf++; chaveF = `${chave}_${sf}`; }
      await supabaseClient.from('opcoes_configuracao').insert({
        tipo: tipo.value, chave: chaveF, rotulo: formNome.value.trim(),
        icone: iconesPadrao[tipo.value] ?? null, ordem: maxOrdem + 1, ativo: formAtivo.value,
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
    <div class="d-flex gap-2 mb-1">
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
            <template v-if="useDropdown && !modoEdicao">
              <CampoFormulario :id="'campo-select'" :label="labelNome" :obrigatorio="true">
                <select :id="'campo-select'" class="form-select" :disabled="carregando" @change="selecionarDropdown(($event.target as HTMLSelectElement).value)">
                  <option value="">Selecionar {{ labelNome.toLowerCase() }}...</option>
                  <option v-for="o in opcoesDropdown" :key="o.id" :value="o.id">{{ o.rotulo }}</option>
                  <option disabled>──────────</option>
                  <option value="__outra__">Outra...</option>
                </select>
              </CampoFormulario>
            </template>
            <template v-if="!useDropdown || modoEdicao || mostrarInputCustom">
              <CampoFormulario :id="'campo-nome'" :label="useDropdown && modoEdicao ? labelNome : labelNome" :erro="erroValidacao" :obrigatorio="true">
                <input :id="'campo-nome'" v-model="formNome" type="text" class="form-control" :class="{ 'is-invalid': erroValidacao }" :placeholder="placeholderNome" :disabled="carregando" :maxlength="tipo === 'letra_turma' ? 2 : 80" @input="validarNome()" />
              </CampoFormulario>
            </template>
            <div class="form-check form-switch mt-3">
              <input class="form-check-input" type="checkbox" id="campo-ativo" v-model="formAtivo" />
              <label class="form-check-label" for="campo-ativo">Ativo</label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" @click="modalAberto = false">Cancelar</button>
            <button type="button" class="btn btn-success" @click="salvar" :disabled="erroValidacao !== null || carregando">
              <span v-if="carregando" class="spinner-border spinner-border-sm me-1"></span> Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="modalAberto" class="modal-backdrop fade show"></div>
  </div>
</template>
