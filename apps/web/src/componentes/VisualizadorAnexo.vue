<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { baixarArquivo } from '@/servicos/api';
import ModalBase from '@/componentes/ModalBase.vue';

const props = defineProps<{
  aberto: boolean;
  anexoId: string;
  nomeArquivo: string;
  mimeType?: string;
}>();

const emit = defineEmits<{
  fechar: [];
}>();

const carregando = ref(false);
const erro = ref<string | null>(null);
const blobUrl = ref<string | null>(null);
let sequencia = 0;

const esImagem = computed(() => props.mimeType?.startsWith('image/') ?? false);
const esPdf = computed(() => props.mimeType === 'application/pdf');

function limpar() {
  // Invalida qualquer download em andamento antes de descartar o blob atual.
  sequencia++;
  if (blobUrl.value) {
    URL.revokeObjectURL(blobUrl.value);
    blobUrl.value = null;
  }
  erro.value = null;
  carregando.value = false;
}

async function carregar() {
  if (!props.aberto || !props.anexoId) return;
  limpar();
  carregando.value = true;
  const id = ++sequencia;
  try {
    const data = await baixarArquivo(`/api/anexos/${props.anexoId}/arquivo`);
    if (id !== sequencia) return;
    if (!props.aberto) return;
    blobUrl.value = URL.createObjectURL(data);
  } catch {
    if (id !== sequencia) return;
    erro.value = 'Não foi possível carregar o anexo.';
  } finally {
    if (id === sequencia) carregando.value = false;
  }
}

function fechar() {
  limpar();
  emit('fechar');
}

watch(() => [props.aberto, props.anexoId], carregar);

onUnmounted(() => {
  limpar();
});
</script>

<template>
  <ModalBase
    :visivel="aberto"
    :titulo="nomeArquivo"
    icone="paperclip"
    largura="lg"
    @update:visivel="(visivel) => !visivel && fechar()"
  >
    <div class="d-flex align-items-center justify-content-center bg-body-tertiary">
      <div
        v-if="carregando"
        class="d-flex flex-column align-items-center gap-2 py-5 text-body-secondary"
      >
        <span class="spinner-border" role="status" aria-hidden="true"></span>
        <small>Carregando anexo…</small>
      </div>

      <div
        v-else-if="erro"
        class="d-flex flex-column align-items-center gap-2 py-5 text-body-secondary"
      >
        <i class="bi bi-exclamation-triangle fs-3 text-danger" aria-hidden="true"></i>
        <small>{{ erro }}</small>
      </div>

      <img
        v-else-if="blobUrl && esImagem"
        :src="blobUrl"
        :alt="nomeArquivo"
        class="img-fluid rounded"
        style="max-height: 70vh"
      />
      <iframe
        v-else-if="blobUrl && esPdf"
        :src="blobUrl"
        class="w-100 border-0 rounded"
        style="height: 70vh"
        title="Pré-visualização do anexo"
      ></iframe>

      <div v-else-if="blobUrl" class="text-center py-5 text-body-secondary">
        <i class="bi bi-file-earmark fs-3 mb-2 d-block" aria-hidden="true"></i>
        <small>Não é possível visualizar este tipo de arquivo. Baixe para abrir.</small>
      </div>
    </div>

    <template #rodape>
      <button type="button" class="btn btn-sm btn-secondary" @click="fechar">
        <i class="bi bi-x-lg me-1" aria-hidden="true"></i>
        Fechar
      </button>
      <a v-if="blobUrl" :href="blobUrl" :download="nomeArquivo" class="btn btn-sm btn-primary">
        <i class="bi bi-download me-1" aria-hidden="true"></i>
        Baixar
      </a>
    </template>
  </ModalBase>
</template>
