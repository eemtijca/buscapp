<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { supabaseClient } from '@/servicos/supabase';
import ChatPainelDuplo from '@/componentes/ChatPainelDuplo.vue';
import type { ContatoChat, MensagemChat } from '@/tipos/componentes';
import { avatarCor } from '@/utils/chatUtils';

const router = useRouter();
const { usuario } = useAutenticacao();
const {
  buscarContatosGestao,
  buscarConversaDetalhe,
  enviarMensagem,
  marcarMensagensComoLidas,
  ocultarConversa,
  horarioProtegidoAtivo,
  obterHorarioProtegido,
} = useMonitoramento();

const contatos = ref<ContatoChat[]>([]);
const mensagens = ref<MensagemChat[]>([]);
const conversaAtivaId = ref<string | null>(null);
const contatoAtivo = ref<ContatoChat | null>(null);
const horarioAtivo = ref(false);
const enviando = ref(false);
const carregandoContatos = ref(true);
const horarioConfig = obterHorarioProtegido();
const statusMsg = ref<string | null>(null);
const confirmandoExcluir = ref(false);
const ocultarConvId = ref<string | null>(null);

let timeoutStatus: ReturnType<typeof setTimeout> | null = null;
let canalMensagens: ReturnType<typeof supabaseClient.channel> | null = null;
let canalContatos: ReturnType<typeof supabaseClient.channel> | null = null;
let intervaloRelogio: number | null = null;

function mostrarStatus(msg: string) {
  if (timeoutStatus) clearTimeout(timeoutStatus);
  statusMsg.value = msg;
  timeoutStatus = setTimeout(() => { statusMsg.value = null; }, 4000);
}

async function carregarContatos() {
  if (!usuario.value) return;
  carregandoContatos.value = true;
  contatos.value = await buscarContatosGestao(usuario.value.id);
  for (const c of contatos.value) {
    c.avatarCor = avatarCor(c.nomeContato);
  }
  carregandoContatos.value = false;

  if (conversaAtivaId.value && !contatos.value.find(c => c.conversaId === conversaAtivaId.value)) {
    conversaAtivaId.value = null;
    contatoAtivo.value = null;
    mensagens.value = [];
  }
}

async function selecionarConversa(conversaId: string) {
  if (!usuario.value) return;
  const userId = usuario.value.id;
  conversaAtivaId.value = conversaId;
  contatoAtivo.value = contatos.value.find((c) => c.conversaId === conversaId) ?? null;
  confirmandoExcluir.value = false;

  await marcarMensagensComoLidas(conversaId, userId);

  const det = await buscarConversaDetalhe(conversaId, userId);
  mensagens.value = det.mensagens;

  inscreverCanalMensagens(conversaId);

  const contato = contatos.value.find((c) => c.conversaId === conversaId);
  if (contato) contato.naoLidas = 0;
}

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
    mostrarStatus('Conversa ocultada. Reaparecerá se o responsável enviar nova mensagem.');
    if (convId === conversaAtivaId.value) {
      conversaAtivaId.value = null;
      contatoAtivo.value = null;
    }
    await carregarContatos();
  }
}

function mergeMensagens(novas: MensagemChat[]) {
  const existentes = new Set(mensagens.value.map(m => m.id));
  for (const msg of novas) {
    if (!existentes.has(msg.id)) {
      mensagens.value.push(msg);
    }
  }
}

