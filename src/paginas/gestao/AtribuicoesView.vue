<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { supabaseClient } from '@/servicos/supabase';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import Combobox from '@/componentes/Combobox.vue';
import type { OpcaoCombobox } from '@/componentes/Combobox.vue';
import type { AtribuicaoProfessor, Perfil, Turma, Disciplina } from '@/tipos/database';
import type { OpcaoCheckbox } from '@/tipos/componentes';

interface AtribuicaoItem extends AtribuicaoProfessor {
  professor_nome?: string;
  turma_nome?: string;
  disciplina_nome?: string;
}

const router = useRouter();

const atribuicoes = ref<AtribuicaoItem[]>([]);
const professores = ref<Perfil[]>([]);
const turmas = ref<Turma[]>([]);
const disciplinas = ref<Disciplina[]>([]);
const carregando = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const modalAberto = ref(false);
const modoEdicao = ref(false);
const editandoId = ref<string | null>(null);

const formProfessorId = ref('');
const formTurmaId = ref('');
const formDisciplinaId = ref('');
const { buscarOpcoes } = useOpcoesConfiguracao();
const opcoesPapel = ref<OpcaoCheckbox[]>([]);

const formPapel = ref('titular');
const formDataInicio = ref('');
const formDataFim = ref('');
const formAtivo = ref(true);
const formDirty = ref(false);

const professorOpcoes = computed<OpcaoCombobox[]>(() =>
  professores.value.map((p) => ({ valor: p.id, rotulo: p.nome })),
);
const turmaOpcoes = computed<OpcaoCombobox[]>(() =>
  turmas.value.map((t) => ({ valor: t.id, rotulo: t.nome_completo })),
);
const disciplinaOpcoes = computed<OpcaoCombobox[]>(() =>
  disciplinas.value.map((d) => ({ valor: d.id, rotulo: d.nome })),
);
const papelOpcoes = computed<OpcaoCombobox[]>(() =>
  opcoesPapel.value.map((o) => ({ valor: o.valor, rotulo: o.rotulo, icone: o.icone })),
);

onBeforeRouteLeave((_to, _from, next) => {
  if (formDirty.value && modalAberto.value && !carregando.value) {
    const confirmar = window.confirm('Há alterações não salvas. Deseja realmente sair?');
    if (!confirmar) return next(false);
  }
  next();
});

watch(
  [
    formProfessorId,
    formTurmaId,
    formDisciplinaId,
    formPapel,
    formDataInicio,
    formDataFim,
    formAtivo,
  ],
  () => {
    if (!formDirty.value && modalAberto.value) formDirty.value = true;
  },
);

function mostrarSucesso(msg: string) {
  mensagemSucesso.value = msg;
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}

function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
}

function resetForm() {
  formProfessorId.value = '';
  formTurmaId.value = '';
  formDisciplinaId.value = '';
  formPapel.value = 'titular';
  formDataInicio.value = '';
  formDataFim.value = '';
  formAtivo.value = true;
  formDirty.value = false;
  editandoId.value = null;
  modoEdicao.value = false;
}

function formatarData(data: string | null) {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR');
}

