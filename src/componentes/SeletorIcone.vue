<script setup lang="ts">
import { ref, computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: string;
  desabilitado?: boolean;
}>(), {
  desabilitado: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

interface IconEntry {
  nome: string;
  rotulo: string;
  categoria: string;
}

const icones: IconEntry[] = [
  { nome: 'plus', rotulo: 'Adicionar', categoria: 'Ações' },
  { nome: 'plus-lg', rotulo: 'Adicionar (grande)', categoria: 'Ações' },
  { nome: 'pencil', rotulo: 'Editar', categoria: 'Ações' },
  { nome: 'trash', rotulo: 'Excluir', categoria: 'Ações' },
  { nome: 'trash3', rotulo: 'Excluir (alternativo)', categoria: 'Ações' },
  { nome: 'download', rotulo: 'Baixar', categoria: 'Ações' },
  { nome: 'upload', rotulo: 'Enviar', categoria: 'Ações' },
  { nome: 'search', rotulo: 'Pesquisar', categoria: 'Ações' },
  { nome: 'gear', rotulo: 'Configuração', categoria: 'Ações' },
  { nome: 'gear-wide', rotulo: 'Configuração (alternativo)', categoria: 'Ações' },
  { nome: 'check', rotulo: 'Confirmar', categoria: 'Ações' },
  { nome: 'x-lg', rotulo: 'Fechar', categoria: 'Ações' },
  { nome: 'arrow-repeat', rotulo: 'Atualizar', categoria: 'Ações' },
  { nome: 'eye', rotulo: 'Visualizar', categoria: 'Ações' },
  { nome: 'eye-slash', rotulo: 'Ocultar', categoria: 'Ações' },
  { nome: 'share', rotulo: 'Compartilhar', categoria: 'Ações' },
  { nome: 'arrow-up', rotulo: 'Subir', categoria: 'Ações' },
  { nome: 'arrow-down', rotulo: 'Descer', categoria: 'Ações' },
  { nome: 'house', rotulo: 'Início', categoria: 'Navegação' },
  { nome: 'house-door', rotulo: 'Início (porta)', categoria: 'Navegação' },
  { nome: 'arrow-left', rotulo: 'Voltar', categoria: 'Navegação' },
  { nome: 'arrow-right', rotulo: 'Avançar', categoria: 'Navegação' },
  { nome: 'chevron-left', rotulo: 'Recuar', categoria: 'Navegação' },
  { nome: 'chevron-right', rotulo: 'Avançar', categoria: 'Navegação' },
  { nome: 'chevron-up', rotulo: 'Recolher', categoria: 'Navegação' },
  { nome: 'chevron-down', rotulo: 'Expandir', categoria: 'Navegação' },
  { nome: 'box-arrow-up-right', rotulo: 'Abrir link', categoria: 'Navegação' },
  { nome: 'arrow-return-left', rotulo: 'Retornar', categoria: 'Navegação' },
  { nome: 'list', rotulo: 'Lista', categoria: 'Navegação' },
  { nome: 'grid', rotulo: 'Grade', categoria: 'Navegação' },
  { nome: 'chat', rotulo: 'Bate-papo', categoria: 'Comunicação' },
  { nome: 'chat-dots', rotulo: 'Bate-papo com pontos', categoria: 'Comunicação' },
  { nome: 'chat-quote', rotulo: 'Bate-papo com citação', categoria: 'Comunicação' },
  { nome: 'bell', rotulo: 'Notificações', categoria: 'Comunicação' },
  { nome: 'bell-fill', rotulo: 'Notificações (preenchido)', categoria: 'Comunicação' },
  { nome: 'envelope', rotulo: 'E-mail', categoria: 'Comunicação' },
  { nome: 'telephone', rotulo: 'Telefone', categoria: 'Comunicação' },
  { nome: 'megaphone', rotulo: 'Comunicado', categoria: 'Comunicação' },
  { nome: 'send', rotulo: 'Enviar', categoria: 'Comunicação' },
  { nome: 'person', rotulo: 'Usuário', categoria: 'Pessoas' },
  { nome: 'person-badge', rotulo: 'Usuário com crachá', categoria: 'Pessoas' },
  { nome: 'person-vcard', rotulo: 'Cartão de visita', categoria: 'Pessoas' },
  { nome: 'person-check', rotulo: 'Usuário verificado', categoria: 'Pessoas' },
  { nome: 'person-fill-exclamation', rotulo: 'Usuário alerta', categoria: 'Pessoas' },
  { nome: 'people', rotulo: 'Equipe', categoria: 'Pessoas' },
  { nome: 'people-fill', rotulo: 'Equipe (preenchido)', categoria: 'Pessoas' },
  { nome: 'shield-lock', rotulo: 'Privacidade', categoria: 'Pessoas' },
  { nome: 'shield-check', rotulo: 'Protegido', categoria: 'Pessoas' },
  { nome: 'shield-exclamation', rotulo: 'Alerta de segurança', categoria: 'Pessoas' },
  { nome: 'file-earmark', rotulo: 'Documento', categoria: 'Documentos' },
  { nome: 'file-earmark-text', rotulo: 'Documento texto', categoria: 'Documentos' },
  { nome: 'file-earmark-bar-graph', rotulo: 'Relatório', categoria: 'Documentos' },
  { nome: 'file-earmark-arrow-down', rotulo: 'Importar', categoria: 'Documentos' },
  { nome: 'file-earmark-arrow-up', rotulo: 'Exportar', categoria: 'Documentos' },
  { nome: 'file-earmark-check', rotulo: 'Documento aprovado', categoria: 'Documentos' },
  { nome: 'file-earmark-x', rotulo: 'Documento rejeitado', categoria: 'Documentos' },
  { nome: 'file-earmark-pdf', rotulo: 'Documento PDF', categoria: 'Documentos' },
  { nome: 'clipboard-check', rotulo: 'Lista de verificação', categoria: 'Documentos' },
  { nome: 'clipboard-data', rotulo: 'Dados', categoria: 'Documentos' },
  { nome: 'book', rotulo: 'Livro', categoria: 'Escola' },
  { nome: 'bookmark-star', rotulo: 'Destaque', categoria: 'Escola' },
  { nome: 'pencil-square', rotulo: 'Escrever', categoria: 'Escola' },
  { nome: 'calendar', rotulo: 'Calendário', categoria: 'Escola' },
  { nome: 'calendar-check', rotulo: 'Presença', categoria: 'Escola' },
  { nome: 'calendar-event', rotulo: 'Evento', categoria: 'Escola' },
  { nome: 'calendar-date', rotulo: 'Data', categoria: 'Escola' },
  { nome: 'clock', rotulo: 'Horário', categoria: 'Escola' },
  { nome: 'clock-history', rotulo: 'Histórico', categoria: 'Escola' },
  { nome: 'alarm', rotulo: 'Alarme', categoria: 'Escola' },
  { nome: 'sun', rotulo: 'Manhã', categoria: 'Escola' },
  { nome: 'sunset', rotulo: 'Tarde', categoria: 'Escola' },
  { nome: 'moon', rotulo: 'Noite', categoria: 'Escola' },
  { nome: 'heart-pulse', rotulo: 'Saúde', categoria: 'Escola' },
  { nome: 'mortarboard', rotulo: 'Formatura', categoria: 'Escola' },
  { nome: 'fonts', rotulo: 'Texto', categoria: 'Escola' },
  { nome: 'exclamation-triangle', rotulo: 'Atenção', categoria: 'Status' },
  { nome: 'exclamation-circle', rotulo: 'Alerta', categoria: 'Status' },
  { nome: 'check-circle', rotulo: 'Sucesso', categoria: 'Status' },
  { nome: 'check2-square', rotulo: 'Selecionado', categoria: 'Status' },
  { nome: 'info-circle', rotulo: 'Informação', categoria: 'Status' },
  { nome: 'question-circle', rotulo: 'Ajuda', categoria: 'Status' },
  { nome: 'star', rotulo: 'Favorito', categoria: 'Status' },
  { nome: 'star-fill', rotulo: 'Favorito (preenchido)', categoria: 'Status' },
  { nome: 'heart', rotulo: 'Coração', categoria: 'Status' },
  { nome: 'heart-fill', rotulo: 'Coração (preenchido)', categoria: 'Status' },
  { nome: 'hand-thumbs-up', rotulo: 'Gostei', categoria: 'Status' },
  { nome: 'hand-thumbs-down', rotulo: 'Não gostei', categoria: 'Status' },
  { nome: 'tag', rotulo: 'Etiqueta', categoria: 'Status' },
  { nome: 'tags', rotulo: 'Etiquetas', categoria: 'Status' },
  { nome: 'graph-up', rotulo: 'Crescimento', categoria: 'Status' },
  { nome: 'graph-down', rotulo: 'Declínio', categoria: 'Status' },
];

const categorias = [...new Set(icones.map(i => i.categoria))];

const modalAberto = ref(false);
const busca = ref('');
const categoriaAtiva = ref('Todos');

const iconesFiltrados = computed(() => {
  let items = icones;
  if (categoriaAtiva.value !== 'Todos') {
    items = items.filter(i => i.categoria === categoriaAtiva.value);
  }
  if (busca.value.trim()) {
    const termo = busca.value.toLowerCase().trim();
    items = items.filter(i =>
      i.nome.includes(termo) || i.rotulo.toLowerCase().includes(termo)
    );
  }
  return items;
});

function selecionar(nome: string) {
  emit('update:modelValue', nome);
  modalAberto.value = false;
}

function abrir() {
  if (props.desabilitado) return;
  busca.value = '';
  categoriaAtiva.value = 'Todos';
  modalAberto.value = true;
}
</script>

<template>
  <div class="mb-3">
    <label class="form-label small fw-medium">Ícone</label>
    <button
      type="button"
      class="btn w-100 text-start d-flex align-items-center gap-2"
      :class="modelValue ? 'btn-outline-success' : 'btn-outline-secondary'"
      @click="abrir"
      :disabled="desabilitado"
    >
      <span v-if="modelValue" class="d-flex align-items-center gap-2">
        <i :class="'bi bi-' + modelValue" style="font-size: 1.25rem"></i>
        <code class="small">{{ modelValue }}</code>
      </span>
      <span v-else class="text-body-secondary">
        <i class="bi bi-image me-1"></i>
        Selecionar ícone
      </span>
      <i class="bi bi-chevron-down ms-auto small text-body-secondary"></i>
    </button>

    <div v-if="modalAberto" class="modal d-block" tabindex="-1" @click.self="modalAberto = false">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Selecionar ícone</h5>
            <button type="button" class="btn-close" @click="modalAberto = false"></button>
          </div>
          <div class="modal-body">
            <input
              v-model="busca"
              type="search"
              class="form-control mb-3"
              placeholder="Buscar ícone..."
              autofocus
            />
            <div class="d-flex gap-1 flex-wrap mb-3">
              <button
                v-for="cat in ['Todos', ...categorias]"
                :key="cat"
                class="btn btn-sm"
                :class="categoriaAtiva === cat ? 'btn-success' : 'btn-outline-success'"
                @click="categoriaAtiva = cat"
              >
                {{ cat }}
              </button>
            </div>
            <div class="row g-2" v-if="iconesFiltrados.length">
              <div
                v-for="ico in iconesFiltrados"
                :key="ico.nome"
                class="col-4 col-md-3 col-lg-2"
              >
                <button
                  type="button"
                  class="btn btn-outline-success w-100 text-center py-2"
                  :class="{ 'btn-success text-white': modelValue === ico.nome }"
                  @click="selecionar(ico.nome)"
                  :title="ico.rotulo"
                >
                  <i :class="'bi bi-' + ico.nome" style="font-size: 1.5rem"></i>
                  <br />
                  <span class="small" style="font-size: 0.6rem">{{ ico.nome }}</span>
                </button>
              </div>
            </div>
            <div v-else class="text-center text-body-secondary py-4">
              <i class="bi bi-search" style="font-size: 2rem"></i>
              <p class="mt-2 mb-0">Nenhum ícone encontrado para "{{ busca }}"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="modalAberto" class="modal-backdrop fade show"></div>
  </div>
</template>
