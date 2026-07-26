<script setup lang="ts">
import { ref, computed } from 'vue';
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

    <div v-else class="overflow-y-auto flex-grow-1">
      <button
        v-for="contato in contatosFiltrados"
        :key="contato.conversaId"
        type="button"
        class="btn border-0 rounded-0 d-flex align-items-start gap-2 p-2 w-100 text-start"
        :class="{
          'bg-primary bg-opacity-10 border-start border-3 border-primary':
            contato.conversaId === conversaAtivaId,
          'bg-white': contato.conversaId !== conversaAtivaId,
        }"
        @click="selecionar(contato.conversaId)"
      >
        <span
          class="d-inline-flex align-items-center justify-content-center rounded-circle text-white flex-shrink-0 small"
          :style="{
            width: '40px',
            height: '40px',
            backgroundColor: contato.avatarCor,
            fontSize: contato.naoLidas > 0 ? '0.8rem' : '0.7rem',
          }"
          :title="contato.nomeContato"
        >
          <span :class="{ 'fw-bold': false }">{{ contato.avatarIniciais }}</span>
        </span>
        <div class="flex-grow-1 min-w-0 overflow-hidden">
          <div class="d-flex justify-content-between align-items-baseline">
            <span class="small text-truncate" :class="{ 'fw-bold': contato.naoLidas > 0 }">{{
              contato.nomeContato
            }}</span>
            <span class="small text-body-secondary flex-shrink-0 ms-1">{{
              contato.ultimaData
            }}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center">
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
          </div>
          <div class="small text-body-tertiary text-truncate">
            {{ contato.ultimaMensagem }}
          </div>
        </div>
        <div v-if="papelUsuario !== 'responsavel'" class="position-relative flex-shrink-0 ms-1">
          <button
            type="button"
            class="btn btn-sm btn-link p-0 text-body-secondary"
            style="line-height: 1"
            @click.stop="
              menuAbertoId = menuAbertoId === contato.conversaId ? null : contato.conversaId
            "
          >
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <div
            v-if="menuAbertoId === contato.conversaId"
            class="position-absolute end-0 top-100 bg-white border rounded shadow-sm p-1"
            style="z-index: 1050; min-width: 120px"
          >
            <button
              type="button"
              class="btn btn-sm btn-light d-flex align-items-center gap-2 w-100 text-start"
              @click.stop="
                menuAbertoId = null;
                emit('ocultar', contato.conversaId);
              "
            >
              <i class="bi bi-eye-slash small"></i>
              <span class="small">Ocultar</span>
            </button>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
