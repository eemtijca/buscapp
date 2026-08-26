<script setup lang="ts">
import { computed } from 'vue';
import { useAutenticacao } from '@/composables/useAutenticacao';
import CartaoNavegacao from '@/componentes/CartaoNavegacao.vue';

const { usuario } = useAutenticacao();
const nomeResponsavel = usuario.value?.nome || 'Responsável';
const temModulo = (modulo: string) => (usuario.value?.acesso_modulos ?? []).includes(modulo);

const podeAlertas = computed(() => temModulo('alertas'));
const podeTermometro = computed(() => temModulo('termometro'));
const podeJustificativa = computed(() => temModulo('justificativa'));
const podeChat = computed(() => temModulo('chat'));
</script>

<template>
  <div class="container py-4 py-md-5" style="max-width: 800px">
    <div class="text-center mb-4 mb-md-5">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success mb-3"
        style="width: 64px; height: 64px; font-size: 1.75rem"
      >
        <i class="bi bi-house-heart" aria-hidden="true"></i>
      </span>
      <h1 class="h4 fw-bold mb-1">Olá, {{ nomeResponsavel }}</h1>
      <p class="text-body-secondary small mb-0">
        Acompanhe a vida escolar do seu filho de forma simples e transparente.
      </p>
    </div>

    <div class="row g-3 justify-content-center">
      <div v-if="podeAlertas" class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="bell"
          titulo="Alertas"
          descricao="Veja notificações de ausência e comunicados importantes."
          rota="/responsavel/alertas"
          cor="success"
        />
      </div>
      <div v-if="podeTermometro" class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="thermometer-half"
          titulo="Termômetro"
          descricao="Acompanhe o nível de atenção da frequência do seu filho."
          rota="/responsavel/termometro"
          cor="success"
        />
      </div>
      <div v-if="podeJustificativa" class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="paperclip"
          titulo="Justificativa"
          descricao="Envie atestados e justifique faltas do seu filho."
          rota="/responsavel/justificativa"
          cor="success"
        />
      </div>
      <div v-if="podeChat" class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="chat-dots"
          titulo="Falar com coordenação"
          descricao="Converse com a equipe escolar dentro do horário protegido."
          rota="/responsavel/chat"
          cor="success"
        />
      </div>
    </div>
  </div>
</template>
