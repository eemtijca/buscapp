<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import {
  enviarMensagem,
  garantirConversasDosFilhos,
  marcarMensagensComoLidas,
  useContatosChat,
  useConversaDetalhe,
} from '@/composables/consultas/useChat';
import { useFilhosResponsavel } from '@/composables/consultas/useMonitoramento';
import { useHorarioProtegido } from '@/composables/consultas/useCatalogos';
import { useNotificacoes } from '@/composables/useNotificacoes';
import ChatPainelDuplo from '@/componentes/ChatPainelDuplo.vue';

const router = useRouter();
const route = useRoute();
const { usuario } = useAutenticacao();
const { filhos } = useFilhosResponsavel();
const { marcarNotificacoesConversaLidas } = useNotificacoes();

const { contatos, pendente: carregandoContatos } = useContatosChat(
  () => usuario.value?.papel ?? '',
  () => usuario.value?.id ?? '',
);

const conversaAtivaId = ref<string | null>(null);
const { mensagens, temAnteriores, carregandoAnteriores, carregarAnteriores } = useConversaDetalhe(
  () => conversaAtivaId.value,
  () => usuario.value?.id,
);

const { horario, horarioAtivo } = useHorarioProtegido();

const enviando = ref(false);
const erro = ref<string | null>(null);

const contatoAtivo = computed(
  () => contatos.value.find((contato) => contato.conversaId === conversaAtivaId.value) ?? null,
);
const podeEnviar = computed(() => horarioAtivo.value);

// Cada filho precisa de uma conversa aberta para aparecer na lista.
watch(
  filhos,
  (lista) => {
    if (!lista.length) return;
    void garantirConversasDosFilhos(lista.map((filho) => filho.id));
  },
  { immediate: true },
);

watch(
  contatos,
  (lista) => {
    const inicial = route.query.conversa as string | undefined;
    if (!conversaAtivaId.value && inicial && lista.some((c) => c.conversaId === inicial)) {
      void selecionarConversa(inicial);
      return;
    }
    if (!conversaAtivaId.value && lista.length) void selecionarConversa(lista[0]!.conversaId);
  },
  { immediate: true },
);

async function selecionarConversa(conversaId: string) {
  conversaAtivaId.value = conversaId;
  // A conversa ativa fica na URL para sobreviver ao refresh e permitir link direto.
  void router.replace({ query: { conversa: conversaId } });
  await Promise.all([
    marcarMensagensComoLidas(conversaId),
    marcarNotificacoesConversaLidas(conversaId),
  ]);
}

async function handleEnviarMensagem(texto: string) {
  if (!conversaAtivaId.value) return;
  enviando.value = true;
  erro.value = null;
  const ok = await enviarMensagem(conversaAtivaId.value, texto);
  if (!ok) erro.value = 'Falha ao enviar mensagem. Tente novamente.';
  enviando.value = false;
}

function rotaInicio(): string {
  return '/responsavel';
}

function handleVoltar() {
  conversaAtivaId.value = null;
}
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
      :mensagem-fora-horario="horario.mensagemForaHorario"
      :enviando="enviando"
      :pode-enviar="podeEnviar"
      :carregando-contatos="carregandoContatos"
      :papel-usuario="usuario?.papel ?? 'responsavel'"
      :titulo-chat="contatoAtivo?.nomeContato ?? 'Coordenação escolar'"
      :subtitulo-chat="
        'Coordenação Escolar' + (horarioAtivo ? ' · Online agora' : ' · Fora do horário')
      "
      :contato-selecionado="contatoAtivo"
      :tem-mensagens-anteriores="temAnteriores"
      :carregando-anteriores="carregandoAnteriores"
      @selecionar-conversa="selecionarConversa"
      @enviar-mensagem="handleEnviarMensagem"
      @carregar-anteriores="carregarAnteriores"
      @voltar="handleVoltar"
    />
  </div>
</template>
