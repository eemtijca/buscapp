<script setup lang="ts">
import { ref } from 'vue';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { traduzirErro } from '@/utils/traduzirErro';

const { solicitarCodigoRedefinicao } = useAutenticacao();

const email = ref('');
const carregando = ref(false);
const enviado = ref(false);
const erro = ref<string | null>(null);

async function handleSolicitarCodigo(): Promise<void> {
  if (!email.value.trim()) {
    erro.value = 'Informe seu e-mail para solicitar o código.';
    return;
  }

  carregando.value = true;
  erro.value = null;

  try {
    await solicitarCodigoRedefinicao(email.value.trim());
    enviado.value = true;
  } catch (erroDesconhecido: unknown) {
    erro.value = traduzirErro(erroDesconhecido).mensagem;
  } finally {
    carregando.value = false;
  }
}
</script>

<template>
  <div class="d-flex align-items-center py-4 bg-body-tertiary" style="min-height: 100dvh">
    <div class="form-signin w-100 m-auto">
      <div class="d-flex align-items-center justify-content-center gap-2 mb-5">
        <i
          class="bi bi-mortarboard"
          style="font-size: 2.5rem; color: var(--bs-primary)"
          aria-hidden="true"
        ></i>
        <span class="fw-semibold text-body-secondary" style="font-size: 1.75rem"> BuscApp </span>
      </div>

      <template v-if="enviado">
        <div class="alert alert-success d-flex align-items-center" role="alert">
          <i class="bi bi-check-circle-fill flex-shrink-0 me-2 fs-5" aria-hidden="true"></i>
          <div>
            <p class="mb-1">Solicitação enviada com sucesso!</p>
            <p class="mb-0 small">
              A administração será notificada e lhe enviará um código. Você pode fechar esta tela e
              voltar depois.
            </p>
          </div>
        </div>

        <p class="small text-body-secondary text-center mb-3">
          Já recebeu o código? Clique abaixo para redefinir sua senha.
        </p>

        <router-link to="/redefinir-senha-codigo" class="btn btn-primary w-100 py-2 mb-2">
          <i class="bi bi-shield-lock me-1" aria-hidden="true"></i>
          Redefinir senha
        </router-link>

        <router-link
          to="/"
          class="d-block text-center small link-offset-2"
          style="text-decoration: none"
        >
          <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
          Voltar para o login
        </router-link>
      </template>

      <template v-else>
        <h1 class="h4 mb-3 fw-normal text-center">Solicitar código de acesso</h1>

        <p class="text-body-secondary text-center mb-4" style="font-size: 0.875rem">
          Informe seu e-mail para receber um código de redefinição de senha da administração.
        </p>

        <div v-if="erro" class="alert alert-danger d-flex align-items-center" role="alert">
          <i class="bi bi-exclamation-triangle-fill flex-shrink-0 me-2" aria-hidden="true"></i>
          <span>{{ erro }}</span>
        </div>

        <form @submit.prevent="handleSolicitarCodigo" novalidate>
          <div class="form-floating">
            <input
              id="email"
              v-model="email"
              type="email"
              class="form-control"
              :class="{ 'is-invalid': erro && !email.trim() }"
              placeholder="nome@exemplo.com"
              :disabled="carregando"
              autocomplete="email"
              required
            />
            <label for="email">E-mail</label>
          </div>

          <button type="submit" class="btn btn-primary w-100 py-2 mt-3" :disabled="carregando">
            <span
              v-if="carregando"
              class="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
            {{ carregando ? 'Solicitando...' : 'Solicitar código' }}
          </button>
        </form>

        <div class="text-center mt-3">
          <router-link to="/redefinir-senha-codigo" class="btn btn-outline-primary btn-sm w-100">
            <i class="bi bi-shield-lock me-1" aria-hidden="true"></i>
            Já tenho um código
          </router-link>
        </div>

        <router-link
          to="/"
          class="d-block text-center mt-2 small link-offset-2"
          style="text-decoration: none"
        >
          <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
          Voltar para o login
        </router-link>
      </template>

      <p class="mt-5 mb-1 text-body-secondary text-center" style="font-size: 0.75rem">v0.1.0</p>
    </div>
  </div>
</template>

<style scoped>
.form-signin {
  max-width: 330px;
  padding: 1rem;
}

.form-signin .form-floating:focus-within {
  z-index: 2;
}
</style>
