<script setup lang="ts">
import type { StatusConexao } from '@/composables/useStatusConexao';

defineProps<{
  status: StatusConexao;
}>();
</script>

<template>
  <span class="d-inline-flex align-items-center gap-1">
    <span
      class="rounded-circle d-inline-block"
      :class="{
        'bg-success': status === 'conectado',
        'bg-danger': status === 'desconectado',
        'bg-warning': status === 'verificando',
      }"
      style="width: 8px; height: 8px"
      aria-hidden="true"
    ></span>
    <span class="small">
      <template v-if="status === 'conectado'">Conectado</template>
      <template v-else-if="status === 'desconectado'">Desconectado</template>
      <template v-else>Verificando...</template>
    </span>
  </span>
</template>
