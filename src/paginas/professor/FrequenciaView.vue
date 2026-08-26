<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import CartaoAlunoFrequencia from '@/componentes/CartaoAlunoFrequencia.vue';
import GrupoCheckbox from '@/componentes/GrupoCheckbox.vue';
import type { AlunoFrequencia, OpcaoCheckbox } from '@/tipos/componentes';

const router = useRouter();
const { usuario } = useAutenticacao();
const { buscarAlunosParaFrequencia, registrarFrequenciaEmMassa, carregando } = useMonitoramento();

const alunos = ref<AlunoFrequencia[]>([]);
const buscaAluno = ref('');
const dataAula = ref(new Date().toISOString().slice(0, 10));
const periodosSelecionados = ref<string[]>(['Dia completo']);
const mensagemSucesso = ref<string | null>(null);
const salvando = ref(false);

const { buscarOpcoes } = useOpcoesConfiguracao();
const opcoesPeriodos = ref<OpcaoCheckbox[]>([]);
const { inscrever, encerrar } = useRealtimeRefresh();

const alunosFiltrados = computed(() => {
  if (!buscaAluno.value.trim()) return alunos.value;
  const termo = buscaAluno.value.toLowerCase().trim();
  return alunos.value.filter(
    (a) =>
      a.nome.toLowerCase().includes(termo) ||
      a.matricula.toLowerCase().includes(termo) ||
      (a.turma ?? '').toLowerCase().includes(termo),
  );
});

const totalAusentesMarcados = computed(() => alunos.value.filter((a) => a.ausente).length);
const totalAlunos = computed(() => alunos.value.length);
const todosAusentes = computed(() => alunos.value.every((a) => a.ausente));

function alternarTodos() {
  const novoValor = !todosAusentes.value;
  alunos.value.forEach((a) => {
    a.ausente = novoValor;
    if (!novoValor) a.periodosAusentes = [];
  });
}

function alternarAusencia(alunoId: string) {
  const aluno = alunos.value.find((a) => a.id === alunoId);
  if (aluno) {
    aluno.ausente = !aluno.ausente;
    if (!aluno.ausente) {
      aluno.periodosAusentes = [];
    }
  }
}

async function salvarFrequencia() {
  if (!usuario.value || salvando.value) return;
  salvando.value = true;
  const { registradas, erro: errMsg } = await registrarFrequenciaEmMassa(
    alunos.value,
    usuario.value.id,
    dataAula.value,
    periodosSelecionados.value.includes('Dia completo')
      ? ['1º Horário', '2º Horário', '3º Horário', '4º Horário', 'Manhã', 'Tarde']
      : periodosSelecionados.value,
  );
  salvando.value = false;
  if (errMsg) {
    mensagemSucesso.value = errMsg;
  } else if (registradas > 0) {
    mensagemSucesso.value = `${registradas} ausência(s) registrada(s) com sucesso.`;
  } else {
    mensagemSucesso.value = 'Todos os alunos estão presentes. Nenhuma ausência registrada.';
  }
  await nextTick();
  requestAnimationFrame(() => {
    const alerta = document.querySelector('.alert-success');
    if (alerta) alerta.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}

async function carregarAlunos() {
  alunos.value = await buscarAlunosParaFrequencia(dataAula.value);
}

onMounted(async () => {
  opcoesPeriodos.value = await buscarOpcoes('periodo');
  await carregarAlunos();
  // Enturmacoes na inscrição: matrícula nova aparece na lista sem recarregar.
  await inscrever([{ tabela: 'frequencias' }, { tabela: 'enturmacoes' }], carregarAlunos);
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
      <router-link to="/professor" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1" aria-hidden="true"></i>
        Início
      </router-link>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="router.back()">
        <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
        Voltar
      </button>
    </div>

    <h1 class="h5 fw-bold mb-3">
      <i class="bi bi-check2-square text-success me-2" aria-hidden="true"></i>
      Registrar frequência
    </h1>

    <div class="card border mb-4">
      <div
        class="card-header bg-body-tertiary d-flex flex-wrap justify-content-between align-items-center gap-2"
      >
        <span class="fw-semibold small">Registro de frequência por exceção</span>
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <label for="dataAula" class="col-form-label col-form-label-sm text-body-secondary mb-0"
            >Data</label
          >
          <input
            id="dataAula"
            v-model="dataAula"
            type="date"
            class="form-control form-control-sm"
            style="width: 150px"
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

        <div v-if="mensagemSucesso" class="alert alert-success py-2 mb-3 small" role="status">
          <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
          {{ mensagemSucesso }}
        </div>

        <div class="mb-3">
          <label class="form-label small fw-medium mb-2">Períodos</label>
          <GrupoCheckbox
            nome="periodoFreq"
            :opcoes="opcoesPeriodos"
            :modelo="periodosSelecionados"
            :colunas="4"
            @update:modelo="periodosSelecionados = $event"
          />
        </div>

        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div class="d-flex gap-2 align-items-center">
            <div class="input-group input-group-sm" style="max-width: 280px">
              <span class="input-group-text bg-body-tertiary">
                <i class="bi bi-search" aria-hidden="true"></i>
              </span>
              <input
                v-model="buscaAluno"
                type="search"
                class="form-control"
                placeholder="Buscar aluno"
                aria-label="Buscar alunos"
              />
            </div>
            <div class="form-check mb-0">
              <input
                id="alternarTodos"
                :checked="todosAusentes && totalAlunos > 0"
                type="checkbox"
                class="form-check-input"
                :indeterminate="totalAusentesMarcados > 0 && !todosAusentes"
                @change="alternarTodos"
              />
              <label class="form-check-label small" for="alternarTodos">
                {{ todosAusentes ? 'Desmarcar todos' : 'Marcar todos' }}
              </label>
            </div>
          </div>
          <div class="d-flex gap-2">
            <span class="badge text-bg-success"
              >{{ totalAlunos - totalAusentesMarcados }} presentes</span
            >
            <span v-if="totalAusentesMarcados > 0" class="badge text-bg-danger"
              >{{ totalAusentesMarcados }} ausente(s)</span
            >
          </div>
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
          <p class="mb-0 small">Nenhum aluno cadastrado para a sua turma.</p>
        </div>

        <div v-else-if="!alunosFiltrados.length" class="text-center py-5 text-body-secondary">
          <span
            class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
            style="width: 72px; height: 72px"
          >
            <i class="bi bi-search fs-4 opacity-50" aria-hidden="true"></i>
          </span>
          <p class="mb-0 small">Nenhum aluno encontrado.</p>
        </div>

        <div v-else class="d-flex flex-column gap-2">
          <div v-for="aluno in alunosFiltrados" :key="aluno.id" class="w-100">
            <CartaoAlunoFrequencia :aluno="aluno" @alternar="alternarAusencia" />
          </div>
        </div>
      </div>

      <div class="card-footer bg-body-tertiary d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-outline-secondary btn-sm" @click="router.back()">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-success btn-sm"
          :disabled="carregando || !alunos.length"
          @click="salvarFrequencia"
        >
          <span
            v-if="carregando"
            class="spinner-border spinner-border-sm me-1"
            role="status"
          ></span>
          <i v-else class="bi bi-save me-1" aria-hidden="true"></i>
          Salvar frequência
        </button>
      </div>
    </div>
  </div>
</template>
