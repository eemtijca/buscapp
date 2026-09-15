import type { Readable } from 'node:stream';

export interface UrlUpload {
  url: string;
  expiraEm: Date;
}

export interface EstatisticaObjeto {
  tamanho: number;
  mimeType: string | null;
}

export interface Armazenamento {
  salvar(chave: string, dados: Buffer, mimeType: string): Promise<void>;
  ler(chave: string): Promise<Buffer>;
  lerFluxo(chave: string): Promise<Readable>;
  remover(chave: string): Promise<void>;
  /** URL pré-assinada para o cliente enviar o arquivo direto ao provedor. */
  criarUrlUpload?(chave: string, mimeType: string): Promise<UrlUpload>;
  /** Metadados do objeto já enviado, usados para confirmar o upload direto. */
  estatistica?(chave: string): Promise<EstatisticaObjeto>;
}

/** Remove componentes de caminho que permitam escapar do diretório base. */
export function normalizarChave(chave: string): string {
  const normalizada = chave
    .replace(/\\/g, '/')
    .split('/')
    .filter((parte) => parte && parte !== '.' && parte !== '..')
    .join('/');
  if (!normalizada) throw new Error('Chave de armazenamento inválida.');
  return normalizada;
}

/** Sanitiza o nome original do arquivo para uso em chaves. */
export function nomeSeguro(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? 'arquivo';
  const limpo = base.replace(/[^A-Za-z0-9._-]/g, '_').slice(-120);
  return limpo || 'arquivo';
}
