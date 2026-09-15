import { ref } from 'vue';
import { api } from '@/servicos/api';
import type { OpcaoConfiguracao } from '@/tipos/database';
import type { OpcaoCheckbox } from '@/tipos/componentes';

const cache = new Map<string, OpcaoCheckbox[]>();

export function useOpcoesConfiguracao() {
  const carregando = ref(false);

  async function buscarOpcoes(tipo: string): Promise<OpcaoCheckbox[]> {
    const chaveCache = `opcoes_${tipo}`;
    if (cache.has(chaveCache)) return cache.get(chaveCache)!;

    carregando.value = true;
    try {
      const { opcoes: opcoesApi } = await api<{ opcoes: OpcaoConfiguracao[] }>('/api/opcoes', {
        parametros: { tipo, ativo: 'true' },
      });

      const opcoes: OpcaoCheckbox[] = opcoesApi.map((o) => ({
        valor: o.chave,
        rotulo: o.rotulo,
        icone: o.icone ?? undefined,
      }));

      cache.set(chaveCache, opcoes);
      return opcoes;
    } catch {
      return [];
    } finally {
      carregando.value = false;
    }
  }

  function limparCache(tipo?: string) {
    if (tipo) {
      cache.delete(`opcoes_${tipo}`);
    } else {
      cache.clear();
    }
  }

  return { buscarOpcoes, limparCache, carregando };
}
