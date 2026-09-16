import { onScopeDispose, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue';
import {
  consultar,
  observar,
  recarregar as recarregarConsulta,
  type OpcoesConsulta,
  type SnapshotConsulta,
} from '@/servicos/cache';

export interface ResultadoConsulta<T> {
  dados: ShallowRef<T | undefined>;
  erro: ShallowRef<unknown>;
  atualizando: Ref<boolean>;
  pendente: Ref<boolean>;
  atualizadoEm: Ref<number | null>;
  recarregar: (forcar?: boolean) => Promise<void>;
}

/**
 * Mantém uma consulta do cache sincronizada com o componente.
 * A chave é recalculada a cada mudança de parâmetro reativo e a assinatura é trocada quando muda.
 */
export function useConsulta<T>(obter: () => OpcoesConsulta<T>): ResultadoConsulta<T> {
  const dados = shallowRef<T | undefined>(undefined);
  const erro = shallowRef<unknown>(null);
  const atualizando = ref(false);
  const pendente = ref(true);
  const atualizadoEm = ref<number | null>(null);

  let assinaturaAtual: string | null = null;
  let cancelar: (() => void) | null = null;

  function aplicar(estado: SnapshotConsulta<T>): void {
    dados.value = estado.dados;
    erro.value = estado.erro;
    atualizando.value = estado.atualizando;
    pendente.value = estado.pendente;
    atualizadoEm.value = estado.atualizadoEm;
  }

  function limpar(): void {
    cancelar?.();
    cancelar = null;
  }

  watch(
    obter,
    (opcoes) => {
      if (opcoes.habilitado === false) {
        limpar();
        assinaturaAtual = null;
        aplicar({
          dados: undefined,
          erro: null,
          atualizando: false,
          pendente: false,
          atualizadoEm: null,
        });
        return;
      }

      const assinatura = `${opcoes.namespace ?? ''}|${opcoes.chave}`;

      if (assinatura === assinaturaAtual) {
        aplicar(consultar(opcoes));
        return;
      }

      limpar();
      assinaturaAtual = assinatura;
      aplicar(consultar(opcoes));
      cancelar = observar(opcoes, aplicar);
    },
    { immediate: true },
  );

  onScopeDispose(limpar);

  function recarregar(forcar = true): Promise<void> {
    const opcoes = obter();
    return recarregarConsulta(opcoes.chave, forcar, opcoes.namespace);
  }

  return { dados, erro, atualizando, pendente, atualizadoEm, recarregar };
}
