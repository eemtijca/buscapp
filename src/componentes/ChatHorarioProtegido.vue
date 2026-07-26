<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue';
import type { MensagemChat } from '@/tipos/componentes';
import { agruparPorData, avatarIniciais } from '@/utils/chatUtils';

const props = withDefaults(
  defineProps<{
    mensagens: MensagemChat[];
    horarioAtivo: boolean;
    mensagemForaHorario?: string;
    enviando?: boolean;
    tituloChat?: string;
    subtituloChat?: string;
    meuPapel?: string;
    mostrarBotaoVoltar?: boolean;
    mostrarBotaoFechar?: boolean;
  }>(),
  {
    mensagemForaHorario: '',
    enviando: false,
    tituloChat: 'Coordenação escolar',
    subtituloChat: '',
    meuPapel: 'responsavel',
    mostrarBotaoVoltar: false,
    mostrarBotaoFechar: false,
  },
);

const emit = defineEmits<{
  'enviar-mensagem': [texto: string];
  voltar: [];
  'fechar-conversa': [];
}>();

const texto = ref('');
const contenedorMensagens = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

function autoResize() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  const maxH = 5 * 24;
  const novo = Math.min(el.scrollHeight, maxH);
  el.style.height = novo + 'px';
  el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
}

function submeter() {
  if (!texto.value.trim() || props.enviando) return;
  emit('enviar-mensagem', texto.value.trim());
  texto.value = '';
  nextTick(() => autoResize());
}

const grupos = computed(() => agruparPorData(props.mensagens));

const cabecalhoSubtitulo = computed(() => {
  if (props.subtituloChat) return props.subtituloChat;
  return props.horarioAtivo ? 'Online agora' : 'Fora do horário escolar';
});

async function rolarParaBaixo() {
  await nextTick();
  if (contenedorMensagens.value) {
    contenedorMensagens.value.scrollTop = contenedorMensagens.value.scrollHeight;
  }
}

watch(
  () => props.mensagens.length,
  () => rolarParaBaixo(),
  { immediate: true },
);
</script>

<template>
  <section
    class="chat-view d-flex flex-column flex-grow-1 overflow-hidden"
    aria-label="Canal de diálogo"
  >
    <div class="chat-header d-flex align-items-center gap-2 px-3 py-2 border-bottom bg-body">
      <button
        v-if="mostrarBotaoVoltar"
        type="button"
        class="btn btn-sm d-md-none me-1"
        aria-label="Voltar para lista de conversas"
        @click="emit('voltar')"
      >
        <i class="bi bi-arrow-left"></i>
      </button>
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle text-white flex-shrink-0 fw-bold small"
        style="width: 36px; height: 36px; background-color: #008241"
        aria-hidden="true"
      >
        {{ avatarIniciais(tituloChat) }}
      </span>
      <div class="min-w-0 flex-grow-1">
        <div class="fw-semibold text-truncate small">{{ tituloChat }}</div>
        <small :class="horarioAtivo ? 'text-success' : 'text-body-secondary'">
          <span
            class="d-inline-block rounded-circle me-1"
            :class="horarioAtivo ? 'bg-success' : 'bg-secondary'"
            style="width: 8px; height: 8px"
            aria-hidden="true"
          ></span>
          {{ cabecalhoSubtitulo }}
        </small>
      </div>
      <button
        v-if="mostrarBotaoFechar"
        type="button"
        class="btn btn-sm btn-outline-secondary"
        title="Fechar conversa"
        aria-label="Fechar conversa"
        @click="emit('fechar-conversa')"
      >
        <i class="bi bi-x-lg"></i>
      </button>
    </div>

    <div
      ref="contenedorMensagens"
      class="chat-messages flex-grow-1 p-3 bg-light"
      role="log"
      aria-live="polite"
      aria-label="Histórico de mensagens"
    >
      <div v-if="!grupos.length" class="text-body-secondary text-center my-auto py-4">
        <span
          class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-3"
          style="width: 72px; height: 72px"
        >
          <i class="bi bi-chat-text fs-4 opacity-50" aria-hidden="true"></i>
        </span>
        <p class="mb-0 small">Nenhuma mensagem ainda. Inicie a conversa.</p>
      </div>

      <template v-for="grupo in grupos" :key="grupo.rotulo">
        <div class="text-center my-2">
          <span class="small text-body-tertiary bg-body-tertiary px-2 py-1 rounded-1">{{
            grupo.rotulo
          }}</span>
        </div>

        <div
          v-for="msg in grupo.mensagens"
          :key="msg.id"
          class="d-flex mb-2"
          :class="msg.minha ? 'justify-content-end' : 'justify-content-start'"
        >
          <div v-if="msg.isSistema" class="text-center w-100 my-1">
            <span class="small text-body-tertiary bg-body-tertiary px-3 py-1 rounded-pill">
              {{ msg.texto }}
            </span>
          </div>

          <div
            v-else
            class="rounded-3 px-3 py-2 shadow-sm"
            :class="msg.minha ? 'bg-primary text-white' : 'bg-white text-body'"
            style="max-width: 80%"
          >
            <div
              v-if="!msg.minha"
              class="small fw-semibold mb-1"
              :class="msg.minha ? 'text-white-50' : 'text-success'"
            >
              {{ msg.nomeAutor }}
            </div>
            <div class="text-break">{{ msg.texto }}</div>
            <div
              class="small mt-1 d-flex align-items-center justify-content-end gap-1"
              :class="msg.minha ? 'text-white-50' : 'text-body-secondary'"
            >
              <span>{{ msg.horario }}</span>
              <span v-if="msg.minha">
                <i v-if="msg.lida" class="bi bi-check2-all" title="Lida"></i>
                <i v-else class="bi bi-check2" title="Enviada"></i>
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div
      v-if="!horarioAtivo && mensagemForaHorario"
      class="alert alert-warning rounded-0 mb-0 py-2 small flex-shrink-0"
      role="status"
    >
      <i class="bi bi-clock-history me-2" aria-hidden="true"></i>
      {{ mensagemForaHorario }}
    </div>

    <div class="chat-input p-2 bg-body border-top flex-shrink-0">
      <form @submit.prevent="submeter" class="d-flex gap-2 align-items-end">
        <label for="entradaChat" class="visually-hidden">Digite sua mensagem</label>
        <div class="chat-input-wrapper d-flex gap-2 align-items-end flex-grow-1">
          <textarea
            id="entradaChat"
            ref="textareaRef"
            v-model="texto"
            class="form-control form-control-sm"
            rows="1"
            placeholder="Digite sua mensagem..."
            :disabled="enviando"
            @input="autoResize"
            @keydown.enter.prevent="submeter"
            style="
              resize: none;
              min-height: 31px;
              max-height: calc(1.5em * 5 + 8px);
              overflow-y: hidden;
            "
          ></textarea>
          <button
            type="submit"
            class="btn btn-primary btn-sm chat-submit-btn flex-shrink-0 d-flex align-items-center gap-1"
            :disabled="enviando || !texto.trim()"
            aria-label="Enviar mensagem"
          >
            <span
              v-if="enviando"
              class="spinner-border spinner-border-sm"
              role="status"
              aria-hidden="true"
            ></span>
            <template v-else>
              <i class="bi bi-send" aria-hidden="true"></i>
              <span class="d-none d-sm-inline">Enviar</span>
            </template>
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.chat-view {
  min-height: 0;
}

.chat-messages {
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.chat-messages .text-break {
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
