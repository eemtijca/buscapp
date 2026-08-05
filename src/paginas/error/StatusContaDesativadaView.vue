<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import ErrorView from './ErrorView.vue';

const router = useRouter();
const { logout } = useAutenticacao();

async function sair(): Promise<void> {
  await logout();
  await router.push('/');
}
</script>

<template>
  <ErrorView
    :codigo="423"
    icone="bi-person-slash"
    titulo="Conta desativada"
    mensagem="Sua conta foi desativada pela coordenação da escola. Caso acredite que isso seja um engano, entre em contato com a gestão."
  >
    <template #acoes>
      <button type="button" class="btn btn-primary" @click="sair">
        <i class="bi bi-box-arrow-right me-1" aria-hidden="true"></i>
        Sair da conta
      </button>
    </template>
  </ErrorView>
</template>
