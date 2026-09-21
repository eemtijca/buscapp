<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { ContatoChat } from '@/tipos/componentes';

const props = withDefaults(
  defineProps<{
    contatos: ContatoChat[];
    conversaAtivaId: string | null;
    carregando?: boolean;
    papelUsuario?: string;
  }>(),
  { carregando: false, papelUsuario: '' },
);

const emit = defineEmits<{
  selecionar: [conversaId: string];
  ocultar: [conversaId: string];
}>();

const busca = ref('');
const menuAbertoId = ref<string | null>(null);
const container = ref<HTMLElement | null>(null);

/** Fecha o menu ao clicar fora ou pressionar Escape. */
function aoClicarFora(evento: MouseEvent) {
  if (!menuAbertoId.value) return;
  if (container.value && !container.value.contains(evento.target as Node))
    menuAbertoId.value = null;
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Escape') menuAbertoId.value = null;
}

onMounted(() => {
  document.addEventListener('click', aoClicarFora);
  document.addEventListener('keydown', aoTeclar);
});

onUnmounted(() => {
  document.removeEventListener('click', aoClicarFora);
  document.removeEventListener('keydown', aoTeclar);
});

/** Cor do texto do avatar com contraste mínimo sobre a cor de fundo. */
function corTextoAvatar(cor: string): string {
  const hex = cor.replace('#', '');
  if (hex.length !== 6) return '#fff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? '#000' : '#fff';
}

const contatosFiltrados = computed(() => {
  let lista =
    props.papelUsuario === 'responsavel' ? props.contatos : props.contatos.filter((c) => c.ativa);

  const termo = busca.value.toLowerCase().trim();
  if (termo) {
    lista = lista.filter(
      (c) =>
        c.nomeContato.toLowerCase().includes(termo) || c.subtitulo.toLowerCase().includes(termo),
    );
  }

  return lista;
});

function selecionar(id: string) {
  emit('selecionar', id);
}
</script>

<template>
  <div class="d-flex flex-column overflow-hidden h-100 border-end bg-body">
    <div class="p-2 border-bottom">
      <input
        v-model="busca"
        type="search"
        class="form-control form-control-sm"
        placeholder="Buscar conversa..."
        aria-label="Buscar conversa"
      />
    </div>

    <div v-if="carregando" class="d-flex justify-content-center py-4">
      <div class="spinner-border spinner-border-sm text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
    </div>

    <div
      v-else-if="!contatosFiltrados.length"
      class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-body-secondary px-3 text-center"
    >
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary mb-2"
        style="width: 56px; height: 56px"
      >
        <i class="bi bi-chat-text fs-4 opacity-50"></i>
      </span>
      <p class="small mb-0">
        {{ busca ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ativa.' }}
      </p>
    </div>

    <div v-else class="overflow-y-auto flex-grow-1" ref="container">
      <div
        v-for="contato in contatosFiltrados"
        :key="contato.conversaId"
        class="d-flex align-items-stretch border-0 rounded-0 p-0 w-100"
        :class="{
          'bg-primary bg-opacity-10 border-start border-3 border-primary':
            contato.conversaId === conversaAtivaId,
          'bg-white': contato.conversaId !== conversaAtivaId,
        }"
      >
        <button
          type="button"
          class="btn border-0 rounded-0 d-flex align-items-start gap-2 p-2 flex-grow-1 text-start"
          :aria-current="contato.conversaId === conversaAtivaId ? 'true' : undefined"
          @click="selecionar(contato.conversaId)"
        >
          <span
            class="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0 small"
            :style="{
              width: '40px',
              height: '40px',
              backgroundColor: contato.avatarCor,
              color: corTextoAvatar(contato.avatarCor),
              fontSize: contato.naoLidas > 0 ? '0.8rem' : '0.7rem',
            }"
            :title="contato.nomeContato"
          >
            <span>{{ contato.avatarIniciais }}</span>
          </span>
          <span class="flex-grow-1 min-w-0 overflow-hidden">
            <span class="d-flex justify-content-between align-items-baseline">
              <span class="small text-truncate" :class="{ 'fw-bold': contato.naoLidas > 0 }">{{
                contato.nomeContato
              }}</span>
              <span class="small text-body-secondary flex-shrink-0 ms-1">{{
                contato.ultimaData
              }}</span>
            </span>
            <span class="d-flex justify-content-between align-items-center">
              <span class="small text-body-secondary text-truncate">
                {{ contato.subtitulo }}
              </span>
              <span
                v-if="contato.naoLidas > 0"
                class="badge bg-primary rounded-pill flex-shrink-0 ms-1"
                style="font-size: 0.65rem"
              >
                {{ contato.naoLidas > 99 ? '99+' : contato.naoLidas }}
              </span>
            </span>
            <span class="small text-body-tertiary text-truncate d-block">
              {{ contato.ultimaMensagem }}
            </span>
          </span>
        </button>

        <div v-if="papelUsuario !== 'responsavel'" class="position-relative flex-shrink-0 p-1">
          <button
            type="button"
            class="btn btn-sm btn-link p-0 text-body-secondary"
            style="line-height: 1"
            :aria-label="'Opções da conversa com ' + contato.nomeContato"
            :aria-expanded="menuAbertoId === contato.conversaId"
            aria-haspopup="menu"
            @click.stop="
              menuAbertoId = menuAbertoId === contato.conversaId ? null : contato.conversaId
            "
          >
            <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
          </button>
          <div
            v-if="menuAbertoId === contato.conversaId"
            class="position-absolute end-0 top-100 bg-white border rounded shadow-sm p-1"
            style="z-index: 1050; min-width: 120px"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              class="btn btn-sm btn-light d-flex align-items-center gap-2 w-100 text-start"
              @click.stop="
                menuAbertoId = null;
                emit('ocultar', contato.conversaId);
              "
            >
              <i class="bi bi-eye-slash small" aria-hidden="true"></i>
              <span class="small">Ocultar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
