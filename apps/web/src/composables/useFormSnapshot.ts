import { computed, ref } from 'vue';

/** Snapshot baseado em JSON para detecção de alterações; pausa durante hidratação. */
export function useFormSnapshot<T extends Record<string, unknown>>(getFoto: () => T) {
  const fotoInicial = ref<string>('');
  const pausado = ref(true);

  function tirarFoto(): string {
    try {
      return JSON.stringify(getFoto());
    } catch {
      return '';
    }
  }

  function reset(): void {
    fotoInicial.value = tirarFoto();
  }

  function pausar(v: boolean): void {
    pausado.value = v;
  }

  const isDirty = computed(() => {
    if (pausado.value) return false;
    return tirarFoto() !== fotoInicial.value;
  });

  return { fotoInicial, pausado, isDirty, reset, pausar, tirarFoto };
}
