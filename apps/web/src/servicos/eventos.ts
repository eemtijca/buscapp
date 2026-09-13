export type EscopoEvento = Record<string, string>;
export type OuvinteEvento = (tabela: string, escopo: EscopoEvento) => void;

const ouvintes = new Set<OuvinteEvento>();
let fonte: EventSource | null = null;

function base(): string {
  return (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
}

function garantirFonte(): void {
  if (fonte || typeof window === 'undefined') return;

  // O EventSource reconecta sozinho; o backoff é delegado ao navegador.
  fonte = new EventSource(`${base()}/api/eventos`, { withCredentials: true });

  fonte.addEventListener('invalidar', (evento) => {
    try {
      const dados = JSON.parse((evento as MessageEvent).data) as {
        tabela?: string;
        escopo?: EscopoEvento;
      };
      if (!dados.tabela) return;
      for (const ouvinte of ouvintes) ouvinte(dados.tabela, dados.escopo ?? {});
    } catch {
      /* evento malformado é ignorado */
    }
  });
}

/** Registra um ouvinte de invalidação; devolve a função de cancelamento. */
export function inscreverEventos(ouvinte: OuvinteEvento): () => void {
  ouvinteAtivo(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
    if (!ouvintes.size && fonte) {
      fonte.close();
      fonte = null;
    }
  };
}

function ouvinteAtivo(ouvinte: OuvinteEvento): void {
  ouvintes.add(ouvinte);
  garantirFonte();
}
