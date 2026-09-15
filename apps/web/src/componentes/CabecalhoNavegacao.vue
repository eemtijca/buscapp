<script setup lang="ts">
import { computed } from 'vue';
import type { LinkNav, DropdownItem } from '@/tipos/componentes';

const props = withDefaults(
  defineProps<{
    variante: 'dashboard' | 'simples' | 'centralizado' | 'autenticacao' | 'escuro' | 'avatar';
    itens: LinkNav[];
    marca?: string;
    nomeUsuario?: string;
    avatarSrc?: string;
    itensDropdown?: DropdownItem[];
    placeholderPesquisa?: string;
    rotuloEntrar?: string;
    rotuloCadastrar?: string;
    pesquisaAriaLabel?: string;
    tituloPagina?: string;
    subtituloPagina?: string;
    alvoOffcanvas?: string;
    rotaMarca?: string;
  }>(),
  {
    marca: '',
    nomeUsuario: '',
    avatarSrc: '',
    itensDropdown: () => [],
    placeholderPesquisa: '',
    rotuloEntrar: '',
    rotuloCadastrar: '',
    pesquisaAriaLabel: '',
    tituloPagina: '',
    subtituloPagina: '',
    alvoOffcanvas: 'barraLateralOffcanvas',
    rotaMarca: '',
  },
);

const classesHeader = computed(() => {
  switch (props.variante) {
    case 'simples':
      return 'd-flex flex-wrap justify-content-center py-3 mb-4 border-bottom';
    case 'centralizado':
      return 'd-flex justify-content-center py-3';
    case 'autenticacao':
      return 'd-flex flex-wrap align-items-center justify-content-center justify-content-md-between py-3 mb-4 border-bottom';
    case 'escuro':
      return 'p-3 text-bg-dark';
    case 'avatar':
      return 'p-3 mb-3 border-bottom';
    case 'dashboard':
      return 'navbar navbar-dark bg-primary flex-md-nowrap p-0 shadow-sm';
    default:
      return '';
  }
});

const navClasse = computed(() => {
  if (props.variante === 'centralizado') return 'nav nav-pills';
  if (props.variante === 'simples') return 'nav nav-pills';
  if (props.variante === 'autenticacao')
    return 'nav col-12 col-md-auto mb-2 justify-content-center mb-md-0';
  if (props.variante === 'escuro')
    return 'nav col-12 col-lg-auto me-lg-auto mb-2 justify-content-center mb-md-0';
  if (props.variante === 'avatar')
    return 'nav col-12 col-lg-auto me-lg-auto mb-2 justify-content-center mb-md-0';
  return 'nav nav-pills';
});

const linkClasse = computed(() => {
  return (item: LinkNav) => {
    if (props.variante === 'simples') return item.ativo ? 'nav-link active' : 'nav-link';
    if (props.variante === 'centralizado') return item.ativo ? 'nav-link active' : 'nav-link';
    if (props.variante === 'autenticacao') {
      return `nav-link px-2${item.ativo ? ' link-secondary' : ''}`;
    }
    if (props.variante === 'escuro') {
      return `nav-link px-2${item.ativo ? ' text-secondary' : ' text-white'}`;
    }
    if (props.variante === 'avatar') {
      return `nav-link px-2${item.ativo ? ' link-secondary' : ' link-body-emphasis'}`;
    }
    return 'nav-link';
  };
});
</script>

