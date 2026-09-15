<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import CartaoAlunoFrequencia from '@/componentes/CartaoAlunoFrequencia.vue';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import Combobox from '@/componentes/Combobox.vue';
import type { OpcaoCombobox } from '@/componentes/Combobox.vue';
import GrupoCheckbox from '@/componentes/GrupoCheckbox.vue';
import ModalConfirmacao from '@/componentes/ModalConfirmacao.vue';
import type { AlunoFrequencia, OpcaoCheckbox } from '@/tipos/componentes';

const route = useRoute();
const { usuario } = useAutenticacao();
const {
  buscarAlunosParaFrequencia,
  registrarFrequenciaEmMassa,
  registrarAusenciaEmPeriodo,
  carregando,
} = useMonitoramento();

const abaAtiva = ref<'turma' | 'individual'>('turma');
const alunos = ref<AlunoFrequencia[]>([]);
const dataAula = ref(new Date().toISOString().slice(0, 10));
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const { buscarOpcoes } = useOpcoesConfiguracao();
const opcoesPeriodos = ref<OpcaoCheckbox[]>([]);
const opcoesMotivos = ref<OpcaoCheckbox[]>([]);
const { inscrever, encerrar } = useRealtimeRefresh();

const turmaSelecionada = ref('');
const buscaTurma = ref('');
const periodosChamada = ref<string[]>([]);

const turmaOpcoes = computed<OpcaoCombobox[]>(() =>
  turmasDisponiveis.value.map((t) => ({ valor: t.id, rotulo: t.nome })),
);
const alunoOpcoes = computed<OpcaoCombobox[]>(() =>
  alunos.value.map((a) => ({ valor: a.id, rotulo: a.nome, descricao: a.turma ?? undefined })),
);
const chamadaPendente = ref(false);
const salvandoChamada = ref(false);

const alunoIdIndividual = ref('');
const periodosIndividuais = ref<string[]>([]);
const motivosIndividuais = ref<string[]>([]);
const justificativaIndividual = ref('');

const contadorJustificativa = computed(() => justificativaIndividual.value.length);

const justificativaSugerida = computed(() => {
  if (!motivosIndividuais.value.length) return '';
  const nomes = motivosIndividuais.value.map(
    (m) => opcoesMotivos.value.find((o) => o.valor === m)?.rotulo ?? m,
  );
  return `Aluno encaminhado para ${nomes.join(', ')}.`;
});

function aplicarMotivo() {
  if (
    !justificativaIndividual.value ||
    justificativaIndividual.value === justificativaSugerida.value
  ) {
    justificativaIndividual.value = justificativaSugerida.value;
  }
}

const turmasDisponiveis = computed(() => {
  const mapa = new Map<string, string>();
  for (const aluno of alunos.value) {
    if (aluno.turma_id && aluno.turma && !mapa.has(aluno.turma_id)) {
      mapa.set(aluno.turma_id, aluno.turma);
    }
  }
  return [...mapa.entries()].map(([id, nome]) => ({ id, nome }));
});

const alunosDaTurma = computed(() => {
  if (!turmaSelecionada.value) return [];
  return alunos.value.filter((a) => a.turma_id === turmaSelecionada.value);
});

const alunosFiltrados = computed(() => {
  if (!buscaTurma.value.trim()) return alunosDaTurma.value;
  const termo = buscaTurma.value.toLowerCase().trim();
  return alunosDaTurma.value.filter(
    (a) =>
      a.nome.toLowerCase().includes(termo) ||
      a.matricula.toLowerCase().includes(termo) ||
      (a.turma ?? '').toLowerCase().includes(termo),
  );
});

const totalAusentesMarcados = computed(() => alunosDaTurma.value.filter((a) => a.ausente).length);
const totalAlunosTurma = computed(() => alunosDaTurma.value.length);
const todosAusentes = computed(
  () => totalAlunosTurma.value > 0 && alunosDaTurma.value.every((a) => a.ausente),
);

function alternarTodos() {
  const novoValor = !todosAusentes.value;
  alunosDaTurma.value.forEach((a) => {
    a.ausente = novoValor;
    if (!novoValor) a.periodosAusentes = [];
  });
}

function alternarAusencia(alunoId: string) {
  const aluno = alunosDaTurma.value.find((a) => a.id === alunoId);
  if (aluno) {
    aluno.ausente = !aluno.ausente;
    if (!aluno.ausente) aluno.periodosAusentes = [];
  }
}