function inscreverCanalMensagens(conversaId: string) {
  if (canalMensagens) supabaseClient.removeChannel(canalMensagens);

  canalMensagens = supabaseClient
    .channel(`chat-msg-${conversaId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'mensagens',
      filter: `conversa_id=eq.${conversaId}`,
    }, async () => {
      if (!usuario.value) return;
      const det = await buscarConversaDetalhe(conversaId, usuario.value.id);
      mergeMensagens(det.mensagens);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'mensagens',
      filter: `conversa_id=eq.${conversaId}`,
    }, (payload) => {
      const msg = mensagens.value.find(m => m.id === payload.new.id);
      if (msg) msg.lida = payload.new.lida_em !== null;
    })
    .subscribe();
}

function inscreverCanalContatos() {
  if (!usuario.value) return;
  canalContatos = supabaseClient
    .channel('chat-contatos-gestao')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, () => carregarContatos())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversas' }, () => carregarContatos())
    .subscribe();
}

function handleVoltar() {
  conversaAtivaId.value = null;
  contatoAtivo.value = null;
}

onMounted(async () => {
  horarioAtivo.value = horarioProtegidoAtivo();
  if (usuario.value) {
    await carregarContatos();
    inscreverCanalContatos();
  }
  intervaloRelogio = window.setInterval(() => { horarioAtivo.value = horarioProtegidoAtivo(); }, 60_000);
});

watch(usuario, async (val) => {
  if (val && contatos.value.length === 0) {
    await carregarContatos();
    inscreverCanalContatos();
  }
});

onUnmounted(() => {
  if (canalMensagens) supabaseClient.removeChannel(canalMensagens);
  if (canalContatos) supabaseClient.removeChannel(canalContatos);
  if (intervaloRelogio) window.clearInterval(intervaloRelogio);
  if (timeoutStatus) clearTimeout(timeoutStatus);
});
</script>

<template>
  <div class="d-flex flex-column h-100 overflow-hidden">
    <div class="d-flex align-items-center gap-2 px-3 py-1 border-bottom bg-body-tertiary flex-shrink-0">
      <router-link to="/gestao" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1"></i>Início
      </router-link>
      <button type="button" class="btn btn-sm btn-outline-secondary d-none d-md-inline-block" @click="router.back()">
        <i class="bi bi-arrow-left me-1"></i>Voltar
      </button>
      <span class="fw-semibold small flex-grow-1">Chat com pais</span>
      <div v-if="conversaAtivaId" class="d-flex gap-1">
        <button type="button" class="btn btn-sm btn-outline-danger" @click="confirmarOcultar(conversaAtivaId!)">
          <i class="bi bi-eye-slash me-1"></i>Ocultar
        </button>
      </div>
    </div>

    <div v-if="statusMsg" class="alert alert-info py-2 small mb-0 rounded-0 flex-shrink-0" role="status">
      <i class="bi bi-info-circle me-1"></i>{{ statusMsg }}
    </div>

    <div v-if="confirmandoExcluir" class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="z-index: 1060; background: rgba(0,0,0,0.3);">
      <div class="bg-white rounded-3 shadow-lg p-4 text-center" style="max-width: 320px;">
        <i class="bi bi-exclamation-triangle text-danger fs-2 mb-2 d-block"></i>
        <p class="small mb-3">Tem certeza que deseja ocultar esta conversa? Ela reaparecerá se o responsável enviar nova mensagem.</p>
        <div class="d-flex gap-2 justify-content-center">
          <button type="button" class="btn btn-sm btn-secondary" @click="confirmandoExcluir = false">Cancelar</button>
          <button type="button" class="btn btn-sm btn-danger" @click="handleOcultarConversa">Ocultar</button>
        </div>
      </div>
    </div>

    <ChatPainelDuplo
      :contatos="contatos"
      :mensagens="mensagens"
      :conversa-ativa-id="conversaAtivaId"
      :horario-ativo="horarioAtivo"
      :mensagem-fora-horario="horarioConfig.mensagemForaHorario"
      :enviando="enviando"
      :carregando-contatos="carregandoContatos"
      :papel-usuario="usuario?.papel ?? 'gestao'"
      :titulo-chat="contatoAtivo?.nomeContato ?? ''"
      :subtitulo-chat="contatoAtivo?.subtitulo ?? ''"
      :mostrar-botao-fechar="false"
      :contato-selecionado="contatoAtivo"
      @selecionar-conversa="selecionarConversa"
      @enviar-mensagem="handleEnviarMensagem"
      @voltar="handleVoltar"
      @ocultar="confirmarOcultar"
    />
  </div>
</template>
