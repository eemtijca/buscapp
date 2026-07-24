<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import CampoFormulario from '@/componentes/CampoFormulario.vue';

const props = withDefaults(
  defineProps<{
    alunoNome?: string;
    alunoTurma?: string;
    enviando?: boolean;
    dataPreenchida?: string;
    dataDesabilitada?: boolean;
  }>(),
  {
    alunoNome: '',
    alunoTurma: '',
    enviando: false,
    dataPreenchida: '',
    dataDesabilitada: false,
  },
);

const router = useRouter();
const emit = defineEmits<{
  enviar: [payload: { motivo: string; dataInicio: string; dataFim: string; arquivo: File | null }];
}>();

const motivo = ref('');
const dataInicio = ref(props.dataPreenchida);
const dataFim = ref(props.dataPreenchida);
const arquivo = ref<File | null>(null);
const erroValidacao = ref<string | null>(null);
const multiplosDias = ref(false);

watch(
  () => props.dataPreenchida,
  (nova) => {
    if (nova) {
      dataInicio.value = nova;
      dataFim.value = nova;
    }
  },
);

watch(multiplosDias, (ativo) => {
  if (!ativo) {
    dataFim.value = dataInicio.value;
  }
});

const nomeArquivo = computed(() => (arquivo.value ? arquivo.value.name : ''));
const contadorMotivo = computed(() => motivo.value.length);
const tamanhoArquivo = computed(() => {
  if (!arquivo.value) return '';
  const kb = arquivo.value.size / 1024;
  if (kb < 1024) return kb.toFixed(0) + ' KB';
  return (kb / 1024).toFixed(1) + ' MB';
});

function aoSelecionarArquivo(event: Event) {
  const alvo = event.target as HTMLInputElement;
  if (alvo.files && alvo.files.length > 0) {
    const file = alvo.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      erroValidacao.value = 'O arquivo é maior que 10 MB. Envie um arquivo menor.';
      arquivo.value = null;
      alvo.value = '';
      return;
    }
    arquivo.value = file;
    erroValidacao.value = null;
  }
}

function limparArquivo() {
  arquivo.value = null;
  const input = document.getElementById('inputArquivoJustificativa') as HTMLInputElement | null;
  if (input) input.value = '';
}

function submeter() {
  if (!motivo.value.trim()) {
    erroValidacao.value = 'Descreva o motivo da ausência.';
    return;
  }
  if (!dataInicio.value) {
    erroValidacao.value = 'Informe a data da ausência.';
    return;
  }
  if (!dataFim.value) {
    dataFim.value = dataInicio.value;
  }
  erroValidacao.value = null;
  emit('enviar', {
    motivo: motivo.value.trim(),
    dataInicio: dataInicio.value,
    dataFim: dataFim.value,
    arquivo: arquivo.value,
  });
}
</script>

<template>
  <form @submit.prevent="submeter" novalidate>
    <div v-if="alunoNome" class="alert alert-light border d-flex align-items-center gap-2 mb-3">
      <i class="bi bi-person-badge text-success fs-5" aria-hidden="true"></i>
      <div>
        <div class="fw-medium small">{{ alunoNome }}</div>
        <small v-if="alunoTurma" class="text-body-secondary">{{ alunoTurma }}</small>
      </div>
    </div>

    <div
      v-if="erroValidacao"
      class="alert alert-danger d-flex align-items-center py-2 small mb-3"
      role="alert"
    >
      <i class="bi bi-exclamation-triangle me-2" aria-hidden="true"></i>
      <span>{{ erroValidacao }}</span>
    </div>

    <CampoFormulario id="dataInicio" label="Data da ausência" :obrigatorio="true">
      <input
        id="dataInicio"
        v-model="dataInicio"
        type="date"
        class="form-control form-control-sm"
        :class="{ 'is-invalid': erroValidacao && !dataInicio }"
        :disabled="enviando || dataDesabilitada"
        required
      />
    </CampoFormulario>

    <div class="form-check mb-3">
      <input
        id="chkMultiplosDias"
        v-model="multiplosDias"
        type="checkbox"
        class="form-check-input"
        :disabled="enviando || dataDesabilitada"
      />
      <label class="form-check-label small" for="chkMultiplosDias">
        Justificativa para múltiplos dias
      </label>
    </div>

    <CampoFormulario v-if="multiplosDias" id="dataFim" label="Data final">
      <input
        id="dataFim"
        v-model="dataFim"
        type="date"
        class="form-control form-control-sm"
        :min="dataInicio"
        :disabled="enviando || dataDesabilitada"
      />
    </CampoFormulario>

    <CampoFormulario
      id="motivo"
      label="Motivo da ausência"
      :obrigatorio="true"
      :maxlength="500"
      :contador="contadorMotivo"
    >
      <textarea
        id="motivo"
        v-model="motivo"
        class="form-control form-control-sm"
        :class="{ 'is-invalid': erroValidacao && !motivo.trim() }"
        rows="3"
        placeholder="Ex.: Atestado médico, consulta, falecimento na família..."
        :disabled="enviando"
        maxlength="500"
        required
      ></textarea>
    </CampoFormulario>

    <div class="mb-3">
      <label class="form-label fw-medium small">Anexar atestado ou comprovante</label>
      <div
        v-if="!arquivo"
        class="border border-2 border-dashed rounded-3 p-3 text-center text-body-secondary"
      >
        <i class="bi bi-cloud-arrow-up fs-4 d-block mb-2" aria-hidden="true"></i>
        <p class="mb-2 small">Toque para escolher uma foto ou documento do celular.</p>
        <label
          for="inputArquivoJustificativa"
          class="btn btn-success btn-sm"
          :class="{ disabled: enviando }"
        >
          <i class="bi bi-camera me-2" aria-hidden="true"></i>
          Escolher arquivo
        </label>
        <input
          id="inputArquivoJustificativa"
          type="file"
          accept="image/*,application/pdf"
          class="visually-hidden"
          :disabled="enviando"
          @change="aoSelecionarArquivo"
        />
        <small class="d-block mt-2">Aceita imagem ou PDF até 10 MB.</small>
      </div>

      <div v-else class="alert alert-success d-flex align-items-center gap-2 mb-0 py-2 small">
        <i class="bi bi-file-earmark-check fs-5" aria-hidden="true"></i>
        <div class="flex-grow-1 min-w-0">
          <div class="fw-medium text-truncate">{{ nomeArquivo }}</div>
          <small class="text-body-secondary">{{ tamanhoArquivo }}</small>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-outline-danger"
          :disabled="enviando"
          aria-label="Remover arquivo selecionado"
          @click="limparArquivo"
        >
          <i class="bi bi-trash" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <div class="d-flex gap-2 justify-content-end">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="enviando"
        @click="router.back()"
      >
        Cancelar
      </button>
      <button type="submit" class="btn btn-sm btn-success" :disabled="enviando">
        <i class="bi bi-send me-1" aria-hidden="true"></i>
        Enviar
      </button>
    </div>
  </form>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
