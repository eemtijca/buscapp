<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import { useNotificacoes } from '@/composables/useNotificacoes';
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh';
import ChatPainelDuplo from '@/componentes/ChatPainelDuplo.vue';
import type { ContatoChat, MensagemChat, HorarioProtegido } from '@/tipos/componentes';
import { avatarCor } from '@/utils/chatUtils';

const router = useRouter();
const { usuario } = useAutenticacao();
const {
  buscarContatosResponsavel,
  buscarConversaDetalhe,
  enviarMensagem,
  marcarMensagensComoLidas,
  horarioProtegidoAtivo,
  obterHorarioProtegido,
} = useMonitoramento();
const { marcarNotificacoesConversaLidas } = useNotificacoes();

const contatos = ref<ContatoChat[]>([]);
const mensagens = ref<MensagemChat[]>([]);
const conversaAtivaId = ref<string | null>(null);
const contatoAtivo = ref<ContatoChat | null>(null);
const horarioAtivo = ref(false);
const enviando = ref(false);
const carregandoContatos = ref(true);
const horarioConfig = ref<HorarioProtegido | null>(null);
const erro = ref<string | null>(null);

const { inscrever, encerrar } = useRealtimeRefresh();
let intervaloRelogio: number | null = null;

const podeEnviar = computed(() => horarioAtivo.value);

async function carregarContatos() {
  if (!usuario.value) return;
  carregandoContatos.value = true;
  contatos.value = await buscarContatosResponsavel(usuario.value.id);
  for (const c of contatos.value) {
    c.avatarCor = avatarCor(c.nomeContato);
  }
  carregandoContatos.value = false;

  if (
    conversaAtivaId.value &&
    !contatos.value.find((c) => c.conversaId === conversaAtivaId.value)
  ) {
    conversaAtivaId.value = null;
    contatoAtivo.value = null;
    mensagens.value = [];
  }

  if (contatos.value.length > 0 && !conversaAtivaId.value) {
    const primeiro = contatos.value[0];
    if (primeiro) await selecionarConversa(primeiro.conversaId);
  }
}

async function selecionarConversa(conversaId: string) {
  if (!usuario.value) return;
  const userId = usuario.value.id;
  conversaAtivaId.value = conversaId;
  contatoAtivo.value = contatos.value.find((c) => c.conversaId === conversaId) ?? null;

  await marcarMensagensComoLidas(conversaId, userId);
  // Badge de mensagens novas zera na hora em que a conversa é aberta.
  await marcarNotificacoesConversaLidas(conversaId);

  const det = await buscarConversaDetalhe(conversaId, userId);
  mensagens.value = det.mensagens;

  const contato = contatos.value.find((c) => c.conversaId === conversaId);
  if (contato) {
    contato.naoLidas = 0;
  }
}

async function handleEnviarMensagem(texto: string) {
  if (!conversaAtivaId.value) return;
  enviando.value = true;
  erro.value = null;
  const ok = await enviarMensagem(conversaAtivaId.value, texto);
  if (!ok) {
    erro.value = 'Falha ao enviar mensagem. Tente novamente.';
  }
  enviando.value = false;
}

/** Recarrega contatos e, se houver, as mensagens da conversa aberta. */
async function recarregarChat() {
  const conversaAntes = conversaAtivaId.value;
  await carregarContatos();
  if (!usuario.value || !conversaAntes || conversaAtivaId.value !== conversaAntes) return;
  const det = await buscarConversaDetalhe(conversaAntes, usuario.value.id);
  mensagens.value = det.mensagens;
}

async function inscreverChat() {
  await inscrever([{ tabela: 'mensagens' }, { tabela: 'conversas' }], recarregarChat);
}

function rotaInicio(): string {
  return '/responsavel';
}

function handleVoltar() {
  conversaAtivaId.value = null;
  contatoAtivo.value = null;
}

onMounted(async () => {
  horarioConfig.value = await obterHorarioProtegido();
  horarioAtivo.value = horarioProtegidoAtivo();
  if (usuario.value) {
    await carregarContatos();
    await inscreverChat();
  }
  intervaloRelogio = window.setInterval(() => {
    horarioAtivo.value = horarioProtegidoAtivo();
  }, 60_000);
});

watch(usuario, async (val) => {
  if (val && contatos.value.length === 0) {
    await carregarContatos();
    await inscreverChat();
  }
});

onUnmounted(() => {
  encerrar();
  if (intervaloRelogio) window.clearInterval(intervaloRelogio);
});
</script>

<template>
  <div class="d-flex flex-column h-100 overflow-hidden">
    <div
      class="d-flex align-items-center gap-2 px-3 py-1 border-bottom bg-body-tertiary flex-shrink-0"
    >
      <router-link :to="rotaInicio()" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1"></i>Início
      </router-link>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary d-none d-md-inline-block"
        @click="router.back()"
      >
        <i class="bi bi-arrow-left me-1"></i>Voltar
      </button>
      <span class="fw-semibold small flex-grow-1">Falar com a coordenação</span>
    </div>

    <div
      v-if="erro"
      class="alert alert-danger py-2 small mb-0 rounded-0 flex-shrink-0"
      role="alert"
    >
      <i class="bi bi-exclamation-triangle me-1"></i>
      {{ erro }}
    </div>

    <ChatPainelDuplo
      :contatos="contatos"
      :mensagens="mensagens"
      :conversa-ativa-id="conversaAtivaId"
      :horario-ativo="horarioAtivo"
      :mensagem-fora-horario="horarioConfig?.mensagemForaHorario ?? ''"
      :enviando="enviando"
      :pode-enviar="podeEnviar"
      :carregando-contatos="carregandoContatos"
      :papel-usuario="usuario?.papel ?? 'responsavel'"
      :titulo-chat="contatoAtivo?.nomeContato ?? 'Coordenação escolar'"
      :subtitulo-chat="
        'Coordenação Escolar' + (horarioAtivo ? ' · Online agora' : ' · Fora do horário')
      "
      :contato-selecionado="contatoAtivo"
      @selecionar-conversa="selecionarConversa"
      @enviar-mensagem="handleEnviarMensagem"
      @voltar="handleVoltar"
    />
  </div>
</template>