async function carregarDados() {
  carregando.value = true;
  try {
    const [resAtribuicoes, resProfessores, resTurmas, resDisciplinas] = await Promise.all([
      supabaseClient
        .from('atribuicoes_professores')
        .select(
          `
          *,
          perfis!atribuicoes_professores_professor_id_fkey (nome),
          turmas!atribuicoes_professores_turma_id_fkey (nome_completo),
          disciplinas!atribuicoes_professores_disciplina_id_fkey (nome)
        `,
        )
        .order('created_at', { ascending: false }),
      supabaseClient.from('perfis').select('id, nome').eq('papel', 'professor').order('nome'),
      supabaseClient
        .from('turmas')
        .select('id, nome_completo')
        .eq('ativo', true)
        .order('nome_completo'),
      supabaseClient.from('disciplinas').select('id, nome').eq('ativo', true).order('nome'),
    ]);

    atribuicoes.value = (resAtribuicoes.data ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      professor_nome: (a.perfis as Record<string, string> | null)?.nome ?? '—',
      turma_nome: (a.turmas as Record<string, string> | null)?.nome_completo ?? '—',
      disciplina_nome: (a.disciplinas as Record<string, string> | null)?.nome ?? null,
    })) as AtribuicaoItem[];

    professores.value = (resProfessores.data ?? []) as Perfil[];
    turmas.value = (resTurmas.data ?? []) as Turma[];
    disciplinas.value = (resDisciplinas.data ?? []) as Disciplina[];
  } catch {
    mostrarErro('Falha ao carregar dados.');
  } finally {
    carregando.value = false;
  }
}

async function abrirEditar(atribuicao: AtribuicaoItem) {
  modoEdicao.value = true;
  editandoId.value = atribuicao.id;
  formProfessorId.value = atribuicao.professor_id;
  formTurmaId.value = atribuicao.turma_id;
  formDisciplinaId.value = atribuicao.disciplina_id ?? '';
  formPapel.value = atribuicao.papel;
  formDataInicio.value = atribuicao.data_inicio ? atribuicao.data_inicio.slice(0, 10) : '';
  formDataFim.value = atribuicao.data_fim ? atribuicao.data_fim.slice(0, 10) : '';
  formAtivo.value = atribuicao.ativo;
  modalAberto.value = true;
}

function abrirNovo() {
  resetForm();
  modalAberto.value = true;
}

async function salvar() {
  document.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  if (!formProfessorId.value || !formTurmaId.value || !formDataInicio.value) {
    mostrarErro('Preencha os campos obrigatórios.');
    return;
  }
  carregando.value = true;
  try {
    const payload = {
      professor_id: formProfessorId.value,
      turma_id: formTurmaId.value,
      disciplina_id: formDisciplinaId.value || null,
      papel: formPapel.value,
      data_inicio: formDataInicio.value,
      data_fim: formDataFim.value || null,
      ativo: formAtivo.value,
    };

    if (modoEdicao.value && editandoId.value) {
      const { error } = await supabaseClient
        .from('atribuicoes_professores')
        .update(payload)
        .eq('id', editandoId.value);
      if (error) {
        mostrarErro('Falha ao atualizar atribuição.');
        return;
      }
      mostrarSucesso('Atribuição atualizada.');
    } else {
      const { error } = await supabaseClient.from('atribuicoes_professores').insert(payload);
      if (error) {
        mostrarErro('Falha ao criar atribuição.');
        return;
      }
      mostrarSucesso('Atribuição criada.');
    }
    modalAberto.value = false;
    resetForm();
    await carregarDados();
  } finally {
    carregando.value = false;
  }
}

async function alternarAtivo(atribuicao: AtribuicaoItem) {
  const novoValor = !atribuicao.ativo;
  const { error } = await supabaseClient
    .from('atribuicoes_professores')
    .update({ ativo: novoValor })
    .eq('id', atribuicao.id);
  if (!error) {
    atribuicao.ativo = novoValor;
    mostrarSucesso(novoValor ? 'Atribuição ativada.' : 'Atribuição desativada.');
  } else {
    mostrarErro('Falha ao alterar status.');
  }
}

const papelBadge = (papel: string) => {
  const idx = opcoesPapel.value.findIndex((p) => p.valor === papel);
  const cores = ['text-bg-primary', 'text-bg-info', 'text-bg-success', 'text-bg-warning'];
  return cores[idx % cores.length] || 'text-bg-secondary';
};

