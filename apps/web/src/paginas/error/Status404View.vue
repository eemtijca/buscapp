<script setup lang="ts">
import ErrorView from './ErrorView.vue';
</script>

<template>
  <ErrorView
    :codigo="404"
    icone="bi-emoji-frown"
    titulo="Página não encontrada"
    mensagem="A página que você procura não existe ou foi removida."
  />
</template>