function mostrarSucesso(msg: string) {
  mensagemSucesso.value = msg;
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}

function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
}

async function carregarAlunos() {
  alunos.value = await buscarAlunosParaFrequencia(dataAula.value);
  if (!turmaSelecionada.value && turmasDisponiveis.value.length) {
    turmaSelecionada.value = turmasDisponiveis.value[0]!.id;
  }
  const alunoQuery = route.query.aluno;
  if (
    typeof alunoQuery === 'string' &&
    alunos.value.some((a) => a.id === alunoQuery) &&
    !alunoIdIndividual.value
  ) {
    abaAtiva.value = 'individual';
    alunoIdIndividual.value = alunoQuery;
  }
}

async function salvarChamada() {
  if (!totalAusentesMarcados.value) {
    mostrarErro('Nenhuma falta marcada. Marque os alunos ausentes antes de salvar.');
    return;
  }
  chamadaPendente.value = true;
}

async function confirmarSalvarChamada() {
  if (!usuario.value || !chamadaPendente.value) return;
  chamadaPendente.value = false;
  salvandoChamada.value = true;
  try {
    const turmaNome =
      turmasDisponiveis.value.find((t) => t.id === turmaSelecionada.value)?.nome ?? 'turma';
    const periodosEfetivos = periodosChamada.value.filter((p) => p !== 'Dia completo');
    const { registradas, erro: errMsg } = await registrarFrequenciaEmMassa(
      alunosDaTurma.value,
      usuario.value.id,
      dataAula.value,
      periodosEfetivos,
    );
    if (errMsg) {
      mostrarErro(errMsg);
    } else {
      mostrarSucesso(`${registradas} ausência(s) registrada(s) para ${turmaNome}.`);
      await carregarAlunos();
    }
  } finally {
    salvandoChamada.value = false;
  }
}

const confirmarIndividual = ref(false);

const temDadosIndividual = computed(
  () =>
    !!alunoIdIndividual.value ||
    periodosIndividuais.value.length > 0 ||
    !!justificativaIndividual.value.trim(),
);

function solicitarRegistrarIndividual() {
  if (!usuario.value) return;
  if (!alunoIdIndividual.value) {
    mostrarErro('Selecione um aluno.');
    return;
  }
  if (!periodosIndividuais.value.length) {
    mostrarErro('Selecione pelo menos um período.');
    return;
  }
  confirmarIndividual.value = true;
}

