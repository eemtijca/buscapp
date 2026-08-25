import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

/** Expõe na variável CSS --altura-cartao a maior altura entre os filhos do contêiner. */
export function useAlturaUniformeCards(
  containerRef: Ref<HTMLElement | null>,
  seletor = '.cartao-selecao',
) {
  const altura = ref<number | null>(null);
  let observer: ResizeObserver | null = null;

  function medir() {
    const c = containerRef.value;
    if (!c) {
      altura.value = null;
      return;
    }
    let max = 0;
    c.querySelectorAll<HTMLElement>(seletor).forEach((el) => {
      max = Math.max(max, el.offsetHeight);
    });
    altura.value = max > 0 ? max : null;
  }

  function iniciar() {
    medir();
    if (containerRef.value && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(medir);
      observer.observe(containerRef.value);
    }
  }

  function parar() {
    observer?.disconnect();
    observer = null;
  }

  watch(containerRef, (novo, antigo) => {
    if (antigo && observer) observer.unobserve(antigo);
    if (novo) {
      medir();
      if (observer) observer.observe(novo);
    }
  });

  onMounted(iniciar);
  onBeforeUnmount(parar);

  return { altura };
}
