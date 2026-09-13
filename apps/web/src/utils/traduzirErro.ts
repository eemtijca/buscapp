import { ErroApi } from '@/servicos/api';

interface ErroTraduzido {
  mensagem: string;
  tempo?: number;
}

const MENSAGEM_CONEXAO =
  'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';

function extrairMensagem(erroDesconhecido: unknown): string {
  if (typeof erroDesconhecido === 'string') return erroDesconhecido;
  if (erroDesconhecido instanceof Error) return erroDesconhecido.message;
  if (erroDesconhecido && typeof erroDesconhecido === 'object') {
    const mensagem = (erroDesconhecido as { message?: unknown }).message;
    if (typeof mensagem === 'string') return mensagem;
  }
  return '';
}

/** Falhas de rede do fetch são TypeError ou trazem mensagens conhecidas do navegador. */
function ehErroDeRede(erroDesconhecido: unknown, mensagem: string): boolean {
  return (
    erroDesconhecido instanceof TypeError ||
    mensagem.includes('Failed to fetch') ||
    mensagem.includes('NetworkError') ||
    mensagem.includes('Load failed')
  );
}

export function traduzirErro(erroDesconhecido: unknown): ErroTraduzido {
  // A API devolve mensagens em português no envelope { erro: { codigo, mensagem } }.
  if (erroDesconhecido instanceof ErroApi) {
    return { mensagem: erroDesconhecido.message };
  }

  const mensagem = extrairMensagem(erroDesconhecido);

  if (ehErroDeRede(erroDesconhecido, mensagem)) {
    return { mensagem: MENSAGEM_CONEXAO };
  }

  if (mensagem) {
    return { mensagem };
  }

  return { mensagem: 'Ocorreu um erro inesperado. Tente novamente.' };
}
