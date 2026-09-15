<script setup lang="ts">
import { computed } from 'vue';
import type { OpcaoCheckbox } from '@/tipos/componentes';

const props = withDefaults(
  defineProps<{
    opcoes: OpcaoCheckbox[];
    modelo: string[];
    colunas?: 1 | 2 | 3 | 4;
    desabilitado?: boolean;
    nome?: string;
    mostrarSelecionarTodos?: boolean;
    rotuloSelecionarTodos?: string;
  }>(),
  {
    colunas: 1,
    desabilitado: false,
    nome: '',
    mostrarSelecionarTodos: false,
    rotuloSelecionarTodos: 'Selecionar todos',
  },
);

const emit = defineEmits<{
  'update:modelo': [valor: string[]];
}>();

const classeColuna = computed(() => {
  const tamanho = Math.max(1, Math.floor(12 / props.colunas));
  return `col-12 col-md-${tamanho}`;
});

/** Verifica se todos os valores disponíveis estão selecionados. */
const todosSelecionados = computed(() => {
  const ativos = props.opcoes.filter((o) => !o.desabilitado).map((o) => o.valor);
  return ativos.length > 0 && ativos.every((v) => props.modelo.includes(v));
});

/** Verifica se há seleção parcial para estado indeterminado. */
const indeterminado = computed(() => {
  const ativos = props.opcoes.filter((o) => !o.desabilitado).map((o) => o.valor);
  const selecionados = ativos.filter((v) => props.modelo.includes(v)).length;
  return selecionados > 0 && selecionados < ativos.length;
});

function alternar(valor: string) {
  const idx = props.modelo.indexOf(valor);
  if (idx === -1) {
    emit('update:modelo', [...props.modelo, valor]);
  } else {
    const novo = [...props.modelo];
    novo.splice(idx, 1);
    emit('update:modelo', novo);
  }
}

/** Alterna a seleção de todos os itens disponíveis. */
function alternarTodosItens() {
  const ativos = props.opcoes.filter((o) => !o.desabilitado).map((o) => o.valor);
  if (todosSelecionados.value) {
    emit('update:modelo', []);
  } else {
    emit('update:modelo', [...ativos]);
  }
}
</script>

<template>
  <div
    v-if="mostrarSelecionarTodos && opcoes.length > 1"
    class="form-check mb-2 border-bottom pb-2"
  >
    <input
      :id="`${nome || 'cb'}-todos`"
      :checked="todosSelecionados"
      :indeterminate="indeterminado"
      type="checkbox"
      class="form-check-input"
      :disabled="desabilitado"
      @change="alternarTodosItens"
    />
    <label :for="`${nome || 'cb'}-todos`" class="form-check-label small fw-semibold">
      {{ rotuloSelecionarTodos }}
    </label>
  </div>
  <div class="row g-2">
    <div v-for="opcao in opcoes" :key="opcao.valor" :class="classeColuna">
      <div class="form-check">
        <input
          :id="`${nome || 'cb'}-${opcao.valor}`"
          :checked="modelo.includes(opcao.valor)"
          type="checkbox"
          class="form-check-input"
          :disabled="desabilitado || opcao.desabilitado"
          :aria-disabled="desabilitado || opcao.desabilitado"
          @change="alternar(opcao.valor)"
        />
        <label
          :for="`${nome || 'cb'}-${opcao.valor}`"
          class="form-check-label small"
          :class="{ 'text-body-secondary': desabilitado || opcao.desabilitado }"
        >
          <i v-if="opcao.icone" :class="`bi bi-${opcao.icone} me-1`" aria-hidden="true"></i>
          {{ opcao.rotulo }}
        </label>
      </div>
    </div>
  </div>
</template>