async function registrarIndividual() {
  confirmarIndividual.value = false;
  if (!usuario.value) return;
  for (const periodo of periodosIndividuais.value) {
    const ok = await registrarAusenciaEmPeriodo(
      alunoIdIndividual.value,
      usuario.value.id,
      dataAula.value,
      periodo,
      justificativaIndividual.value.trim() || undefined,
      motivosIndividuais.value.length ? motivosIndividuais.value : undefined,
    );
    if (!ok) {
      mostrarErro(`Falha ao registrar ausência no ${periodo}. Tente novamente.`);
      return;
    }
  }
  const aluno = alunos.value.find((a) => a.id === alunoIdIndividual.value);
  mostrarSucesso(
    `${periodosIndividuais.value.length} ausência(s) registrada(s) para ${aluno?.nome ?? 'aluno'}.`,
  );
  alunoIdIndividual.value = '';
  periodosIndividuais.value = [];
  motivosIndividuais.value = [];
  justificativaIndividual.value = '';
  await nextTick();
  requestAnimationFrame(() => {
    document
      .querySelector('.alert-success')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

onMounted(async () => {
  opcoesPeriodos.value = await buscarOpcoes('periodo');
  opcoesMotivos.value = await buscarOpcoes('motivo_ausencia');
  await carregarAlunos();
  await inscrever([{ tabela: 'frequencias' }], carregarAlunos);
});

onUnmounted(() => {
  encerrar();
});

watch(dataAula, () => {
  carregarAlunos();
});
</script>

<template>
  <div class="container py-4" style="max-width: 960px">
    <div class="d-flex gap-2 mb-3">
      <router-link to="/gestao" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1" aria-hidden="true"></i>
        Início
      </router-link>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="$router.back()">
        <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
        Voltar
      </button>
    </div>

    <h1 class="h5 fw-bold mb-3">
      <i class="bi bi-calendar-x text-success me-2" aria-hidden="true"></i>
      Registrar infrequências
    </h1>

    <div class="btn-group btn-group-sm mb-3" role="group" aria-label="Modo de registro">
      <button
        type="button"
        class="btn"
        :class="abaAtiva === 'turma' ? 'btn-success' : 'btn-outline-success'"
        @click="abaAtiva = 'turma'"
      >
        <i class="bi bi-people me-1" aria-hidden="true"></i>
        Chamada por turma
      </button>
      <button
        type="button"
        class="btn"
        :class="abaAtiva === 'individual' ? 'btn-success' : 'btn-outline-success'"
        @click="abaAtiva = 'individual'"
      >
        <i class="bi bi-person-dash me-1" aria-hidden="true"></i>
        Registro individual
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

    <div v-if="carregando && !alunos.length" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
    </div>

    <div v-else-if="!alunos.length" class="text-center py-5 text-body-secondary">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-inbox fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0 small">Nenhum aluno cadastrado.</p>
    </div>

    <template v-else>
      <CampoFormulario id="dataInfrequencia" label="Data da aula" :obrigatorio="true">
        <input
          id="dataInfrequencia"
          v-model="dataAula"
          type="date"
          class="form-control form-control-sm"
          style="max-width: 200px"
        />
      </CampoFormulario>

      <div v-if="abaAtiva === 'turma'" class="card border">
        <div
          class="card-header bg-body-tertiary d-flex flex-wrap justify-content-between align-items-center gap-2"
        >
          <span class="fw-semibold small">Chamada por exceção</span>
          <div class="d-flex align-items-center gap-2">
            <label
              for="seletorTurma"
              class="col-form-label col-form-label-sm text-body-secondary mb-0"
              >Turma</label
            >
            <Combobox
              id="seletorTurma"
              v-model="turmaSelecionada"
              :opcoes="turmaOpcoes"
              placeholder="Selecione a turma"
              tamanho="sm"
            />
          </div>
        </div>

        <div class="card-body">
          <div class="alert alert-info d-flex align-items-start gap-2 mb-3 py-2 small" role="note">
            <i class="bi bi-info-circle mt-1" aria-hidden="true"></i>
            <span
              >Todos os alunos são considerados <strong>presentes</strong>. Toque para marcar
              <strong>falta</strong>.</span
            >
          </div>

          <div class="mb-3">
            <label class="form-label small fw-medium mb-2">Períodos</label>
            <GrupoCheckbox
              nome="periodoChamadaGestao"
              :opcoes="opcoesPeriodos"
              :modelo="periodosChamada"
              :colunas="4"
              mostrar-selecionar-todos
              @update:modelo="periodosChamada = $event"
            />
          </div>

          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div class="d-flex gap-2 align-items-center">
              <div class="input-group input-group-sm" style="max-width: 260px">
                <span class="input-group-text bg-body-tertiary">
                  <i class="bi bi-search" aria-hidden="true"></i>
                </span>
                <input
                  v-model="buscaTurma"
                  type="search"
                  class="form-control"
                  placeholder="Buscar aluno"
                  aria-label="Buscar alunos da turma"
                />
              </div>
              <div class="form-check mb-0">
                <input
                  id="alternarTodosGestao"
                  :checked="todosAusentes"
                  type="checkbox"
                  class="form-check-input"
                  :indeterminate="totalAusentesMarcados > 0 && !todosAusentes"
                  :disabled="!totalAlunosTurma"
                  @change="alternarTodos"
                />
                <label class="form-check-label small" for="alternarTodosGestao">
                  {{ todosAusentes ? 'Desmarcar todos' : 'Marcar todos' }}
                </label>
              </div>
            </div>
            <div class="d-flex gap-2">
              <span class="badge text-bg-success"
                >{{ totalAlunosTurma - totalAusentesMarcados }} presentes</span
              >
              <span v-if="totalAusentesMarcados > 0" class="badge text-bg-danger"
                >{{ totalAusentesMarcados }} ausente(s)</span
              >
            </div>
          </div>

          <div v-if="!turmaSelecionada" class="text-center py-4 text-body-secondary small">
            Selecione uma turma.
          </div>

          <div v-else-if="!alunosFiltrados.length" class="text-center py-5 text-body-secondary">
            <span
              class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
              style="width: 72px; height: 72px"
            >
              <i class="bi bi-search fs-4 opacity-50" aria-hidden="true"></i>
            </span>
            <p class="mb-0 small">Nenhum aluno encontrado nesta turma.</p>
          </div>

          <div v-else class="d-flex flex-column gap-2">
            <div v-for="aluno in alunosFiltrados" :key="aluno.id" class="w-100">
              <CartaoAlunoFrequencia :aluno="aluno" @alternar="alternarAusencia" />
            </div>
          </div>
        </div>

        <div class="card-footer bg-body-tertiary d-flex justify-content-end gap-2">
          <button
            type="button"
            class="btn btn-success btn-sm"
            :disabled="salvandoChamada || carregando || !totalAusentesMarcados"
            @click="salvarChamada"
          >
            <span
              v-if="salvandoChamada"
              class="spinner-border spinner-border-sm me-1"
              role="status"
            ></span>
            <i v-else class="bi bi-save me-1" aria-hidden="true"></i>
            Salvar chamada
          </button>
        </div>
      </div>

      <div v-else class="card border">
        <div class="card-body">
          <p class="text-body-secondary small mb-3">
            Use quando um aluno específico faltar (ou tenha faltado) em períodos pontuais.
          </p>

          <CampoFormulario id="alunoIndividual" label="Aluno" :obrigatorio="true">
            <Combobox
              id="alunoIndividual"
              v-model="alunoIdIndividual"
              :opcoes="alunoOpcoes"
              placeholder="Selecione um aluno"
              tamanho="sm"
            />
          </CampoFormulario>

          <CampoFormulario
            id="periodosIndividuais"
            label="Períodos de ausência"
            :obrigatorio="true"
            dica="Marque um ou mais períodos"
          >
            <GrupoCheckbox
              nome="periodoIndividual"
              :opcoes="opcoesPeriodos"
              :modelo="periodosIndividuais"
              :colunas="3"
              mostrar-selecionar-todos
              @update:modelo="periodosIndividuais = $event"
            />
          </CampoFormulario>

          <CampoFormulario
            id="motivosIndividuais"
            label="Motivo (preenchimento rápido)"
            dica="Selecione para compor a justificativa automaticamente"
          >
            <GrupoCheckbox
              nome="motivoIndividual"
              :opcoes="opcoesMotivos"
              :modelo="motivosIndividuais"
              :colunas="2"
              @update:modelo="
                (v) => {
                  motivosIndividuais = v;
                  aplicarMotivo();
                }
              "
            />
          </CampoFormulario>

          <CampoFormulario
            id="justificativaIndividual"
            label="Justificativa (opcional)"
            :maxlength="500"
            :contador="contadorJustificativa"
          >
            <textarea
              id="justificativaIndividual"
              v-model="justificativaIndividual"
              class="form-control form-control-sm"
              rows="3"
              placeholder="Ex.: Responsável comunicou por telefone..."
              maxlength="500"
            ></textarea>
          </CampoFormulario>

          <div class="d-flex gap-2 justify-content-end">
            <button
              v-if="temDadosIndividual"
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="
                temDadosIndividual
                  ? ((alunoIdIndividual = ''),
                    (periodosIndividuais = []),
                    (justificativaIndividual = ''),
                    (motivosIndividuais = []))
                  : null
              "
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-sm btn-success"
              :disabled="carregando || !alunoIdIndividual || !periodosIndividuais.length"
              @click="solicitarRegistrarIndividual"
            >
              <span
                v-if="carregando"
                class="spinner-border spinner-border-sm me-1"
                role="status"
              ></span>
              <i v-else class="bi bi-save me-1" aria-hidden="true"></i>
              Registrar ausência
            </button>
          </div>
        </div>
      </div>
    </template>

    <ModalConfirmacao
      :visivel="chamadaPendente"
      titulo="Salvar chamada"
      :mensagem="
        'Registrar ' +
        totalAusentesMarcados +
        ' ausência(s) na turma selecionada em ' +
        new Date(dataAula + 'T12:00:00').toLocaleDateString('pt-BR') +
        '?'
      "
      rotulo-confirmar="Registrar faltas"
      icone="calendar-x"
      variante="warning"
      @confirmar="confirmarSalvarChamada"
      @cancelar="chamadaPendente = false"
    />
    <ModalConfirmacao
      :visivel="confirmarIndividual"
      titulo="Registrar ausência"
      :mensagem="`Registrar ${periodosIndividuais.length} ausência(s) para o aluno selecionado em ${new Date(dataAula + 'T12:00:00').toLocaleDateString('pt-BR')}?`"
      rotulo-confirmar="Registrar"
      icone="person-dash"
      variante="warning"
      @confirmar="registrarIndividual"
      @cancelar="confirmarIndividual = false"
    />
  </div>
</template>
