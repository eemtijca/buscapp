<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '@/servicos/api';
import { useHorariosLetivos } from '@/composables/consultas/useCatalogos';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import Combobox from '@/componentes/Combobox.vue';
import type { OpcaoCombobox } from '@/componentes/Combobox.vue';
import ModalBase from '@/componentes/ModalBase.vue';
import type { HorarioLetivo } from '@/tipos/database';

const diasSemana = [
  { valor: 0, rotulo: 'Domingo' },
  { valor: 1, rotulo: 'Segunda' },
  { valor: 2, rotulo: 'Terça' },
  { valor: 3, rotulo: 'Quarta' },
  { valor: 4, rotulo: 'Quinta' },
  { valor: 5, rotulo: 'Sexta' },
  { valor: 6, rotulo: 'Sábado' },
];

const { horarios, pendente, recarregar } = useHorariosLetivos();
const salvando = ref(false);
const carregando = computed(() => pendente.value || salvando.value);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const modalAberto = ref(false);
const modoEdicao = ref(false);
const editandoId = ref<string | null>(null);

const formDia = ref(1);
const formInicio = ref('07:00');
const formFim = ref('17:00');
const formAtivo = ref(true);

const diasOpcoes = computed<OpcaoCombobox[]>(() =>
  diasSemana.map((d) => ({ valor: String(d.valor), rotulo: d.rotulo })),
);
const formDiaStr = computed({
  get: () => String(formDia.value),
  set: (v: string) => (formDia.value = Number(v)),
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
  formDia.value = 1;
  formInicio.value = '07:00';
  formFim.value = '17:00';
  formAtivo.value = true;
  editandoId.value = null;
  modoEdicao.value = false;
}

function abrirNovo() {
  resetForm();
  modalAberto.value = true;
}

function abrirEditar(item: HorarioLetivo) {
  modoEdicao.value = true;
  editandoId.value = item.id;
  formDia.value = item.dia_semana;
  formInicio.value = item.hora_inicio.slice(0, 5);
  formFim.value = item.hora_fim.slice(0, 5);
  formAtivo.value = item.ativo;
  modalAberto.value = true;
}

async function salvar() {
  if (formFim.value <= formInicio.value) {
    mostrarErro('O horário de fim deve ser posterior ao de início.');
    return;
  }
  salvando.value = true;
  try {
    if (modoEdicao.value && editandoId.value) {
      await api(`/api/horarios/${editandoId.value}`, {
        metodo: 'PUT',
        corpo: {
          dia_semana: formDia.value,
          hora_inicio: formInicio.value,
          hora_fim: formFim.value,
          ativo: formAtivo.value,
        },
      });
      mostrarSucesso('Horário atualizado.');
    } else {
      await api('/api/horarios', {
        metodo: 'POST',
        corpo: {
          dia_semana: formDia.value,
          hora_inicio: formInicio.value,
          hora_fim: formFim.value,
          ativo: formAtivo.value,
        },
      });
      mostrarSucesso('Horário criado.');
    }
    modalAberto.value = false;
    await recarregar();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mostrarErro(msg);
  } finally {
    salvando.value = false;
  }
}

async function alternarAtivo(item: HorarioLetivo) {
  try {
    await api(`/api/horarios/${item.id}/status`, {
      metodo: 'PATCH',
      corpo: { ativo: !item.ativo },
    });
    await recarregar();
  } catch {
    mostrarErro('Falha ao alternar status.');
  }
}

async function excluir(id: string) {
  if (!confirm('Excluir este horário?')) return;
  try {
    await api(`/api/horarios/${id}`, { metodo: 'DELETE' });
    mostrarSucesso('Horário excluído.');
    await recarregar();
  } catch {
    mostrarErro('Falha ao excluir.');
  }
}
</script>

<template>
  <div class="container py-4" style="max-width: 900px">
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
      <h1 class="h4 fw-bold mb-0">Horários Letivos</h1>
      <button class="btn btn-success btn-sm ms-auto" @click="abrirNovo">
        <i class="bi bi-plus-lg"></i> Novo horário
      </button>
    </div>

    <div class="alert alert-info small" role="alert">
      <i class="bi bi-info-circle"></i>
      Estes horários definem as janelas de atendimento do chat. Fora delas, o envio de mensagens é
      bloqueado.
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
            <th>Dia</th>
            <th>Início</th>
            <th>Fim</th>
            <th>Ativo</th>
            <th class="text-end">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in horarios"
            :key="item.id"
            :class="{ 'text-body-tertiary': !item.ativo }"
          >
            <td>
              {{ diasSemana.find((d) => d.valor === item.dia_semana)?.rotulo ?? item.dia_semana }}
            </td>
            <td>{{ item.hora_inicio.slice(0, 5) }}</td>
            <td>{{ item.hora_fim.slice(0, 5) }}</td>
            <td>
              <div class="form-check form-switch">
                <input
                  class="form-check-input"
                  type="checkbox"
                  :checked="item.ativo"
                  :aria-label="`Ativo: ${item.dia_semana} ${item.hora_inicio}`"
                  @change="alternarAtivo(item)"
                />
              </div>
            </td>
            <td class="text-end">
              <button
                class="btn btn-outline-primary btn-sm me-1"
                :aria-label="`Editar horário de ${item.hora_inicio} às ${item.hora_fim}`"
                @click="abrirEditar(item)"
              >
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm" @click="excluir(item.id)">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="!horarios.length">
            <td colspan="5" class="text-center text-body-secondary py-4">
              Nenhum horário cadastrado.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ModalBase
      :visivel="modalAberto"
      :titulo="(modoEdicao ? 'Editar' : 'Novo') + ' horário'"
      largura="md"
      @update:visivel="(aberto) => !aberto && (modalAberto = false)"
    >
      <CampoFormulario id="hr-dia" label="Dia da semana">
        <Combobox
          id="hr-dia"
          v-model="formDiaStr"
          :opcoes="diasOpcoes"
          placeholder="Selecione o dia"
        />
      </CampoFormulario>
      <CampoFormulario id="hr-inicio" label="Início">
        <input
          id="hr-inicio"
          v-model="formInicio"
          type="time"
          class="form-control"
          :disabled="carregando"
        />
      </CampoFormulario>
      <CampoFormulario id="hr-fim" label="Fim">
        <input
          id="hr-fim"
          v-model="formFim"
          type="time"
          class="form-control"
          :disabled="carregando"
        />
      </CampoFormulario>
      <div class="form-check form-switch mt-3">
        <input class="form-check-input" type="checkbox" id="hr-ativo" v-model="formAtivo" />
        <label class="form-check-label" for="hr-ativo">Ativo</label>
      </div>

      <template #rodape>
        <button type="button" class="btn btn-outline-secondary" @click="modalAberto = false">
          Cancelar
        </button>
        <button type="button" class="btn btn-success" @click="salvar" :disabled="carregando">
          <span v-if="carregando" class="spinner-border spinner-border-sm me-1"></span>
          Salvar
        </button>
      </template>
    </ModalBase>
  </div>
</template>
