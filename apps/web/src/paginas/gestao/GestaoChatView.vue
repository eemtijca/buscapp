<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import {
  enviarMensagem,
  marcarMensagensComoLidas,
  ocultarConversa,
  useContatosChat,
  useConversaDetalhe,
} from '@/composables/consultas/useChat';
import { useHorarioProtegido } from '@/composables/consultas/useCatalogos';
import { useNotificacoes } from '@/composables/useNotificacoes';
import ChatPainelDuplo from '@/componentes/ChatPainelDuplo.vue';

const route = useRoute();
const router = useRouter();
const { usuario } = useAutenticacao();
const { marcarNotificacoesConversaLidas } = useNotificacoes();

const { contatos, pendente: carregandoContatos } = useContatosChat(
  () => usuario.value?.papel ?? '',
  () => usuario.value?.id ?? '',
);

const conversaAtivaId = ref<string | null>(null);
const { mensagens } = useConversaDetalhe(
  () => conversaAtivaId.value,
  () => usuario.value?.id,
);

const { horario, horarioAtivo } = useHorarioProtegido();

const abertaPorDetalhe = ref(false);
const enviando = ref(false);
const statusMsg = ref<string | null>(null);
const confirmandoExcluir = ref(false);
const ocultarConvId = ref<string | null>(null);

let timeoutStatus: ReturnType<typeof setTimeout> | null = null;

const contatoAtivo = computed(
  () => contatos.value.find((contato) => contato.conversaId === conversaAtivaId.value) ?? null,
);

const podeEnviar = computed(() => {
  if (horarioAtivo.value) return true;
  if ((usuario.value?.papel ?? '') !== 'gestao') return false;
  return contatoAtivo.value?.iniciadaPelaGestao === true;
});

function mostrarStatus(msg: string) {
  if (timeoutStatus) clearTimeout(timeoutStatus);
  statusMsg.value = msg;
  timeoutStatus = setTimeout(() => {
    statusMsg.value = null;
  }, 4000);
}

async function selecionarConversa(conversaId: string) {
  conversaAtivaId.value = conversaId;
  confirmandoExcluir.value = false;
  await Promise.all([
    marcarMensagensComoLidas(conversaId),
    marcarNotificacoesConversaLidas(conversaId),
  ]);
}

// Abre a conversa do deep-link quando os contatos chegam; sem deep-link, mantém o placeholder.
watch(
  contatos,
  async (lista) => {
    if (conversaAtivaId.value) return;
    const conversaInicial = route.query.conversa as string | undefined;
    if (!conversaInicial) return;
    abertaPorDetalhe.value = !lista.some((contato) => contato.conversaId === conversaInicial);
    await selecionarConversa(conversaInicial);
  },
  { immediate: true },
);

async function handleEnviarMensagem(texto: string) {
  if (!conversaAtivaId.value) return;
  enviando.value = true;
  statusMsg.value = null;
  const ok = await enviarMensagem(conversaAtivaId.value, texto);
  if (!ok) mostrarStatus('Falha ao enviar mensagem.');
  enviando.value = false;
}

function confirmarOcultar(conversaId: string) {
  ocultarConvId.value = conversaId;
  confirmandoExcluir.value = true;
}

async function handleOcultarConversa() {
  const convId = ocultarConvId.value || conversaAtivaId.value;
  if (!convId) return;
  const ok = await ocultarConversa(convId);
  if (ok) {
    confirmandoExcluir.value = false;
    ocultarConvId.value = null;
    abertaPorDetalhe.value = false;
    mostrarStatus('Conversa ocultada. Reaparecerá se o responsável enviar nova mensagem.');
    if (convId === conversaAtivaId.value) conversaAtivaId.value = null;
  }
}

function handleVoltar() {
  conversaAtivaId.value = null;
  abertaPorDetalhe.value = false;
}
</script>

<template>
  <div class="d-flex flex-column h-100 overflow-hidden">
    <div
      class="d-flex align-items-center gap-2 px-3 py-1 border-bottom bg-body-tertiary flex-shrink-0"
    >
      <router-link to="/gestao" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1"></i>Início
      </router-link>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary d-none d-md-inline-block"
        @click="router.back()"
      >
        <i class="bi bi-arrow-left me-1"></i>Voltar
      </button>
      <span class="fw-semibold small flex-grow-1">Chat com pais</span>
      <div v-if="conversaAtivaId" class="d-flex gap-1">
        <button
          type="button"
          class="btn btn-sm btn-outline-danger"
          @click="confirmarOcultar(conversaAtivaId!)"
        >
          <i class="bi bi-eye-slash me-1"></i>Ocultar
        </button>
      </div>
    </div>

    <div
      v-if="statusMsg"
      class="alert alert-info py-2 small mb-0 rounded-0 flex-shrink-0"
      role="status"
    >
      <i class="bi bi-info-circle me-1"></i>{{ statusMsg }}
    </div>

    <div
      v-if="confirmandoExcluir"
      class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style="z-index: 1060; background: rgba(0, 0, 0, 0.3)"
    >
      <div class="bg-white rounded-3 shadow-lg p-4 text-center" style="max-width: 320px">
        <i class="bi bi-exclamation-triangle text-danger fs-2 mb-2 d-block"></i>
        <p class="small mb-3">
          Tem certeza que deseja ocultar esta conversa? Ela reaparecerá se o responsável enviar nova
          mensagem.
        </p>
        <div class="d-flex gap-2 justify-content-center">
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            @click="confirmandoExcluir = false"
          >
            Cancelar
          </button>
          <button type="button" class="btn btn-sm btn-danger" @click="handleOcultarConversa">
            Ocultar
          </button>
        </div>
      </div>
    </div>

    <ChatPainelDuplo
      :contatos="contatos"
      :mensagens="mensagens"
      :conversa-ativa-id="conversaAtivaId"
      :horario-ativo="horarioAtivo"
      :mensagem-fora-horario="horario.mensagemForaHorario"
      :enviando="enviando"
      :pode-enviar="podeEnviar"
      :carregando-contatos="carregandoContatos"
      :papel-usuario="usuario?.papel ?? 'gestao'"
      :titulo-chat="contatoAtivo?.nomeContato ?? ''"
      :subtitulo-chat="contatoAtivo?.subtitulo ?? ''"
      :mostrar-botao-fechar="false"
      :contato-selecionado="contatoAtivo"
      :mostrar-chat-inicialmente="!!route.query.conversa"
      @selecionar-conversa="selecionarConversa"
      @enviar-mensagem="handleEnviarMensagem"
      @voltar="handleVoltar"
      @ocultar="confirmarOcultar"
    />
  </div>
</template>
