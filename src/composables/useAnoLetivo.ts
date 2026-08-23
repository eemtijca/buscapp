import { supabaseClient } from '@/servicos/supabase';

export function useAnoLetivo() {
  async function buscarAnoLetivoAtivo(): Promise<{ id: string } | null> {
    const { data } = await supabaseClient
      .from('anos_letivos')
      .select('id')
      .eq('status', 'ativo')
      .eq('ativo', true)
      .limit(1);
    return data?.[0] ?? null;
  }

  return { buscarAnoLetivoAtivo };
}
