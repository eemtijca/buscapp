<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import ListaOcorrencias from '@/componentes/ListaOcorrencias.vue';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import Combobox from '@/componentes/Combobox.vue';
import type { OpcaoCombobox } from '@/componentes/Combobox.vue';
import GrupoCheckbox from '@/componentes/GrupoCheckbox.vue';
import ModalConfirmacao from '@/componentes/ModalConfirmacao.vue';
import type { AlunoFrequencia, OcorrenciaGrave, OpcaoCheckbox } from '@/tipos/componentes';
import { supabaseClient } from '@/servicos/supabase';

const router = useRouter();
const { usuario } = useAutenticacao();
const {
  buscarOcorrenciasGraves,
  alternarBloqueioRetorno,
  buscarAlunosParaFrequencia,
  registrarOcorrenciaGrave,
} = useMonitoramento();
const {
  ultimaAtualizacao,
  estaAtualizando,
  atualizar: refresh,
  inscrever,
  encerrar,
} = useRealtimeRefresh();
const { buscarOpcoes } = useOpcoesConfiguracao();

const ocorrencias = ref<OcorrenciaGrave[]>([]);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

// Registro de ocorrência pela gestão (mesmo fluxo do professor).
const mostrarFormulario = ref(false);
const salvando = ref(false);
const alunos = ref<AlunoFrequencia[]>([]);
const opcoesTipo = ref<OpcaoCheckbox[]>([]);
const opcoesTags = ref<OpcaoCheckbox[]>([]);
const alunoId = ref('');
const tipos = ref<string[]>(['grave']);

const alunoOpcoes = computed<OpcaoCombobox[]>(() =>
  alunos.value.map((a) => ({ valor: a.id, rotulo: a.nome, descricao: a.turma ?? undefined })),
);
const tags = ref<string[]>([]);
const descricao = ref('');
const exigePresenca = ref(false);
const confirmarRegistro = ref(false);
const confirmarCancelar = ref(false);

/** Verifica se há dados preenchidos no formulário de ocorrência. */
const temDadosOcorrencia = computed(
  () => !!alunoId.value || !!descricao.value.trim() || tags.value.length > 0,
);
const notificarCoordenacao = ref(true);
const notificarResponsavel = ref(false);

function mostrarSucesso(msg: string) {
  mensagemSucesso.value = msg;
  setTimeout(() => (mensagemSucesso.value = null), 4000);
}

function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
}

async function alternarBloqueio(ocorrenciaId: string) {
  const oc = ocorrencias.value.find((o) => o.id === ocorrenciaId);
  if (!oc) return;
  const novoValor = !oc.exigePresencaResponsavel;
  const ok = await alternarBloqueioRetorno(ocorrenciaId, novoValor);
  if (ok) {
    oc.exigePresencaResponsavel = novoValor;
    oc.bloqueado = novoValor;
    mostrarSucesso(novoValor ? 'Retorno bloqueado.' : 'Retorno liberado.');
  } else {
    mostrarErro('Falha ao atualizar bloqueio.');
  }
}

function registrarSuspensao() {
  mostrarSucesso('Encaminhado para formalização de suspensão.');
}

async function carregarOcorrencias() {
  ocorrencias.value = await buscarOcorrenciasGraves();
}

async function atualizarManual() {
  await refresh(carregarOcorrencias);
}

async function alternarFormulario() {
  if (mostrarFormulario.value && temDadosOcorrencia.value) {
    confirmarCancelar.value = true;
    return;
  }
  mostrarFormulario.value = !mostrarFormulario.value;
  if (mostrarFormulario.value && !alunos.value.length) {
    opcoesTipo.value = await buscarOpcoes('tipo_ocorrencia');
    const { data: tagsData } = await supabaseClient
      .from('tags_comportamento')
      .select('nome, icone, descricao')
      .eq('ativo', true)
      .order('nome');
    opcoesTags.value = (tagsData ?? []).map(
      (t: { nome: string; icone: string | null; descricao: string | null }) => ({
        valor: t.nome,
        rotulo: t.descricao ?? t.nome,
        icone: t.icone ?? undefined,
      }),
    );
    alunos.value = await buscarAlunosParaFrequencia();
  }
}

