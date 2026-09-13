<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useStatusConta } from '@/composables/useStatusConta';
import { isNavigating, destinoTitulo } from '@/composables/useNavegacao';
import TelaCarregamento from '@/componentes/TelaCarregamento.vue';

const { iniciar, parar } = useStatusConta();

onMounted(() => iniciar());
onUnmounted(() => parar());
</script>

<template>
  <TelaCarregamento :visivel="isNavigating" :titulo="destinoTitulo" />
  <router-view />
</template>
