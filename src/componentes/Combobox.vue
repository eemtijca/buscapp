<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';

defineOptions({ name: 'CampoCombobox' });

export interface OpcaoCombobox {
  valor: string;
  rotulo: string;
  descricao?: string;
  icone?: string;
}

const props = withDefaults(
  defineProps<{
    id: string;
    modelValue: string;
    opcoes: OpcaoCombobox[];
    placeholder?: string;
    desabilitado?: boolean;
    obrigatorio?: boolean;
    carregando?: boolean;
    tamanho?: 'sm' | undefined;
    nome?: string;
    ariaLabel?: string;
  }>(),
  {
    placeholder: 'Selecione uma opção',
    desabilitado: false,
    obrigatorio: false,
    carregando: false,
    tamanho: undefined,
    nome: '',
    ariaLabel: '',
  },
);

const emit = defineEmits<{
  'update:modelValue': [valor: string];
  buscar: [termo: string];
}>();

const aberto = ref(false);
const textoBusca = ref('');
const indiceAtivo = ref(-1);
const wrapperRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const listaRef = ref<HTMLUListElement | null>(null);

// Sincroniza o texto exibido com o valor selecionado
function rotuloDoValor(valor: string): string {
  const encontrada = props.opcoes.find((o) => o.valor === valor);
  if (encontrada)
    return encontrada.descricao
      ? `${encontrada.rotulo} — ${encontrada.descricao}`
      : encontrada.rotulo;
  return valor;
}

function sincronizarTexto() {
  if (!props.modelValue) {
    // Mantém o texto digitado se o usuário estiver com o menu aberto
    if (!aberto.value) textoBusca.value = '';
    return;
  }
  textoBusca.value = rotuloDoValor(props.modelValue);
}

watch(() => props.modelValue, sincronizarTexto);
watch(
  () => props.opcoes,
  () => {
    // Atualiza o rótulo quando as opções carregam após seleção
    if (props.modelValue) sincronizarTexto();
  },
);

onMounted(() => {
  sincronizarTexto();
  document.addEventListener('mousedown', aoClicarFora);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', aoClicarFora);
});

function aoClicarFora(event: MouseEvent) {
  if (!wrapperRef.value) return;
  if (!wrapperRef.value.contains(event.target as Node)) {
    aberto.value = false;
    indiceAtivo.value = -1;
    // Restaura o rótulo se o usuário não confirmou a seleção
    sincronizarTexto();
  }
}

// Filtragem insensível a acentos para melhor experiência em pt-BR
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const opcoesFiltradas = computed(() => {
  const termo = normalizar(textoBusca.value.trim());
  // Se o texto corresponde exatamente ao rótulo selecionado, mostra todas
  if (props.modelValue && normalizar(rotuloDoValor(props.modelValue)) === termo) {
    return props.opcoes;
  }
  if (!termo) return props.opcoes;
  return props.opcoes.filter((o) => {
    const alvo = normalizar(`${o.rotulo} ${o.descricao ?? ''}`);
    return alvo.includes(termo);
  });
});

function abrir() {
  if (props.desabilitado) return;
  aberto.value = true;
  indiceAtivo.value = -1;
  // Emite busca inicial para carregamento sob demanda
  emit('buscar', textoBusca.value);
}

function fechar() {
  aberto.value = false;
  indiceAtivo.value = -1;
}

function selecionar(opcao: OpcaoCombobox) {
  emit('update:modelValue', opcao.valor);
  textoBusca.value = opcao.descricao ? `${opcao.rotulo} — ${opcao.descricao}` : opcao.rotulo;
  fechar();
  nextTick(() => inputRef.value?.focus());
}

function limpar() {
  emit('update:modelValue', '');
  textoBusca.value = '';
  emit('buscar', '');
  aberto.value = true;
  nextTick(() => inputRef.value?.focus());
}

function aoDigitar(event: Event) {
  const alvo = event.target as HTMLInputElement;
  textoBusca.value = alvo.value;
  if (!aberto.value) aberto.value = true;
  indiceAtivo.value = -1;
  emit('buscar', textoBusca.value);
  // Se o usuário apagou tudo, limpa a seleção
  if (!textoBusca.value.trim() && props.modelValue) {
    emit('update:modelValue', '');
  }
}

function aoTeclar(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!aberto.value) {
      abrir();
      return;
    }
    indiceAtivo.value = Math.min(indiceAtivo.value + 1, opcoesFiltradas.value.length - 1);
    rolarAteAtivo();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    indiceAtivo.value = Math.max(indiceAtivo.value - 1, 0);
    rolarAteAtivo();
  } else if (event.key === 'Enter') {
    if (aberto.value && indiceAtivo.value >= 0) {
      event.preventDefault();
      const opcao = opcoesFiltradas.value[indiceAtivo.value];
      if (opcao) selecionar(opcao);
    }
  } else if (event.key === 'Escape') {
    fechar();
    sincronizarTexto();
  }
}

