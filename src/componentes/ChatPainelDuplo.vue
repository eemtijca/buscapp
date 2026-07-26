<script setup lang="ts">
import { ref } from 'vue';
import type { ContatoChat, MensagemChat } from '@/tipos/componentes';
import ChatContatos from '@/componentes/ChatContatos.vue';
import ChatHorarioProtegido from '@/componentes/ChatHorarioProtegido.vue';

withDefaults(
  defineProps<{
    contatos: ContatoChat[];
    mensagens: MensagemChat[];
    conversaAtivaId: string | null;
    horarioAtivo: boolean;
    mensagemForaHorario: string;
    enviando: boolean;
    carregandoContatos?: boolean;
    papelUsuario: string;
    tituloChat?: string;
    subtituloChat?: string;
    mostrarBotaoFechar?: boolean;
    contatoSelecionado?: ContatoChat | null;
  }>(),
  {
    carregandoContatos: false,
    tituloChat: '',
    subtituloChat: '',
    mostrarBotaoFechar: false,
    contatoSelecionado: null,
  },
);

const emit = defineEmits<{
  selecionarConversa: [conversaId: string];
  enviarMensagem: [texto: string];
  fecharConversa: [];
  voltar: [];
  ocultar: [conversaId: string];
}>();

const mobileMostraChat = ref(false);

function selecionar(id: string) {
  mobileMostraChat.value = true;
  emit('selecionarConversa', id);
}

function handleVoltar() {
  mobileMostraChat.value = false;
  emit('voltar');
}
</script>

<template>
  <div class="chat-layout d-flex overflow-hidden flex-grow-1 bg-body">
    <div
      class="chat-sidebar d-flex flex-column flex-shrink-0 overflow-hidden"
      :class="{
        'd-md-flex': true,
        'w-100': !mobileMostraChat,
        'd-none': mobileMostraChat,
      }"
    >
      <ChatContatos
        :contatos="contatos"
        :conversa-ativa-id="conversaAtivaId"
        :carregando="carregandoContatos"
        :papel-usuario="papelUsuario"
        @selecionar="selecionar"
        @ocultar="emit('ocultar', $event)"
      />
    </div>

    <div
      v-if="conversaAtivaId"
      class="chat-main d-flex flex-column flex-grow-1 overflow-hidden"
      :class="{
        'd-md-flex': true,
        'w-100': mobileMostraChat,
        'd-none': !mobileMostraChat,
      }"
    >
      <ChatHorarioProtegido
        :mensagens="mensagens"
        :horario-ativo="horarioAtivo"
        :mensagem-fora-horario="mensagemForaHorario"
        :enviando="enviando"
        :titulo-chat="tituloChat"
        :subtitulo-chat="subtituloChat"
        :meu-papel="papelUsuario"
        :mostrar-botao-voltar="mobileMostraChat"
        :mostrar-botao-fechar="mostrarBotaoFechar"
        @enviar-mensagem="emit('enviarMensagem', $event)"
        @voltar="handleVoltar"
        @fechar-conversa="emit('fecharConversa')"
      />
    </div>

    <div
      v-else
      class="chat-main d-none d-md-flex align-items-center justify-content-center flex-grow-1 bg-body-tertiary"
    >
      <div class="text-center text-body-secondary px-3">
        <span
          class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-secondary mb-3"
          style="width: 80px; height: 80px"
        >
          <i class="bi bi-chat-dots fs-1 opacity-50"></i>
        </span>
        <h2 class="h6 fw-normal mb-1">Canal de diálogo</h2>
        <p class="small mb-0">
          Selecione uma conversa para visualizar as mensagens.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-layout {
  min-height: 0;
}

@media (min-width: 768px) {
  .chat-sidebar {
    width: 320px !important;
    min-width: 260px;
    max-width: 320px;
  }
}
</style>
