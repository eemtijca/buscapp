import { ref, watch, type Ref } from 'vue';

// Cria um ref com valor debounced para buscas em combobox
export function useDebounce<T>(fonte: Ref<T>, atraso = 300): Ref<T> {
  const debounced = ref(fonte.value) as Ref<T>;
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(fonte, (novo) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      debounced.value = novo;
    }, atraso);
  });

  return debounced;
}

// Debounce simples para funções assíncronas
export function debounce<F extends (...args: unknown[]) => unknown>(
  fn: F,
  atraso = 300,
): (...args: Parameters<F>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, atraso);
  };
}
