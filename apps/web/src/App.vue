<script setup lang="ts">
import { isNavigating, destinoTitulo } from '@/composables/useNavegacao';
import TelaCarregamento from '@/componentes/TelaCarregamento.vue';
</script>

<template>
  <TelaCarregamento :visivel="isNavigating" :titulo="destinoTitulo" />
  <router-view />
</template>
