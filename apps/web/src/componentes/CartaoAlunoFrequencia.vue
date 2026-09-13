<script setup lang="ts">
import { computed } from 'vue';
import type { AlunoFrequencia } from '@/tipos/componentes';

const props = defineProps<{
  aluno: AlunoFrequencia;
}>();

const emit = defineEmits<{
  alternar: [alunoId: string];
  'registrar-ausencia-periodo': [alunoId: string];
}>();

const classesCartao = computed(() =>
  props.aluno.ausente ? 'border-danger border-2 bg-danger-subtle' : 'border-success border-2',
);

const inicialAluno = computed(() =>
  props.aluno.nome ? props.aluno.nome.charAt(0).toUpperCase() : '?',
);
</script>

<template>
  <div class="card shadow-sm" :class="classesCartao">
    <div class="card-body d-flex align-items-center gap-3 p-3">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0 fw-semibold"
        :class="aluno.ausente ? 'bg-danger text-white' : 'bg-success text-white'"
        style="width: 44px; height: 44px"
        aria-hidden="true"
      >
        {{ inicialAluno }}
      </span>

      <div class="min-w-0 flex-grow-1" style="overflow-wrap: break-word; word-break: break-word">
        <div class="fw-semibold">{{ aluno.nome }}</div>
        <div class="text-body-secondary small">
          <span v-if="aluno.turma">{{ aluno.turma }} · </span>Matrícula {{ aluno.matricula }}
        </div>
        <div v-if="aluno.periodosAusentes && aluno.periodosAusentes.length" class="small mt-1">
          <span class="badge text-bg-warning">
            <i class="bi bi-clock-history me-1" aria-hidden="true"></i>
            Ausente em {{ aluno.periodosAusentes.length }} aula(s)
          </span>
        </div>
        <div
          v-if="aluno.motivosAusencia && aluno.motivosAusencia.length"
          class="small mt-1 d-flex gap-1 flex-wrap"
        >
          <span v-for="m in aluno.motivosAusencia" :key="m" class="badge text-bg-light border">{{
            m
          }}</span>
        </div>
        <div v-if="aluno.observacao" class="small mt-1 text-body-secondary">
          <i class="bi bi-chat-quote me-1" aria-hidden="true"></i>
          {{ aluno.observacao }}
        </div>
      </div>

      <button
        type="button"
        class="btn flex-shrink-0"
        :class="aluno.ausente ? 'btn-outline-danger' : 'btn-success'"
        :aria-pressed="aluno.ausente"
        :aria-label="
          aluno.ausente
            ? 'Marcar ' + aluno.nome + ' como presente'
            : 'Marcar ' + aluno.nome + ' como ausente'
        "
        @click="emit('alternar', aluno.id)"
      >
        <i :class="aluno.ausente ? 'bi bi-x-circle' : 'bi bi-check-circle'" aria-hidden="true"></i>
        <span class="d-none d-sm-inline ms-1">
          {{ aluno.ausente ? 'Ausente' : 'Presente' }}
        </span>
      </button>
    </div>

    <div class="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3">
      <button
        type="button"
        class="btn btn-link btn-sm text-decoration-none p-0 text-warning-emphasis"
        :aria-label="'Registrar ausência em aula específica para ' + aluno.nome"
        @click="emit('registrar-ausencia-periodo', aluno.id)"
      >
        <i class="bi bi-clock me-1" aria-hidden="true"></i>
        Registrar ausência em aula
      </button>
    </div>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
