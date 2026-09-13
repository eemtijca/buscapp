import { api } from '@/servicos/api';
import type { AnoLetivo } from '@/tipos/database';

export function useAnoLetivo() {
  async function buscarAnoLetivoAtivo(): Promise<{ id: string } | null> {
    try {
      const { anos_letivos } = await api<{ anos_letivos: AnoLetivo[] }>('/api/anos-letivos');
      const ativo = anos_letivos.find((ano) => ano.ativo && ano.status === 'ativo');
      return ativo ? { id: ativo.id } : null;
    } catch {
      return null;
    }
  }

  return { buscarAnoLetivoAtivo };
}
