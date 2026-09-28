<script setup lang="ts">
import ErrorView from './ErrorView.vue';
</script>

<template>
  <ErrorView
    :codigo="404"
    icone="bi-emoji-frown"
    titulo="Página não encontrada"
    mensagem="A página procurada não existe ou foi removida."
  />
</template>
