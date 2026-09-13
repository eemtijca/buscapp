<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { supabaseClient } from '@/servicos/supabase';

const props = defineProps<{
  aberto: boolean;
  storagePath: string;
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
  if (blobUrl.value) {
    URL.revokeObjectURL(blobUrl.value);
    blobUrl.value = null;
  }
  erro.value = null;
  carregando.value = false;
}

async function carregar() {
  if (!props.aberto || !props.storagePath) return;
  limpar();
  carregando.value = true;
  const id = ++sequencia;
  const { data, error } = await supabaseClient.storage
    .from('justificativas')
    .download(props.storagePath);
  if (id !== sequencia) return;
  if (error || !data) {
    carregando.value = false;
    erro.value = 'Não foi possível carregar o anexo.';
    return;
  }
  if (!props.aberto) {
    carregando.value = false;
    return;
  }
  blobUrl.value = URL.createObjectURL(data);
  carregando.value = false;
}

function fechar() {
  limpar();
  emit('fechar');
}

function aoPressionarTecla(evento: KeyboardEvent) {
  if (evento.key === 'Escape' && props.aberto) fechar();
}

watch(() => [props.aberto, props.storagePath], carregar);

onMounted(() => {
  window.addEventListener('keydown', aoPressionarTecla);
});

onUnmounted(() => {
  limpar();
  window.removeEventListener('keydown', aoPressionarTecla);
});
</script>

<template>
  <div v-if="aberto">
    <div class="modal-backdrop fade show" style="z-index: 1055" @click="fechar"></div>
    <div class="modal fade show d-block" tabindex="-1" style="z-index: 1056" @click.self="fechar">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div class="modal-content border-0 shadow">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold text-truncate" :title="nomeArquivo">
              <i class="bi bi-paperclip me-2" aria-hidden="true"></i>
              {{ nomeArquivo }}
            </h5>
            <button type="button" class="btn-close" aria-label="Fechar" @click="fechar"></button>
          </div>

          <div class="modal-body d-flex align-items-center justify-content-center bg-body-tertiary">
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

          <div class="modal-footer border-top-0 pt-0">
            <button type="button" class="btn btn-sm btn-secondary" @click="fechar">
              <i class="bi bi-x-lg me-1" aria-hidden="true"></i>
              Fechar
            </button>
            <a
              v-if="blobUrl"
              :href="blobUrl"
              :download="nomeArquivo"
              class="btn btn-sm btn-primary"
            >
              <i class="bi bi-download me-1" aria-hidden="true"></i>
              Baixar
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
