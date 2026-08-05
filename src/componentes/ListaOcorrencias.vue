<script setup lang="ts">
import type { OcorrenciaGrave } from '@/tipos/componentes';

defineProps<{
  ocorrencias: OcorrenciaGrave[];
}>();

const emit = defineEmits<{
  'bloquear-retorno': [ocorrenciaId: string];
  'ver-anexo': [ocorrenciaId: string];
  'registrar-suspensao': [ocorrenciaId: string];
}>();

const classeTipo: Record<string, string> = {
  grave: 'text-bg-danger',
  suspensao: 'text-bg-dark',
};
const rotuloTipo: Record<string, string> = {
  grave: 'Ocorrência grave',
  suspensao: 'Suspensão',
};
const rotuloTag: Record<string, string> = {
  agressao_verbal: 'Agressão verbal',
  agressao_fisica: 'Agressão física',
  desacato: 'Desacato',
  dano_patrimonio: 'Dano ao patrimônio',
  bullying: 'Bullying',
  descumprimento_regras: 'Descumprimento de regras',
  saida_nao_autorizada: 'Saída não autorizada',
};
</script>

<template>
  <div class="list-group list-group-flush">
    <article
      v-for="oc in ocorrencias"
      :key="oc.id"
      class="list-group-item list-group-item-action p-3"
      :aria-label="'Ocorrência de ' + oc.alunoNome"
    >
      <div class="d-flex w-100 justify-content-between gap-2 flex-wrap mb-2">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span
            v-for="t in oc.tipo"
            :key="t"
            class="badge"
            :class="classeTipo[t] || 'text-bg-secondary'"
            >{{ rotuloTipo[t] || t }}</span
          >
          <strong class="me-2">{{ oc.alunoNome }}</strong>
          <small class="text-body-secondary">
            <span v-if="oc.turma">{{ oc.turma }} · </span>Matrícula {{ oc.alunoMatricula }}
          </small>
        </div>
        <small class="text-body-secondary">{{ oc.data }}</small>
      </div>

      <p class="mb-2 small">{{ oc.descricao }}</p>

      <div class="d-flex flex-wrap gap-2 mb-2">
        <span v-if="oc.professorNome" class="badge text-bg-light border">
          <i class="bi bi-person me-1" aria-hidden="true"></i>{{ oc.professorNome }}
        </span>
        <span v-if="oc.bloqueado" class="badge text-bg-dark">
          <i class="bi bi-lock me-1" aria-hidden="true"></i>Retorno bloqueado
        </span>
        <span v-if="oc.exigePresencaResponsavel" class="badge text-bg-warning">
          <i class="bi bi-people me-1" aria-hidden="true"></i>Exige responsável
        </span>
        <span v-for="tag in oc.tags_comportamento" :key="tag" class="badge text-bg-info">{{
          rotuloTag[tag] || tag
        }}</span>
        <span
          v-if="oc.notificar_coordenacao"
          class="badge text-bg-light border"
          title="Coordenação notificada"
        >
          <i class="bi bi-megaphone me-1" aria-hidden="true"></i>Coord.
        </span>
        <span
          v-if="oc.notificar_responsavel"
          class="badge text-bg-light border"
          title="Responsável notificado"
        >
          <i class="bi bi-person-badge me-1" aria-hidden="true"></i>Resp.
        </span>
      </div>

      <div class="d-flex flex-wrap gap-2 justify-content-end">
        <button
          v-if="oc.anexoPath"
          type="button"
          class="btn btn-sm btn-outline-secondary"
          @click="emit('ver-anexo', oc.id)"
        >
          <i class="bi bi-file-earmark-pdf me-1" aria-hidden="true"></i>
          Ver documento
          <span v-if="oc.anexoNome" class="text-body-secondary">({{ oc.anexoNome }})</span>
        </button>

        <button
          v-if="oc.tipo.includes('grave')"
          type="button"
          class="btn btn-sm btn-outline-dark"
          @click="emit('registrar-suspensao', oc.id)"
        >
          <i class="bi bi-shield-lock me-1" aria-hidden="true"></i>
          Formalizar suspensão
        </button>

        <button
          type="button"
          class="btn btn-sm"
          :class="oc.exigePresencaResponsavel ? 'btn-outline-warning' : 'btn-warning'"
          :aria-pressed="oc.exigePresencaResponsavel"
          @click="emit('bloquear-retorno', oc.id)"
        >
          <i class="bi bi-people me-1" aria-hidden="true"></i>
          {{ oc.exigePresencaResponsavel ? 'Desbloquear retorno' : 'Bloquear retorno' }}
        </button>
      </div>
    </article>

    <div v-if="!ocorrencias.length" class="text-body-secondary text-center py-4 mb-0">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
        style="width: 72px; height: 72px"
      >
        <i class="bi bi-inbox fs-4 opacity-50" aria-hidden="true"></i>
      </span>
      <p class="mb-0">Nenhuma ocorrência grave registrada.</p>
    </div>
  </div>
</template>
