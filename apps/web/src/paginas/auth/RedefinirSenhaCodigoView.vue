<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { traduzirErro } from '@/utils/traduzirErro';

const { redefinirSenhaComCodigo } = useAutenticacao();

const email = ref('');
const codigo = ref('');
const novaSenha = ref('');
const confirmarSenha = ref('');
const mostrarSenhas = ref(false);
const carregando = ref(false);
const atualizado = ref(false);
const erro = ref<string | null>(null);

interface Requisito {
  chave: string;
  label: string;
  regex: RegExp;
}

const requisitos: Requisito[] = [
  { chave: 'minimo', label: 'Mínimo 8 caracteres', regex: /.{8,}/ },
  { chave: 'maiuscula', label: 'Pelo menos 1 letra maiúscula', regex: /[A-Z]/ },
  { chave: 'minuscula', label: 'Pelo menos 1 letra minúscula', regex: /[a-z]/ },
  { chave: 'numero', label: 'Pelo menos 1 número', regex: /\d/ },
  { chave: 'especial', label: 'Pelo menos 1 caractere especial', regex: /[^A-Za-z0-9]/ },
];

const senhasConferem = computed(
  () => confirmarSenha.value.length > 0 && novaSenha.value === confirmarSenha.value,
);

const senhasDiferem = computed(
  () => confirmarSenha.value.length > 0 && novaSenha.value !== confirmarSenha.value,
);

const formularioValido = computed(
  () =>
    email.value.trim().length > 0 &&
    codigo.value.length === 6 &&
    requisitos.every((r) => r.regex.test(novaSenha.value)) &&
    novaSenha.value === confirmarSenha.value &&
    confirmarSenha.value.length > 0,
);

function requisitoAtendido(req: Requisito): boolean {
  return req.regex.test(novaSenha.value);
}

async function handleRedefinir(): Promise<void> {
  if (!formularioValido.value) return;

  carregando.value = true;
  erro.value = null;

  try {
    await redefinirSenhaComCodigo(email.value.trim(), codigo.value.trim(), novaSenha.value);
    atualizado.value = true;
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

      <template v-if="atualizado">
        <div class="alert alert-success d-flex align-items-center" role="alert">
          <i class="bi bi-check-circle-fill flex-shrink-0 me-2 fs-5" aria-hidden="true"></i>
          <span>Senha redefinida com sucesso!</span>
        </div>

        <router-link to="/" class="btn btn-primary w-100 py-2"> Ir para o login </router-link>
      </template>

      <template v-else>
        <h1 class="h4 mb-3 fw-normal text-center">Redefinir senha com código</h1>

        <p class="text-body-secondary text-center mb-4" style="font-size: 0.875rem">
          Informe seu e-mail, o código recebido e escolha uma nova senha.
        </p>

        <div v-if="erro" class="alert alert-danger d-flex align-items-center" role="alert">
          <i class="bi bi-exclamation-triangle-fill flex-shrink-0 me-2" aria-hidden="true"></i>
          <span>{{ erro }}</span>
        </div>

        <form @submit.prevent="handleRedefinir" novalidate>
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

          <div class="form-floating mt-3">
            <input
              id="codigo"
              v-model="codigo"
              type="text"
              class="form-control"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              placeholder="000000"
              :disabled="carregando"
              autocomplete="one-time-code"
              required
            />
            <label for="codigo">Código de 6 dígitos</label>
          </div>

          <div class="form-floating mt-3">
            <input
              id="nova-senha"
              v-model="novaSenha"
              :type="mostrarSenhas ? 'text' : 'password'"
              class="form-control"
              :class="{ 'is-invalid': erro && !novaSenha.trim() }"
              placeholder="Nova senha"
              :disabled="carregando"
              autocomplete="new-password"
              required
            />
            <label for="nova-senha">Nova senha</label>
          </div>

          <ul
            v-if="novaSenha.length > 0"
            class="list-unstyled mb-0 small mt-2"
            style="font-size: 0.8rem"
            aria-label="Requisitos de senha"
          >
            <li
              v-for="req in requisitos"
              :key="req.chave"
              :class="requisitoAtendido(req) ? 'text-success' : 'text-body-tertiary'"
            >
              <i
                :class="requisitoAtendido(req) ? 'bi-check-circle-fill' : 'bi-circle'"
                class="me-1"
                aria-hidden="true"
              ></i>
              {{ req.label }}
            </li>
          </ul>

          <div class="form-floating mt-3">
            <input
              id="confirmar-senha"
              v-model="confirmarSenha"
              :type="mostrarSenhas ? 'text' : 'password'"
              class="form-control"
              :class="{
                'is-valid': senhasConferem,
                'is-invalid': senhasDiferem,
              }"
              placeholder="Confirmar senha"
              :disabled="carregando"
              autocomplete="new-password"
              required
            />
            <label for="confirmar-senha">Confirmar senha</label>
          </div>

          <div class="form-check text-start mt-3">
            <input
              id="mostrar-senhas"
              v-model="mostrarSenhas"
              type="checkbox"
              class="form-check-input"
            />
            <label class="form-check-label" for="mostrar-senhas">Mostrar senhas</label>
          </div>

          <div
            v-if="senhasConferem"
            class="text-success small d-flex align-items-center gap-1 mt-1"
          >
            <i class="bi bi-check-circle-fill" aria-hidden="true"></i>
            Senhas conferem
          </div>
          <div
            v-else-if="senhasDiferem"
            class="text-danger small d-flex align-items-center gap-1 mt-1"
          >
            <i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i>
            Senhas não conferem
          </div>

          <button
            type="submit"
            class="btn btn-primary w-100 py-2 mt-3"
            :disabled="carregando || !formularioValido"
          >
            <span
              v-if="carregando"
              class="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
            {{ carregando ? 'Redefinindo...' : 'Redefinir senha' }}
          </button>
        </form>

        <router-link
          to="/"
          class="d-block text-center mt-3 small link-offset-2"
          style="text-decoration: none"
        >
          <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
          Voltar para o login
        </router-link>

        <router-link
          to="/solicitar-codigo"
          class="d-block text-center mt-1 small link-offset-2"
          style="text-decoration: none"
        >
          Ainda não solicitou? Pedir código à administração
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
