<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { api } from '@/servicos/api';
import { useDisciplinas, useOpcoes, useTurmas } from '@/composables/consultas/useCatalogos';
import { useUsuarios } from '@/composables/consultas/useGestaoUsuarios';
import { useConsulta } from '@/composables/useConsulta';
import { Consultas } from '@/servicos/consultas';
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
import type { AtribuicaoProfessor } from '@/tipos/database';

interface AtribuicaoItem extends AtribuicaoProfessor {
  professor_nome?: string;
  turma_nome?: string;
  disciplina_nome?: string | null;
}

/** Resumo de usuário usado no combo de professores. */
interface ProfessorResumo {
  id: string;
  nome: string;
}

const router = useRouter();

const consultaAtribuicoes = useConsulta(() => Consultas.atribuicoes());
const consultaProfessores = useUsuarios(() => ({ papel: 'professor' }));
const consultaTurmas = useTurmas(() => ({ ativo: 'true' }));
const consultaDisciplinas = useDisciplinas(() => ({ ativo: 'true' }));
const { opcoes: opcoesPapel } = useOpcoes(() => 'papel_atribuicao');

const erro = computed(
  () =>
    consultaAtribuicoes.erro.value ??
    consultaProfessores.erro.value ??
    consultaTurmas.erro.value ??
    consultaDisciplinas.erro.value,
);

const atribuicoes = computed<AtribuicaoItem[]>(() =>
  (consultaAtribuicoes.dados.value?.atribuicoes ?? []).map((atribuicao) => ({
    ...atribuicao,
    professor_nome: atribuicao.professor?.nome ?? '—',
    turma_nome: atribuicao.turma?.nome_completo ?? '—',
    disciplina_nome: atribuicao.disciplina?.nome ?? null,
  })),
);
const professores = computed<ProfessorResumo[]>(() =>
  consultaProfessores.usuarios.value.map((usuario) => ({ id: usuario.id, nome: usuario.nome })),
);
const turmas = consultaTurmas.turmas;
const disciplinas = consultaDisciplinas.disciplinas;
const pendente = computed(
  () =>
    consultaAtribuicoes.pendente.value ||
    consultaProfessores.pendente.value ||
    consultaTurmas.pendente.value ||
    consultaDisciplinas.pendente.value,
);
const salvando = ref(false);
const carregando = computed(() => pendente.value || salvando.value);

async function recarregar() {
  await Promise.all([
    consultaAtribuicoes.recarregar(true),
    consultaProfessores.recarregar(),
    consultaTurmas.recarregar(),
    consultaDisciplinas.recarregar(),
  ]);
}
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const modalAberto = ref(false);
const modoEdicao = ref(false);
const editandoId = ref<string | null>(null);

const formProfessorId = ref('');
const formTurmaId = ref('');
const formDisciplinaId = ref('');

const formPapel = ref('titular');
const formDataInicio = ref('');
const formDataFim = ref('');
const formAtivo = ref(true);
// Snapshot para detecção de alterações.
const {
  isDirty: formDirty,
  reset: resetSnapshot,
  pausar: pausarSnapshot,
  pausado: snapshotPausado,
} = useFormSnapshot(() => ({
  professor: formProfessorId.value,
  turma: formTurmaId.value,
  disciplina: formDisciplinaId.value,
  papel: formPapel.value,
  inicio: formDataInicio.value,
  fim: formDataFim.value,
  ativo: String(formAtivo.value),
}));
let timerSucesso: ReturnType<typeof setTimeout> | null = null;
let timerErro: ReturnType<typeof setTimeout> | null = null;

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
    if (snapshotPausado.value) return;
  },
);

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
  formProfessorId.value = '';
  formTurmaId.value = '';
  formDisciplinaId.value = '';
  formPapel.value = 'titular';
  formDataInicio.value = '';
  formDataFim.value = '';
  formAtivo.value = true;
  editandoId.value = null;
  modoEdicao.value = false;
  nextTick(() => {
    resetSnapshot();
    pausarSnapshot(false);
  });
}

function formatarData(data: string | null) {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR');
}

async function abrirEditar(atribuicao: AtribuicaoItem) {
  pausarSnapshot(true);
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
  if (!formProfessorId.value || !formTurmaId.value || !formDataInicio.value) {
    mostrarErro(
      mensagemErroExplicita('Atribuição', 'nova', 'salvar', 'Preencha os campos obrigatórios.'),
    );
    return;
  }
  salvando.value = true;
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
      try {
        await api(`/api/atribuicoes/${editandoId.value}`, { metodo: 'PUT', corpo: payload });
      } catch (e) {
        mostrarErro(mensagemErroExplicita('Atribuição', formPapel.value, 'atualizar', e));
        return;
      }
      mostrarSucesso(criarMensagemSucesso('Atribuição', formPapel.value, 'atualizada'));
    } else {
      try {
        await api('/api/atribuicoes', { metodo: 'POST', corpo: payload });
      } catch (e) {
        mostrarErro(mensagemErroExplicita('Atribuição', formPapel.value, 'criar', e));
        return;
      }
      mostrarSucesso(criarMensagemSucesso('Atribuição', formPapel.value, 'criada'));
    }
    modalAberto.value = false;
    resetForm();
    await recarregar();
  } finally {
    salvando.value = false;
  }
}

async function alternarAtivo(atribuicao: AtribuicaoItem) {
  const novoValor = !atribuicao.ativo;
  try {
    await api(`/api/atribuicoes/${atribuicao.id}/status`, {
      metodo: 'PATCH',
      corpo: { ativo: novoValor },
    });
    mostrarSucesso(novoValor ? 'Atribuição ativada.' : 'Atribuição desativada.');
    await recarregar();
  } catch {
    mostrarErro('Falha ao alterar status.');
  }
}

const papelBadge = (papel: string) => {
  const idx = opcoesPapel.value.findIndex((p) => p.valor === papel);
  const cores = ['text-bg-primary', 'text-bg-info', 'text-bg-success', 'text-bg-warning'];
  return cores[idx % cores.length] || 'text-bg-secondary';
};
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
        <i class="bi bi-people text-success me-2" aria-hidden="true"></i>
        Atribuições
      </h1>
      <button
        type="button"
        class="btn btn-sm btn-success"
        :disabled="carregando"
        @click="abrirNovo"
      >
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
        Nova atribuição
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
      mensagem="Não foi possível carregar as atribuições."
      @tentar-novamente="recarregar()"
    />

    <div v-else-if="carregando && !atribuicoes.length" class="text-center py-5">
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
                    :disabled="carregando"
                    :aria-label="'Editar atribuição de ' + a.professor_nome"
                    @click="abrirEditar(a)"
                  >
                    <i class="bi bi-pencil" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="a.ativo ? 'btn-outline-danger' : 'btn-outline-success'"
                    :disabled="carregando"
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

    <ModalBase
      :visivel="modalAberto"
      :titulo="modoEdicao ? 'Editar atribuição' : 'Nova atribuição'"
      icone="people"
      cor-icone="text-primary"
      largura="md"
      @update:visivel="(aberto) => !aberto && (modalAberto = false)"
    >
      <form @submit.prevent="salvar">
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
            <input id="campoAtivo" v-model="formAtivo" type="checkbox" class="form-check-input" />
            <label class="form-check-label small fw-medium" for="campoAtivo">Ativo</label>
          </div>
        </div>
      </form>

      <template #rodape>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="modalAberto = false">
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