function solicitarRegistroOcorrencia() {
  if (!usuario.value || !alunoId.value || !tipos.value.length) return;
  if (descricao.value.trim().length < 10) {
    mostrarErro('Descreva a ocorrência com pelo menos 10 caracteres.');
    return;
  }
  confirmarRegistro.value = true;
}

async function registrarOcorrencia() {
  confirmarRegistro.value = false;
  if (!usuario.value || !alunoId.value || !tipos.value.length) return;
  salvando.value = true;
  try {
    const ok = await registrarOcorrenciaGrave(
      alunoId.value,
      usuario.value.id,
      descricao.value.trim(),
      tipos.value,
      exigePresenca.value,
      tags.value,
      notificarCoordenacao.value,
      notificarResponsavel.value,
    );
    if (ok) {
      mostrarSucesso('Ocorrência registrada com sucesso!');
      alunoId.value = '';
      tipos.value = ['grave'];
      tags.value = [];
      descricao.value = '';
      exigePresenca.value = false;
      notificarCoordenacao.value = true;
      notificarResponsavel.value = false;
      mostrarFormulario.value = false;
      await carregarOcorrencias();
      await nextTick();
      requestAnimationFrame(() => {
        document
          .querySelector('.alert-success')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      mostrarErro('Falha ao registrar ocorrência. Tente novamente.');
    }
  } finally {
    salvando.value = false;
  }
}

let inicializado = false;

// Inicializa quando usuario existir: garante carga e inscrição realtime mesmo após reload direto.
async function inicializar() {
  if (!usuario.value || inicializado) return;
  inicializado = true;
  await carregarOcorrencias();
  await inscrever([{ tabela: 'ocorrencias' }], carregarOcorrencias);
}

watch(usuario, () => void inicializar(), { immediate: true });

onUnmounted(() => {
  encerrar();
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
        <i class="bi bi-shield-exclamation text-danger me-2" aria-hidden="true"></i>
        Ocorrências graves e suspensões
      </h1>
      <div class="d-flex align-items-center gap-2">
        <span class="badge text-bg-secondary">{{ ocorrencias.length }} registro(s)</span>
        <button
          type="button"
          class="btn btn-sm"
          :class="mostrarFormulario ? 'btn-outline-secondary' : 'btn-success'"
          @click="alternarFormulario"
        >
          <i
            class="bi me-1"
            :class="mostrarFormulario ? 'bi-x-lg' : 'bi-plus-lg'"
            aria-hidden="true"
          ></i>
          {{ mostrarFormulario ? 'Cancelar' : 'Registrar ocorrência' }}
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="estaAtualizando"
          @click="atualizarManual"
          title="Recarregar dados"
        >
          <span
            v-if="estaAtualizando"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          ></span>
          <i v-else class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
          Atualizar
        </button>
      </div>
    </div>

    <div v-if="ultimaAtualizacao" class="small text-body-tertiary mb-2 text-end">
      <i class="bi bi-clock me-1" aria-hidden="true"></i>
      Última atualização: {{ ultimaAtualizacao.toLocaleTimeString('pt-BR') }}
    </div>

    <div v-if="mensagemSucesso" class="alert alert-success py-2 small mb-3" role="status">
      <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
      {{ mensagemSucesso }}
    </div>
    <div v-if="mensagemErro" class="alert alert-danger py-2 small mb-3" role="alert">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
      {{ mensagemErro }}
    </div>

    <div v-if="mostrarFormulario" class="card border mb-3">
      <div class="card-header bg-body-tertiary py-2">
        <span class="fw-medium small">Nova ocorrência</span>
      </div>
      <div class="card-body">
        <CampoFormulario id="ocoGestaoAluno" label="Aluno" :obrigatorio="true">
          <Combobox
            id="ocoGestaoAluno"
            v-model="alunoId"
            :opcoes="alunoOpcoes"
            placeholder="Selecione um aluno"
            tamanho="sm"
          />
        </CampoFormulario>

        <CampoFormulario id="ocoGestaoTipo" label="Tipo de ocorrência" :obrigatorio="true">
          <GrupoCheckbox
            nome="tipoOcorrenciaGestao"
            :opcoes="opcoesTipo"
            :modelo="tipos"
            :colunas="3"
            @update:modelo="tipos = $event"
          />
        </CampoFormulario>

        <CampoFormulario
          id="ocoGestaoTags"
          label="Tags de comportamento (opcional)"
          dica="Componha a descrição automaticamente"
        >
          <GrupoCheckbox
            nome="tagsOcorrenciaGestao"
            :opcoes="opcoesTags"
            :modelo="tags"
            :colunas="3"
            @update:modelo="tags = $event"
          />
        </CampoFormulario>

        <CampoFormulario id="ocoGestaoDescricao" label="Descrição" :obrigatorio="true">
          <textarea
            id="ocoGestaoDescricao"
            v-model="descricao"
            class="form-control form-control-sm"
            rows="3"
            maxlength="500"
            placeholder="Descreva o acontecido com ao menos 10 caracteres."
          ></textarea>
        </CampoFormulario>

        <div class="d-flex flex-wrap gap-3 mb-3 small">
          <div class="form-check">
            <input
              id="ocoGestaoPresenca"
              v-model="exigePresenca"
              type="checkbox"
              class="form-check-input"
            />
            <label class="form-check-label" for="ocoGestaoPresenca"
              >Exigir presença do responsável</label
            >
          </div>
          <div class="form-check">
            <input
              id="ocoGestaoCoord"
              v-model="notificarCoordenacao"
              type="checkbox"
              class="form-check-input"
            />
            <label class="form-check-label" for="ocoGestaoCoord">Notificar coordenação</label>
          </div>
          <div class="form-check">
            <input
              id="ocoGestaoResp"
              v-model="notificarResponsavel"
              type="checkbox"
              class="form-check-input"
            />
            <label class="form-check-label" for="ocoGestaoResp">Notificar responsável</label>
          </div>
        </div>

        <div class="d-flex gap-2 justify-content-end">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="temDadosOcorrencia ? (confirmarCancelar = true) : (mostrarFormulario = false)"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-sm btn-success"
            :disabled="salvando || !alunoId || !tipos.length || descricao.trim().length < 10"
            @click="solicitarRegistroOcorrencia"
          >
            <span
              v-if="salvando"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            ></span>
            <i v-else class="bi bi-check-lg me-1" aria-hidden="true"></i>
            Registrar ocorrência
          </button>
        </div>
      </div>
    </div>

    <div class="card border">
      <div class="card-body p-0">
        <ListaOcorrencias
          :ocorrencias="ocorrencias"
          @bloquear-retorno="alternarBloqueio"
          @registrar-suspensao="registrarSuspensao"
        />
      </div>
    </div>
    <ModalConfirmacao
      :visivel="confirmarRegistro"
      titulo="Confirmar ocorrência"
      mensagem="Deseja registrar esta ocorrência? Ela afetará o termômetro de atenção do aluno."
      rotulo-confirmar="Registrar"
      icone="shield-exclamation"
      variante="danger"
      @confirmar="registrarOcorrencia"
      @cancelar="confirmarRegistro = false"
    />
    <ModalConfirmacao
      :visivel="confirmarCancelar"
      titulo="Descartar ocorrência?"
      mensagem="Há dados preenchidos que serão perdidos. Deseja realmente cancelar?"
      rotulo-confirmar="Descartar"
      icone="exclamation-triangle"
      variante="danger"
      @confirmar="
        () => {
          confirmarCancelar = false;
          mostrarFormulario = false;
          alunoId = '';
          descricao = '';
          tags = [];
        }
      "
      @cancelar="confirmarCancelar = false"
    />
  </div>
</template>
