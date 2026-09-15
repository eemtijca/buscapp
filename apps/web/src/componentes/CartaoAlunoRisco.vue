<script setup lang="ts">
import { computed } from 'vue';
import type { AlunoRisco, NivelRisco } from '@/tipos/componentes';

const props = defineProps<{
  aluno: AlunoRisco;
}>();

const emit = defineEmits<{
  chat: [alunoId: string];
  'ver-detalhes': [alunoId: string];
  'registrar-falta': [alunoId: string];
}>();

const classeBorda = computed(() => {
  switch (props.aluno.nivel) {
    case 'alto':
      return 'border-danger border-start border-4';
    case 'medio':
      return 'border-warning border-start border-4';
    case 'baixo':
    default:
      return 'border-success border-start border-4';
  }
});

const classeBadge: Record<NivelRisco, string> = {
  alto: 'text-bg-danger',
  medio: 'text-bg-warning',
  baixo: 'text-bg-success',
};

const rotuloNivel: Record<NivelRisco, string> = {
  alto: 'Crítico',
  medio: 'Atenção',
  baixo: 'Estável',
};

const inicialAluno = computed(() =>
  props.aluno.nome ? props.aluno.nome.charAt(0).toUpperCase() : '?',
);
</script>

<template>
  <div class="card shadow-sm" :class="classeBorda">
    <div class="card-body p-3">
      <div class="d-flex align-items-center gap-3">
        <span
          class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-secondary fw-semibold flex-shrink-0"
          style="width: 44px; height: 44px"
          aria-hidden="true"
        >
          {{ inicialAluno }}
        </span>

        <div class="min-w-0 flex-grow-1">
          <button
            type="button"
            class="btn btn-link text-decoration-none text-start p-0 fw-semibold text-truncate d-block"
            @click="emit('ver-detalhes', aluno.id)"
          >
            {{ aluno.nome }}
          </button>
          <div class="text-body-secondary small text-truncate">
            <span v-if="aluno.turma">{{ aluno.turma }} · </span>Matrícula {{ aluno.matricula }}
            <span v-if="aluno.ultimaAusencia"> · Última falta: {{ aluno.ultimaAusencia }}</span>
          </div>
          <div class="d-flex flex-wrap gap-2 mt-1">
            <span class="badge" :class="classeBadge[aluno.nivel]">
              {{ rotuloNivel[aluno.nivel] }}
            </span>
            <span v-if="aluno.totalAusencias > 0" class="badge text-bg-light border">
              <i class="bi bi-calendar-x me-1" aria-hidden="true"></i>
              {{ aluno.totalAusencias }} falta(s)
            </span>
            <span v-if="aluno.totalOcorrencias > 0" class="badge text-bg-light border">
              <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
              {{ aluno.totalOcorrencias }} ocorrência(s)
            </span>
            <span v-if="aluno.exigePresencaResponsavel" class="badge text-bg-dark">
              <i class="bi bi-lock me-1" aria-hidden="true"></i>
              Retorno bloqueado
            </span>
          </div>
        </div>

        <div class="d-flex gap-2 flex-shrink-0">
          <button
            type="button"
            class="btn btn-sm btn-outline-danger"
            title="Registrar falta"
            @click="emit('registrar-falta', aluno.id)"
          >
            <i class="bi bi-calendar-x me-1" aria-hidden="true"></i>
            <span class="d-none d-sm-inline">Falta</span>
            <span class="d-sm-none visually-hidden">Registrar falta do aluno</span>
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="aluno.nivel === 'alto' ? 'btn-danger' : 'btn-outline-success'"
            title="Abrir conversa com o responsável"
            @click="emit('chat', aluno.id)"
          >
            <i class="bi bi-chat-dots me-1" aria-hidden="true"></i>
            <span class="d-none d-sm-inline">Chat</span>
            <span class="d-sm-none visually-hidden">Abrir conversa com o responsável</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