<template>
  <header v-if="variante === 'dashboard'" :class="classesHeader">
    <div class="container-fluid">
      <div class="d-flex align-items-center gap-2 py-2 w-100">
        <div class="d-flex align-items-center gap-2 min-w-0 flex-grow-1 text-white">
          <i v-if="marca" class="bi bi-mortarboard" aria-hidden="true"></i>
          <router-link
            v-if="marca && rotaMarca"
            :to="rotaMarca"
            class="navbar-brand fw-semibold mb-0 lh-1 text-white text-decoration-none"
          >
            {{ marca }}
          </router-link>
          <span v-else-if="marca" class="navbar-brand fw-semibold mb-0 lh-1">{{ marca }}</span>
        </div>

        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          <slot name="usuario" />
        </div>
      </div>
    </div>
  </header>

  <header v-else-if="variante === 'escuro'" :class="classesHeader">
    <div class="container">
      <div
        class="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start"
      >
        <a
          v-if="marca"
          href="/"
          class="d-flex align-items-center mb-2 mb-lg-0 text-white text-decoration-none"
        >
          <span class="fs-4">{{ marca }}</span>
        </a>
        <ul :class="navClasse">
          <li v-for="item in itens" :key="item.rotulo">
            <a :href="item.url" :class="linkClasse(item)">{{ item.rotulo }}</a>
          </li>
        </ul>
        <form class="col-12 col-lg-auto mb-3 mb-lg-0 me-lg-3" role="search">
          <input
            type="search"
            class="form-control form-control-dark text-bg-dark"
            :placeholder="placeholderPesquisa"
            :aria-label="pesquisaAriaLabel || placeholderPesquisa"
          />
        </form>
        <div class="text-end">
          <slot name="acoes">
            <button v-if="rotuloEntrar" type="button" class="btn btn-outline-light me-2">
              {{ rotuloEntrar }}
            </button>
            <button v-if="rotuloCadastrar" type="button" class="btn btn-warning">
              {{ rotuloCadastrar }}
            </button>
          </slot>
        </div>
      </div>
    </div>
  </header>

  <header v-else-if="variante === 'avatar'" :class="classesHeader">
    <div class="container">
      <div
        class="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start"
      >
        <a
          v-if="marca"
          href="/"
          class="d-flex align-items-center mb-2 mb-lg-0 link-body-emphasis text-decoration-none"
        >
          <span class="fs-4">{{ marca }}</span>
        </a>
        <ul :class="navClasse">
          <li v-for="item in itens" :key="item.rotulo">
            <a :href="item.url" :class="linkClasse(item)">{{ item.rotulo }}</a>
          </li>
        </ul>
        <form class="col-12 col-lg-auto mb-3 mb-lg-0 me-lg-3" role="search">
          <input
            type="search"
            class="form-control"
            :placeholder="placeholderPesquisa"
            :aria-label="pesquisaAriaLabel || placeholderPesquisa"
          />
        </form>
        <div v-if="itensDropdown.length" class="dropdown text-end">
          <a
            href="#"
            class="d-block link-body-emphasis text-decoration-none dropdown-toggle"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <img
              v-if="avatarSrc"
              :src="avatarSrc"
              :alt="nomeUsuario"
              width="32"
              height="32"
              class="rounded-circle"
            />
          </a>
          <ul class="dropdown-menu text-small">
            <template v-for="item in itensDropdown" :key="item.rotulo">
              <li v-if="item.dividir"><hr class="dropdown-divider" /></li>
              <li v-else>
                <a class="dropdown-item" :href="item.url || '#'">{{ item.rotulo }}</a>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </div>
  </header>

  <header v-else-if="variante === 'simples'" :class="classesHeader">
    <div class="container">
      <a
        href="/"
        class="d-flex align-items-center mb-3 mb-md-0 me-md-auto link-body-emphasis text-decoration-none"
      >
        <span v-if="marca" class="fs-4">{{ marca }}</span>
      </a>
      <ul :class="navClasse">
        <li v-for="item in itens" :key="item.rotulo" class="nav-item">
          <a
            :href="item.url"
            :class="linkClasse(item)"
            :aria-current="item.ativo ? 'page' : undefined"
            >{{ item.rotulo }}</a
          >
        </li>
      </ul>
    </div>
  </header>

  <header v-else-if="variante === 'centralizado'" :class="classesHeader">
    <ul :class="navClasse">
      <li v-for="item in itens" :key="item.rotulo" class="nav-item">
        <a
          :href="item.url"
          :class="linkClasse(item)"
          :aria-current="item.ativo ? 'page' : undefined"
          >{{ item.rotulo }}</a
        >
      </li>
    </ul>
  </header>

  <header v-else-if="variante === 'autenticacao'" :class="classesHeader">
    <div class="container">
      <div class="col-md-3 mb-2 mb-md-0">
        <a v-if="marca" href="/" class="d-inline-flex link-body-emphasis text-decoration-none">
          <span class="fs-4">{{ marca }}</span>
        </a>
      </div>
      <ul :class="navClasse">
        <li v-for="item in itens" :key="item.rotulo">
          <a :href="item.url" :class="linkClasse(item)">{{ item.rotulo }}</a>
        </li>
      </ul>
      <div class="col-md-3 text-end">
        <button v-if="rotuloEntrar" type="button" class="btn btn-outline-primary me-2">
          {{ rotuloEntrar }}
        </button>
        <button v-if="rotuloCadastrar" type="button" class="btn btn-primary">
          {{ rotuloCadastrar }}
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.form-control-dark {
  border-color: var(--bs-gray);
}
.form-control-dark:focus {
  border-color: #fff;
  box-shadow: 0 0 0 0.25rem rgba(255, 255, 255, 0.25);
}
.dropdown-toggle:not(:focus) {
  outline: 0;
}

/* Barra de navegação compacta da variante de painel. */
.navbar-dark.bg-dark {
  min-height: 56px;
}

.navbar-brand {
  font-size: 1rem;
}

@media (min-width: 992px) {
  .navbar-brand {
    font-size: 1.1rem;
  }
}
</style>
