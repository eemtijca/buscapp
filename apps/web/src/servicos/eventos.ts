export type EscopoEvento = Record<string, string>;
export type OuvinteEvento = (tabela: string, escopo: EscopoEvento) => void;
export type StatusStream = 'conectado' | 'desconectado';
export type OuvinteStatus = (status: StatusStream) => void;

const ouvintes = new Set<OuvinteEvento>();
const ouvintesStatus = new Set<OuvinteStatus>();
let fonte: EventSource | null = null;
let statusAtual: StatusStream = 'desconectado';

function base(): string {
  return (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
}

function notificarStatus(status: StatusStream): void {
  statusAtual = status;
  for (const ouvinte of ouvintesStatus) ouvinte(status);
}

function garantirFonte(): void {
  if (fonte || typeof window === 'undefined') return;

  // O EventSource reconecta sozinho e aplica o próprio backoff; aqui só observamos o estado.
  fonte = new EventSource(`${base()}/api/eventos`, { withCredentials: true });

  fonte.onopen = () => notificarStatus('conectado');
  fonte.onerror = () => notificarStatus('desconectado');

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

function encerrarFonte(): void {
  if (!fonte) return;
  fonte.close();
  fonte = null;
  notificarStatus('desconectado');
}

/** Registra um ouvinte de invalidação; devolve a função de cancelamento. */
export function inscreverEventos(ouvinte: OuvinteEvento): () => void {
  ouvintes.add(ouvinte);
  garantirFonte();

  return () => {
    ouvintes.delete(ouvinte);
    if (!ouvintes.size) encerrarFonte();
  };
}

/** Registra um ouvinte de status da conexão; devolve a função de cancelamento. */
export function inscreverStatus(ouvinte: OuvinteStatus): () => void {
  ouvintesStatus.add(ouvinte);
  ouvinte(statusAtual);

  return () => {
    ouvintesStatus.delete(ouvinte);
  };
}
