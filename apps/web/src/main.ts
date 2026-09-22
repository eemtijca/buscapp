import '@fontsource-variable/noto-sans';
import '@fontsource-variable/noto-sans/wght-italic.css';
import '@fontsource-variable/noto-sans-display';
import '@fontsource-variable/noto-sans-display/wght-italic.css';
import '@fontsource-variable/noto-sans-mono';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@/assets/cores.css';

import { createApp } from 'vue';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import router from './rotas';
import { definirTratadorSessaoInvalida, inicializarCache } from '@/servicos/cache';
import { tratarSessaoExpirada } from '@/composables/useAutenticacao';

registerSW({ immediate: true });

inicializarCache();
definirTratadorSessaoInvalida(() => {
  void tratarSessaoExpirada().then(() => router.push('/'));
});

const app = createApp(App);

app.use(router);

app.mount('#app');
