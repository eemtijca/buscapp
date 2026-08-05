<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useStatusConta } from '@/composables/useStatusConta';

const { iniciar, parar } = useStatusConta();

onMounted(() => iniciar());
onUnmounted(() => parar());
</script>

<template>
  <router-view />
</template>