function rolarAteAtivo() {
  nextTick(() => {
    const lista = listaRef.value;
    if (!lista) return;
    const ativo = lista.querySelector<HTMLElement>(`[data-indice="${indiceAtivo.value}"]`);
    ativo?.scrollIntoView({ block: 'nearest' });
  });
}

const idLista = computed(() => `${props.id}-lista`);
const classeInput = computed(() => [
  'form-control',
  props.tamanho === 'sm' ? 'form-control-sm' : '',
  props.desabilitado ? 'bg-body-tertiary' : 'bg-body',
]);
</script>

<template>
  <div ref="wrapperRef" class="combobox-wrapper position-relative">
    <div class="input-group input-group-sm" v-if="tamanho === 'sm'">
      <input
        :id="id"
        ref="inputRef"
        :value="textoBusca"
        type="text"
        :class="classeInput"
        :placeholder="placeholder"
        :disabled="desabilitado"
        :required="obrigatorio"
        :aria-label="ariaLabel || placeholder"
        role="combobox"
        :aria-expanded="aberto"
        :aria-controls="idLista"
        aria-autocomplete="list"
        :aria-activedescendant="indiceAtivo >= 0 ? `${id}-opcao-${indiceAtivo}` : undefined"
        autocomplete="off"
        @focus="abrir"
        @click="abrir"
        @input="aoDigitar"
        @keydown="aoTeclar"
      />
      <button
        v-if="modelValue && !desabilitado"
        type="button"
        class="btn btn-outline-secondary"
        tabindex="-1"
        aria-label="Limpar seleção"
        @click="limpar"
      >
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary"
        tabindex="-1"
        :disabled="desabilitado"
        aria-label="Abrir lista"
        @click="aberto ? fechar() : abrir()"
      >
        <i :class="aberto ? 'bi bi-chevron-up' : 'bi bi-chevron-down'" aria-hidden="true"></i>
      </button>
    </div>

    <div v-else class="input-group">
      <input
        :id="id"
        ref="inputRef"
        :value="textoBusca"
        type="text"
        :class="classeInput"
        :placeholder="placeholder"
        :disabled="desabilitado"
        :required="obrigatorio"
        :aria-label="ariaLabel || placeholder"
        role="combobox"
        :aria-expanded="aberto"
        :aria-controls="idLista"
        aria-autocomplete="list"
        :aria-activedescendant="indiceAtivo >= 0 ? `${id}-opcao-${indiceAtivo}` : undefined"
        autocomplete="off"
        @focus="abrir"
        @click="abrir"
        @input="aoDigitar"
        @keydown="aoTeclar"
      />
      <button
        v-if="modelValue && !desabilitado"
        type="button"
        class="btn btn-outline-secondary"
        tabindex="-1"
        aria-label="Limpar seleção"
        @click="limpar"
      >
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary"
        tabindex="-1"
        :disabled="desabilitado"
        aria-label="Abrir lista"
        @click="aberto ? fechar() : abrir()"
      >
        <i :class="aberto ? 'bi bi-chevron-up' : 'bi bi-chevron-down'" aria-hidden="true"></i>
      </button>
    </div>

    <ul
      v-show="aberto"
      :id="idLista"
      ref="listaRef"
      role="listbox"
      class="dropdown-menu show shadow-sm p-1 mt-1 w-100 overflow-auto"
      style="
        max-height: 240px;
        display: block;
        position: absolute;
        z-index: 1050;
        inset: auto 0 auto 0;
      "
    >
      <li v-if="carregando" class="dropdown-item-text small text-body-secondary py-2 text-center">
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Carregando...
      </li>
      <template v-else-if="opcoesFiltradas.length">
        <li
          v-for="(opcao, indice) in opcoesFiltradas"
          :key="opcao.valor"
          :id="`${id}-opcao-${indice}`"
          role="option"
          :data-indice="indice"
          :aria-selected="modelValue === opcao.valor"
          class="dropdown-item small d-flex flex-column py-1 px-2 rounded"
          :class="{
            active: indice === indiceAtivo,
            'bg-primary text-white': indice === indiceAtivo,
            'fw-semibold': modelValue === opcao.valor,
          }"
          style="cursor: pointer"
          @mousedown.prevent="selecionar(opcao)"
          @mouseenter="indiceAtivo = indice"
        >
          <span class="d-flex align-items-center gap-1">
            <i v-if="opcao.icone" :class="`bi bi-${opcao.icone}`" aria-hidden="true"></i>
            {{ opcao.rotulo }}
          </span>
          <small
            v-if="opcao.descricao"
            class="text-truncate"
            :class="indice === indiceAtivo ? 'text-white-50' : 'text-body-secondary'"
            >{{ opcao.descricao }}</small
          >
        </li>
      </template>
      <li v-else class="dropdown-item-text small text-body-secondary py-2 text-center">
        Nenhum resultado encontrado.
      </li>
    </ul>
  </div>
</template>

<style scoped>
.combobox-wrapper :deep(.dropdown-item.active) {
  color: #fff;
}
.combobox-wrapper :deep(.dropdown-item.active) small {
  color: rgba(255, 255, 255, 0.75) !important;
}
</style>
