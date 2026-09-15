<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';

const props = withDefaults(
  defineProps<{
    codigo: number;
    icone: string;
    titulo: string;
    mensagem: string;
    destino?: string;
    rotuloAcao?: string;
  }>(),
  {
    destino: '',
    rotuloAcao: '',
  },
);

const router = useRouter();
const contagem = ref(5);
let intervalo: ReturnType<typeof setInterval> | null = null;

function redirecionar(): void {
  if (intervalo) {
    clearInterval(intervalo);
    intervalo = null;
  }
  if (props.destino) {
    router.push(props.destino);
  }
}

if (props.destino) {
  intervalo = setInterval(() => {
    contagem.value--;
    if (contagem.value <= 0) {
      redirecionar();
    }
  }, 1000);
}

onUnmounted(() => {
  if (intervalo) {
    clearInterval(intervalo);
    intervalo = null;
  }
});

const mostrarContagem = computed(() => props.destino && contagem.value > 0);
const textoContagem = computed(() => {
  if (contagem.value === 1) return 'Redirecionando em 1 segundo';
  return `Redirecionando em ${contagem.value} segundos`;
});
</script>

<template>
  <div class="d-flex align-items-center justify-content-center" style="min-height: 100dvh">
    <div class="text-center px-3" style="max-width: 480px">
      <i
        :class="`bi ${icone} d-block mb-4 text-body-secondary`"
        style="font-size: 4rem"
        aria-hidden="true"
      ></i>

      <h1 class="display-6 fw-semibold mb-2">{{ titulo }}</h1>

      <p class="text-body-secondary mb-4">{{ mensagem }}</p>

      <div v-if="mostrarContagem" class="mb-3">
        <span class="badge bg-primary fs-6 px-3 py-2">{{ textoContagem }}</span>
      </div>

      <div class="d-flex flex-column flex-sm-row gap-2 justify-content-center">
        <slot name="acoes">
          <button v-if="destino" type="button" class="btn btn-primary" @click="redirecionar">
            {{ rotuloAcao || 'Redirecionar agora' }}
          </button>
          <router-link to="/" class="btn btn-outline-secondary"> Voltar ao início </router-link>
        </slot>
      </div>
    </div>
  </div>
</template>
