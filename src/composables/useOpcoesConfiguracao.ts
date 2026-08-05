import { ref } from 'vue';
import { supabaseClient } from '@/servicos/supabase';
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
      const { data } = await supabaseClient
        .from('opcoes_configuracao')
        .select('chave, rotulo, icone')
        .eq('tipo', tipo)
        .eq('ativo', true)
        .order('ordem');

      const opcoes: OpcaoCheckbox[] = (data ?? []).map(
        (o: Pick<OpcaoConfiguracao, 'chave' | 'rotulo' | 'icone'>) => ({
          valor: o.chave,
          rotulo: o.rotulo,
          icone: o.icone ?? undefined,
        }),
      );

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
