<script setup lang="ts">
import { useRoute } from 'vue-router';
import ErrorView from './ErrorView.vue';

const route = useRoute();
const destino = (route.query.destino as string) || '/';
</script>

<template>
  <ErrorView
    :codigo="403"
    icone="bi-shield-exclamation"
    titulo="Acesso negado"
    mensagem="Você não tem permissão para acessar esta página."
    :destino="destino"
    rotuloAcao="Redirecionar agora"
  />
</template>
