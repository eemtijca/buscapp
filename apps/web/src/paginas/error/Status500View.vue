<script setup lang="ts">
import ErrorView from './ErrorView.vue';
</script>

<template>
  <ErrorView
    :codigo="500"
    icone="bi-exclamation-triangle"
    titulo="Erro interno"
    mensagem="Ocorreu um erro inesperado. Tente novamente mais tarde."
  />
</template>
