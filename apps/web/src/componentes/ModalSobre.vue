<script setup lang="ts">
import ModalBase from '@/componentes/ModalBase.vue';

defineProps<{ visivel: boolean }>();
const emit = defineEmits<{ 'update:visivel': [valor: boolean] }>();

const DESENVOLVEDORES = [
  { nome: 'Emanuel Lázaro', url: 'https://github.com/emanuellcs' },
  { nome: 'Prof. Josué Cavalcante', url: 'https://github.com/wolf9611' },
];

const REPOSITORIO = 'https://github.com/eemtijca/buscapp';
</script>

<template>
  <ModalBase
    :visivel="visivel"
    titulo="Sobre o BuscApp"
    descricao="Créditos, desenvolvimento e licença do projeto."
    icone="mortarboard"
    cor-icone="text-primary"
    @update:visivel="(aberto) => !aberto && emit('update:visivel', false)"
  >
    <p class="small text-body-secondary">
      Plataforma de gestão escolar para acompanhar frequência, ocorrências, justificativas de falta
      e a comunicação entre professores, gestão e responsáveis.
    </p>

    <p class="small fw-medium mb-1">Desenvolvimento</p>
    <ul class="list-unstyled small mb-3">
      <li v-for="pessoa in DESENVOLVEDORES" :key="pessoa.url">
        <a :href="pessoa.url" target="_blank" rel="noopener noreferrer">{{ pessoa.nome }}</a>
      </li>
    </ul>

    <p class="small mb-1">
      <a :href="REPOSITORIO" target="_blank" rel="noopener noreferrer">
        Repositório do projeto no GitHub
      </a>
    </p>
    <p class="small text-body-secondary mb-0">
      Código aberto sob a licença MIT, mantido pela equipe do BuscApp na EEMTI José Cláudio de
      Araújo.
    </p>
  </ModalBase>
</template>