onMounted(async () => {
  opcoesPapel.value = await buscarOpcoes('papel_atribuicao');
  await carregarDados();
});
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
        <i class="bi bi-people text-success me-2" aria-hidden="true"></i>
        Atribuições
      </h1>
      <button type="button" class="btn btn-sm btn-success" @click="abrirNovo">
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
        Nova atribuição
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

    <div v-if="carregando && !atribuicoes.length" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="mt-2 text-body-secondary small mb-0">Carregando atribuições...</p>
    </div>

    <div v-else-if="!atribuicoes.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-people fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhuma atribuição cadastrada.</p>
    </div>

    <div v-else class="card border">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 small">
          <thead class="table-light">
            <tr>
              <th scope="col">Professor</th>
              <th scope="col">Turma</th>
              <th scope="col">Disciplina</th>
              <th scope="col">Papel</th>
              <th scope="col">Início</th>
              <th scope="col">Fim</th>
              <th scope="col">Ativo</th>
              <th scope="col" class="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in atribuicoes" :key="a.id">
              <td class="fw-medium">{{ a.professor_nome }}</td>
              <td>{{ a.turma_nome }}</td>
              <td>{{ a.disciplina_nome ?? '—' }}</td>
              <td>
                <span class="badge" :class="papelBadge(a.papel)">
                  {{ opcoesPapel.find((p) => p.valor === a.papel)?.rotulo ?? a.papel }}
                </span>
              </td>
              <td>{{ formatarData(a.data_inicio) }}</td>
              <td>{{ formatarData(a.data_fim) }}</td>
              <td>
                <span class="badge" :class="a.ativo ? 'text-bg-success' : 'text-bg-secondary'">
                  {{ a.ativo ? 'Sim' : 'Não' }}
                </span>
              </td>
              <td class="text-end">
                <div class="d-flex gap-1 justify-content-end">
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-success"
                    @click="abrirEditar(a)"
                  >
                    <i class="bi bi-pencil" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="a.ativo ? 'btn-outline-danger' : 'btn-outline-success'"
                    :title="a.ativo ? 'Desativar' : 'Ativar'"
                    @click="alternarAtivo(a)"
                  >
                    <i
                      :class="a.ativo ? 'bi bi-pause-circle' : 'bi bi-play-circle'"
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
              <i class="bi bi-people text-primary me-1" aria-hidden="true"></i>
              {{ modoEdicao ? 'Editar atribuição' : 'Nova atribuição' }}
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
              <CampoFormulario id="campoProfessor" label="Professor" :obrigatorio="true">
                <Combobox
                  id="campoProfessor"
                  v-model="formProfessorId"
                  :opcoes="professorOpcoes"
                  placeholder="Selecione um professor"
                  tamanho="sm"
                />
              </CampoFormulario>
              <CampoFormulario id="campoTurma" label="Turma" :obrigatorio="true">
                <Combobox
                  id="campoTurma"
                  v-model="formTurmaId"
                  :opcoes="turmaOpcoes"
                  placeholder="Selecione uma turma"
                  tamanho="sm"
                />
              </CampoFormulario>
              <CampoFormulario id="campoDisciplina" label="Disciplina">
                <Combobox
                  id="campoDisciplina"
                  v-model="formDisciplinaId"
                  :opcoes="disciplinaOpcoes"
                  placeholder="Selecione uma disciplina"
                  tamanho="sm"
                />
              </CampoFormulario>
              <CampoFormulario id="campoPapel" label="Papel" :obrigatorio="true">
                <Combobox
                  id="campoPapel"
                  v-model="formPapel"
                  :opcoes="papelOpcoes"
                  placeholder="Selecione o papel"
                  tamanho="sm"
                />
              </CampoFormulario>
              <CampoFormulario id="campoDataInicio" label="Data início" :obrigatorio="true">
                <input
                  id="campoDataInicio"
                  v-model="formDataInicio"
                  type="date"
                  class="form-control form-control-sm"
                  required
                  autocomplete="off"
                />
              </CampoFormulario>
              <CampoFormulario id="campoDataFim" label="Data fim">
                <input
                  id="campoDataFim"
                  v-model="formDataFim"
                  type="date"
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
